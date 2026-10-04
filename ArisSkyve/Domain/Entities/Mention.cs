using System;
using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class Mention
    {
        [Key]
        public int Id { get; set; }
        public int? PostId { get; set; }
        public int? CommentId { get; set; }
        public int MentionedUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual Post? Post { get; set; }
        public virtual Comment? Comment { get; set; }
        public virtual User? MentionedUser { get; set; }
    }
}
