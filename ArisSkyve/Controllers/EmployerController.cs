using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ArisSkyve.Infrastructure.Services.Recruitment;
using System.Security.Claims;

namespace ArisSkyve.Controllers
{
    // Dedicated landing page for Business-role accounts: an overview (active/closed jobs,
    // applicant totals, a status funnel) plus quick actions, instead of the stats that used
    // to live bolted onto the Business branch of Views/Jobs/Index.cshtml. Posting/editing a
    // job and managing applicants still happen on Jobs/Index (its modals do the real work);
    // this page links into them rather than re-implementing that UI a second time.
    [Authorize]
    public class EmployerController : Controller
    {
        private readonly ArisDBContext _context;

        public EmployerController(ArisDBContext context)
        {
            _context = context;
        }

        private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        private static readonly (string Status, string Label)[] FunnelOrder =
        {
            (JobApplicationStatus.Submitted, "Submitted"),
            (JobApplicationStatus.UnderReview, "Under Review"),
            (JobApplicationStatus.Shortlisted, "Shortlisted"),
            (JobApplicationStatus.InterviewScheduled, "Interview"),
            (JobApplicationStatus.Offered, "Offered"),
            (JobApplicationStatus.Hired, "Hired"),
            (JobApplicationStatus.Rejected, "Rejected"),
        };

        public async Task<IActionResult> Index()
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile is not BussinessAccount business)
                return RedirectToAction("Index", "Jobs");

            var jobs = await _context.JobPostings
                .Where(j => j.BusinessAccountId == business.Id)
                .OrderByDescending(j => j.CreatedAt)
                .Select(j => new BusinessJobSummaryViewModel
                {
                    Id = j.Id,
                    Title = j.Title,
                    Salary = j.Salary,
                    CreatedAt = j.CreatedAt,
                    IsActive = j.isActive,
                    Openings = j.Openings,
                    ApplicantCount = _context.JobApplications.Count(a => a.JobPostingId == j.Id && a.Status != JobApplicationStatus.Withdrawn),
                    HiredCount = _context.JobApplications.Count(a => a.JobPostingId == j.Id && a.Status == JobApplicationStatus.Hired),
                    // Việc đang chờ nhà tuyển dụng: hồ sơ mới, ứng viên xin đổi lịch, offer bị từ chối.
                    ActionNeededCount = _context.JobApplications.Count(a => a.JobPostingId == j.Id
                        && (a.Status == JobApplicationStatus.Submitted
                            || (a.Status == JobApplicationStatus.InterviewScheduled && a.InterviewResponse == InterviewResponses.Declined)
                            || (a.Status == JobApplicationStatus.Offered && a.OfferResponse == OfferResponses.Declined)))
                })
                .ToListAsync();

            var jobIds = jobs.Select(j => j.Id).ToList();
            var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);

            var applications = await _context.JobApplications
                .Where(a => jobIds.Contains(a.JobPostingId) && a.Status != JobApplicationStatus.Withdrawn)
                .Select(a => new { a.Status, a.AppliedAt })
                .ToListAsync();

            var statusBreakdown = FunnelOrder
                .Select(f => new StatusCountViewModel
                {
                    Status = f.Status,
                    Label = f.Label,
                    Count = applications.Count(a => a.Status == f.Status)
                })
                .ToList();

            var model = new EmployerDashboardViewModel
            {
                CompanyId = business.Id,
                CompanyName = business.CompanyName,
                AvatarUrl = business.AvatarUrl,
                IsVerified = business.IsVerified,
                ActiveJobCount = jobs.Count(j => j.IsActive),
                ClosedJobCount = jobs.Count(j => !j.IsActive),
                TotalApplicants = applications.Count,
                NewApplicantsLast7Days = applications.Count(a => a.AppliedAt >= sevenDaysAgo),
                StatusBreakdown = statusBreakdown,
                Jobs = jobs
            };

            return View(model);
        }

        // Lịch phỏng vấn của mọi tin thuộc doanh nghiệp trong khoảng [from, to) (UTC, ISO).
        [HttpGet]
        public async Task<IActionResult> GetInterviews(DateTime? from = null, DateTime? to = null)
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile is not BussinessAccount business)
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới xem được lịch phỏng vấn." });

            var start = from.HasValue ? VnTime.NormalizeToUtc(from.Value) : DateTime.UtcNow.Date.AddDays(-7);
            var end = to.HasValue ? VnTime.NormalizeToUtc(to.Value) : start.AddDays(14);
            if (end <= start || (end - start).TotalDays > 62) end = start.AddDays(7);

            var now = DateTime.UtcNow;
            var rows = await _context.JobApplications
                .Where(a => a.JobPosting.BusinessAccountId == business.Id
                            && a.InterviewAt != null && a.InterviewAt >= start && a.InterviewAt < end
                            && a.Status != JobApplicationStatus.Withdrawn)
                .OrderBy(a => a.InterviewAt)
                .Select(a => new
                {
                    a.Id,
                    a.JobPostingId,
                    JobTitle = a.JobPosting.Title,
                    a.FullName,
                    Avatar = a.Applicant.AvatarUrl,
                    a.InterviewAt,
                    a.InterviewDurationMinutes,
                    a.IsVideoCall,
                    a.InterviewLocation,
                    a.InterviewResponse,
                    a.InterviewRound,
                    a.Status,
                    HasEvaluation = a.Evaluations.Any(e => e.Round == a.InterviewRound)
                })
                .ToListAsync();

            var interviews = rows.Select(a => new
            {
                id = a.Id,
                jobId = a.JobPostingId,
                jobTitle = a.JobTitle,
                name = a.FullName,
                avatar = a.Avatar,
                at = a.InterviewAt,
                duration = a.InterviewDurationMinutes,
                isVideoCall = a.IsVideoCall,
                location = a.InterviewLocation,
                response = a.InterviewResponse,
                round = a.InterviewRound,
                status = a.Status,
                // Lịch cũ của đơn đã qua bước phỏng vấn vẫn hiện, nhưng mờ đi.
                isCurrent = a.Status == JobApplicationStatus.InterviewScheduled,
                needsEvaluation = a.Status == JobApplicationStatus.InterviewScheduled
                                  && a.InterviewResponse != InterviewResponses.Declined
                                  && !a.HasEvaluation
                                  && a.InterviewAt!.Value.AddMinutes(a.InterviewDurationMinutes) <= now
            });

            return Json(new { success = true, from = start, to = end, interviews });
        }
    }
}
