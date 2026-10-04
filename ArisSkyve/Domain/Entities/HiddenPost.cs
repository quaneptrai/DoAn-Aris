using System;

namespace ArisSkyve.Domain.Entities
{
    public class HiddenPost
    {
        public int UserId { get; set; }
        public int PostId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual User? User { get; set; }
        public virtual Post? Post { get; set; }
    }
}
