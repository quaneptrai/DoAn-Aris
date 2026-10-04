using ArisSkyve.Application.DTOs;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ArisSkyve.Controllers
{
    [Authorize]
    [Route("Interview")]
    public class InterviewController : Controller
    {
        private readonly ArisDBContext _context;

        public InterviewController(ArisDBContext context)
        {
            _context = context;
        }

        private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        // The in-app video interview room for one specific application. Only the candidate
        // who applied and the business that owns the posting may enter — checked here (not
        // just in VideoCallHub) so a wrong/expired link 404s straight away instead of
        // silently loading a room the signaling hub will then refuse to connect.
        [HttpGet("Room")]
        [HttpGet("Room/{id:int}")]
        public async Task<IActionResult> Room(int id)
        {
            var application = await _context.JobApplications
                .Include(a => a.Applicant)
                .Include(a => a.JobPosting).ThenInclude(j => j.BusinessAccount)
                .FirstOrDefaultAsync(a => a.Id == id);
            if (application == null) return NotFound();

            var candidateUserId = application.Applicant.UserId;
            var employerUserId = application.JobPosting.BusinessAccount?.UserId;

            bool isCandidate = CurrentUserId == candidateUserId;
            bool isEmployer = employerUserId.HasValue && CurrentUserId == employerUserId.Value;
            if (!isCandidate && !isEmployer) return Forbid();

            if (!application.IsVideoCall) return NotFound();

            var employerName = application.JobPosting.BusinessAccount?.CompanyName ?? application.JobPosting.Company;

            var model = new InterviewRoomViewModel
            {
                ApplicationId = application.Id,
                JobTitle = application.JobPosting.Title,
                ScheduledAt = application.InterviewAt,
                IsEmployer = isEmployer,
                SelfName = isEmployer ? employerName : application.Applicant.FullName,
                OtherPartyName = isEmployer ? application.Applicant.FullName : employerName,
                SelfUserId = CurrentUserId,
                OtherPartyUserId = isEmployer ? candidateUserId : (employerUserId ?? 0)
            };

            return View(model);
        }
    }
}
