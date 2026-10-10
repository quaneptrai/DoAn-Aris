using System.Security.Claims;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Presentation;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.ViewComponents
{
    /// <summary>
    /// Khung điều hướng của app (thiết kế "Aris Kinetic", 26/09/2026):
    /// sidebar (desktop) + thanh trên (desktop) + thanh tab (mobile) + popover thông báo/tài khoản.
    /// Mọi số liệu hiển thị ở sidebar đều là dữ liệu thật của người dùng.
    /// </summary>
    public class AppNavbarViewComponent : ViewComponent
    {
        private readonly ArisDBContext _context;

        public AppNavbarViewComponent(ArisDBContext context)
        {
            _context = context;
        }

        public async Task<IViewComponentResult> InvokeAsync(
            string? active = null,
            bool includeChatWidget = true,
            string theme = "light",
            IEnumerable<(string Label, string Href)>? chips = null)
        {
            var userIdClaim = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            {
                return Content(string.Empty);
            }

            var user = await _context.Users
                .AsNoTracking()
                .Include(u => u.Profile).ThenInclude(p => p!.Education)
                .Include(u => u.Profile).ThenInclude(p => p!.ContactMethods)
                .FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Content(string.Empty);

            var profile = user.Profile;
            var isBusiness = user.Role == "Business" || user.Role == "Admin" && profile is BussinessAccount;
            var fullName = profile is BussinessAccount biz && !string.IsNullOrWhiteSpace(biz.CompanyName)
                ? biz.CompanyName
                : (!string.IsNullOrWhiteSpace(profile?.FullName) ? profile!.FullName : user.Username);

            var model = new AppNavbarViewModel
            {
                Active = active,
                UserId = userId,
                AvatarUrl = profile?.AvatarUrl,
                Role = user.Role ?? "Employee",
                IsAdmin = AdminAccess.IsAdmin(user),
                HasBusinessProfile = profile is BussinessAccount,
                IncludeChatWidget = includeChatWidget,
                Theme = theme,
                FullName = fullName,
                Email = user.Email ?? string.Empty,
                Chips = chips?.ToList() ?? new List<(string, string)>()
            };

            model.UnreadMessages = await _context.Messages
                .CountAsync(m => m.ReceiverId == userId && !m.IsRead);

            if (profile != null)
            {
                if (isBusiness)
                {
                    var since = DateTime.UtcNow.AddDays(-7);
                    model.ActiveJobs = await _context.JobPostings
                        .CountAsync(j => j.BusinessAccountId == profile.Id && j.isActive);
                    model.NewApplicants = await _context.JobApplications
                        .CountAsync(a => a.JobPosting.BusinessAccountId == profile.Id
                                         && a.AppliedAt >= since
                                         && a.Status != JobApplicationStatus.Withdrawn);
                }
                else
                {
                    var now = DateTime.UtcNow;
                    model.HasUpcomingInterview = await _context.JobApplications
                        .AnyAsync(a => a.ApplicantId == profile.Id
                                       && a.Status == JobApplicationStatus.InterviewScheduled
                                       && a.InterviewAt >= now);

                    var hasResume = await _context.Resumes.AnyAsync(r => r.EmployeeId == profile.Id);
                    var (percent, missing) = ProfileCompleteness.Compute(profile, hasResume);
                    model.ProfilePercent = percent;
                    model.ProfileMissing = missing.Take(2).ToList();
                }
            }

            return View(model);
        }
    }

    public class AppNavbarViewModel
    {
        public string? Active { get; set; }
        public int UserId { get; set; }
        public string? AvatarUrl { get; set; }
        public string Role { get; set; } = "Employee";
        public bool IncludeChatWidget { get; set; } = true;
        public string Theme { get; set; } = "light";

        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public int UnreadMessages { get; set; }
        public bool HasUpcomingInterview { get; set; }
        public int ProfilePercent { get; set; }
        public List<string> ProfileMissing { get; set; } = new();
        public int ActiveJobs { get; set; }
        public int NewApplicants { get; set; }
        public List<(string Label, string Href)> Chips { get; set; } = new();

        public bool IsAdmin { get; set; }
        public bool HasBusinessProfile { get; set; }
        public bool IsBusiness => Role == "Business" || Role == "Admin" && HasBusinessProfile;
        public bool HasRealAvatar => AvatarPresentation.HasImage(AvatarUrl);
        public string? DeliveryAvatarUrl => PublicMediaDeliveryUrl.ToDeliveryUrl(AvatarUrl);

        public string Initials
        {
            get
            {
                return AvatarPresentation.Initials(FullName);
            }
        }

        /* Cùng công thức với toneOf() trong aris-shell.js để màu avatar khớp giữa server và client */
        public int Tone
        {
            get
            {
                return AvatarPresentation.Tone(FullName);
            }
        }
    }
}
