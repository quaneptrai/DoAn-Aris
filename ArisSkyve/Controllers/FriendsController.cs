using ArisSkyve.Domain.Entities;
using ArisSkyve.Hubs;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

using ArisSkyve.Infrastructure.Services;

namespace ArisSkyve.Controllers
{
    [Authorize]
    public class FriendsController : Controller
    {
        private readonly ArisDBContext _context;
        private readonly IV7FeatureGate _featureGate;

        public FriendsController(ArisDBContext context, IV7FeatureGate featureGate)
        {
            _context = context;
            _featureGate = featureGate;
        }

        private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        [HttpGet("Friends/Suggestions")]
        public async Task<IActionResult> Suggestions(int take = 5)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            int myId = CurrentUserId;
            take = Math.Clamp(take, 1, 20);

            var myFriendships = await _context.Friendships
                .Where(f => f.RequesterId == myId || f.AddresseeId == myId)
                .ToListAsync();

            var friendIds = myFriendships
                .Where(f => f.Status == FriendshipStatus.Accepted)
                .Select(f => f.RequesterId == myId ? f.AddresseeId : f.RequesterId)
                .ToHashSet();

            var pendingOrBlockedIds = myFriendships
                .Select(f => f.RequesterId == myId ? f.AddresseeId : f.RequesterId)
                .ToHashSet();

            var dismissedIds = (await _context.DismissedSuggestions
                .Where(d => d.UserId == myId)
                .Select(d => d.SuggestedUserId)
                .ToListAsync()).ToHashSet();

            var candidateUsers = await _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Id != myId && !pendingOrBlockedIds.Contains(u.Id) && !dismissedIds.Contains(u.Id))
                .Take(50)
                .ToListAsync();

            var candidateIds = candidateUsers.Select(u => u.Id).ToList();
            var candidateFriendships = await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Accepted &&
                            (candidateIds.Contains(f.RequesterId) || candidateIds.Contains(f.AddresseeId)))
                .ToListAsync();

            var result = candidateUsers.Select(u =>
            {
                var theirFriendIds = candidateFriendships
                    .Where(f => f.RequesterId == u.Id || f.AddresseeId == u.Id)
                    .Select(f => f.RequesterId == u.Id ? f.AddresseeId : f.RequesterId);

                int mutualCount = theirFriendIds.Count(id => friendIds.Contains(id));
                string reason = mutualCount > 0 ? $"{mutualCount} bạn chung" : "Gợi ý kết nối";

                return new
                {
                    id = u.Id,
                    name = u.Profile?.FullName ?? u.Username,
                    avatar = u.Profile?.AvatarUrl ?? "/images/default-avatar.png",
                    headline = u.Profile?.Bio ?? "Thành viên Aris",
                    mutualCount,
                    reason
                };
            }).OrderByDescending(s => s.mutualCount).Take(take).ToList();

            return Json(result);
        }

        [HttpPost("Friends/DismissSuggestion")]
        public async Task<IActionResult> DismissSuggestion(int userId)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            int myId = CurrentUserId;
            var existing = await _context.DismissedSuggestions
                .FirstOrDefaultAsync(d => d.UserId == myId && d.SuggestedUserId == userId);

            if (existing == null)
            {
                _context.DismissedSuggestions.Add(new DismissedSuggestion
                {
                    UserId = myId,
                    SuggestedUserId = userId,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }

            return Json(new { success = true });
        }

        [HttpGet]
        public async Task<IActionResult> GetFriends()
        {
            var myId = CurrentUserId;

            var friendships = await _context.Friendships
                .Include(f => f.Requester).ThenInclude(u => u.Profile)
                .Include(f => f.Addressee).ThenInclude(u => u.Profile)
                .Where(f => f.Status == FriendshipStatus.Accepted && (f.RequesterId == myId || f.AddresseeId == myId))
                .ToListAsync();

            var friends = friendships.Select(f =>
            {
                var friend = f.RequesterId == myId ? f.Addressee : f.Requester;
                return new
                {
                    userId = friend.Id,
                    username = friend.Username,
                    displayName = ChatController.DisplayName(friend),
                    avatar = friend.Profile?.AvatarUrl ?? "/images/default-avatar.png",
                    isOnline = friend.ShowActiveStatus && ChatHub.IsConnected(friend.Id)
                };
            }).OrderBy(f => f.username).ToList();

            return Json(friends);
        }

        [HttpGet]
        public async Task<IActionResult> GetPendingRequests()
        {
            var myId = CurrentUserId;

            var incoming = await _context.Friendships
                .Include(f => f.Requester).ThenInclude(u => u.Profile)
                .Where(f => f.Status == FriendshipStatus.Pending && f.AddresseeId == myId)
                .Select(f => new
                {
                    requestId = f.Id,
                    userId = f.Requester.Id,
                    username = f.Requester.Username,
                    displayName = f.Requester.Profile != null && !string.IsNullOrEmpty(f.Requester.Profile.FullName) ? f.Requester.Profile.FullName : f.Requester.Username,
                    avatar = f.Requester.Profile != null ? f.Requester.Profile.AvatarUrl : null
                })
                .ToListAsync();

            var outgoing = await _context.Friendships
                .Include(f => f.Addressee).ThenInclude(u => u.Profile)
                .Where(f => f.Status == FriendshipStatus.Pending && f.RequesterId == myId)
                .Select(f => new
                {
                    requestId = f.Id,
                    userId = f.Addressee.Id,
                    username = f.Addressee.Username,
                    displayName = f.Addressee.Profile != null && !string.IsNullOrEmpty(f.Addressee.Profile.FullName) ? f.Addressee.Profile.FullName : f.Addressee.Username,
                    avatar = f.Addressee.Profile != null ? f.Addressee.Profile.AvatarUrl : null
                })
                .ToListAsync();

            return Json(new { incoming, outgoing });
        }

        [HttpPost]
        public async Task<IActionResult> SendRequest(int userId)
        {
            var myId = CurrentUserId;
            if (userId == myId) return Json(new { success = false, message = "Bạn không thể tự kết bạn với chính mình." });

            var targetExists = await _context.Users.AnyAsync(u => u.Id == userId);
            if (!targetExists) return NotFound();

            var existing = await _context.Friendships.FirstOrDefaultAsync(f =>
                (f.RequesterId == myId && f.AddresseeId == userId) ||
                (f.RequesterId == userId && f.AddresseeId == myId));

            if (existing != null)
            {
                if (existing.Status == FriendshipStatus.Accepted)
                    return Json(new { success = false, message = "Hai bạn đã là bạn bè." });

                // They already sent me a request — accept it instead of creating a duplicate.
                if (existing.RequesterId == userId)
                {
                    existing.Status = FriendshipStatus.Accepted;
                    existing.RespondedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    return Json(new { success = true, status = "friends" });
                }

                return Json(new { success = false, message = "Lời mời kết bạn đã được gửi trước đó." });
            }

            var friendship = new Friendship { RequesterId = myId, AddresseeId = userId };
            _context.Friendships.Add(friendship);

            // Send → cancel → send again replaces the still-unread request instead of stacking.
            var staged = await NotificationWriter.StageAsync(_context, userId, myId, "FriendRequest",
                "đã gửi cho bạn một lời mời kết bạn.", "/Chat/Index?networkTab=requests");

            await _context.SaveChangesAsync();
            await NotificationWriter.PushAsync(NotificationWriter.HubFrom(HttpContext), _context, staged);
            return Json(new { success = true, status = "pending_sent" });
        }

        [HttpPost]
        public async Task<IActionResult> AcceptRequest(int requestId)
        {
            var myId = CurrentUserId;
            var friendship = await _context.Friendships.FirstOrDefaultAsync(f => f.Id == requestId && f.AddresseeId == myId);
            if (friendship == null) return NotFound();

            // A repeated click (double tap, second tab) is a no-op, not another notification.
            if (friendship.Status == FriendshipStatus.Accepted) return Json(new { success = true });

            friendship.Status = FriendshipStatus.Accepted;
            friendship.RespondedAt = DateTime.UtcNow;

            var staged = await NotificationWriter.StageAsync(_context, friendship.RequesterId, myId, "FriendRequestAccepted",
                "đã chấp nhận lời mời kết bạn của bạn.", "/Chat/Index?networkTab=friends");

            await _context.SaveChangesAsync();
            await NotificationWriter.PushAsync(NotificationWriter.HubFrom(HttpContext), _context, staged);
            return Json(new { success = true });
        }

        [HttpPost]
        public async Task<IActionResult> DeclineRequest(int requestId)
        {
            var myId = CurrentUserId;
            var friendship = await _context.Friendships.FirstOrDefaultAsync(f => f.Id == requestId && f.AddresseeId == myId);
            if (friendship == null) return NotFound();

            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();
            return Json(new { success = true });
        }

        [HttpPost]
        public async Task<IActionResult> CancelRequest(int requestId)
        {
            var myId = CurrentUserId;
            var friendship = await _context.Friendships.FirstOrDefaultAsync(f => f.Id == requestId && f.RequesterId == myId);
            if (friendship == null) return NotFound();

            // A withdrawn request should not stay in the other person's bell.
            var pendingNotice = await _context.Notifications
                .Where(n => n.UserId == friendship.AddresseeId && n.ActorId == myId && n.Type == "FriendRequest" && !n.IsRead)
                .ToListAsync();
            _context.Notifications.RemoveRange(pendingNotice);

            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();
            return Json(new { success = true });
        }

        [HttpPost]
        public async Task<IActionResult> RemoveFriend(int userId)
        {
            var myId = CurrentUserId;
            var friendship = await _context.Friendships.FirstOrDefaultAsync(f =>
                f.Status == FriendshipStatus.Accepted &&
                ((f.RequesterId == myId && f.AddresseeId == userId) || (f.RequesterId == userId && f.AddresseeId == myId)));

            if (friendship == null) return NotFound();

            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();
            return Json(new { success = true });
        }
    }
}
