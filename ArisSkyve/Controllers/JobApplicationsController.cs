using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services.Recruitment;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace ArisSkyve.Controllers
{
    [Authorize]
    public class JobApplicationsController : Controller
    {
        private readonly ArisDBContext _context;
        private readonly ApplicationScoringQueue? _scoringQueue;
        private readonly ApplicationMatchService? _matchService;
        private readonly SkillGapService? _gapService;

        public JobApplicationsController(ArisDBContext context, ApplicationScoringQueue? scoringQueue = null, ApplicationMatchService? matchService = null,
            SkillGapService? gapService = null)
        {
            _context = context;
            _scoringQueue = scoringQueue;
            _matchService = matchService;
            _gapService = gapService;
        }

        private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        private static List<string> ParseJsonList(string? json)
        {
            if (string.IsNullOrWhiteSpace(json) || json == "[]") return new List<string>();
            try
            {
                return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
            }
            catch (JsonException)
            {
                return new List<string>();
            }
        }

        private static string StatusLabel(string status) => RecruitmentFlow.StatusLabel(status);

        private static string EmployerLink(JobApplication a) => $"/Employer/Index?jobId={a.JobPostingId}&app={a.Id}";
        private static string CandidateLink(JobApplication a) => $"/JobApplications/MyApplications?app={a.Id}";

        private void AddEvent(JobApplication a, string type, string actorRole, string title, string? detail = null, bool isInternal = false)
        {
            _context.ApplicationEvents.Add(new ApplicationEvent
            {
                JobApplication = a,
                Type = type,
                ActorRole = actorRole,
                ActorUserId = actorRole == "System" ? null : CurrentUserId,
                Title = title,
                Detail = string.IsNullOrWhiteSpace(detail) ? null : detail.Trim(),
                IsInternal = isInternal,
                CreatedAt = DateTime.UtcNow
            });
        }

        private void Notify(int userId, string type, string content, string link)
        {
            _context.Notifications.Add(new Notification
            {
                UserId = userId,
                ActorId = CurrentUserId,
                Type = type,
                Content = content,
                Link = link,
                CreatedAt = DateTime.UtcNow
            });
        }

        private static string? Clip(string? s, int max)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            s = s.Trim();
            return s.Length > max ? s[..max] : s;
        }

        // Đơn thuộc tin của doanh nghiệp đang đăng nhập — null nếu không có quyền.
        private async Task<(User? user, JobApplication? app)> LoadEmployerApplicationAsync(int applicationId)
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile == null || user.Role != "Business") return (user, null);
            var app = await _context.JobApplications
                .Include(a => a.JobPosting)
                .Include(a => a.Applicant)
                .FirstOrDefaultAsync(a => a.Id == applicationId);
            if (app == null || app.JobPosting.BusinessAccountId != user.Profile.Id) return (user, null);
            return (user, app);
        }

        private async Task<(User? user, JobApplication? app)> LoadCandidateApplicationAsync(int applicationId)
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile == null) return (user, null);
            var app = await _context.JobApplications
                .Include(a => a.JobPosting).ThenInclude(j => j.BusinessAccount)
                .FirstOrDefaultAsync(a => a.Id == applicationId && a.ApplicantId == user.Profile.Id);
            return (user, app);
        }

        // Dữ liệu để render form ứng tuyển: CV của ứng viên, câu hỏi sàng lọc của job (nếu
        // có), và đơn đã nộp trước đó (nếu có) để UI hiện đúng trạng thái thay vì để ứng
        // viên nộp trùng.
        [HttpGet]
        public async Task<IActionResult> GetApplyModal(int jobId)
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile == null)
                return Json(new { success = false, message = "Vui lòng hoàn thiện hồ sơ trước khi ứng tuyển." });

            var job = await _context.JobPostings.FirstOrDefaultAsync(j => j.Id == jobId);
            if (job == null) return NotFound();

            if (user.Role == "Business")
            {
                return Json(new { success = false, isBusiness = true, isOwnJob = job.BusinessAccountId == user.Profile.Id });
            }

            var resumes = await _context.Resumes
                .Where(r => r.EmployeeId == user.Profile.Id)
                .OrderByDescending(r => r.LastUpdatedAt)
                .Select(r => new { id = r.Id, name = r.Label, fileUrl = r.FileUrl })
                .ToListAsync();

            var existingApplications = await _context.JobApplications
                .Where(a => a.JobPostingId == jobId && a.ApplicantId == user.Profile.Id && a.Status != JobApplicationStatus.Withdrawn)
                .OrderByDescending(a => a.AppliedAt)
                .ToListAsync();
            var existing = existingApplications.FirstOrDefault();

            return Json(new
            {
                success = true,
                isBusiness = false,
                jobActive = job.isActive,
                resumes,
                screeningQuestions = ParseJsonList(job.ScreeningQuestions),
                alreadyApplied = existing != null,
                applicationCount = existingApplications.Count,
                application = existing == null ? null : new { id = existing.Id, status = existing.Status, appliedAt = existing.AppliedAt }
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Apply(int jobId, [FromBody] SubmitJobApplicationDto dto)
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile == null)
                return Json(new { success = false, message = "Vui lòng hoàn thiện hồ sơ trước khi ứng tuyển." });

            if (user.Role == "Business")
                return Json(new { success = false, message = "Tài khoản doanh nghiệp không thể ứng tuyển vào tin tuyển dụng." });

            var job = await _context.JobPostings.FirstOrDefaultAsync(j => j.Id == jobId);
            if (job == null) return NotFound();

            if (!job.isActive)
                return Json(new { success = false, message = "Tin tuyển dụng này đã hết hạn hoặc ngừng nhận hồ sơ." });

            if (job.BusinessAccountId == user.Profile.Id)
                return Json(new { success = false, message = "Bạn không thể ứng tuyển vào tin của chính công ty mình." });

            // Candidates are allowed to apply more than once — the client-side flow (Jobs/
            // Details.cshtml) warns them re-applying can look unprofessional to the employer
            // and requires an explicit confirmation before hitting this endpoint again, but
            // it's never hard-blocked here. The employer's applicant list flags candidates
            // who show up more than once (see GetApplicantsForJob's applicationCount).
            var resume = dto == null ? null : await _context.Resumes.FirstOrDefaultAsync(r => r.Id == dto.ResumeId && r.EmployeeId == user.Profile.Id);
            if (resume == null)
                return Json(new { success = false, message = "Vui lòng chọn một CV hợp lệ." });

            var screeningQuestions = ParseJsonList(job.ScreeningQuestions);
            var screeningAnswers = dto!.ScreeningAnswers ?? new List<string>();
            if (screeningQuestions.Count > 0 &&
                (screeningAnswers.Count != screeningQuestions.Count || screeningAnswers.Any(string.IsNullOrWhiteSpace)))
                return Json(new { success = false, message = "Vui lòng trả lời đầy đủ câu hỏi của nhà tuyển dụng." });

            var application = new JobApplication
            {
                JobPostingId = jobId,
                ApplicantId = user.Profile.Id,
                ResumeId = resume.Id,
                ResumeSnapshotUrl = resume.FileUrl,
                ResumeSnapshotName = string.IsNullOrWhiteSpace(resume.Label) ? user.Profile.FullName : resume.Label,
                FullName = user.Profile.FullName,
                Email = string.IsNullOrWhiteSpace(resume.Email) ? user.Email : resume.Email,
                CoverLetter = Clip(dto.CoverLetter, 500),
                ScreeningAnswers = JsonSerializer.Serialize(screeningAnswers.Select(answer => answer.Trim()).ToList()),
                Status = JobApplicationStatus.Submitted,
                AppliedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.JobApplications.Add(application);
            AddEvent(application, ApplicationEventTypes.Applied, "Candidate", "Nộp hồ sơ", $"CV: {application.ResumeSnapshotName}");

            if (job.BusinessAccountId != null)
            {
                var businessProfile = await _context.Profiles.FirstOrDefaultAsync(p => p.Id == job.BusinessAccountId);
                if (businessProfile != null)
                {
                    _context.Notifications.Add(new Notification
                    {
                        UserId = businessProfile.UserId,
                        ActorId = user.Id,
                        Type = "JobApplication",
                        Content = $"{user.Profile.FullName} vừa ứng tuyển vào vị trí \"{job.Title}\".",
                        Link = $"/Employer/Index?jobId={job.Id}",
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return Json(new { success = false, message = "Không thể nộp đơn lúc này, vui lòng thử lại." });
            }

            // Chấm CV ↔ tin ở nền để nhà tuyển dụng mở bảng là thấy điểm và lý do.
            _scoringQueue?.Enqueue(application.Id);

            return Json(new { success = true, applicationId = application.Id });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Withdraw(int applicationId)
        {
            var (user, application) = await LoadCandidateApplicationAsync(applicationId);
            if (user?.Profile == null || application == null) return NotFound();

            if (application.Status is JobApplicationStatus.Offered or JobApplicationStatus.Hired or JobApplicationStatus.Rejected or JobApplicationStatus.Withdrawn)
                return Json(new { success = false, message = application.Status == JobApplicationStatus.Offered
                    ? "Bạn đang có offer cho đơn này — hãy trả lời offer thay vì rút đơn."
                    : "Không thể rút đơn ở trạng thái hiện tại." });

            application.Status = JobApplicationStatus.Withdrawn;
            application.UpdatedAt = DateTime.UtcNow;
            AddEvent(application, ApplicationEventTypes.Withdrawn, "Candidate", "Ứng viên rút đơn");

            var employerUserId = application.JobPosting.BusinessAccount?.UserId;
            if (employerUserId.HasValue)
                Notify(employerUserId.Value, "ApplicationWithdrawn", $"{user.Profile.FullName} đã rút đơn \"{application.JobPosting.Title}\".", EmployerLink(application));

            await _context.SaveChangesAsync();

            return Json(new { success = true });
        }

        [HttpGet]
        public async Task<IActionResult> MyApplications()
        {
            bool isAjax = Request.Headers["X-Requested-With"] == "XMLHttpRequest";

            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile == null)
            {
                var empty = new MyApplicationsViewModel();
                return isAjax ? PartialView("_MyApplicationsPartial", empty) : View(empty);
            }

            var rows = await _context.JobApplications
                .Include(a => a.JobPosting).ThenInclude(j => j.BusinessAccount)
                .Where(a => a.ApplicantId == user.Profile.Id)
                .OrderByDescending(a => a.UpdatedAt)
                .ToListAsync();

            var now = DateTime.UtcNow;
            var applications = rows.Select(a =>
            {
                var step = RecruitmentFlow.ForCandidate(a, now);
                return new MyApplicationItemViewModel
                {
                    Id = a.Id,
                    JobId = a.JobPostingId,
                    JobTitle = a.JobPosting.Title,
                    CompanyName = a.JobPosting.BusinessAccount != null ? a.JobPosting.BusinessAccount.CompanyName : a.JobPosting.Company,
                    CompanyLogo = a.JobPosting.BusinessAccount?.AvatarUrl,
                    Salary = a.JobPosting.Salary,
                    Status = a.Status,
                    StatusNote = a.StatusNote,
                    RejectionCategory = a.Status == JobApplicationStatus.Rejected ? a.RejectionCategory : null,
                    RejectionLabel = a.Status == JobApplicationStatus.Rejected ? RejectionCategories.Label(a.RejectionCategory ?? RejectionCategories.Other) : null,
                    AppliedAt = a.AppliedAt,
                    UpdatedAt = a.UpdatedAt,
                    CanWithdraw = !JobApplicationStatus.IsClosed(a.Status) && a.Status != JobApplicationStatus.Offered,
                    InterviewAt = a.InterviewAt,
                    InterviewLocation = a.InterviewLocation,
                    IsVideoCall = a.IsVideoCall,
                    InterviewResponse = a.InterviewResponse,
                    InterviewRound = a.InterviewRound,
                    InterviewDurationMinutes = a.InterviewDurationMinutes,
                    ProposedSlots = RecruitmentFlow.ParseSlots(a.ProposedSlotsJson),
                    MatchScore = a.MatchScore,
                    MatchSummary = a.MatchSummary,
                    OfferSalary = a.OfferSalary,
                    OfferStartDate = a.OfferStartDate,
                    OfferExpiresAt = a.OfferExpiresAt,
                    OfferResponse = a.OfferResponse,
                    NextStepKey = step.Key,
                    NextStepTitle = step.Title,
                    NextStepText = step.Text,
                    NextStepActions = step.Actions.ToList()
                };
            }).ToList();

            var model = new MyApplicationsViewModel { Applications = applications };
            return isAjax ? PartialView("_MyApplicationsPartial", model) : View(model);
        }

        // Danh sách ứng viên cho một job cụ thể — chỉ chủ sở hữu (BusinessAccount đã đăng
        // tin) mới được xem, dùng để đổ dữ liệu vào bảng Kanban của trang Employer.
        [HttpGet]
        public async Task<IActionResult> GetApplicantsForJob(int jobId, string? status = null)
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile == null || user.Role != "Business")
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể xem danh sách ứng viên." });

            var job = await _context.JobPostings.FirstOrDefaultAsync(j => j.Id == jobId);
            if (job == null) return NotFound();
            if (job.BusinessAccountId != user.Profile.Id)
                return Json(new { success = false, message = "Bạn không có quyền xem tin tuyển dụng này." });

            var query = _context.JobApplications
                .Include(a => a.Applicant)
                .Where(a => a.JobPostingId == jobId && a.Status != JobApplicationStatus.Withdrawn);

            if (!string.IsNullOrWhiteSpace(status) && JobApplicationStatus.All.Contains(status))
                query = query.Where(a => a.Status == status);

            var raw = await query
                .OrderByDescending(a => a.AppliedAt)
                .ToListAsync();

            var appIds = raw.Select(a => a.Id).ToList();
            var evaluations = await _context.InterviewEvaluations
                .Where(e => appIds.Contains(e.JobApplicationId))
                .ToListAsync();

            // Counted against ALL of this job's non-withdrawn applications (not just the
            // current status-filtered `raw`), so a candidate who applied under two different
            // statuses still gets flagged as having applied more than once.
            var applicationCounts = await _context.JobApplications
                .Where(a => a.JobPostingId == jobId && a.Status != JobApplicationStatus.Withdrawn)
                .GroupBy(a => a.ApplicantId)
                .Select(g => new { ApplicantId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.ApplicantId, x => x.Count);

            var hiredCount = await _context.JobApplications.CountAsync(a => a.JobPostingId == jobId && a.Status == JobApplicationStatus.Hired);
            var now = DateTime.UtcNow;

            var applicants = raw.Select(a =>
            {
                var roundEval = evaluations
                    .Where(e => e.JobApplicationId == a.Id && e.Round == a.InterviewRound)
                    .OrderByDescending(e => e.CreatedAt)
                    .FirstOrDefault();
                var step = RecruitmentFlow.ForEmployer(a, roundEval, now, hiredCount, job.Openings);
                var tier = MatchInsight.Tier(a.MatchScore);
                return new
                {
                    id = a.Id,
                    applicantId = a.ApplicantId,
                    candidateUserId = a.Applicant?.UserId,
                    fullName = a.FullName,
                    email = a.Email,
                    avatar = a.Applicant?.AvatarUrl,
                    jobTitle = a.Applicant?.JobTitle,
                    coverLetter = a.CoverLetter,
                    resumeUrl = a.ResumeSnapshotUrl,
                    resumeName = a.ResumeSnapshotName,
                    screeningAnswers = ParseJsonList(a.ScreeningAnswers),
                    status = a.Status,
                    statusLabel = StatusLabel(a.Status),
                    statusNote = a.StatusNote,
                    rejectionCategory = a.Status == JobApplicationStatus.Rejected ? a.RejectionCategory : null,
                    rejectionLabel = a.Status == JobApplicationStatus.Rejected ? RejectionCategories.Label(a.RejectionCategory ?? RejectionCategories.Other) : null,
                    appliedAt = a.AppliedAt,
                    updatedAt = a.UpdatedAt,
                    applicationCount = applicationCounts.GetValueOrDefault(a.ApplicantId, 1),
                    interviewAt = a.InterviewAt,
                    interviewLocation = a.InterviewLocation,
                    isVideoCall = a.IsVideoCall,
                    interviewResponse = a.InterviewResponse,
                    interviewRound = a.InterviewRound,
                    interviewDurationMinutes = a.InterviewDurationMinutes,
                    interviewDeclineReason = a.InterviewDeclineReason,
                    proposedSlots = RecruitmentFlow.ParseSlots(a.ProposedSlotsJson).Where(s => s > now).ToList(),
                    matchScore = a.MatchScore,
                    matchSummary = a.MatchSummary,
                    matchTier = tier.Key,
                    matchTierLabel = tier.Label,
                    matchError = a.MatchScoredAt == null ? a.MatchError : null,
                    matchPending = a.MatchScoredAt == null && (a.MatchAttempts < ApplicationMatchService.MaxAttempts || (_scoringQueue?.IsQueued(a.Id) ?? false)),
                    offerSalary = a.OfferSalary,
                    offerStartDate = a.OfferStartDate,
                    offerExpiresAt = a.OfferExpiresAt,
                    offerResponse = a.OfferResponse,
                    hiredAt = a.HiredAt,
                    lastEvaluation = roundEval == null ? null : new
                    {
                        round = roundEval.Round,
                        recommendation = roundEval.Recommendation,
                        recommendationLabel = RecruitmentFlow.RecommendationLabel(roundEval.Recommendation),
                        average = Math.Round((roundEval.TechnicalRating + roundEval.CommunicationRating + roundEval.ProblemSolvingRating + roundEval.CultureFitRating) / 4.0, 1)
                    },
                    nextStep = new { key = step.Key, title = step.Title, text = step.Text, actions = step.Actions }
                };
            }).ToList();

            // Vì sao hồ sơ rơi ở tin này — đếm trên mọi đơn bị từ chối, không theo bộ lọc trạng thái.
            var rejectionBreakdown = (await _context.JobApplications
                    .Where(a => a.JobPostingId == jobId && a.Status == JobApplicationStatus.Rejected)
                    .GroupBy(a => a.RejectionCategory)
                    .Select(g => new { Code = g.Key, Count = g.Count() })
                    .ToListAsync())
                .GroupBy(x => x.Code ?? RejectionCategories.Other)
                .Select(g => new { code = g.Key, label = RejectionCategories.Label(g.Key), count = g.Sum(x => x.Count) })
                .OrderByDescending(x => x.count)
                .ToList();

            return Json(new
            {
                success = true,
                jobTitle = job.Title,
                jobActive = job.isActive,
                openings = job.Openings,
                hiredCount,
                rejectionBreakdown,
                applicants
            });
        }

        // Ngăn chi tiết của nhà tuyển dụng: phân tích AI đầy đủ, câu hỏi sàng lọc + trả lời,
        // phiếu đánh giá các vòng và dòng thời gian.
        [HttpGet]
        public async Task<IActionResult> GetApplicationDetail(int applicationId)
        {
            var (_, app) = await LoadEmployerApplicationAsync(applicationId);
            if (app == null) return Json(new { success = false, message = "Bạn không có quyền xem đơn này." });

            var detail = MatchDetail.FromJson(app.MatchDetailJson);
            var questions = ParseJsonList(app.JobPosting.ScreeningQuestions);
            var answers = ParseJsonList(app.ScreeningAnswers);
            var evaluations = await _context.InterviewEvaluations
                .Where(e => e.JobApplicationId == app.Id)
                .OrderByDescending(e => e.Round).ThenByDescending(e => e.CreatedAt)
                .ToListAsync();
            var events = await _context.ApplicationEvents
                .Where(e => e.JobApplicationId == app.Id)
                .OrderByDescending(e => e.CreatedAt)
                .Take(50)
                .ToListAsync();

            var otherApplications = await _context.JobApplications
                .Where(a => a.ApplicantId == app.ApplicantId && a.Id != app.Id && a.JobPosting.BusinessAccountId == app.JobPosting.BusinessAccountId)
                .Select(a => new { id = a.Id, jobId = a.JobPostingId, jobTitle = a.JobPosting.Title, status = a.Status, appliedAt = a.AppliedAt })
                .Take(5)
                .ToListAsync();

            return Json(new
            {
                success = true,
                match = detail == null ? null : new
                {
                    score = detail.Score,
                    tier = MatchInsight.Tier(detail.Score).Key,
                    tierLabel = MatchInsight.Tier(detail.Score).Label,
                    summary = app.MatchSummary,
                    reason = detail.Reason,
                    advice = detail.Advice,
                    matched = detail.Matched,
                    missing = detail.Missing,
                    evidence = detail.Evidence,
                    explanationStatus = detail.ExplanationStatus,
                    semanticScore = detail.SemanticScore,
                    llmAdjustment = detail.LlmAdjustment,
                    probes = MatchInsight.InterviewProbes(detail),
                    scoredAt = app.MatchScoredAt
                },
                matchError = app.MatchScoredAt == null ? app.MatchError : null,
                screening = questions.Select((q, i) => new { question = q, answer = i < answers.Count ? answers[i] : null }).ToList(),
                evaluations = evaluations.Select(e => new
                {
                    id = e.Id,
                    round = e.Round,
                    technical = e.TechnicalRating,
                    communication = e.CommunicationRating,
                    problemSolving = e.ProblemSolvingRating,
                    cultureFit = e.CultureFitRating,
                    average = Math.Round((e.TechnicalRating + e.CommunicationRating + e.ProblemSolvingRating + e.CultureFitRating) / 4.0, 1),
                    recommendation = e.Recommendation,
                    recommendationLabel = RecruitmentFlow.RecommendationLabel(e.Recommendation),
                    strengths = e.Strengths,
                    concerns = e.Concerns,
                    createdAt = e.CreatedAt
                }),
                timeline = events.Select(e => new { type = e.Type, actor = e.ActorRole, title = e.Title, detail = e.Detail, isInternal = e.IsInternal, at = e.CreatedAt }),
                otherApplications
            });
        }

        // Nhà tuyển dụng bấm "Chấm lại" — chạy ngay (5–35 giây) thay vì chờ hàng đợi.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> RescoreApplication(int applicationId)
        {
            var (_, app) = await LoadEmployerApplicationAsync(applicationId);
            if (app == null) return Json(new { success = false, message = "Bạn không có quyền với đơn này." });
            if (_matchService == null) return Json(new { success = false, message = "Dịch vụ chấm điểm chưa sẵn sàng." });

            var outcome = await _matchService.ScoreAsync(app.Id, HttpContext.RequestAborted);
            if (!outcome.Success) return Json(new { success = false, message = outcome.Message });
            var tier = MatchInsight.Tier(app.MatchScore);
            return Json(new { success = true, matchScore = app.MatchScore, matchSummary = app.MatchSummary, matchTier = tier.Key, matchTierLabel = tier.Label });
        }

        // Xếp hàng chấm mọi đơn chưa có điểm của một tin (đơn cũ trước khi có tính năng này).
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> QueueScoringForJob(int jobId)
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile == null || user.Role != "Business") return Json(new { success = false });
            var job = await _context.JobPostings.FirstOrDefaultAsync(j => j.Id == jobId && j.BusinessAccountId == user.Profile.Id);
            if (job == null) return Json(new { success = false, message = "Không tìm thấy tin." });

            var pending = await _context.JobApplications
                .Where(a => a.JobPostingId == jobId && a.MatchScoredAt == null && a.Status != JobApplicationStatus.Withdrawn)
                .ToListAsync();
            // Cho phép thử lại cả đơn đã hết lượt tự động khi nhà tuyển dụng chủ động bấm.
            foreach (var a in pending.Where(a => a.MatchAttempts >= ApplicationMatchService.MaxAttempts))
                a.MatchAttempts = ApplicationMatchService.MaxAttempts - 1;
            await _context.SaveChangesAsync();

            var queued = pending.Count(a => _scoringQueue?.Enqueue(a.Id) ?? false);
            return Json(new { success = true, queued, total = pending.Count });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateApplicationStatus(int applicationId, [FromBody] UpdateApplicationStatusDto dto)
        {
            if (dto == null || !JobApplicationStatus.All.Contains(dto.Status) || dto.Status == JobApplicationStatus.Withdrawn)
                return Json(new { success = false, message = "Trạng thái không hợp lệ." });

            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile == null || user.Role != "Business")
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể cập nhật trạng thái." });

            var application = await _context.JobApplications
                .Include(a => a.JobPosting)
                .Include(a => a.Applicant)
                .FirstOrDefaultAsync(a => a.Id == applicationId);
            if (application == null) return NotFound();

            if (application.JobPosting.BusinessAccountId != user.Profile.Id)
                return Json(new { success = false, message = "Bạn không có quyền thao tác trên đơn ứng tuyển này." });

            if (application.Status == JobApplicationStatus.Withdrawn)
                return Json(new { success = false, message = "Ứng viên đã rút đơn ứng tuyển này." });

            var isReject = dto.Status == JobApplicationStatus.Rejected;
            if (isReject && !string.IsNullOrWhiteSpace(dto.RejectionCategory) && !RejectionCategories.All.Contains(dto.RejectionCategory))
                return Json(new { success = false, message = "Nhóm lý do từ chối không hợp lệ." });

            var previous = application.Status;
            application.Status = dto.Status;
            application.StatusNote = dto.Note;
            application.RejectionCategory = isReject
                ? (string.IsNullOrWhiteSpace(dto.RejectionCategory) ? RejectionCategories.Other : dto.RejectionCategory)
                : null;
            application.UpdatedAt = DateTime.UtcNow;

            if (dto.Status == JobApplicationStatus.Hired)
            {
                application.HiredAt ??= DateTime.UtcNow;
                if (application.OfferResponse == OfferResponses.Pending) application.OfferResponse = OfferResponses.Accepted;
            }
            else if (previous == JobApplicationStatus.Hired)
            {
                application.HiredAt = null;
            }

            AddEvent(application,
                dto.Status == JobApplicationStatus.Rejected ? ApplicationEventTypes.Rejected : ApplicationEventTypes.StatusChanged,
                "Employer",
                $"{StatusLabel(previous)} → {StatusLabel(dto.Status)}",
                isReject
                    ? string.Join("\n", new[] { RejectionCategories.Label(application.RejectionCategory), dto.Note }.Where(x => !string.IsNullOrWhiteSpace(x)))
                    : dto.Note);

            _context.Notifications.Add(new Notification
            {
                UserId = application.Applicant.UserId,
                ActorId = CurrentUserId,
                Type = "ApplicationStatus",
                Content = isReject
                    ? $"Đơn \"{application.JobPosting.Title}\" chưa phù hợp lần này. Xem lý do và lộ trình kỹ năng cho lần sau."
                    : $"Đơn ứng tuyển \"{application.JobPosting.Title}\" của bạn đã chuyển sang trạng thái: {StatusLabel(dto.Status)}.",
                Link = CandidateLink(application),
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Json(new { success = true, statusLabel = StatusLabel(dto.Status) });
        }

        // Schedules (or reschedules) an interview for an application: sets the status to
        // InterviewScheduled and stores the structured date/location alongside a free-text
        // note (reusing StatusNote, which already doubles as "note attached to the current
        // status" for the candidate-facing MyApplications view).
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ScheduleInterview(int applicationId, [FromBody] ScheduleInterviewDto dto)
        {
            if (dto == null || dto.ScheduledAt == default)
                return Json(new { success = false, message = "Vui lòng chọn thời gian phỏng vấn." });

            dto.ScheduledAt = VnTime.NormalizeToUtc(dto.ScheduledAt);
            if (dto.ScheduledAt < DateTime.UtcNow.AddMinutes(-5))
                return Json(new { success = false, message = "Thời gian phỏng vấn không thể ở quá khứ." });

            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile == null || user.Role != "Business")
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể lên lịch phỏng vấn." });

            var application = await _context.JobApplications
                .Include(a => a.JobPosting)
                .Include(a => a.Applicant)
                .FirstOrDefaultAsync(a => a.Id == applicationId);
            if (application == null) return NotFound();

            if (application.JobPosting.BusinessAccountId != user.Profile.Id)
                return Json(new { success = false, message = "Bạn không có quyền thao tác trên đơn ứng tuyển này." });

            if (application.Status is JobApplicationStatus.Withdrawn or JobApplicationStatus.Rejected or JobApplicationStatus.Offered or JobApplicationStatus.Hired)
                return Json(new { success = false, message = "Không thể lên lịch phỏng vấn ở trạng thái hiện tại." });

            var duration = Math.Clamp(dto.DurationMinutes ?? application.InterviewDurationMinutes, 15, 240);

            // Cảnh báo trùng giờ với buổi phỏng vấn khác của cùng doanh nghiệp.
            if (!dto.Force)
            {
                var start = dto.ScheduledAt;
                var end = start.AddMinutes(duration);
                var windowStart = start.AddHours(-5);
                var others = await _context.JobApplications
                    .Where(a => a.Id != application.Id
                                && a.JobPosting.BusinessAccountId == user.Profile.Id
                                && a.Status == JobApplicationStatus.InterviewScheduled
                                && a.InterviewResponse != InterviewResponses.Declined
                                && a.InterviewAt != null && a.InterviewAt < end && a.InterviewAt >= windowStart)
                    .Select(a => new { a.Id, a.FullName, a.InterviewAt, a.InterviewDurationMinutes, JobTitle = a.JobPosting.Title })
                    .ToListAsync();
                var conflicts = others
                    .Where(o => o.InterviewAt!.Value.AddMinutes(o.InterviewDurationMinutes) > start)
                    .Select(o => new { id = o.Id, name = o.FullName, jobTitle = o.JobTitle, at = o.InterviewAt, label = VnTime.Format(o.InterviewAt!.Value, "HH:mm dd/MM") })
                    .ToList();
                if (conflicts.Count > 0)
                    return Json(new { success = false, conflict = true, conflicts, message = "Khung giờ này trùng với buổi phỏng vấn khác." });
            }

            var isReschedule = application.Status == JobApplicationStatus.InterviewScheduled && !dto.NextRound;
            if (dto.NextRound && application.InterviewAt.HasValue) application.InterviewRound += 1;

            application.Status = JobApplicationStatus.InterviewScheduled;
            application.InterviewAt = dto.ScheduledAt;
            application.InterviewDurationMinutes = duration;
            application.IsVideoCall = dto.IsVideoCall;
            application.InterviewLocation = dto.IsVideoCall ? null : dto.Location;
            application.StatusNote = dto.Note;
            application.InterviewResponse = InterviewResponses.Pending;
            application.InterviewDeclineReason = null;
            application.ProposedSlotsJson = null;
            application.InterviewRespondedAt = null;
            application.Reminder24hSentAt = null;
            application.Reminder1hSentAt = null;
            application.FollowUpNudgedAt = null;
            application.UpdatedAt = DateTime.UtcNow;

            var whenText = VnTime.Format(dto.ScheduledAt, "HH:mm dd/MM/yyyy");
            var where = dto.IsVideoCall ? "phòng video Aris" : (string.IsNullOrWhiteSpace(dto.Location) ? "địa điểm sẽ báo sau" : dto.Location);
            AddEvent(application, ApplicationEventTypes.InterviewScheduled, "Employer",
                isReschedule ? $"Đổi lịch phỏng vấn vòng {application.InterviewRound}" : $"Mời phỏng vấn vòng {application.InterviewRound}",
                $"{whenText} · {duration} phút · {where}" + (string.IsNullOrWhiteSpace(dto.Note) ? "" : $"\n{dto.Note}"));

            _context.Notifications.Add(new Notification
            {
                UserId = application.Applicant.UserId,
                ActorId = CurrentUserId,
                Type = "InterviewScheduled",
                Content = isReschedule
                    ? $"Lịch phỏng vấn cho \"{application.JobPosting.Title}\" đã được đổi sang {whenText}. Vui lòng xác nhận."
                    : $"Bạn được mời phỏng vấn vòng {application.InterviewRound} cho \"{application.JobPosting.Title}\" vào lúc {whenText}. Vui lòng xác nhận.",
                Link = CandidateLink(application),
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Json(new
            {
                success = true,
                statusLabel = StatusLabel(application.Status),
                interviewAt = application.InterviewAt,
                interviewLocation = application.InterviewLocation,
                isVideoCall = application.IsVideoCall,
                interviewRound = application.InterviewRound,
                interviewDurationMinutes = application.InterviewDurationMinutes
            });
        }

        // Candidate-facing "Lời mời" (Invitations) list — every application of theirs
        // currently sitting at InterviewScheduled, most recent interview first. Kept
        // separate from MyApplications since these need an explicit accept/decline rather
        // than being just another passive status row.
        [HttpGet]
        public async Task<IActionResult> GetInterviewInvitations()
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile == null) return Json(new { success = true, invitations = Array.Empty<object>() });

            var invitations = await _context.JobApplications
                .Include(a => a.JobPosting).ThenInclude(j => j.BusinessAccount)
                .Where(a => a.ApplicantId == user.Profile.Id && a.Status == JobApplicationStatus.InterviewScheduled)
                .OrderByDescending(a => a.InterviewAt)
                .Select(a => new
                {
                    id = a.Id,
                    jobTitle = a.JobPosting.Title,
                    companyName = a.JobPosting.BusinessAccount != null ? a.JobPosting.BusinessAccount.CompanyName : a.JobPosting.Company,
                    companyLogo = a.JobPosting.BusinessAccount != null ? a.JobPosting.BusinessAccount.AvatarUrl : null,
                    interviewAt = a.InterviewAt,
                    interviewLocation = a.InterviewLocation,
                    isVideoCall = a.IsVideoCall,
                    interviewRound = a.InterviewRound,
                    note = a.StatusNote,
                    response = a.InterviewResponse
                })
                .ToListAsync();

            return Json(new { success = true, invitations });
        }

        // Candidate accepts or declines a scheduled interview. Doesn't change the
        // application's overall Status (stays InterviewScheduled either way) — Declined
        // tells the employer this time doesn't work; the optional reason + up to 3 proposed
        // slots let them re-book in one click instead of messaging back and forth.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> RespondToInterview(int applicationId, bool accept, string? reason = null, List<string>? proposedSlots = null)
        {
            var (user, application) = await LoadCandidateApplicationAsync(applicationId);
            if (user?.Profile == null || application == null) return NotFound();

            if (application.Status != JobApplicationStatus.InterviewScheduled)
                return Json(new { success = false, message = "Lời mời phỏng vấn này không còn hiệu lực." });

            var now = DateTime.UtcNow;
            var slots = (proposedSlots ?? new List<string>())
                .Select(RecruitmentFlow.ParseClientTime)
                .Where(s => s.HasValue && s.Value > now.AddMinutes(30))
                .Select(s => s!.Value)
                .Distinct()
                .OrderBy(s => s)
                .Take(3)
                .ToList();

            application.InterviewResponse = accept ? InterviewResponses.Accepted : InterviewResponses.Declined;
            application.InterviewRespondedAt = now;
            application.InterviewDeclineReason = accept ? null : Clip(reason, 500);
            application.ProposedSlotsJson = accept || slots.Count == 0 ? null : JsonSerializer.Serialize(slots);
            application.UpdatedAt = now;

            var slotText = string.Join(", ", slots.Select(s => VnTime.Format(s, "HH:mm dd/MM")));
            AddEvent(application,
                accept ? ApplicationEventTypes.InterviewAccepted : ApplicationEventTypes.InterviewDeclined,
                "Candidate",
                accept ? "Xác nhận tham gia phỏng vấn" : "Báo bận, xin đổi lịch",
                accept ? null : string.Join("\n", new[] { application.InterviewDeclineReason, slots.Count > 0 ? $"Giờ có thể tham gia: {slotText}" : null }.Where(x => !string.IsNullOrWhiteSpace(x))));

            var employerUserId = application.JobPosting.BusinessAccount?.UserId;
            if (employerUserId.HasValue)
            {
                Notify(employerUserId.Value, "InterviewResponse",
                    accept
                        ? $"{user.Profile.FullName} đã xác nhận tham gia phỏng vấn cho \"{application.JobPosting.Title}\"."
                        : $"{user.Profile.FullName} không tham gia được lịch phỏng vấn \"{application.JobPosting.Title}\""
                          + (slots.Count > 0 ? $" và đề xuất: {slotText}." : "."),
                    EmployerLink(application));
            }

            await _context.SaveChangesAsync();

            return Json(new { success = true, response = application.InterviewResponse, proposedSlots = slots });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SubmitEvaluation(int applicationId, [FromBody] SubmitEvaluationDto dto)
        {
            var (_, app) = await LoadEmployerApplicationAsync(applicationId);
            if (app == null) return Json(new { success = false, message = "Bạn không có quyền với đơn này." });
            if (dto == null || !EvaluationRecommendations.All.Contains(dto.Recommendation))
                return Json(new { success = false, message = "Chọn kết luận cho phiếu đánh giá." });
            var ratings = new[] { dto.TechnicalRating, dto.CommunicationRating, dto.ProblemSolvingRating, dto.CultureFitRating };
            if (ratings.Any(r => r < 1 || r > 5))
                return Json(new { success = false, message = "Mỗi tiêu chí chấm từ 1 đến 5." });
            if (app.Status is JobApplicationStatus.Withdrawn)
                return Json(new { success = false, message = "Ứng viên đã rút đơn." });

            var eval = new InterviewEvaluation
            {
                JobApplicationId = app.Id,
                Round = app.InterviewRound,
                EvaluatorUserId = CurrentUserId,
                TechnicalRating = dto.TechnicalRating,
                CommunicationRating = dto.CommunicationRating,
                ProblemSolvingRating = dto.ProblemSolvingRating,
                CultureFitRating = dto.CultureFitRating,
                Recommendation = dto.Recommendation,
                Strengths = Clip(dto.Strengths, 1500),
                Concerns = Clip(dto.Concerns, 1500),
                CreatedAt = DateTime.UtcNow
            };
            _context.InterviewEvaluations.Add(eval);
            app.FollowUpNudgedAt ??= DateTime.UtcNow;
            app.UpdatedAt = DateTime.UtcNow;
            var avg = Math.Round(ratings.Average(), 1);
            AddEvent(app, ApplicationEventTypes.Evaluated, "Employer",
                $"Phiếu đánh giá vòng {eval.Round}: {RecruitmentFlow.RecommendationLabel(eval.Recommendation)} ({avg}/5)",
                string.Join("\n", new[] { eval.Strengths == null ? null : $"Điểm mạnh: {eval.Strengths}", eval.Concerns == null ? null : $"Cần lưu ý: {eval.Concerns}" }.Where(x => x != null)),
                isInternal: true);

            await _context.SaveChangesAsync();

            var hired = await _context.JobApplications.CountAsync(a => a.JobPostingId == app.JobPostingId && a.Status == JobApplicationStatus.Hired);
            var step = RecruitmentFlow.ForEmployer(app, eval, DateTime.UtcNow.AddYears(1), hired, app.JobPosting.Openings);
            return Json(new { success = true, average = avg, nextStep = new { key = step.Key, title = step.Title, text = step.Text, actions = step.Actions } });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SendOffer(int applicationId, [FromBody] SendOfferDto dto)
        {
            var (_, app) = await LoadEmployerApplicationAsync(applicationId);
            if (app == null) return Json(new { success = false, message = "Bạn không có quyền với đơn này." });
            if (app.Status is JobApplicationStatus.Withdrawn or JobApplicationStatus.Rejected or JobApplicationStatus.Hired)
                return Json(new { success = false, message = "Không thể gửi offer ở trạng thái hiện tại." });

            var now = DateTime.UtcNow;
            var expires = dto?.ExpiresAt.HasValue == true ? VnTime.NormalizeToUtc(dto.ExpiresAt.Value) : now.AddDays(7);
            if (expires < now.AddHours(1))
                return Json(new { success = false, message = "Hạn trả lời phải sau thời điểm hiện tại." });

            var isResend = app.Status == JobApplicationStatus.Offered;
            app.Status = JobApplicationStatus.Offered;
            app.OfferSalary = Clip(dto?.Salary, 200);
            app.OfferStartDate = dto?.StartDate.HasValue == true ? VnTime.NormalizeToUtc(dto.StartDate.Value) : null;
            app.OfferExpiresAt = expires;
            app.OfferResponse = OfferResponses.Pending;
            app.OfferRespondedAt = null;
            app.OfferDeclineReason = null;
            app.StatusNote = Clip(dto?.Note, 2000);
            app.UpdatedAt = now;

            var parts = new List<string>();
            if (app.OfferSalary != null) parts.Add($"Lương: {app.OfferSalary}");
            if (app.OfferStartDate.HasValue) parts.Add($"Bắt đầu: {VnTime.Format(app.OfferStartDate.Value, "dd/MM/yyyy")}");
            parts.Add($"Hạn trả lời: {VnTime.Format(expires, "dd/MM/yyyy")}");
            AddEvent(app, ApplicationEventTypes.OfferSent, "Employer", isResend ? "Gửi lại offer" : "Gửi offer", string.Join(" · ", parts) + (app.StatusNote == null ? "" : $"\n{app.StatusNote}"));
            Notify(app.Applicant.UserId, "OfferSent",
                $"Bạn nhận được offer cho \"{app.JobPosting.Title}\". Trả lời trước {VnTime.Format(expires, "dd/MM/yyyy")}.",
                CandidateLink(app));

            await _context.SaveChangesAsync();
            return Json(new { success = true, statusLabel = StatusLabel(app.Status), offerExpiresAt = app.OfferExpiresAt });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> RespondToOffer(int applicationId, bool accept, string? reason = null)
        {
            var (user, app) = await LoadCandidateApplicationAsync(applicationId);
            if (user?.Profile == null || app == null) return NotFound();
            if (app.Status != JobApplicationStatus.Offered || app.OfferResponse == OfferResponses.Declined)
                return Json(new { success = false, message = "Offer này không còn chờ phản hồi." });

            var now = DateTime.UtcNow;
            app.OfferRespondedAt = now;
            app.UpdatedAt = now;
            if (accept)
            {
                app.OfferResponse = OfferResponses.Accepted;
                app.Status = JobApplicationStatus.Hired;
                app.HiredAt = now;
            }
            else
            {
                app.OfferResponse = OfferResponses.Declined;
                app.OfferDeclineReason = Clip(reason, 500);
            }
            AddEvent(app, accept ? ApplicationEventTypes.OfferAccepted : ApplicationEventTypes.OfferDeclined, "Candidate",
                accept ? "Nhận offer" : "Từ chối offer", accept ? null : app.OfferDeclineReason);

            await _context.SaveChangesAsync();

            var hired = await _context.JobApplications.CountAsync(a => a.JobPostingId == app.JobPostingId && a.Status == JobApplicationStatus.Hired);
            var openings = app.JobPosting.Openings;
            var employerUserId = app.JobPosting.BusinessAccount?.UserId;
            if (employerUserId.HasValue)
            {
                var full = accept && openings.HasValue && hired >= openings.Value && app.JobPosting.isActive;
                Notify(employerUserId.Value, accept ? "OfferAccepted" : "OfferDeclined",
                    accept
                        ? $"{user.Profile.FullName} đã nhận offer \"{app.JobPosting.Title}\"." + (full ? $" Đã đủ {hired}/{openings} người — cân nhắc đóng tin." : "")
                        : $"{user.Profile.FullName} đã từ chối offer \"{app.JobPosting.Title}\"" + (app.OfferDeclineReason == null ? "." : $": {app.OfferDeclineReason}"),
                    EmployerLink(app));
                await _context.SaveChangesAsync();
            }

            return Json(new { success = true, status = app.Status, statusLabel = StatusLabel(app.Status) });
        }

        // File .ics cho cả hai phía — mở được bằng Google Calendar, Outlook, Lịch iOS.
        [HttpGet]
        public async Task<IActionResult> InterviewIcs(int applicationId)
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Profile == null) return NotFound();
            var app = await _context.JobApplications
                .Include(a => a.JobPosting).ThenInclude(j => j.BusinessAccount)
                .FirstOrDefaultAsync(a => a.Id == applicationId);
            if (app == null || app.InterviewAt == null) return NotFound();
            var isOwner = app.ApplicantId == user.Profile.Id || app.JobPosting.BusinessAccountId == user.Profile.Id;
            if (!isOwner) return NotFound();

            static string Esc(string? s) => (s ?? "").Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\r", "").Replace("\n", "\\n");
            string Ts(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc).ToString("yyyyMMdd'T'HHmmss'Z'");

            var company = app.JobPosting.BusinessAccount?.CompanyName ?? app.JobPosting.Company;
            var start = app.InterviewAt.Value;
            var end = start.AddMinutes(Math.Max(15, app.InterviewDurationMinutes));
            var room = $"{Request.Scheme}://{Request.Host}/Interview/Room/{app.Id}";
            var location = app.IsVideoCall ? room : (app.InterviewLocation ?? "");
            var desc = $"Phỏng vấn vòng {app.InterviewRound} — {app.JobPosting.Title} ({company})."
                       + (app.IsVideoCall ? $"\nPhòng video: {room}" : "")
                       + (string.IsNullOrWhiteSpace(app.StatusNote) ? "" : $"\n{app.StatusNote}");

            var sb = new StringBuilder();
            sb.Append("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Aris//Recruitment//VI\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n");
            sb.Append("BEGIN:VEVENT\r\n");
            sb.Append($"UID:aris-interview-{app.Id}-r{app.InterviewRound}@aris\r\n");
            sb.Append($"DTSTAMP:{Ts(DateTime.UtcNow)}\r\n");
            sb.Append($"DTSTART:{Ts(start)}\r\nDTEND:{Ts(end)}\r\n");
            sb.Append($"SUMMARY:{Esc($"Phỏng vấn: {app.JobPosting.Title} — {(app.ApplicantId == user.Profile.Id ? company : app.FullName)}")}\r\n");
            sb.Append($"LOCATION:{Esc(location)}\r\n");
            sb.Append($"DESCRIPTION:{Esc(desc)}\r\n");
            sb.Append("BEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY\r\nDESCRIPTION:Phỏng vấn sau 30 phút\r\nEND:VALARM\r\n");
            sb.Append("END:VEVENT\r\nEND:VCALENDAR\r\n");

            return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/calendar; charset=utf-8", $"phong-van-{app.Id}.ics");
        }

        // "Vì sao?" phía ứng viên cho một đơn của chính họ: phân tích CV ↔ tin, gợi ý sửa CV và
        // lời nhắn của nhà tuyển dụng. Không trả phiếu đánh giá nội bộ.
        [HttpGet]
        public async Task<IActionResult> GetMyApplicationInsight(int applicationId)
        {
            var (_, app) = await LoadCandidateApplicationAsync(applicationId);
            if (app == null) return Json(new { success = false, message = "Không tìm thấy đơn ứng tuyển." });

            if (app.MatchScoredAt == null && _matchService != null && app.MatchAttempts < ApplicationMatchService.MaxAttempts + 2)
            {
                await _matchService.ScoreAsync(app.Id, HttpContext.RequestAborted);
                await _context.Entry(app).ReloadAsync();
            }

            var detail = MatchDetail.FromJson(app.MatchDetailJson);
            var events = await _context.ApplicationEvents
                .Where(e => e.JobApplicationId == app.Id && !e.IsInternal)
                .OrderByDescending(e => e.CreatedAt)
                .Take(30)
                .Select(e => new { type = e.Type, actor = e.ActorRole, title = e.Title, detail = e.Detail, at = e.CreatedAt })
                .ToListAsync();

            return Json(new
            {
                success = true,
                job = new
                {
                    id = app.JobPostingId,
                    title = app.JobPosting.Title,
                    company = app.JobPosting.BusinessAccount?.CompanyName ?? app.JobPosting.Company
                },
                status = app.Status,
                statusLabel = StatusLabel(app.Status),
                employerNote = app.StatusNote,
                rejection = app.Status != JobApplicationStatus.Rejected ? null : new
                {
                    category = app.RejectionCategory ?? RejectionCategories.Other,
                    label = RejectionCategories.Label(app.RejectionCategory ?? RejectionCategories.Other),
                    note = app.StatusNote,
                    // Đơn cũ (trước khi có nhóm lý do) cũng hiện lộ trình — chỉ ẩn khi lý do không phải năng lực.
                    skillGap = app.RejectionCategory == null || RejectionCategories.IsSkillGap(app.RejectionCategory)
                },
                resumeId = app.ResumeId,
                match = detail == null ? null : new
                {
                    score = detail.Score,
                    tier = MatchInsight.Tier(detail.Score).Key,
                    tierLabel = MatchInsight.Tier(detail.Score).Label,
                    summary = app.MatchSummary,
                    reason = detail.Reason,
                    advice = detail.Advice,
                    matched = detail.Matched,
                    missing = detail.Missing,
                    evidence = detail.Evidence,
                    explanationStatus = detail.ExplanationStatus,
                    cvSuggestions = MatchInsight.CvSuggestions(detail, app.JobPosting.Title)
                },
                matchError = detail == null ? (app.MatchError ?? "AI chưa chấm được CV này.") : null,
                timeline = events
            });
        }

        // Lộ trình kỹ năng cho đúng tin này (AiCore /api/v2/skills/gap-plan): CV đã nộp + kỹ năng AI
        // thấy CV chưa nhắc → học gì trước, học gì sau. Ngăn "Vì sao?" gọi sau khi có phân tích.
        [HttpGet]
        public async Task<IActionResult> GetMyApplicationGapPlan(int applicationId)
        {
            var (_, app) = await LoadCandidateApplicationAsync(applicationId);
            if (app == null) return Json(new { success = false, message = "Không tìm thấy đơn ứng tuyển." });
            if (_gapService == null) return Json(new { success = false, message = "Dịch vụ kỹ năng chưa sẵn sàng." });

            var outcome = await _gapService.ForApplicationAsync(app, MatchDetail.FromJson(app.MatchDetailJson), HttpContext.RequestAborted);
            return outcome.Success
                ? Json(new { success = true, plan = outcome.Plan })
                : Json(new { success = false, message = outcome.Message });
        }
    }
}
