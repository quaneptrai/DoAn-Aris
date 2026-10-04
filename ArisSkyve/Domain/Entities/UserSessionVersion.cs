using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ArisSkyve.Domain.Entities
{
    public class UserSessionVersion
    {
        [Key, ForeignKey(nameof(User))]
        public int UserId { get; set; }

        public string Version { get; set; } = Guid.NewGuid().ToString("N");
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public virtual User? User { get; set; }
    }
}
