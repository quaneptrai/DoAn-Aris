using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ArisSkyve.Domain.Entities
{
    public static class JobApplicationStatus
    {
        public const string Submitted = "Submitted";
        public const string UnderReview = "UnderReview";
        public const string Shortlisted = "Shortlisted";
        public const string InterviewScheduled = "InterviewScheduled";
        public const string Offered = "Offered";
        // Ứng viên đã nhận offer (hoặc nhà tuyển dụng ghi nhận đã tuyển ngoài hệ thống).
        public const string Hired = "Hired";
        public const string Rejected = "Rejected";
        public const string Withdrawn = "Withdrawn";

        public static readonly HashSet<string> All = new()
        {
            Submitted, UnderReview, Shortlisted, InterviewScheduled, Offered, Hired, Rejected, Withdrawn
        };

        // Trạng thái đã khép lại — không đổi lịch, không gửi offer, không rút đơn nữa.
        public static bool IsClosed(string status) =>
            status is Hired or Rejected or Withdrawn;
    }

    public static class InterviewResponses
    {
        public const string Pending = "Pending";
        public const string Accepted = "Accepted";
        public const string Declined = "Declined";
    }

    public static class OfferResponses
    {
        public const string Pending = "Pending";
        public const string Accepted = "Accepted";
        public const string Declined = "Declined";
    }

    // Nhóm lý do khi nhà tuyển dụng từ chối — có cấu trúc để ứng viên biết nên cải thiện gì
    // (Skills/Experience/Interview: kèm lộ trình kỹ năng) và để thống kê vì sao hồ sơ rơi ở mỗi tin.
    public static class RejectionCategories
    {
        public const string Skills = "Skills";
        public const string Experience = "Experience";
        public const string Interview = "Interview";
        public const string Salary = "Salary";
        public const string Location = "Location";
        public const string Filled = "Filled";
        public const string Other = "Other";

        public static readonly HashSet<string> All = new() { Skills, Experience, Interview, Salary, Location, Filled, Other };

        public static string Label(string? code) => code switch
        {
            Skills => "Kỹ năng chuyên môn chưa khớp yêu cầu",
            Experience => "Kinh nghiệm chưa đủ cho vị trí",
            Interview => "Kết quả phỏng vấn chưa đạt",
            Salary => "Kỳ vọng lương chưa khớp",
            Location => "Địa điểm hoặc thời gian làm việc chưa phù hợp",
            Filled => "Vị trí đã tuyển đủ người",
            Other => "Lý do khác",
            _ => string.Empty
        };

        // Lý do ứng viên cải thiện được bằng cách học thêm — trang ứng viên mở sẵn lộ trình kỹ năng.
        public static bool IsSkillGap(string? code) => code is Skills or Experience or Interview;
    }

    public class JobApplication
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int JobPostingId { get; set; }
        public JobPosting JobPosting { get; set; } = null!;

        // References the applicant's EmployesAccount (profile), matching the convention
        // already used by Resume.EmployeeId rather than the raw User.Id.
        [Required]
        public int ApplicantId { get; set; }
        public EmployesAccount Applicant { get; set; } = null!;

        // Nullable + SetNull on delete: an applicant may later delete/replace the resume
        // they applied with, but the submission itself (and its snapshot below) must survive.
        public int? ResumeId { get; set; }
        public Resume? Resume { get; set; }

        // Snapshot of the resume file actually submitted, taken at apply time, so later
        // edits/deletes to the candidate's live Resume record can't retroactively change
        // what a business is reviewing for this specific application.
        [MaxLength(1000)]
        public string? ResumeSnapshotUrl { get; set; }
        [MaxLength(300)]
        public string? ResumeSnapshotName { get; set; }

        [MaxLength(300)]
        public string FullName { get; set; } = string.Empty;
        [MaxLength(300)]
        public string Email { get; set; } = string.Empty;

        public string? CoverLetter { get; set; }

        // JSON array of strings, positionally aligned with JobPosting.ScreeningQuestions
        // at the time of application (mirrors the Responsibilities/Requirements JSON-list
        // convention already used on JobPosting).
        public string ScreeningAnswers { get; set; } = "[]";

        [MaxLength(30)]
        public string Status { get; set; } = JobApplicationStatus.Submitted;

        // Business-facing note attached to the current status (e.g. interview details or a
        // rejection reason) — shown back to the candidate alongside the status badge.
        public string? StatusNote { get; set; }

        // RejectionCategories — chỉ có nghĩa khi Status = Rejected.
        [MaxLength(20)]
        public string? RejectionCategory { get; set; }

        // Set together with Status when a business schedules (or reschedules) an interview —
        // StatusNote doubles as the free-text message shown alongside these two structured
        // fields (candidate-facing, via MyApplications).
        public DateTime? InterviewAt { get; set; }
        [MaxLength(500)]
        public string? InterviewLocation { get; set; }

        // When true, InterviewLocation is ignored and the interview instead happens in the
        // built-in WebRTC video room at /Interview/Room/{applicationId} (see VideoCallHub).
        public bool IsVideoCall { get; set; } = false;

        // Set when the current round is an AI video interview instead of a meeting with a person:
        // the candidate takes this InterviewKit from their application before InterviewAt (the
        // deadline). Kept as a plain id — a deleted kit just leaves the invitation unusable.
        public int? InterviewKitId { get; set; }

        // Candidate's response to the invitation — reset to Pending every time an interview
        // is (re)scheduled. Surfaced as its own "Lời mời" (Invitations) tab on the Chat page
        // rather than folded into the passive MyApplications list, since it's something the
        // candidate needs to actively act on.
        [MaxLength(20)]
        public string InterviewResponse { get; set; } = "Pending";

        // Lý do ứng viên từ chối lịch + tối đa 3 khung giờ họ đề xuất (JSON mảng ISO UTC),
        // để nhà tuyển dụng chốt lại bằng một lần bấm thay vì nhắn qua lại.
        [MaxLength(500)]
        public string? InterviewDeclineReason { get; set; }
        public string? ProposedSlotsJson { get; set; }
        public DateTime? InterviewRespondedAt { get; set; }
        public int InterviewRound { get; set; } = 1;
        public int InterviewDurationMinutes { get; set; } = 45;

        // Dấu mốc của RecruitmentReminderWorker — mỗi lần (đổi) lịch thì reset về null.
        public DateTime? Reminder24hSentAt { get; set; }
        public DateTime? Reminder1hSentAt { get; set; }
        public DateTime? FollowUpNudgedAt { get; set; }

        // Kết quả chấm CV ↔ tin của AiCore (/score-cv-for-job) cho đúng CV đã nộp. Lưu lại để
        // bảng ứng viên không phải gọi AiCore mỗi lần mở (một lần chấm mất 5–35 giây).
        public double? MatchScore { get; set; }
        [MaxLength(400)]
        public string? MatchSummary { get; set; }
        public string? MatchDetailJson { get; set; }
        public DateTime? MatchScoredAt { get; set; }
        public int MatchAttempts { get; set; }
        [MaxLength(300)]
        public string? MatchError { get; set; }

        // Offer: StatusNote vẫn là lời nhắn kèm theo; các trường dưới là phần có cấu trúc.
        [MaxLength(200)]
        public string? OfferSalary { get; set; }
        public DateTime? OfferStartDate { get; set; }
        public DateTime? OfferExpiresAt { get; set; }
        [MaxLength(20)]
        public string? OfferResponse { get; set; }
        public DateTime? OfferRespondedAt { get; set; }
        [MaxLength(500)]
        public string? OfferDeclineReason { get; set; }
        public DateTime? HiredAt { get; set; }

        public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<ApplicationEvent> Events { get; set; } = new List<ApplicationEvent>();
        public ICollection<InterviewEvaluation> Evaluations { get; set; } = new List<InterviewEvaluation>();
    }
}
