using System;

namespace ArisSkyve.Domain.Entities
{
    public class CompanyFollow
    {
        public int UserId { get; set; }
        public int BusinessAccountId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual User? User { get; set; }
        public virtual BussinessAccount? BusinessAccount { get; set; }
    }
}
