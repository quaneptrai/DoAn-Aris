using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ArisSkyve.Controllers;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Hubs;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Services
{
    public sealed record StagedNotification(Notification Notification, IReadOnlyList<int> ReplacedIds);

    /// <summary>
    /// Writes bell notifications without spamming them. Nobody is notified about their own
    /// action, and repeating an event that is still unread (same recipient, actor, type and
    /// link: another comment on the same post, a second status change of one application…)
    /// replaces the older row instead of stacking a new one on top of it.
    /// </summary>
    public static class NotificationWriter
    {
        // Chat messages used to land here one row per message; they are counted by the chat
        // badges now, and legacy rows of this type are kept out of the bell.
        public const string LegacyMessageType = "Message";

        // Types whose Content is a predicate ("đã bình luận…"): the bell shows the actor's name first.
        private static readonly HashSet<string> ActorPrefixedTypes = new(StringComparer.Ordinal)
        {
            "FriendRequest", "FriendRequestAccepted", "PostComment", "CommentReply"
        };

        /// <summary>Adds the notification to the context (caller saves) and removes the unread rows it replaces.</summary>
        public static async Task<StagedNotification?> StageAsync(ArisDBContext db, int userId, int? actorId, string type, string content, string? link)
        {
            if (actorId == userId) return null;

            var stale = await db.Notifications
                .Where(n => n.UserId == userId && !n.IsRead && n.ActorId == actorId && n.Type == type && n.Link == link)
                .ToListAsync();
            db.Notifications.RemoveRange(stale);

            var notification = new Notification
            {
                UserId = userId,
                ActorId = actorId,
                Type = type,
                Content = content,
                Link = link,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };
            db.Notifications.Add(notification);
            return new StagedNotification(notification, stale.Select(n => n.Id).ToList());
        }

        /// <summary>The chat hub of the current request, for controllers that don't inject it (null in unit tests).</summary>
        public static IHubContext<ChatHub>? HubFrom(HttpContext? http) =>
            http?.RequestServices?.GetService(typeof(IHubContext<ChatHub>)) as IHubContext<ChatHub>;

        /// <summary>Live push to the recipient's open tabs. Best effort: the bell also loads on demand.</summary>
        public static async Task PushAsync(IHubContext<ChatHub>? hub, ArisDBContext db, StagedNotification? staged)
        {
            if (hub == null || staged == null) return;
            try
            {
                var n = staged.Notification;
                User? actor = n.ActorId == null
                    ? null
                    : await db.Users.AsNoTracking().Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == n.ActorId);
                await hub.Clients.User(n.UserId.ToString()).SendAsync("ReceiveNotification",
                    Payload(n, actor == null ? null : ChatController.DisplayName(actor), actor?.Profile?.AvatarUrl, staged.ReplacedIds));
            }
            catch (Exception)
            {
                // The notification is already saved; a failed push only delays it until the next load.
            }
        }

        /// <summary>The JSON shape shared by GetNotifications and the live push.</summary>
        public static object Payload(Notification n, string? actorName, string? actorAvatar, IReadOnlyList<int>? replaces = null) => new
        {
            id = n.Id,
            type = n.Type,
            content = n.Content,
            link = n.Link,
            isRead = n.IsRead,
            // SQL Server hands DateTime back without a kind; these are always stored in UTC.
            createdAt = DateTime.SpecifyKind(n.CreatedAt, DateTimeKind.Utc),
            actorName,
            actorAvatar,
            prefixActor = actorName != null && ActorPrefixedTypes.Contains(n.Type),
            replaces = replaces ?? Array.Empty<int>()
        };
    }
}
