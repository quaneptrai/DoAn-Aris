using System;
using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class Story
    {
        [Key]
        public int Id { get; set; }
        public int UserId { get; set; }
        public string MediaUrl { get; set; } = "";
        public string MediaType { get; set; } = "image";
        public string? Caption { get; set; }
        public string? LinkUrl { get; set; }
        public string? LinkLabel { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddHours(24);

        public virtual User? User { get; set; }
    }
}
