using ArisSkyve.Domain.Entities;
using ArisSkyve.Hubs;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ArisSkyve.Controllers
{
    [Authorize]
    public class ChatController : Controller
    {
        private readonly ArisDBContext _context;
        private readonly IPublicMediaStore _publicMedia;

        public ChatController(ArisDBContext context, IPublicMediaStore publicMedia)
        {
            _context = context;
            _publicMedia = publicMedia;
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

        // Public chat media is uploaded directly to Google Drive. The returned HTTPS
        // URL is then sent through ChatHub.SendMessage by the browser.
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

            try
            {
                var upload = await _publicMedia.UploadAsync(PublicMediaStorage.Chat, file, validation.Media, HttpContext.RequestAborted);
                return Json(new { success = true, url = upload.Url, kind = validation.Media.MediaType });
            }
            catch (PublicMediaStorageException)
            {
                return Json(new { success = false, message = "Google Drive could not store the upload. Please try again." });
            }
        }

        // Backwards-compatible image-only endpoint. It uses the same Google Drive
        // store as UploadChatMedia rather than the former AiCore/local paths.
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

            try
            {
                var upload = await _publicMedia.UploadAsync(PublicMediaStorage.Chat, file, validation.Media, HttpContext.RequestAborted);
                return Json(new { success = true, url = upload.Url });
            }
            catch (PublicMediaStorageException)
            {
                return Json(new { success = false, message = "Google Drive could not store the upload. Please try again." });
            }
        }
    }
}
