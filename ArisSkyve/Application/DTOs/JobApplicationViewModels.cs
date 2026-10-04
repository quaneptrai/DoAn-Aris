namespace ArisSkyve.Application.DTOs
{
    public class MyApplicationItemViewModel
    {
        public int Id { get; set; }
        public int JobId { get; set; }
        public string JobTitle { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string? CompanyLogo { get; set; }
        public string? Salary { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? StatusNote { get; set; }
        public string? RejectionCategory { get; set; }
        public string? RejectionLabel { get; set; }
        public DateTime AppliedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool CanWithdraw { get; set; }
        public DateTime? InterviewAt { get; set; }
        public string? InterviewLocation { get; set; }
        public bool IsVideoCall { get; set; }
        public string InterviewResponse { get; set; } = "Pending";
        public int InterviewRound { get; set; } = 1;
        public int InterviewDurationMinutes { get; set; } = 45;
        public List<DateTime> ProposedSlots { get; set; } = new();

        public double? MatchScore { get; set; }
        public string? MatchSummary { get; set; }

        public string? OfferSalary { get; set; }
        public DateTime? OfferStartDate { get; set; }
        public DateTime? OfferExpiresAt { get; set; }
        public string? OfferResponse { get; set; }

        // Bước tiếp theo (RecruitmentFlow.ForCandidate) — hiện thành khối hành động trên thẻ.
        public string NextStepKey { get; set; } = string.Empty;
        public string NextStepTitle { get; set; } = string.Empty;
        public string NextStepText { get; set; } = string.Empty;
        public List<string> NextStepActions { get; set; } = new();
    }

    public class MyApplicationsViewModel
    {
        public List<MyApplicationItemViewModel> Applications { get; set; } = new();
    }
}
