using System.ComponentModel.DataAnnotations;
namespace ArisSkyve.Domain.Entities;
public sealed class AdminAuditLog
{
    public int Id { get; set; }
    public int ActorUserId { get; set; }
    public User ActorUser { get; set; } = null!;
    public int? TargetUserId { get; set; }
    public User? TargetUser { get; set; }
    [MaxLength(64)] public string Action { get; set; } = "";
    [MaxLength(2000)] public string Detail { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
