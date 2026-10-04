using System;

namespace ArisSkyve.Domain.Entities
{
    public class StoryView
    {
        public int StoryId { get; set; }
        public int ViewerId { get; set; }
        public DateTime ViewedAt { get; set; } = DateTime.UtcNow;

        public virtual Story? Story { get; set; }
        public virtual User? Viewer { get; set; }
    }
}
