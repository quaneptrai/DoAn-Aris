using System;

namespace ArisSkyve.Domain.Entities
{
    public class DismissedSuggestion
    {
        public int UserId { get; set; }
        public int SuggestedUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual User? User { get; set; }
        public virtual User? SuggestedUser { get; set; }
    }
}
