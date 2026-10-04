using ArisSkyve.Domain.Entities;

namespace ArisSkyve.Application.DTOs
{
    public class JobsIndexViewModel
    {
        public User User { get; set; } = default!;
        public EmployesAccount Profile { get; set; } = default!;
        public List<JobPosting> JobPostings { get; set; } = new();
        public List<JobRecommendationDTO> RecommendedJobs { get; set; } = new();
        public List<BusinessJobSummaryViewModel> MyJobPostings { get; set; } = new();
    }

    public class BusinessJobSummaryViewModel
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Salary { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsActive { get; set; }
        public int ApplicantCount { get; set; }
        public int HiredCount { get; set; }
        public int? Openings { get; set; }
        public int UnscoredCount { get; set; }
        public int ActionNeededCount { get; set; }
    }
}
