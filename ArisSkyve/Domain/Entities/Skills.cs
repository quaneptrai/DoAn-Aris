using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class Skills
    {
        [Key]
        public int Id { get; set; }

        public string SkillName { get; set; } = string.Empty;

        public int ResumeId { get; set; }
        public Resume Resume { get; set; }
    }
}
