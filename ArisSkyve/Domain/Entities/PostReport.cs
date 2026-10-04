using System;
using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class PostReport
    {
        [Key]
        public int Id { get; set; }
        public int PostId { get; set; }
        public int ReporterId { get; set; }
        public string Reason { get; set; } = "";
        public string? Detail { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string Status { get; set; } = "Pending";

        public virtual Post? Post { get; set; }
        public virtual User? Reporter { get; set; }
    }
}
