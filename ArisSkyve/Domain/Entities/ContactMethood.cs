using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ArisSkyve.Domain.Entities
{
    public class ContactMethood
    {
        [Key]
        public int Id { get; set; }

        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;

        public string Note { get; set; } = string.Empty;

        public string FullText { get; set; } = string.Empty;

        [Column(TypeName = "float[]")]
        public float[]? Embedding { get; set; }

        public List<Skills> Skills { get; set; } = new List<Skills>();
        public List<Experiences> Experiences { get; set; } = new List<Experiences>();
        public List<Education> Educations { get; set; } = new List<Education>();
        public List<ContactMethod> ContactMethods { get; set; } = new List<ContactMethod>();
    }
}
