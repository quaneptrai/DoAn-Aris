using System.Security.Claims;
using System.Text.RegularExpressions;
using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Controllers;

/// <summary>
/// The candidate's video interview, opened from the employer's link. The player
/// gets clips and question text only; answer keys, key points and per-point
/// grading stay with the employer.
/// </summary>
[Authorize]
[Route("InterviewKit")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed partial class InterviewKitController(ArisDBContext context, InterviewSessions sessions, InterviewSpeech speech) : Controller
{
    [GeneratedRegex("^[0-9a-f]{24}$")]
    private static partial Regex CodePattern();

    private int? UserId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    private async Task<InterviewKit?> KitAsync(string code, CancellationToken cancellationToken)
    {
        if (!CodePattern().IsMatch(code ?? "")) return null;
        return await context.InterviewKits
            .Include(k => k.Questions)
            .Include(k => k.Videos)
            .Include(k => k.BusinessAccount)
            .FirstOrDefaultAsync(k => k.InviteCode == code, cancellationToken);
    }

    private Task<bool> CompletedAsync(int kitId, int userId, CancellationToken cancellationToken) =>
        context.InterviewKitSessions.AnyAsync(s => s.KitId == kitId && s.UserId == userId && !s.IsEmployerTest && s.CompletedAtUtc != null, cancellationToken);

    [HttpGet("{code}")]
    public async Task<IActionResult> Index(string code, CancellationToken cancellationToken)
    {
        if (UserId is not int userId) return Challenge();
        var kit = await KitAsync(code, cancellationToken);
        if (kit == null) return View("~/Views/Employer/InterviewClosed.cshtml");
        // The kit's own employer is sent to the test run, which shows the grading.
        if (kit.BusinessAccount.UserId == userId) return Redirect($"/Employer/InterviewFlow/{kit.Id}/Try");
        return View("~/Views/Employer/InterviewPlayer.cshtml", new InterviewPlayerViewModel
        {
            Title = kit.Title,
            CompanyName = kit.BusinessAccount.CompanyName,
            QuestionCount = kit.Questions.Count,
            Endpoint = $"/InterviewKit/{code}",
            AlreadyCompleted = await CompletedAsync(kit.Id, userId, cancellationToken)
        });
    }

    public sealed class AnswerRequest
    {
        public int SessionId { get; set; }
        public int QuestionId { get; set; }
        public string? Transcript { get; set; }
        public int? RecordingId { get; set; }
        public bool Supplement { get; set; }
    }

    [HttpPost("{code}/Start")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Start(string code, CancellationToken cancellationToken)
    {
        if (UserId is not int userId) return Challenge();
        var kit = await KitAsync(code, cancellationToken);
        if (kit == null) return NotFound(new { error = "Liên kết phỏng vấn đã đóng." });
        if (await CompletedAsync(kit.Id, userId, cancellationToken)) return Conflict(new { error = "Bạn đã hoàn thành buổi phỏng vấn này." });
        var session = await sessions.StartAsync(kit, userId, isEmployerTest: false, cancellationToken);
        return Json(InterviewSessions.Plan(kit, kit.BusinessAccount.CompanyName, session.Id));
    }

    [HttpPost("{code}/Answer")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Answer(string code, [FromBody] AnswerRequest request, CancellationToken cancellationToken)
    {
        if (UserId is not int userId) return Challenge();
        var kit = await KitAsync(code, cancellationToken);
        var session = kit == null ? null : await sessions.FindAsync(kit.Id, request.SessionId, userId, cancellationToken);
        if (kit == null || session == null) return NotFound();
        var result = await sessions.AnswerAsync(kit, session, request.QuestionId, request.Transcript, cancellationToken, request.RecordingId, request.Supplement);
        // Only the reaction is revealed: which interviewer clip plays next.
        return result == null ? BadRequest(new { error = "Không thể gửi câu này hoặc đã hết số lần bổ sung/làm lại." }) : Json(new { passed = result.Passed, action = sessions.Action(kit, result) });
    }

    [HttpPost("{code}/Finish")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Finish(string code, [FromBody] AnswerRequest request, CancellationToken cancellationToken)
    {
        if (UserId is not int userId) return Challenge();
        var kit = await KitAsync(code, cancellationToken);
        var session = kit == null ? null : await sessions.FindAsync(kit.Id, request.SessionId, userId, cancellationToken);
        if (kit == null || session == null) return NotFound();
        await sessions.FinishAsync(kit, session, cancellationToken);
        return Json(new { done = true, passed = session.Score >= kit.PassPercent });
    }
}
