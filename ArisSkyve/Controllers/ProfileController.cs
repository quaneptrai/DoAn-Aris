using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ArisSkyve.Controllers
{
    [Authorize]
    public class ProfileController : Controller
    {
        public ArisDBContext _context;
        public ProfileController(ArisDBContext dBContext) {
            _context = dBContext;
        }
        public IActionResult Index()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Challenge();
            }

            var user = _context.Users
                .Include(u => u.Posts)
                .Include(u => u.Likes)
                .Include(u => u.Profile)
                    .ThenInclude(p => p.ContactMethods)
                .Include(u => u.Profile)
                    .ThenInclude(p => p.Education)
                .Include(u => u.Profile)
                    .ThenInclude(p => p.Resumes)
                        .ThenInclude(r => r.Skills)
                .FirstOrDefault(u => u.Id == userId);

            if (user == null)
            {
                return NotFound();
            }

            // Real recent jobs for recommendations sidebar
            ViewBag.RecentJobs = _context.JobPostings
                .Include(j => j.Locations)
                .Where(j => j.isActive)
                .OrderByDescending(j => j.CreatedAt)
                .Take(3)
                .ToList();

            // Calculate real profile completion readiness percentage based on documented fields
            int readiness = 0;
            if (!string.IsNullOrWhiteSpace(user.Profile?.AvatarUrl)) readiness += 20;
            if (!string.IsNullOrWhiteSpace(user.Profile?.Bio) && user.Profile.Bio != "Chưa có tiểu sử.") readiness += 20;
            if (!string.IsNullOrWhiteSpace(user.Profile?.Location) && user.Profile.Location != "Chưa cập nhật" && user.Profile.Location != "Vị trí chưa xác định") readiness += 20;
            if (user.Profile?.ContactMethods != null && user.Profile.ContactMethods.Any()) readiness += 20;
            if (user.Profile?.Resumes != null && user.Profile.Resumes.Any()) readiness += 20;

            ViewBag.ProfileReadiness = readiness;

            return View(user);
        }
        [HttpPost]
        public IActionResult AddContact(ContactMethod contact)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }

            var profile = _context.Profiles
                .Include(p => p.ContactMethods)
                .FirstOrDefault(p => p.UserId == userId);

            if (profile != null)
            {
                var newContact = new ContactMethod
                {
                    MethodType = contact.MethodType,
                    Value = contact.Value,
                    idEmployesAccount = profile.Id 
                };

                _context.ContactMethods.Add(newContact);
                _context.SaveChanges();
            }

            return RedirectToAction("Index");
        }
        [HttpPost]
        public async Task<IActionResult> UpdateBio([FromBody] UpdateBioDto dto)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (userIdStr == null)
                return Unauthorized();

            int userId = int.Parse(userIdStr);

            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return NotFound();

            if (user.Profile == null)
            {
                user.Profile = new EmployesAccount
                {
                    UserId = user.Id,
                    FullName = user.Username ?? "User",
                    Location = "Chưa cập nhật"
                };
            }

            user.Profile.Bio = dto.Bio?.Trim();
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }

        [HttpPost]
        public async Task<IActionResult> UpdatePreferences([FromBody] UpdatePreferencesDto dto)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userIdStr == null) return Unauthorized();

            int userId = int.Parse(userIdStr);
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null || user.Profile == null) return NotFound();

            user.Profile.IsRemoteJob = dto.IsRemoteJob;
            user.Profile.IsLookingForJob = dto.IsLookingForJob;
            await _context.SaveChangesAsync();

            return Ok(new { success = true, isRemoteJob = user.Profile.IsRemoteJob, isLookingForJob = user.Profile.IsLookingForJob });
        }

        [HttpGet("/Profile/View/{id}")]
        public async Task<IActionResult> ViewProfile(int id)
        {
            var user = await _context.Users
                .Include(u => u.Posts)
                .Include(u => u.Profile)
                    .ThenInclude(p => p.ContactMethods)
                .Include(u => u.Profile)
                    .ThenInclude(p => p.Education)
                .Include(u => u.Profile)
                    .ThenInclude(p => p.Resumes)
                        .ThenInclude(r => r.Skills)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null) return NotFound();

            ViewBag.IsReadOnlyView = true;
            ViewBag.TargetUserId = id;
            ViewBag.ProfileReadiness = 100;
            ViewBag.RecentJobs = await _context.JobPostings.Where(j => j.isActive).Take(3).ToListAsync();

            return View("Index", user);
        }

        [HttpGet("/Users/Card/{id}")]
        public async Task<IActionResult> GetUserCard(int id)
        {
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int currentUserId = string.IsNullOrEmpty(currentUserIdClaim) ? 0 : int.Parse(currentUserIdClaim);

            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null) return NotFound();

            bool isOnline = ArisSkyve.Hubs.ChatHub.IsConnected(id);
            string friendStatus = "none";
            if (currentUserId > 0 && currentUserId != id)
            {
                var friendship = await _context.Friendships.FirstOrDefaultAsync(f =>
                    (f.RequesterId == currentUserId && f.AddresseeId == id) ||
                    (f.RequesterId == id && f.AddresseeId == currentUserId));

                if (friendship != null)
                {
                    if (friendship.Status == FriendshipStatus.Accepted) friendStatus = "accepted";
                    else if (friendship.RequesterId == currentUserId) friendStatus = "pending_sent";
                    else friendStatus = "pending_received";
                }
            }

            int mutualCount = 0;
            var mutualSample = new List<object>();
            if (currentUserId > 0 && currentUserId != id)
            {
                var myFriends = await _context.Friendships
                    .Where(f => f.Status == FriendshipStatus.Accepted && (f.RequesterId == currentUserId || f.AddresseeId == currentUserId))
                    .Select(f => f.RequesterId == currentUserId ? f.AddresseeId : f.RequesterId)
                    .ToListAsync();

                var theirFriends = await _context.Friendships
                    .Where(f => f.Status == FriendshipStatus.Accepted && (f.RequesterId == id || f.AddresseeId == id))
                    .Select(f => f.RequesterId == id ? f.AddresseeId : f.RequesterId)
                    .ToListAsync();

                var mutualIds = myFriends.Intersect(theirFriends).ToList();
                mutualCount = mutualIds.Count;
                if (mutualCount > 0)
                {
                    var samples = await _context.Users
                        .Include(u => u.Profile)
                        .Where(u => mutualIds.Take(2).Contains(u.Id))
                        .ToListAsync();

                    mutualSample = samples.Select(s => (object)new
                    {
                        id = s.Id,
                        name = s.Profile?.FullName ?? s.Username,
                        avatar = s.Profile?.AvatarUrl ?? "/images/default-avatar.png"
                    }).ToList();
                }
            }

            return Json(new
            {
                id = user.Id,
                name = user.Profile?.FullName ?? user.Username,
                avatar = user.Profile?.AvatarUrl ?? "/images/default-avatar.png",
                headline = user.Profile?.Bio ?? "Thành viên Aris",
                isOnline,
                friendStatus,
                mutualCount,
                mutualSample
            });
        }
    }
}
