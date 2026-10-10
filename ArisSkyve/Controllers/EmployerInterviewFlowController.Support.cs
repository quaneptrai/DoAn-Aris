using System.Security.Claims;
using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace ArisSkyve.Controllers;
public sealed partial class EmployerInterviewFlowController
{
    [HttpGet("Support")]
    public async Task<IActionResult> Support(CancellationToken token)
    {
        var business = await BusinessAsync(token); if (business == null) return Forbid();
        return await SupportViewAsync(business.UserId, new(), null, token);
    }
    private async Task<IActionResult> SupportViewAsync(int userId, SupportRequestForm form, string? error, CancellationToken token) =>
        View("~/Views/Employer/InterviewSupport.cshtml", new SupportViewModel {
            Form = form, Error = error, Requests = await context.SupportRequests.AsNoTracking().Where(r => r.UserId == userId).OrderByDescending(r => r.Id).Take(30).ToListAsync(token)
        });
    [HttpPost("Support")]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(16000)]
    public async Task<IActionResult> SendSupport(SupportRequestForm form, CancellationToken token)
    {
        var business = await BusinessAsync(token); if (business == null) return Forbid();
        form.Message = form.Message?.Trim() ?? "";
        if (!ModelState.IsValid || form.Message.Length < 10 || form.Message.Length > 2000 || form.Kind is not ("credits" or "bug" or "support") || form.Kind == "credits" && form.Credits is not (>= 1 and <= 10000))
            return await SupportViewAsync(business.UserId, form, "Nhập nội dung từ 10 đến 2.000 ký tự; yêu cầu credit cần số lượng từ 1 đến 10.000.", token);
        var recent = DateTime.UtcNow.AddMinutes(-1);
        if (await context.SupportRequests.AnyAsync(r => r.UserId == business.UserId && r.CreatedAtUtc >= recent, token))
            return await SupportViewAsync(business.UserId, form, "Yêu cầu gần nhất đã được nhận. Vui lòng chờ một phút trước khi gửi tiếp.", token);
        var admins = await context.Users.AsNoTracking().Where(u => u.Role == "Admin" && !u.IsSuspended).ToListAsync(token);
        admins = admins.Where(AdminAccess.IsAdmin).ToList();
        if (admins.Count == 0) return await SupportViewAsync(business.UserId, form, "Chưa có quản trị viên tiếp nhận. Thử lại sau.", token);
        await using var transaction = context.Database.IsRelational() ? await context.Database.BeginTransactionAsync(token) : null;
        var request = new SupportRequest { UserId = business.UserId, Kind = form.Kind, Message = form.Message, RequestedCredits = form.Kind == "credits" ? form.Credits : null };
        context.SupportRequests.Add(request); await context.SaveChangesAsync(token);
        var staged = new List<StagedNotification?>();
        foreach (var admin in admins) staged.Add(await NotificationWriter.StageAsync(context, admin.Id, business.UserId, "SupportRequest", $"Có yêu cầu #{request.Id} từ {business.CompanyName} cần xử lý.", "/Admin?tab=requests&requestId=" + request.Id));
        await context.SaveChangesAsync(token);
        if (transaction != null) await transaction.CommitAsync(token);
        foreach (var notification in staged) await NotificationWriter.PushAsync(NotificationWriter.HubFrom(HttpContext), context, notification);
        TempData["SupportSaved"] = "Đã gửi yêu cầu tới quản trị viên. Bạn có thể theo dõi phản hồi bên dưới.";
        return RedirectToAction(nameof(Support));
    }
}
