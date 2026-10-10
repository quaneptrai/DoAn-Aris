using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Hubs;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ArisSkyve.Controllers
{
    [Authorize]
    public class SettingsController : Controller
    {
        private const long MaxAvatarBytes = 5 * 1024 * 1024;

        private readonly ArisDBContext _context;
        private readonly IHubContext<ChatHub> _hub;
        private readonly IPublicMediaStore _publicMedia;

        public SettingsController(ArisDBContext context, IHubContext<ChatHub> hub, IPublicMediaStore publicMedia)
        {
            _context = context;
            _hub = hub;
            _publicMedia = publicMedia;
        }

        private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        public async Task<IActionResult> Index()
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user == null) return RedirectToAction("Login", "Account");

            ViewBag.EmployerRequestPending = await _context.SupportRequests.AnyAsync(r => r.UserId == user.Id
                && r.Kind == EmployerAccounts.RequestKind && (r.Status == "pending" || r.Status == "processing"));
            return View(user);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateActiveStatus(bool enabled)
        {
            var userId = CurrentUserId;
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound();

            user.ShowActiveStatus = enabled;
            await _context.SaveChangesAsync();

            var isConnected = ChatHub.IsConnected(userId);
            await _hub.Clients.All.SendAsync("PresenceChanged", userId, enabled && isConnected);

            return Json(new { success = true });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateUsername(string username)
        {
            username = (username ?? "").Trim();
            if (string.IsNullOrEmpty(username) || username.Length > 50)
                return Json(new { success = false, message = "Display name must be between 1 and 50 characters." });

            var userId = CurrentUserId;
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound();

            user.Username = username;
            await _context.SaveChangesAsync();

            // Refresh the auth cookie so the new name takes effect immediately, without a re-login.
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Name, user.Username)
            };
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(identity),
                new AuthenticationProperties { IsPersistent = true, ExpiresUtc = DateTime.UtcNow.AddDays(7) });

            return Json(new { success = true, username = user.Username });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [RequestSizeLimit(6_000_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = 6_000_000)]
        public async Task<IActionResult> UpdateAvatar(IFormFile avatar)
        {
            if (avatar == null || avatar.Length == 0)
                return Json(new { success = false, message = "Please choose an image." });

            var validation = await PublicMediaValidator.ValidateImageAsync(avatar, MaxAvatarBytes, HttpContext.RequestAborted);
            if (!validation.IsValid || validation.Media is null)
                return Json(new { success = false, message = validation.Error ?? "Unsupported image format." });

            var userId = CurrentUserId;
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound();

            if (user.Profile == null)
            {
                user.Profile = new EmployesAccount
                {
                    UserId = user.Id,
                    FullName = user.Username,
                    Location = "Chưa cập nhật"
                };
                _context.Profiles.Add(user.Profile);
            }

            PublicMediaUpload upload;
            try
            {
                upload = await _publicMedia.UploadAsync(PublicMediaStorage.Avatars, avatar, validation.Media, HttpContext.RequestAborted);
            }
            catch (PublicMediaStorageException)
            {
                return Json(new { success = false, message = "Google Drive could not store the image. Please try again." });
            }

            user.Profile.AvatarUrl = upload.Url;
            await _context.SaveChangesAsync();

            return Json(new { success = true, avatarUrl = user.Profile.AvatarUrl });
        }

        // Same validation/storage pattern as UpdateAvatar, for the wide banner image shown
        // atop a company's profile page (BussinessAccount.CoverPhotoUrl, inherited from the
        // generic EmployesAccount field — nothing wired this up to an upload before now).
        [HttpPost]
        [ValidateAntiForgeryToken]
        [RequestSizeLimit(6_000_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = 6_000_000)]
        public async Task<IActionResult> UpdateCoverPhoto(IFormFile cover)
        {
            if (cover == null || cover.Length == 0)
                return Json(new { success = false, message = "Please choose an image." });

            var validation = await PublicMediaValidator.ValidateImageAsync(cover, MaxAvatarBytes, HttpContext.RequestAborted);
            if (!validation.IsValid || validation.Media is null)
                return Json(new { success = false, message = validation.Error ?? "Unsupported image format." });

            var userId = CurrentUserId;
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user?.Profile == null) return NotFound();

            PublicMediaUpload upload;
            try
            {
                upload = await _publicMedia.UploadAsync(PublicMediaStorage.Covers, cover, validation.Media, HttpContext.RequestAborted);
            }
            catch (PublicMediaStorageException)
            {
                return Json(new { success = false, message = "Google Drive could not store the image. Please try again." });
            }

            user.Profile.CoverPhotoUrl = upload.Url;
            await _context.SaveChangesAsync();

            return Json(new { success = true, coverUrl = user.Profile.CoverPhotoUrl });
        }

        private static readonly string[] DefaultRejectionTemplates =
        {
            "Cảm ơn bạn đã dành thời gian ứng tuyển. Hồ sơ của bạn rất ấn tượng, tuy nhiên chưa thực sự phù hợp với yêu cầu của vị trí này ở thời điểm hiện tại.",
            "Vị trí này yêu cầu số năm kinh nghiệm nhiều hơn so với hồ sơ hiện tại của bạn. Rất mong được gặp lại bạn ở những vị trí phù hợp hơn trong tương lai.",
            "Chúng tôi đã tìm được ứng viên phù hợp hơn cho vị trí này. Cảm ơn bạn đã quan tâm đến công ty."
        };

        [HttpGet]
        public async Task<IActionResult> GetRejectionTemplates()
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile is not BussinessAccount business)
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có mẫu từ chối." });

            List<string> templates = new();
            if (!string.IsNullOrWhiteSpace(business.RejectionTemplates))
            {
                try
                {
                    templates = System.Text.Json.JsonSerializer.Deserialize<List<string>>(business.RejectionTemplates) ?? new List<string>();
                }
                catch (System.Text.Json.JsonException)
                {
                    templates = new List<string>();
                }
            }

            if (templates.Count == 0) templates = DefaultRejectionTemplates.ToList();

            return Json(new { success = true, templates });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateRejectionTemplates([FromBody] UpdateRejectionTemplatesDto dto)
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile is not BussinessAccount business)
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có mẫu từ chối." });

            var templates = (dto?.Templates ?? new List<string>())
                .Select(t => t.Trim())
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .ToList();

            business.RejectionTemplates = System.Text.Json.JsonSerializer.Serialize(templates);
            await _context.SaveChangesAsync();

            return Json(new { success = true, templates });
        }
    }
}
