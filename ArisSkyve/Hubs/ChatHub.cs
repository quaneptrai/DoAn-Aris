using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Claims;

namespace ArisSkyve.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        // Tracks how many active connections each user currently has (they may have several tabs open).
        private static readonly ConcurrentDictionary<int, int> OnlineUsers = new();

        private readonly ArisDBContext _context;
        private readonly IV7FeatureGate _featureGate;

        public ChatHub(ArisDBContext context, IV7FeatureGate featureGate)
        {
            _context = context;
            _featureGate = featureGate;
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
        // actually part of) and broadcast it to both parties. Unread messages are counted
        // by the chat badges; they no longer add one bell notification each.
        private async Task CreateAndBroadcastMessageAsync(int senderId, int receiverId, string? content, string? imageUrl, int? replyToMessageId, bool isForwarded)
        {
            if (receiverId == senderId) return;

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
                },
                reactions = Array.Empty<object>()
            };

            await Clients.User(receiverId.ToString()).SendAsync("ReceiveMessage", payload);
            await Clients.User(senderId.ToString()).SendAsync("ReceiveMessage", payload);
        }

        /// <summary>
        /// Adds, replaces or removes the caller's emoji on a message of one of their own
        /// conversations, then sends the message's reactions to both participants.
        /// </summary>
        public async Task<bool> ToggleReaction(int messageId, string emoji)
        {
            if (!_featureGate.MessageReactions) return false;
            var normalized = NormalizeReaction(emoji);
            if (normalized == null) return false;

            var userId = CurrentUserId;
            var message = await _context.Messages.AsNoTracking()
                .Where(m => m.Id == messageId && (m.SenderId == userId || m.ReceiverId == userId))
                .Select(m => new { m.SenderId, m.ReceiverId })
                .FirstOrDefaultAsync();
            if (message == null) return false;

            var existing = await _context.MessageReactions.FirstOrDefaultAsync(r => r.MessageId == messageId && r.UserId == userId);
            if (existing == null)
            {
                _context.MessageReactions.Add(new MessageReaction { MessageId = messageId, UserId = userId, Emoji = normalized, CreatedAt = DateTime.UtcNow });
            }
            else if (existing.Emoji == normalized)
            {
                _context.MessageReactions.Remove(existing);
            }
            else
            {
                existing.Emoji = normalized;
                existing.CreatedAt = DateTime.UtcNow;
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return false; // a simultaneous tap on another tab already changed it
            }

            var reactions = await _context.MessageReactions.AsNoTracking()
                .Where(r => r.MessageId == messageId)
                .OrderBy(r => r.CreatedAt)
                .Select(r => new { userId = r.UserId, emoji = r.Emoji })
                .ToListAsync();

            var update = new { messageId, reactions };
            await Clients.User(message.SenderId.ToString()).SendAsync("MessageReactionChanged", update);
            await Clients.User(message.ReceiverId.ToString()).SendAsync("MessageReactionChanged", update);
            return true;
        }

        /// <summary>Exactly one emoji (one grapheme, flags and ZWJ families included), never text or markup.</summary>
        internal static string? NormalizeReaction(string? emoji)
        {
            var value = emoji?.Trim();
            if (string.IsNullOrEmpty(value) || value.Length > 32) return null;
            if (new StringInfo(value).LengthInTextElements != 1) return null;
            if (!value.Any(c => c > 0x7F)) return null;
            if (value.Any(c => char.IsControl(c) || char.IsWhiteSpace(c) || (c < 0x80 && char.IsLetter(c)))) return null;
            return value;
        }

        public async Task DeleteMessage(int messageId)
        {
            var userId = CurrentUserId;

            var message = await _context.Messages.FirstOrDefaultAsync(m => m.Id == messageId && m.SenderId == userId);
            if (message == null) return;

            var receiverId = message.ReceiverId;

            // Replies keep their own text but drop the quote of the recalled message
            // (that FK is Restrict, so the recall used to fail once anyone replied to it).
            var replies = await _context.Messages.Where(m => m.ReplyToMessageId == messageId).ToListAsync();
            foreach (var reply in replies) reply.ReplyToMessageId = null;

            if (_featureGate.MessageReactions)
            {
                _context.MessageReactions.RemoveRange(await _context.MessageReactions.Where(r => r.MessageId == messageId).ToListAsync());
            }

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
