using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class Experiences
    {
        [Key]
        public int Id { get; set; }

        public string Role { get; set; } = string.Empty;
        public string Company { get; set; } = string.Empty;
        public string Duration { get; set; } = string.Empty;

        public int ResumeId { get; set; }
        public Resume Resume { get; set; }
    }
}
