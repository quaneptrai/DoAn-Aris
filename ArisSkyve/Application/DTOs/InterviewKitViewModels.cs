using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Services;

namespace ArisSkyve.Application.DTOs
{
    public class InterviewFlowIndexViewModel
    {
        public string CompanyName { get; set; } = string.Empty;
        public List<InterviewKitSummary> Kits { get; set; } = new();
        public string? Error { get; set; }
    }

    public class InterviewKitSummary
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public int QuestionCount { get; set; }
        public int VideoCount { get; set; }
        public int SessionCount { get; set; }
        public bool InviteOpen { get; set; }
        public DateTime UpdatedAtUtc { get; set; }
    }

    public class InterviewKitEditViewModel
    {
        public string CompanyName { get; set; } = string.Empty;
        public InterviewKitForm Form { get; set; } = new();
        public string? AvatarDataUrl { get; set; }
        public bool CanRenderAvatar { get; set; }
        public string? RunningAvatarJobId { get; set; }
        public List<InterviewKitVideo> Videos { get; set; } = new();
        public List<InterviewScriptClip> Script { get; set; } = new();
        public bool ScriptApproved { get; set; }
        /// <summary>Whether clips can be made automatically on this server (the service itself is never named).</summary>
        public bool CanRenderVideo { get; set; }
        public bool CanSpeak { get; set; }
        /// <summary>A batch of clips being made right now; the page resumes its progress.</summary>
        public string? RunningBatchId { get; set; }
        public string? RunningVideoJobId { get; set; }
        /// <summary>All video slots of the kit: the shared states plus one per question.</summary>
        public int SlotCount { get; set; }
        public string? InviteUrl { get; set; }
        public List<InterviewSessionSummary> Sessions { get; set; } = new();
        public string? Error { get; set; }
    }

    public class InterviewSessionSummary
    {
        public int Id { get; set; }
        public string CandidateName { get; set; } = string.Empty;
        public string CandidateEmail { get; set; } = string.Empty;
        public bool IsEmployerTest { get; set; }
        public DateTime StartedAtUtc { get; set; }
        public DateTime? CompletedAtUtc { get; set; }
        public double? Score { get; set; }
        public List<InterviewAnswerResult> Answers { get; set; } = new();
    }

    public class InterviewKitForm
    {
        public int? Id { get; set; }
        public string? Title { get; set; }
        public string? Persona { get; set; }
        public string? Scene { get; set; }
        public int PassPercent { get; set; } = 70;
        public bool RemoveAvatar { get; set; }
        public bool UseDefaultAvatar { get; set; }
        public InterviewProductionSettings Production { get; set; } = new();
        public List<InterviewQuestionForm> Questions { get; set; } = new();
    }

    public class InterviewQuestionForm
    {
        public int? Id { get; set; }
        public string? Question { get; set; }
        public string? AnswerKey { get; set; }
        public string? KeyPoints { get; set; }
        public string? Code { get; set; }
        public double Weight { get; set; } = 1;
        public string? PointWeights { get; set; }
        public int PrepSeconds { get; set; } = 10;
        public int AnswerSeconds { get; set; } = 90;
        public int Retakes { get; set; } = 1;
    }

    public sealed record InterviewClipSlotModel(InterviewKitVideo? Video, string Label, string Hint, string Kind, int? QuestionId, int KitId, bool CanGenerate);

    /// <summary>The page used by both a candidate and the employer's own test run.</summary>
    public class InterviewPlayerViewModel
    {
        public string Title { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public int QuestionCount { get; set; }
        /// <summary>Base path of the Start/Answer/Finish endpoints.</summary>
        public string Endpoint { get; set; } = string.Empty;
        public bool IsEmployerTest { get; set; }
        public bool AlreadyCompleted { get; set; }
        public string? BackUrl { get; set; }
    }
}
