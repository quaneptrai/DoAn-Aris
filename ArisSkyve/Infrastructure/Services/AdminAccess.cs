using System.Security.Claims;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;
namespace ArisSkyve.Infrastructure.Services;
// The two administrators explicitly selected by the site owner. Role comes from the DB, not a cookie.
public sealed class AdminAccess(ArisDBContext db)
{
    public static readonly string[] Emails = ["xuanthangmuoi@gmail.com", "tohkadangyeu@gmail.com"];
    public static bool IsDesignated(string? email) => Emails.Contains(email?.Trim() ?? "", StringComparer.OrdinalIgnoreCase);
    public static bool IsAdmin(User user) => user.Role == "Admin" && !user.IsSuspended && IsDesignated(user.Email);
    public async Task<User?> CurrentAsync(ClaimsPrincipal principal, CancellationToken token = default)
    {
        if (principal.Identity?.IsAuthenticated != true) return null;
        if (!int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return null;
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, token);
        return user != null && IsAdmin(user) ? user : null;
    }
}
