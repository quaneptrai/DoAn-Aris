using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public static class FriendshipStatus
    {
        public const string Pending = "Pending";
        public const string Accepted = "Accepted";
    }

    // One row per relationship pair. Declined/cancelled/unfriended relationships are
    // deleted outright rather than kept as a third status — nothing downstream needs to
    // remember a friendship that no longer exists, and it lets people re-request freely.
    public class Friendship
    {
        [Key]
        public int Id { get; set; }

        public int RequesterId { get; set; }
        public User Requester { get; set; } = null!;

        public int AddresseeId { get; set; }
        public User Addressee { get; set; } = null!;

        [MaxLength(20)]
        public string Status { get; set; } = FriendshipStatus.Pending;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? RespondedAt { get; set; }
    }
}
