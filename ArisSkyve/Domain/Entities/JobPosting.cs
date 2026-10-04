using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ArisSkyve.Domain.Entities
{
    public class JobPosting
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(300)]
        public string Company { get; set; } = string.Empty;
        public string Responsibilities { get; set; } = "[]";
        public string Requirements { get; set; } = "[]";
        public string Benefits { get; set; } = "[]";

        [MaxLength(500)]
        public string? WorkTime { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Salary { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Experience { get; set; } = string.Empty;

        public DateTime? Deadline { get; set; }
        public string Category { get; set; } = string.Empty;
        public string Hashtags { get; set; } = "[]";

        public string LocationTags { get; set; } = "[]";

        // Optional custom questions the business wants every applicant to answer, stored
        // JSON-encoded like the other list fields on this entity (Responsibilities etc.).
        public string ScreeningQuestions { get; set; } = "[]";

        public string FullText { get; set; } = string.Empty;
        public string OriginalUrl { get; set; } = string.Empty;

        public string? FullTextEmbedding { get; set; }
        public bool isActive { get; set; } = true; 
        // Số người cần tuyển — khi số đơn "Đã tuyển" chạm mốc này, Aris gợi ý đóng tin.
        public int? Openings { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public ICollection<JobLocation> Locations { get; set; } = new List<JobLocation>();
        public int? BusinessAccountId { get; set; }
        public BussinessAccount? BusinessAccount { get; set; }
        public ICollection<JobApplication> Applications { get; set; } = new List<JobApplication>();
    }
}
