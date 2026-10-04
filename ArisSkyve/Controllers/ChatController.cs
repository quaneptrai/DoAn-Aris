using ArisSkyve.Domain.Entities;
using ArisSkyve.Hubs;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;

namespace ArisSkyve.Controllers
{
    [Authorize]
    public class ChatController : Controller
    {
        private readonly ArisDBContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IWebHostEnvironment _env;

        public ChatController(ArisDBContext context, IConfiguration config, IHttpClientFactory httpClientFactory, IWebHostEnvironment env)
        {
            _context = context;
            _config = config;
            _httpClientFactory = httpClientFactory;
            _env = env;
        }

        private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        public async Task<IActionResult> Index(int? userId)
        {
            var me = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (me == null) return RedirectToAction("Login", "Account");

            ViewBag.OpenUserId = userId;
            return View(me);
        }

        /// <summary>Tên hiển thị trong Tin nhắn: tên công ty (doanh nghiệp) → họ tên → tên đăng nhập.</summary>
        internal static string DisplayName(User u)
        {
            if (u.Profile is BussinessAccount b && !string.IsNullOrWhiteSpace(b.CompanyName)) return b.CompanyName;
            return string.IsNullOrWhiteSpace(u.Profile?.FullName) ? u.Username : u.Profile!.FullName;
        }

        [HttpGet]
        public async Task<IActionResult> GetConversations()
        {
            var myId = CurrentUserId;

            var messages = await _context.Messages
                .Where(m => m.SenderId == myId || m.ReceiverId == myId)
                .Include(m => m.Sender).ThenInclude(u => u.Profile)
                .Include(m => m.Receiver).ThenInclude(u => u.Profile)
                .OrderByDescending(m => m.SentAt)
                .ToListAsync();

            var conversations = messages
                .GroupBy(m => m.SenderId == myId ? m.ReceiverId : m.SenderId)
                .Select(g =>
                {
                    var last = g.First();
                    var partner = last.SenderId == myId ? last.Receiver : last.Sender;
                    var lastMessagePreview = !string.IsNullOrWhiteSpace(last.Content)
                        ? last.Content
                        : (last.ImageUrl != null ? "Đã gửi một hình ảnh" : last.Content);
                    return new
                    {
                        userId = partner.Id,
                        username = partner.Username,
                        displayName = DisplayName(partner),
                        avatar = partner.Profile?.AvatarUrl ?? "/images/default-avatar.png",
                        lastMessage = lastMessagePreview,
                        lastMessageAt = last.SentAt,
                        isMine = last.SenderId == myId,
                        unreadCount = g.Count(m => m.ReceiverId == myId && !m.IsRead),
                        isOnline = partner.ShowActiveStatus && ChatHub.IsConnected(partner.Id)
                    };
                })
                .OrderByDescending(c => c.lastMessageAt)
                .ToList();

            return Json(conversations);
        }

        [HttpGet]
        public async Task<IActionResult> GetMessages(int userId)
        {
            var myId = CurrentUserId;

            var partner = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (partner == null) return NotFound();

            var messages = await _context.Messages
                .Where(m => (m.SenderId == myId && m.ReceiverId == userId) || (m.SenderId == userId && m.ReceiverId == myId))
                .OrderBy(m => m.SentAt)
                .Select(m => new
                {
                    id = m.Id,
                    senderId = m.SenderId,
                    receiverId = m.ReceiverId,
                    content = m.Content,
                    imageUrl = m.ImageUrl,
                    isForwarded = m.IsForwarded,
                    sentAt = m.SentAt,
                    isRead = m.IsRead,
                    replyTo = m.ReplyToMessage == null ? null : new
                    {
                        id = m.ReplyToMessage.Id,
                        senderId = m.ReplyToMessage.SenderId,
                        senderUsername = m.ReplyToMessage.Sender.Username,
                        content = m.ReplyToMessage.Content,
                        imageUrl = m.ReplyToMessage.ImageUrl
                    }
                })
                .ToListAsync();

            return Json(new
            {
                partner = new
                {
                    id = partner.Id,
                    username = partner.Username,
                    displayName = DisplayName(partner),
                    avatar = partner.Profile?.AvatarUrl ?? "/images/default-avatar.png",
                    isOnline = partner.ShowActiveStatus && ChatHub.IsConnected(partner.Id)
                },
                messages
            });
        }

        [HttpGet]
        public async Task<IActionResult> SearchUsers(string q)
        {
            if (string.IsNullOrWhiteSpace(q)) return Json(Array.Empty<object>());

            var myId = CurrentUserId;

            var users = await _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Id != myId && (u.Username.Contains(q) || (u.Profile != null && u.Profile.FullName.Contains(q))))
                .Take(10)
                .ToListAsync();

            var userIds = users.Select(u => u.Id).ToList();
            var friendships = await _context.Friendships
                .Where(f => (f.RequesterId == myId && userIds.Contains(f.AddresseeId))
                         || (f.AddresseeId == myId && userIds.Contains(f.RequesterId)))
                .ToListAsync();

            var result = users.Select(u =>
            {
                var rel = friendships.FirstOrDefault(f => f.RequesterId == u.Id || f.AddresseeId == u.Id);
                string friendStatus = "none";
                int? friendshipId = null;
                if (rel != null)
                {
                    friendshipId = rel.Id;
                    friendStatus = rel.Status == FriendshipStatus.Accepted
                        ? "friends"
                        : rel.RequesterId == myId ? "pending_sent" : "pending_received";
                }

                return new
                {
                    id = u.Id,
                    username = u.Username,
                    displayName = DisplayName(u),
                    avatar = (u.Profile != null ? u.Profile.AvatarUrl : null) ?? "/images/default-avatar.png",
                    friendStatus,
                    friendshipId
                };
            }).ToList();

            return Json(result);
        }

        // Ảnh / video trong Tin nhắn: lưu ngay trên máy chủ Aris (wwwroot/uploads/chat) giống ảnh bài đăng,
        // trả về URL để client gửi qua ChatHub.SendMessage (trường ImageUrl — video nhận diện theo đuôi tệp).
        [HttpPost]
        [RequestSizeLimit(60_000_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = 60_000_000)]
        public async Task<IActionResult> UploadChatMedia(IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return Json(new { success = false, message = "Vui lòng chọn ảnh hoặc video." });

            var validation = await PublicMediaValidator.ValidateBrowserMediaAsync(file, HttpContext.RequestAborted);
            if (!validation.IsValid || validation.Media is null)
            {
                return Json(new { success = false, message = validation.Error ?? "Chỉ hỗ trợ ảnh JPEG, PNG, WEBP, GIF hoặc video MP4, WEBM, MOV." });
            }

            if (!PublicMediaStorage.TryGetStorageDirectory(_env.ContentRootPath, PublicMediaStorage.Chat, out var storageDirectory))
            {
                return Json(new { success = false, message = "Không thể chuẩn bị nơi lưu tệp." });
            }

            try
            {
                var name = await PublicMediaValidator.SaveAsync(file, validation.Media, storageDirectory, HttpContext.RequestAborted);
                return Json(new { success = true, url = $"/media/{PublicMediaStorage.Chat}/{name}", kind = validation.Media.MediaType });
            }
            catch
            {
                return Json(new { success = false, message = "Không thể lưu tệp tải lên." });
            }
        }

        // Uploads a chat image to the AiCore media store (same remote storage Dashboard's
        // post images use) and hands back its URL; the client then sends that URL through
        // ChatHub.SendMessage separately, matching the app's existing upload-then-reference
        // pattern for user-generated media.
        [HttpPost]
        [RequestSizeLimit(12_000_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = 12_000_000)]
        public async Task<IActionResult> UploadChatImage(IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return Json(new { success = false, message = "Vui lòng chọn ảnh." });

            var validation = await PublicMediaValidator.ValidateImageAsync(file, PublicMediaValidator.MaximumImageBytes, HttpContext.RequestAborted);
            if (!validation.IsValid || validation.Media is null)
                return Json(new { success = false, message = validation.Error ?? "Chỉ hỗ trợ ảnh JPEG, PNG, WEBP hoặc GIF." });

            var aiCoreBaseUrl = _config["AiCore:BaseUrl"];
            var client = _httpClientFactory.CreateClient();

            try
            {
                using var content = new MultipartFormDataContent();
                using var stream = file.OpenReadStream();
                var streamContent = new StreamContent(stream);
                streamContent.Headers.ContentType = new MediaTypeHeaderValue(validation.Media.ContentType);
                content.Add(streamContent, "file", validation.Media.CreateStorageFileName());

                var response = await client.PostAsync($"{aiCoreBaseUrl}/upload-image", content);
                if (!response.IsSuccessStatusCode)
                    return Json(new { success = false, message = "Không thể tải ảnh lên." });

                var result = await response.Content.ReadFromJsonAsync<AiCoreUploadResult>();
                if (!PublicMediaValidator.IsSafeRemoteMediaUrl(result?.Url))
                    return Json(new { success = false, message = "Không thể tải ảnh lên." });

                return Json(new { success = true, url = result!.Url! });
            }
            catch (Exception)
            {
                return Json(new { success = false, message = "Lỗi kết nối tới dịch vụ lưu trữ." });
            }
        }

        private class AiCoreUploadResult
        {
            public string? Message { get; set; }
            public string? Filename { get; set; }
            public string? Url { get; set; }
        }
    }
}
