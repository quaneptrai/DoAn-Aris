using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public static class EvaluationRecommendations
    {
        public const string Hire = "Hire";
        public const string NextRound = "NextRound";
        public const string Hold = "Hold";
        public const string Reject = "Reject";

        public static readonly HashSet<string> All = new() { Hire, NextRound, Hold, Reject };
    }

    // Phiếu đánh giá sau một vòng phỏng vấn — nội bộ nhà tuyển dụng, ứng viên không thấy.
    public class InterviewEvaluation
    {
        [Key]
        public int Id { get; set; }

        public int JobApplicationId { get; set; }
        public JobApplication JobApplication { get; set; } = null!;

        public int Round { get; set; } = 1;
        public int EvaluatorUserId { get; set; }

        // Thang 1–5.
        public int TechnicalRating { get; set; }
        public int CommunicationRating { get; set; }
        public int ProblemSolvingRating { get; set; }
        public int CultureFitRating { get; set; }

        [MaxLength(20)]
        public string Recommendation { get; set; } = EvaluationRecommendations.Hold;

        [MaxLength(1500)]
        public string? Strengths { get; set; }
        [MaxLength(1500)]
        public string? Concerns { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
