using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Services;

/// <summary>Runs an interview on Aris: what the player gets, and answers graded through <see cref="IInterviewEngine"/>.</summary>
public sealed class InterviewSessions(ArisDBContext context, IInterviewEngine engine)
{
    public sealed record PlayerQuestion(int Id, int Position, string Text, int PrepSeconds, int AnswerSeconds, int Retakes, string? Clip);

    /// <summary>Everything the player needs. Answer keys and key points are never part of it.</summary>
    public sealed record PlayerPlan(int SessionId, string Title, string Company, IReadOnlyDictionary<string, string?> Clips, IReadOnlyList<PlayerQuestion> Questions, int MaxSupplements);

    public static PlayerPlan Plan(InterviewKit kit, string company, int sessionId)
    {
        string? Url(string kind, int? questionId = null) => kit.Videos.FirstOrDefault(v => v.Kind == kind && v.QuestionId == questionId)?.Url;
        var clips = InterviewKitVideo.Kinds.Where(kind => kind != InterviewKitVideo.KindQuestion).ToDictionary(kind => kind, kind => Url(kind));
        var questions = kit.Questions.OrderBy(q => q.Position)
            .Select(q => new PlayerQuestion(q.Id, q.Position, q.Question, q.PrepSeconds, q.AnswerSeconds, q.Retakes, Url(InterviewKitVideo.KindQuestion, q.Id)))
            .ToList();
        return new PlayerPlan(sessionId, kit.Title, company, clips, questions, InterviewProductionSettings.Of(kit).MaxSupplements);
    }

    public async Task<InterviewKitSession> StartAsync(InterviewKit kit, int userId, bool isEmployerTest, CancellationToken cancellationToken)
    {
        var session = new InterviewKitSession { KitId = kit.Id, UserId = userId, IsEmployerTest = isEmployerTest };
        context.InterviewKitSessions.Add(session);
        await context.SaveChangesAsync(cancellationToken);
        return session;
    }

    public Task<InterviewKitSession?> FindAsync(int kitId, int sessionId, int userId, CancellationToken cancellationToken) =>
        context.InterviewKitSessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.KitId == kitId && s.UserId == userId, cancellationToken);

    /// <summary>Grades one answer; answering the same question again replaces the earlier result.</summary>
    public async Task<InterviewAnswerResult?> AnswerAsync(InterviewKit kit, InterviewKitSession session, int questionId, string? transcript, CancellationToken cancellationToken, int? recordingId = null, bool supplement = false)
    {
        if (session.CompletedAtUtc != null) return null;
        var question = kit.Questions.FirstOrDefault(q => q.Id == questionId);
        if (question == null) return null;
        var answers = InterviewJson.Answers(session.AnswersJson);
        var previous = answers.FirstOrDefault(a => a.QuestionId == questionId);
        if (answers.Any(a => kit.Questions.FirstOrDefault(q => q.Id == a.QuestionId)?.Position > question.Position)) return null;
        if (supplement && (previous == null || previous.Supplements >= InterviewProductionSettings.Of(kit).MaxSupplements)) return null;
        if (!supplement && previous != null && previous.Attempts > question.Retakes) return null;
        if (recordingId != null && !await context.InterviewKitRecordings.AnyAsync(r => r.Id == recordingId && r.SessionId == session.Id && r.QuestionId == questionId, cancellationToken)) return null;
        var text = supplement ? previous!.Transcript + "\n" + transcript : transcript ?? "";
        var result = await engine.GradeAsync(question, text, kit.PassPercent, cancellationToken);
        var recordingIds = supplement ? (previous!.RecordingIds ?? (previous.RecordingId is int oldId ? new[] { oldId } : Array.Empty<int>())).ToList() : new List<int>();
        if (recordingId is int newId && !recordingIds.Contains(newId)) recordingIds.Add(newId);
        result = result with { RecordingId = recordingIds.Count > 0 ? recordingIds[^1] : null, RecordingIds = recordingIds, Attempts = supplement ? previous!.Attempts : (previous?.Attempts ?? 0) + 1, Supplements = (previous?.Supplements ?? 0) + (supplement ? 1 : 0) };
        answers.RemoveAll(a => a.QuestionId == questionId);
        answers.Add(result);
        session.AnswersJson = InterviewJson.Write(answers);
        await context.SaveChangesAsync(cancellationToken);
        return result;
    }

    public async Task FinishAsync(InterviewKit kit, InterviewKitSession session, CancellationToken cancellationToken)
    {
        if (session.CompletedAtUtc != null) return;
        var answers = InterviewJson.Answers(session.AnswersJson);
        // Unanswered questions count as zero.
        session.Score = InterviewProductionSettings.TotalScore(kit, answers);
        session.CompletedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
    }
    public string Action(InterviewKit kit, InterviewAnswerResult result) => !result.Passed && result.Score > 0 && result.Supplements < InterviewProductionSettings.Of(kit).MaxSupplements ? "supplement" : "next";
}
