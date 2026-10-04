using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class JobLocation
    {
        public int Id { get; set; }

        [MaxLength(100)]
        public string City { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string Address { get; set; } = string.Empty;

        public int JobPostingId { get; set; }
        public JobPosting JobPosting { get; set; }
    }
}
