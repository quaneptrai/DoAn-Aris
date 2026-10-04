using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ArisSkyve.Domain.Entities
{
    public class PostExtra
    {
        [Key, ForeignKey(nameof(Post))]
        public int PostId { get; set; }

        public string? AspectRatio { get; set; } // '1:1' | '4:5' | '16:9'

        public int? JobPostingId { get; set; }
        public int? RepostOfId { get; set; }

        public virtual Post? Post { get; set; }
        public virtual JobPosting? JobPosting { get; set; }
        public virtual Post? RepostOf { get; set; }
    }
}
