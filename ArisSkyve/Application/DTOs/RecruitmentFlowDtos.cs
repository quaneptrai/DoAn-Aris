namespace ArisSkyve.Application.DTOs
{
    public class SubmitEvaluationDto
    {
        public int TechnicalRating { get; set; }
        public int CommunicationRating { get; set; }
        public int ProblemSolvingRating { get; set; }
        public int CultureFitRating { get; set; }
        public string Recommendation { get; set; } = string.Empty;
        public string? Strengths { get; set; }
        public string? Concerns { get; set; }
    }

    public class SendOfferDto
    {
        public string? Salary { get; set; }
        public DateTime? StartDate { get; set; }
        // Hạn ứng viên trả lời; null = 7 ngày.
        public DateTime? ExpiresAt { get; set; }
        public string? Note { get; set; }
    }

    public class RespondDecisionDto
    {
        public bool Accept { get; set; }
        public string? Reason { get; set; }
        // Chỉ dùng khi từ chối lịch phỏng vấn: tối đa 3 khung giờ ứng viên rảnh (ISO).
        public List<DateTime>? ProposedSlots { get; set; }
    }
}
