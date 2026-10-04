using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public static class ApplicationEventTypes
    {
        public const string Applied = "Applied";
        public const string StatusChanged = "StatusChanged";
        public const string InterviewScheduled = "InterviewScheduled";
        public const string InterviewAccepted = "InterviewAccepted";
        public const string InterviewDeclined = "InterviewDeclined";
        public const string Evaluated = "Evaluated";
        public const string OfferSent = "OfferSent";
        public const string OfferAccepted = "OfferAccepted";
        public const string OfferDeclined = "OfferDeclined";
        public const string Rejected = "Rejected";
        public const string Withdrawn = "Withdrawn";
        public const string Reminder = "Reminder";
    }

    // Lịch sử một đơn ứng tuyển — nguồn cho dòng thời gian ở cả hai phía.
    // IsInternal = true: chỉ nhà tuyển dụng thấy (vd. phiếu đánh giá phỏng vấn).
    public class ApplicationEvent
    {
        [Key]
        public int Id { get; set; }

        public int JobApplicationId { get; set; }
        public JobApplication JobApplication { get; set; } = null!;

        [MaxLength(40)]
        public string Type { get; set; } = string.Empty;

        // Candidate | Employer | System
        [MaxLength(20)]
        public string ActorRole { get; set; } = "System";
        public int? ActorUserId { get; set; }

        [MaxLength(300)]
        public string Title { get; set; } = string.Empty;
        public string? Detail { get; set; }

        public bool IsInternal { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
