using System;

namespace ArisSkyve.Domain.Entities
{
    /// <summary>
    /// An emoji reaction to a chat message. Each participant has at most one reaction per
    /// message: picking another emoji replaces it, picking the same one removes it.
    /// </summary>
    public class MessageReaction
    {
        public int MessageId { get; set; }
        public int UserId { get; set; }
        public string Emoji { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual Message? Message { get; set; }
        public virtual User? User { get; set; }
    }
}
