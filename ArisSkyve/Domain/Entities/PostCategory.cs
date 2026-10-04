using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class PostCategory
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public List<Post> Posts { get; set; } = new();
    }
}
