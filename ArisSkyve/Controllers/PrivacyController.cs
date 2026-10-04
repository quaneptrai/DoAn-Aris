using System.Net.Http.Json;
using System.Security.Claims;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Controllers;

// Trang Chính sách quyền riêng tư (/privacy) và các nút đồng ý / rút lại đồng ý.
// POST đi qua AutoValidateAntiforgeryToken toàn cục (form có token; fetch gửi header RequestVerificationToken).
[Route("privacy")]
public sealed class PrivacyController(ArisDBContext db, IHttpClientFactory clients, IConfiguration configuration) : Controller
{
    [AllowAnonymous, HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken cancellationToken)
    {
        ViewBag.ContactEmail = configuration["Privacy:ContactEmail"];
        if (TryGetUserId(out var userId))
        {
            var state = await db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new { u.PrivacyAcceptedAt, u.CvAiConsentAt })
                .FirstOrDefaultAsync(cancellationToken);
            if (state != null)
            {
                ViewBag.SignedIn = true;
                ViewBag.PrivacyAcceptedAt = state.PrivacyAcceptedAt;
                ViewBag.CvAiConsentAt = state.CvAiConsentAt;
            }
        }
        return View();
    }

    [Authorize, HttpPost("accept")]
    public async Task<IActionResult> Accept(CancellationToken cancellationToken)
    {
        var user = await CurrentUserAsync(cancellationToken);
        if (user == null) return Unauthorized();
        user.PrivacyAcceptedAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Respond(new { accepted = true, at = user.PrivacyAcceptedAt }, "Đã ghi nhận bạn đồng ý với Chính sách quyền riêng tư.", "#consent");
    }

    [Authorize, HttpPost("cv-ai-consent")]
    public async Task<IActionResult> GrantCvAi(CancellationToken cancellationToken)
    {
        var user = await CurrentUserAsync(cancellationToken);
        if (user == null) return Unauthorized();
        user.CvAiConsentAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Respond(new { consented = true, at = user.CvAiConsentAt }, "Đã bật: Aris được dùng AI để xử lý CV của bạn.", "#cv-ai");
    }

    [Authorize, HttpPost("cv-ai-consent/revoke")]
    public async Task<IActionResult> RevokeCvAi(CancellationToken cancellationToken)
    {
        var user = await CurrentUserAsync(cancellationToken);
        if (user == null) return Unauthorized();
        user.CvAiConsentAt = null;
        await db.SaveChangesAsync(cancellationToken);

        // Rút đồng ý thì xoá luôn chỉ mục AI (vector CV, khoá theo employee_id) để AI ngừng dùng CV cũ.
        var employeeId = await db.Profiles.Where(p => p.UserId == user.Id).Select(p => (int?)p.Id).FirstOrDefaultAsync(cancellationToken);
        var aiIndexRemoved = employeeId == null || await DeleteAiIndexAsync(employeeId.Value, cancellationToken);
        return Respond(new { consented = false, aiIndexRemoved },
            aiIndexRemoved
                ? "Đã tắt: Aris ngừng gửi CV của bạn tới AI và đã xoá chỉ mục AI của bạn."
                : "Đã tắt: Aris ngừng gửi CV của bạn tới AI. Chưa xoá được chỉ mục AI lúc này; bấm tắt lại sau ít phút hoặc liên hệ Aris.",
            "#cv-ai");
    }

    private async Task<bool> DeleteAiIndexAsync(int employeeId, CancellationToken cancellationToken)
    {
        try
        {
            var aiCore = (configuration["AiCore:BaseUrl"] ?? "http://localhost:8001").TrimEnd('/');
            using var client = clients.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(15);
            using var response = await client.PostAsJsonAsync($"{aiCore}/delete-cv", new { employee_id = employeeId }, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            return false;
        }
    }

    private IActionResult Respond(object json, string message, string anchor)
    {
        var wantsJson = Request.Headers.Accept.Any(value => value?.Contains("application/json", StringComparison.OrdinalIgnoreCase) == true);
        if (wantsJson) return Ok(json);
        TempData["PrivacyNotice"] = message;
        return Redirect("/privacy" + anchor);
    }

    private async Task<User?> CurrentUserAsync(CancellationToken cancellationToken) =>
        TryGetUserId(out var userId) ? await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken) : null;

    private bool TryGetUserId(out int userId) => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
}
