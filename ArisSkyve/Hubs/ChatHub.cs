using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace ArisSkyve.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        // Tracks how many active connections each user currently has (they may have several tabs open).
        private static readonly ConcurrentDictionary<int, int> OnlineUsers = new();

        private readonly ArisDBContext _context;

        public ChatHub(ArisDBContext context)
        {
            _context = context;
        }

        private int CurrentUserId => int.Parse(Context.User!.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        // Read from other places (SettingsController) that need to know if a user
        // currently has a live hub connection, without going through a hub method.
        public static bool IsConnected(int userId) => OnlineUsers.ContainsKey(userId);

        public override async Task OnConnectedAsync()
        {
            var userId = CurrentUserId;
            var count = OnlineUsers.AddOrUpdate(userId, 1, (_, existing) => existing + 1);

            if (count == 1)
            {
                var showStatus = await _context.Users.Where(u => u.Id == userId).Select(u => u.ShowActiveStatus).FirstOrDefaultAsync();
                if (showStatus)
                {
                    await Clients.Others.SendAsync("PresenceChanged", userId, true);
                }
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = CurrentUserId;
            var count = OnlineUsers.AddOrUpdate(userId, 0, (_, existing) => Math.Max(0, existing - 1));

            if (count == 0)
            {
                OnlineUsers.TryRemove(userId, out _);
                await Clients.Others.SendAsync("PresenceChanged", userId, false);
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task<bool> IsOnline(int userId)
        {
            if (!OnlineUsers.ContainsKey(userId)) return false;
            return await _context.Users.Where(u => u.Id == userId).Select(u => u.ShowActiveStatus).FirstOrDefaultAsync();
        }

        public async Task SendMessage(int receiverId, string content, int? replyToMessageId, string? imageUrl)
        {
            if (string.IsNullOrWhiteSpace(content) && string.IsNullOrWhiteSpace(imageUrl)) return;

            await CreateAndBroadcastMessageAsync(CurrentUserId, receiverId, content, imageUrl, replyToMessageId, isForwarded: false);
        }

        public async Task ForwardMessage(int receiverId, int sourceMessageId)
        {
            var senderId = CurrentUserId;

            // Only allow forwarding a message the current user actually took part in.
            var source = await _context.Messages.FirstOrDefaultAsync(m => m.Id == sourceMessageId
                && (m.SenderId == senderId || m.ReceiverId == senderId));
            if (source == null) return;

            await CreateAndBroadcastMessageAsync(senderId, receiverId, source.Content, source.ImageUrl, replyToMessageId: null, isForwarded: true);
        }

        // Shared by SendMessage and ForwardMessage: persist the message, resolve the
        // optional reply target (only if it belongs to a conversation the sender is
        // actually part of), broadcast it to both parties, and raise a notification.
        private async Task CreateAndBroadcastMessageAsync(int senderId, int receiverId, string? content, string? imageUrl, int? replyToMessageId, bool isForwarded)
        {
            var receiverExists = await _context.Users.AnyAsync(u => u.Id == receiverId);
            if (!receiverExists) return;

            Message? replyTo = null;
            if (replyToMessageId.HasValue)
            {
                replyTo = await _context.Messages
                    .Include(m => m.Sender)
                    .FirstOrDefaultAsync(m => m.Id == replyToMessageId.Value
                        && (m.SenderId == senderId || m.ReceiverId == senderId));
            }

            var message = new Message
            {
                SenderId = senderId,
                ReceiverId = receiverId,
                Content = content?.Trim() ?? string.Empty,
                ImageUrl = imageUrl,
                ReplyToMessageId = replyTo?.Id,
                IsForwarded = isForwarded,
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            var sender = await _context.Users.Include(u => u.Profile).FirstAsync(u => u.Id == senderId);

            var payload = new
            {
                id = message.Id,
                senderId = message.SenderId,
                receiverId = message.ReceiverId,
                senderUsername = sender.Username,
                senderAvatar = sender.Profile?.AvatarUrl ?? "/images/default-avatar.png",
                content = message.Content,
                imageUrl = message.ImageUrl,
                isForwarded = message.IsForwarded,
                sentAt = message.SentAt,
                replyTo = replyTo == null ? null : new
                {
                    id = replyTo.Id,
                    senderId = replyTo.SenderId,
                    senderUsername = replyTo.Sender.Username,
                    content = replyTo.Content,
                    imageUrl = replyTo.ImageUrl
                }
            };

            await Clients.User(receiverId.ToString()).SendAsync("ReceiveMessage", payload);
            await Clients.User(senderId.ToString()).SendAsync("ReceiveMessage", payload);

            var previewSource = !string.IsNullOrWhiteSpace(message.Content)
                ? message.Content
                : (message.ImageUrl != null ? "Đã gửi một hình ảnh" : string.Empty);
            var preview = previewSource.Length > 60 ? previewSource[..60] + "…" : previewSource;
            var notification = new Notification
            {
                UserId = receiverId,
                ActorId = senderId,
                Type = "Message",
                Content = $"{sender.Username}: {preview}",
                Link = $"/Chat/Index?userId={senderId}",
                IsRead = false,
                CreatedAt = message.SentAt
            };
            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();

            await Clients.User(receiverId.ToString()).SendAsync("ReceiveNotification", new
            {
                id = notification.Id,
                content = notification.Content,
                link = notification.Link,
                isRead = false,
                createdAt = notification.CreatedAt,
                actorAvatar = sender.Profile?.AvatarUrl ?? "/images/default-avatar.png"
            });
        }

        public async Task DeleteMessage(int messageId)
        {
            var userId = CurrentUserId;

            var message = await _context.Messages.FirstOrDefaultAsync(m => m.Id == messageId && m.SenderId == userId);
            if (message == null) return;

            var receiverId = message.ReceiverId;

            _context.Messages.Remove(message);
            await _context.SaveChangesAsync();

            await Clients.User(receiverId.ToString()).SendAsync("MessageDeleted", messageId);
            await Clients.User(userId.ToString()).SendAsync("MessageDeleted", messageId);
        }

        public async Task Typing(int receiverId)
        {
            await Clients.User(receiverId.ToString()).SendAsync("UserTyping", CurrentUserId);
        }

        public async Task MarkAsRead(int otherUserId)
        {
            var userId = CurrentUserId;

            var unread = await _context.Messages
                .Where(m => m.SenderId == otherUserId && m.ReceiverId == userId && !m.IsRead)
                .ToListAsync();

            if (unread.Count == 0) return;

            foreach (var m in unread) m.IsRead = true;
            await _context.SaveChangesAsync();

            await Clients.User(otherUserId.ToString()).SendAsync("MessagesRead", userId);
        }
    }
}
