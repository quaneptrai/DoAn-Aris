using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Services.Recruitment
{
    public sealed record AiInterviewInfo(int KitId, string KitTitle, AiInterviewOutcome? Outcome);

    // AI interview rounds of job applications: which kit the candidate was sent and, once they
    // finished it from their application, the score against the kit's pass mark.
    public static class AiInterviews
    {
        public static string CandidateUrl(int applicationId) => $"/InterviewKit/Application/{applicationId}";

        public static string ResultsUrl(int kitId) => $"/Employer/InterviewFlow/{kitId}#candidates";

        // One query for the kits and one for the finished sessions, whatever the number of applications.
        public static async Task<Dictionary<int, AiInterviewInfo>> LoadAsync(ArisDBContext db, IEnumerable<JobApplication> applications, CancellationToken cancellationToken = default)
        {
            var invited = applications.Where(a => a.InterviewKitId != null).ToList();
            if (invited.Count == 0) return new();
            var kitIds = invited.Select(a => a.InterviewKitId!.Value).Distinct().ToList();
            var applicationIds = invited.Select(a => a.Id).ToList();
            var kits = await db.InterviewKits.AsNoTracking()
                .Where(k => kitIds.Contains(k.Id))
                .Select(k => new { k.Id, k.Title, k.PassPercent })
                .ToDictionaryAsync(k => k.Id, cancellationToken);
            var finished = await db.InterviewKitSessions.AsNoTracking()
                .Where(s => s.JobApplicationId != null && applicationIds.Contains(s.JobApplicationId.Value) && s.CompletedAtUtc != null)
                .Select(s => new { ApplicationId = s.JobApplicationId!.Value, s.KitId, s.Score, CompletedAtUtc = s.CompletedAtUtc!.Value })
                .ToListAsync(cancellationToken);
            return invited
                .Where(a => kits.ContainsKey(a.InterviewKitId!.Value))
                .ToDictionary(a => a.Id, a =>
                {
                    var kit = kits[a.InterviewKitId!.Value];
                    var done = finished.Where(s => s.ApplicationId == a.Id && s.KitId == kit.Id).MaxBy(s => s.CompletedAtUtc);
                    var score = done?.Score ?? 0;
                    return new AiInterviewInfo(kit.Id, kit.Title, done == null ? null : new AiInterviewOutcome(score, score >= kit.PassPercent, done.CompletedAtUtc));
                });
        }
    }
}
