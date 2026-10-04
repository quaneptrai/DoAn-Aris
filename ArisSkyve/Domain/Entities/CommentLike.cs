using System;

namespace ArisSkyve.Domain.Entities
{
    public class CommentLike
    {
        public int CommentId { get; set; }
        public int UserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual Comment? Comment { get; set; }
        public virtual User? User { get; set; }
    }
}
