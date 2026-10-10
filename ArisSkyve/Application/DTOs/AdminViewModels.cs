using System.ComponentModel.DataAnnotations;
using ArisSkyve.Domain.Entities;
namespace ArisSkyve.Application.DTOs;
public sealed class SupportRequestForm
{
    [Required, RegularExpression("^(credits|bug|support)$")] public string Kind { get; set; } = "support";
    [Required, StringLength(2000, MinimumLength = 10)] public string Message { get; set; } = "";
    [Range(1, 10000)] public int? Credits { get; set; }
}
public sealed class SupportViewModel
{
    public List<SupportRequest> Requests { get; set; } = [];
    public SupportRequestForm Form { get; set; } = new();
    public string? Error { get; set; }
}
public sealed class AdminIndexViewModel
{
    public string Tab { get; set; } = "requests";
    public string? Search { get; set; }
    public string? Filter { get; set; }
    public int Page { get; set; } = 1;
    public bool HasNext { get; set; }
    public int Users { get; set; }
    public int Businesses { get; set; }
    public int Pending { get; set; }
    public int Kits { get; set; }
    public List<SupportRequest> Requests { get; set; } = [];
    public List<AdminUserRow> Accounts { get; set; } = [];
    public List<AdminKitRow> Interviews { get; set; } = [];
    public List<AdminAuditLog> Audit { get; set; } = [];
}
public sealed record AdminUserRow(int Id, string Username, string Email, string Role, bool IsSuspended, string? CompanyName, int Kits);
public sealed record AdminKitRow(int Id, string Title, string Company, int BusinessAccountId, int UserId, bool InviteOpen, int Questions, int Videos, int Sessions);
