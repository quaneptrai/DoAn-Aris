using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities;

/// <summary>
/// An employer's video interview: the parameters, the finished clips and the
/// candidates' sessions. Scripts, renders and grading go through
/// <c>IInterviewEngine</c>, so nothing here knows which services do the work. A
/// local studio is never contacted; its output only arrives as a package file the
/// employer uploads.
/// </summary>
public sealed class InterviewKit
{
    [Key]
    public int Id { get; set; }

    public int BusinessAccountId { get; set; }

    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    /// <summary>Who the interviewer is: look, manner, voice. Part of every video prompt.</summary>
    [StringLength(2000)]
    public string? Persona { get; set; }

    /// <summary>Fixed background, framing and light shared by every clip.</summary>
    [StringLength(1000)]
    public string? Scene { get; set; }

    /// <summary>Optional reference image; when present every clip starts from it (image → video).</summary>
    public byte[]? AvatarImage { get; set; }

    [StringLength(32)]
    public string? AvatarContentType { get; set; }

    /// <summary>Average score (0–100) at or above which an answer counts as good.</summary>
    public int PassPercent { get; set; } = 70;

    /// <summary>JSON list of <c>InterviewScriptClip</c>: the spoken line and video prompt per slot.</summary>
    public string? ScriptJson { get; set; }
    public string? SettingsJson { get; set; }

    public DateTime? ScriptApprovedAtUtc { get; set; }

    /// <summary>Random code in the candidate link <c>/InterviewKit/{code}</c>; null while invitations are off.</summary>
    [StringLength(32)]
    public string? InviteCode { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public BussinessAccount BusinessAccount { get; set; } = null!;

    public List<InterviewKitQuestion> Questions { get; set; } = new();

    public List<InterviewKitVideo> Videos { get; set; } = new();

    public List<InterviewKitSession> Sessions { get; set; } = new();
}

public sealed class InterviewKitQuestion
{
    [Key]
    public int Id { get; set; }

    public int KitId { get; set; }

    public int Position { get; set; }

    [Required, StringLength(2000)]
    public string Question { get; set; } = string.Empty;

    /// <summary>The employer's correct answer; grading revolves around it.</summary>
    [StringLength(4000)]
    public string? AnswerKey { get; set; }

    /// <summary>Key points separated by ';', the rubric the grader checks.</summary>
    [StringLength(2000)]
    public string? KeyPoints { get; set; }
    [StringLength(80)]
    public string? Code { get; set; }
    public double Weight { get; set; } = 1;
    public string? PointWeights { get; set; }

    public int PrepSeconds { get; set; } = 10;

    public int AnswerSeconds { get; set; } = 90;

    public int Retakes { get; set; } = 1;

    public InterviewKit Kit { get; set; } = null!;
}

/// <summary>A finished clip for one slot of the interview. The file lives in the public media store.</summary>
public sealed class InterviewKitVideo
{
    public const string KindIntro = "intro";
    public const string KindQuestion = "question";
    public const string KindListening = "listening";
    public const string KindThinking = "thinking";
    public const string KindTransition = "transition";
    public const string KindPass = "pass";
    public const string KindFail = "fail";
    public const string KindOutro = "outro";

    public static readonly string[] Kinds = { KindIntro, KindQuestion, KindListening, KindThinking, KindTransition, KindPass, KindFail, KindOutro };

    /// <summary>Slots without speech: the interviewer only reacts.</summary>
    public static readonly string[] SilentKinds = { KindListening, KindThinking, KindPass, KindFail };
    public static readonly string[] BaseKinds = { "base-talk", "base-listen", "base-think", "base-happy", "base-concerned", "base-master" };

    [Key]
    public int Id { get; set; }

    public int KitId { get; set; }

    /// <summary>Set for <see cref="KindQuestion"/> clips only.</summary>
    public int? QuestionId { get; set; }

    [Required, StringLength(32)]
    public string Kind { get; set; } = KindQuestion;

    [Required, StringLength(512)]
    public string Url { get; set; } = string.Empty;

    /// <summary>Store object id (Drive file id, or local file name in Development).</summary>
    [Required, StringLength(256)]
    public string StorageFileId { get; set; } = string.Empty;

    [Required, StringLength(64)]
    public string ContentType { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    /// <summary>Where the clip came from: "auto", "upload" or "package".</summary>
    [StringLength(16)]
    public string? Source { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public InterviewKit Kit { get; set; } = null!;

    public InterviewKitQuestion? Question { get; set; }
}

/// <summary>One run of an interview by a candidate (or the employer's own test run).</summary>
public sealed class InterviewKitSession
{
    [Key]
    public int Id { get; set; }

    public int KitId { get; set; }

    public int UserId { get; set; }

    public bool IsEmployerTest { get; set; }

    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? CompletedAtUtc { get; set; }

    /// <summary>Average of the graded questions, 0–100.</summary>
    public double? Score { get; set; }

    /// <summary>JSON list of <c>InterviewAnswerResult</c>.</summary>
    public string? AnswersJson { get; set; }

    public InterviewKit Kit { get; set; } = null!;

    public User User { get; set; } = null!;
}

/// <summary>Private candidate audio. Only the candidate and the kit's employer may read it.</summary>
public sealed class InterviewKitRecording
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public int QuestionId { get; set; }
    [StringLength(64)] public string ContentType { get; set; } = "audio/webm";
    public byte[] Bytes { get; set; } = Array.Empty<byte>();
    public InterviewKitSession Session { get; set; } = null!;
}
