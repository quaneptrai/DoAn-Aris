namespace ArisSkyve.Application.DTOs
{
    public class EmployerDashboardViewModel
    {
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public bool IsVerified { get; set; }

        public int ActiveJobCount { get; set; }
        public int ClosedJobCount { get; set; }
        public int TotalApplicants { get; set; }
        public int NewApplicantsLast7Days { get; set; }

        public List<StatusCountViewModel> StatusBreakdown { get; set; } = new();
        public List<BusinessJobSummaryViewModel> Jobs { get; set; } = new();
    }

    public class StatusCountViewModel
    {
        public string Status { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public int Count { get; set; }
    }
}
