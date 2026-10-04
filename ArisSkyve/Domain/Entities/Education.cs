using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class Education
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string School { get; set; } = string.Empty;

        public string? Degree { get; set; }

        [Required]
        public string FieldOfStudy { get; set; } = string.Empty;

        [Required]
        public int StartYear { get; set; }
        public float GPA { get; set; }
        public int ResumeId { get; set; }
        public Resume Resume { get; set; }
        public int EmployesAccountId { get; set; }
        public EmployesAccount EmployesAccount { get; set; }
    }
}
