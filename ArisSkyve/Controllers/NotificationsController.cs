using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ArisSkyve.Controllers
{
    [Authorize]
    public class NotificationsController : Controller
    {
        private const int PageSize = 30;

        private readonly ArisDBContext _context;

        public NotificationsController(ArisDBContext context)
        {
            _context = context;
        }

        private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        [HttpGet]
        public async Task<IActionResult> GetNotifications()
        {
            var userId = CurrentUserId;

            // Chat messages are counted on the chat badges, not in the bell.
            var bell = _context.Notifications
                .Where(n => n.UserId == userId && n.Type != NotificationWriter.LegacyMessageType);

            var rows = await bell
                .Include(n => n.Actor).ThenInclude(a => a!.Profile)
                .OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id)
                .Take(PageSize)
                .AsNoTracking()
                .ToListAsync();

            var notifications = rows.Select(n => NotificationWriter.Payload(
                n,
                n.Actor == null ? null : ChatController.DisplayName(n.Actor),
                n.Actor?.Profile?.AvatarUrl));

            var unreadCount = await bell.CountAsync(n => !n.IsRead);

            return Json(new { notifications, unreadCount });
        }

        [HttpPost]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var userId = CurrentUserId;
            var notification = await _context.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
            if (notification == null) return NotFound();

            notification.IsRead = true;
            await _context.SaveChangesAsync();

            return Json(new { success = true });
        }

        [HttpPost]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var userId = CurrentUserId;
            var unread = await _context.Notifications.Where(n => n.UserId == userId && !n.IsRead).ToListAsync();

            foreach (var n in unread) n.IsRead = true;
            await _context.SaveChangesAsync();

            return Json(new { success = true });
        }
    }
}
