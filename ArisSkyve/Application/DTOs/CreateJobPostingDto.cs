namespace ArisSkyve.Application.DTOs
{
    public class CreateJobPostingDto
    {
        public string Title { get; set; } = string.Empty;
        public string Company { get; set; } = string.Empty;
        public List<string> Responsibilities { get; set; } = new();
        public List<string> Requirements { get; set; } = new();
        public List<string> Benefits { get; set; } = new();
        public List<string> WorkTime { get; set; } = new();
        public string Salary { get; set; } = string.Empty;
        public string Experience { get; set; } = string.Empty;
        public string? Deadline { get; set; }
        public string Category { get; set; } = string.Empty;
        public List<string> Keywords { get; set; } = new();
        public List<string> LocationTags { get; set; } = new();
        public List<string> Locations { get; set; } = new();
        public string FullText { get; set; } = string.Empty;
        public string? OriginalUrl { get; set; }
        public List<string> ScreeningQuestions { get; set; } = new();
        public int? Openings { get; set; }
    }
}
