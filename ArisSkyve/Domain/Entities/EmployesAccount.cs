using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class EmployesAccount
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public string FullName { get; set; } = string.Empty;
        [Required]
        public string Location { get; set; } = string.Empty;
        public string? JobTitle { get; set; } 
        public string ? Bio { get; set; } = string.Empty;
        public string? CoverPhotoUrl { get; set; }
        public bool IsLookingForJob { get; set; } = true;
        public bool ShareWithRecruiters { get; set; }
        public bool isStudent { get; set; } = false;
        public bool IsRemoteJob { get; set; } = false;
        public int UserId { get; set; }
        public string? AvatarUrl { get; set; }
        public User User { get; set; }
        public string? ResumeUrl { get; set; }
        public ICollection<ContactMethod> ContactMethods { get; set; } = new List<ContactMethod>();
        public Education? Education { get; set; }
        public virtual ICollection<Resume> Resumes { get; set; } = new List<Resume>();
        public virtual ICollection<JobApplication> Applications { get; set; } = new List<JobApplication>();
    }
}
