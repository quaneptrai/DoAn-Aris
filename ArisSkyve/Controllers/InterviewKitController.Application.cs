using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Services;
using ArisSkyve.Infrastructure.Services.Recruitment;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Controllers;

/// <summary>
/// AI interview sent from a job application. The candidate takes the employer's kit through
/// their own application, so the kit's public invite link does not have to be open, and the
/// session is tied to the application so its result shows up in the recruitment pipeline.
/// </summary>
public sealed partial class InterviewKitController
{
    private async Task<(JobApplication? Application, InterviewKit? Kit)> ApplicationKitAsync(int applicationId, int userId, CancellationToken token)
    {
        var application = await context.JobApplications
            .Include(a => a.Applicant)
            .Include(a => a.JobPosting).ThenInclude(j => j.BusinessAccount)
            .FirstOrDefaultAsync(a => a.Id == applicationId && a.Applicant.UserId == userId
                && a.Status == JobApplicationStatus.InterviewScheduled && a.InterviewKitId != null, token);
        if (application == null) return (null, null);
        var kit = await context.InterviewKits
            .AsSplitQuery()
            .Include(k => k.Questions)
            .Include(k => k.Videos)
            .Include(k => k.BusinessAccount)
            .FirstOrDefaultAsync(k => k.Id == application.InterviewKitId && k.BusinessAccountId == application.JobPosting.BusinessAccountId, token);
        return (application, kit);
    }

    private Task<bool> CompletedForApplicationAsync(int kitId, int applicationId, CancellationToken token) =>
        context.InterviewKitSessions.AnyAsync(s => s.KitId == kitId && s.JobApplicationId == applicationId && s.CompletedAtUtc != null, token);

    private async Task<InterviewKitSession?> ApplicationSessionAsync(InterviewKit kit, int applicationId, int sessionId, int userId, CancellationToken token)
    {
        var session = await sessions.FindAsync(kit.Id, sessionId, userId, token);
        return session?.JobApplicationId == applicationId ? session : null;
    }

    [HttpGet("Application/{applicationId:int}")]
    public async Task<IActionResult> ForApplication(int applicationId, CancellationToken token)
    {
        if (UserId is not int userId) return Challenge();
        var (application, kit) = await ApplicationKitAsync(applicationId, userId, token);
        if (application == null || kit == null) return View("~/Views/Employer/InterviewClosed.cshtml");
        return View("~/Views/Employer/InterviewPlayer.cshtml", new InterviewPlayerViewModel
        {
            Title = kit.Title,
            CompanyName = kit.BusinessAccount.CompanyName,
            QuestionCount = kit.Questions.Count,
            Endpoint = $"/InterviewKit/Application/{applicationId}",
            AlreadyCompleted = await CompletedForApplicationAsync(kit.Id, applicationId, token)
        });
    }

    [HttpPost("Application/{applicationId:int}/Start")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> StartForApplication(int applicationId, CancellationToken token)
    {
        if (UserId is not int userId) return Challenge();
        var (application, kit) = await ApplicationKitAsync(applicationId, userId, token);
        if (application == null || kit == null) return NotFound(new { error = "Lời mời phỏng vấn AI không còn hiệu lực." });
        if (await CompletedForApplicationAsync(kit.Id, applicationId, token)) return Conflict(new { error = "Bạn đã hoàn thành buổi phỏng vấn này." });
        if (application.InterviewAt is DateTime deadline && deadline <= DateTime.UtcNow)
            return Conflict(new { error = "Đã quá hạn làm phỏng vấn AI. Nhắn nhà tuyển dụng nếu bạn cần thêm thời gian." });
        var session = await sessions.StartAsync(kit, userId, isEmployerTest: false, token);
        session.JobApplicationId = applicationId;
        await context.SaveChangesAsync(token);
        return Json(InterviewSessions.Plan(kit, kit.BusinessAccount.CompanyName, session.Id));
    }

    [HttpPost("Application/{applicationId:int}/Answer")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AnswerForApplication(int applicationId, [FromBody] AnswerRequest request, CancellationToken token)
    {
        if (UserId is not int userId) return Challenge();
        var (_, kit) = await ApplicationKitAsync(applicationId, userId, token);
        var session = kit == null ? null : await ApplicationSessionAsync(kit, applicationId, request.SessionId, userId, token);
        if (kit == null || session == null) return NotFound();
        var result = await sessions.AnswerAsync(kit, session, request.QuestionId, request.Transcript, token, request.RecordingId, request.Supplement);
        return result == null ? BadRequest(new { error = "Không thể gửi câu này hoặc đã hết số lần bổ sung/làm lại." }) : Json(new { passed = result.Passed, action = sessions.Action(kit, result) });
    }

    [HttpPost("Application/{applicationId:int}/Recording")]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(11_000_000)]
    public async Task<IActionResult> RecordingForApplication(int applicationId, int sessionId, int questionId, bool transcribe, IFormFile audio, [FromServices] InterviewRecordingStore recordings, CancellationToken token)
    {
        if (UserId is not int userId) return Challenge();
        var (_, kit) = await ApplicationKitAsync(applicationId, userId, token);
        var session = kit == null ? null : await ApplicationSessionAsync(kit, applicationId, sessionId, userId, token);
        if (kit == null || session == null) return NotFound();
        try { return Json(await recordings.SaveAsync(kit, session, questionId, audio, transcribe, token)); }
        catch (InterviewEngineException e) { return BadRequest(new { error = e.Message }); }
    }

    [HttpPost("Application/{applicationId:int}/Finish")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> FinishForApplication(int applicationId, [FromBody] AnswerRequest request, CancellationToken token)
    {
        if (UserId is not int userId) return Challenge();
        var (application, kit) = await ApplicationKitAsync(applicationId, userId, token);
        var session = kit == null ? null : await ApplicationSessionAsync(kit, applicationId, request.SessionId, userId, token);
        if (application == null || kit == null || session == null) return NotFound();
        var firstFinish = session.CompletedAtUtc == null;
        await sessions.FinishAsync(kit, session, token);
        var passed = session.Score >= kit.PassPercent;
        if (firstFinish) await RecordAiInterviewAsync(application, kit, session, passed, userId, token);
        return Json(new { done = true, passed });
    }

    // Puts the result on the application's timeline and tells the employer, once per session.
    private async Task RecordAiInterviewAsync(JobApplication application, InterviewKit kit, InterviewKitSession session, bool passed, int userId, CancellationToken token)
    {
        var score = $"{session.Score ?? 0:0.#}/100";
        context.ApplicationEvents.Add(new ApplicationEvent
        {
            JobApplication = application,
            Type = ApplicationEventTypes.AiInterviewCompleted,
            ActorRole = "Candidate",
            ActorUserId = userId,
            Title = $"Hoàn thành phỏng vấn AI vòng {application.InterviewRound}",
            Detail = $"{kit.Title} · {score} · {(passed ? "đạt" : "chưa đạt")}",
            CreatedAt = DateTime.UtcNow
        });
        application.UpdatedAt = DateTime.UtcNow;
        var employerUserId = application.JobPosting.BusinessAccount?.UserId;
        var staged = employerUserId is int employer
            ? await NotificationWriter.StageAsync(context, employer, userId, "AiInterviewCompleted",
                $"{application.FullName} đã làm xong phỏng vấn AI \"{kit.Title}\" ({score}, {(passed ? "đạt" : "chưa đạt")}).",
                $"/Employer/Index?jobId={application.JobPostingId}&app={application.Id}")
            : null;
        await context.SaveChangesAsync(token);
        await NotificationWriter.PushAsync(NotificationWriter.HubFrom(HttpContext), context, staged);
    }
}
