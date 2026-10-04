using System;

namespace ArisSkyve.Domain.Entities
{
    public class SavedJob
    {
        public int UserId { get; set; }
        public int JobPostingId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual User? User { get; set; }
        public virtual JobPosting? JobPosting { get; set; }
    }
}
