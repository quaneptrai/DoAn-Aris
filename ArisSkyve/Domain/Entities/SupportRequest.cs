using System.ComponentModel.DataAnnotations;
namespace ArisSkyve.Domain.Entities;
public sealed class SupportRequest
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    [MaxLength(20)] public string Kind { get; set; } = "support";
    [MaxLength(2000)] public string Message { get; set; } = "";
    public int? RequestedCredits { get; set; }
    [MaxLength(20)] public string Status { get; set; } = "pending";
    [MaxLength(2000)] public string AdminReply { get; set; } = "";
    public int? HandledByUserId { get; set; }
    public User? HandledByUser { get; set; }
    public int? GrantedCredits { get; set; }
    [MaxLength(10)] public string? CreditDay { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    [ConcurrencyCheck, MaxLength(32)] public string Version { get; set; } = Guid.NewGuid().ToString("N");
}
