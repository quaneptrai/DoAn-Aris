using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;

using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace ArisSkyve.Controllers
{

    using ArisSkyve.Infrastructure.Services;

    [Authorize]
    public class JobsController : Controller
    {
        private readonly ArisDBContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IV7FeatureGate _featureGate;
        private readonly ILogger<JobsController>? _logger;

        private static readonly ConcurrentDictionary<int, SemaphoreSlim> _userLocks = new();

        public JobsController(
            ArisDBContext context,
            IConfiguration config,
            IHttpClientFactory httpClientFactory,
            IV7FeatureGate featureGate,
            ILogger<JobsController>? logger = null)
        {
            _context = context;
            _config = config;
            _httpClientFactory = httpClientFactory;
            _featureGate = featureGate;
            _logger = logger;
        }

        [HttpPost]
        [Route("Jobs/ToggleSave/{id}")]
        [Route("Jobs/ToggleSave")]
        [Route("Jobs/SaveJob/{id}")]
        public async Task<IActionResult> ToggleSave(int id)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            var job = await _context.JobPostings.FirstOrDefaultAsync(j => j.Id == id);
            if (job == null) return NotFound();

            var existing = await _context.SavedJobs.FirstOrDefaultAsync(s => s.UserId == userId && s.JobPostingId == id);
            bool saved = false;
            if (existing != null)
            {
                _context.SavedJobs.Remove(existing);
                saved = false;
            }
            else
            {
                _context.SavedJobs.Add(new SavedJob
                {
                    UserId = userId,
                    JobPostingId = id,
                    CreatedAt = DateTime.UtcNow
                });
                saved = true;
            }

            await _context.SaveChangesAsync();
            return Json(new { success = true, saved });
        }

        [HttpGet]
        [Route("Jobs/Saved")]
        public async Task<IActionResult> Saved(int page = 1, int take = 10)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            take = Math.Clamp(take, 1, 50);
            int skip = (Math.Max(page, 1) - 1) * take;

            var savedJobs = await _context.SavedJobs
                .Include(s => s.JobPosting).ThenInclude(j => j.Locations)
                .Include(s => s.JobPosting).ThenInclude(j => j.BusinessAccount)
                .Where(s => s.UserId == userId && s.JobPosting.isActive)
                .OrderByDescending(s => s.CreatedAt)
                .Skip(skip)
                .Take(take)
                .Select(s => new
                {
                    id = s.JobPosting.Id,
                    title = s.JobPosting.Title,
                    company = s.JobPosting.Company,
                    salary = s.JobPosting.Salary,
                    locations = s.JobPosting.Locations.Select(l => l.City).ToList(),
                    category = s.JobPosting.Category,
                    savedAt = s.CreatedAt.ToString("o")
                })
                .ToListAsync();

            return Json(new { success = true, jobs = savedJobs });
        }

        [HttpGet]
        [Route("Jobs/Facets")]
        public async Task<IActionResult> Facets(string? q = null, string? location = null, string? category = null, string? workMode = null)
        {
            var baseQuery = _context.JobPostings.Where(j => j.isActive);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var search = q.Trim().ToLower();
                baseQuery = baseQuery.Where(j => j.Title.ToLower().Contains(search) || j.Company.ToLower().Contains(search) || j.Category.ToLower().Contains(search));
            }

            // Category counts
            var catQuery = baseQuery;
            if (!string.IsNullOrWhiteSpace(location))
            {
                var loc = location.Trim().ToLower();
                catQuery = catQuery.Where(j => j.Locations.Any(l => l.City.ToLower().Contains(loc) || l.Address.ToLower().Contains(loc)) || j.LocationTags.ToLower().Contains(loc));
            }
            if (!string.IsNullOrWhiteSpace(workMode))
            {
                catQuery = catQuery.Where(j => j.WorkTime == workMode);
            }
            var categoryCounts = await catQuery
                .GroupBy(j => j.Category)
                .Select(g => new { key = g.Key, count = g.Count() })
                .ToDictionaryAsync(x => x.key ?? "Khác", x => x.count);

            // WorkMode counts
            var wmQuery = baseQuery;
            if (!string.IsNullOrWhiteSpace(location))
            {
                var loc = location.Trim().ToLower();
                wmQuery = wmQuery.Where(j => j.Locations.Any(l => l.City.ToLower().Contains(loc) || l.Address.ToLower().Contains(loc)) || j.LocationTags.ToLower().Contains(loc));
            }
            if (!string.IsNullOrWhiteSpace(category))
            {
                wmQuery = wmQuery.Where(j => j.Category == category);
            }
            var workModeCounts = await wmQuery
                .GroupBy(j => j.WorkTime)
                .Select(g => new { key = g.Key, count = g.Count() })
                .ToDictionaryAsync(x => x.key ?? "Toàn thời gian", x => x.count);

            // Location counts
            var locQuery = baseQuery;
            if (!string.IsNullOrWhiteSpace(category))
            {
                locQuery = locQuery.Where(j => j.Category == category);
            }
            if (!string.IsNullOrWhiteSpace(workMode))
            {
                locQuery = locQuery.Where(j => j.WorkTime == workMode);
            }
            var locationCounts = await locQuery
                .SelectMany(j => j.Locations)
                .GroupBy(l => l.City)
                .Select(g => new { key = g.Key, count = g.Count() })
                .ToDictionaryAsync(x => x.key ?? "Toàn quốc", x => x.count);

            return Json(new
            {
                category = categoryCounts,
                workMode = workModeCounts,
                location = locationCounts
            });
        }

        public async Task<IActionResult> Index(string? q = null, string? location = null, string? category = null, string? workMode = null, string? sort = null)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return RedirectToAction("Login", "Account");
            int userId = int.Parse(userIdClaim);

            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            var query = _context.JobPostings
                .Include(j => j.Locations)
                .Include(j => j.BusinessAccount)
                .Where(j => j.isActive);

            if (!string.IsNullOrWhiteSpace(q))
            {
                var search = q.Trim().ToLower();
                query = query.Where(j => j.Title.ToLower().Contains(search) || j.Company.ToLower().Contains(search) || j.Category.ToLower().Contains(search));
            }

            if (!string.IsNullOrWhiteSpace(location))
            {
                var loc = location.Trim().ToLower();
                query = query.Where(j => j.Locations.Any(l => l.City.ToLower().Contains(loc) || l.Address.ToLower().Contains(loc)) || j.LocationTags.ToLower().Contains(loc));
            }

            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(j => j.Category == category);
            }

            if (!string.IsNullOrWhiteSpace(workMode))
            {
                query = query.Where(j => j.WorkTime.Contains(workMode));
            }

            if (sort == "oldest")
            {
                query = query.OrderBy(j => j.CreatedAt);
            }
            else
            {
                query = query.OrderByDescending(j => j.CreatedAt);
            }

            var totalJobsCount = await query.CountAsync();
            var jobs = await query.Take(10).ToListAsync();

            ViewData["UserRole"] = user?.Role;
            ViewBag.SearchQuery = q;
            ViewBag.SearchLocation = location;
            ViewBag.SelectedCategory = category;
            ViewBag.SelectedWorkMode = workMode;
            ViewBag.SelectedSort = sort;
            ViewBag.TotalJobsCount = totalJobsCount;

            var model = new JobsIndexViewModel
            {
                User = user,
                Profile = user?.Profile,
                JobPostings = jobs,
                RecommendedJobs = new List<JobRecommendationDTO>()
            };

            if (user?.Profile != null && user.Role == "Business")
            {
                model.MyJobPostings = await _context.JobPostings
                    .Include(j => j.Locations)
                    .Where(j => j.BusinessAccountId == user.Profile.Id)
                    .OrderByDescending(j => j.CreatedAt)
                    .Select(j => new BusinessJobSummaryViewModel
                    {
                        Id = j.Id,
                        Title = j.Title,
                        Salary = j.Salary,
                        CreatedAt = j.CreatedAt,
                        IsActive = j.isActive,
                        ApplicantCount = _context.JobApplications.Count(a => a.JobPostingId == j.Id && a.Status != "Withdrawn"),
                        HiredCount = _context.JobApplications.Count(a => a.JobPostingId == j.Id && a.Status == "Hired"),
                        Openings = j.Openings
                    })
                    .ToListAsync();
            }
            else if (user?.Profile != null && user.Role == "Employee")
            {
                ViewBag.AppliedJobsCount = await _context.JobApplications
                    .CountAsync(a => a.ApplicantId == user.Profile.Id && a.Status != "Withdrawn");
            }

            return View(model);
        }

        [HttpGet]
        public async Task<IActionResult> Details(int id)
        {
            var job = await _context.JobPostings
                .Include(j => j.Locations)
                .Include(j => j.BusinessAccount)
                .FirstOrDefaultAsync(j => j.Id == id);

            if (job == null) return NotFound();

            // Thẻ chi tiết (bản "Aris Night"): đã ứng tuyển chưa, việc khác cùng công ty, việc tương tự — đều từ dữ liệu thật
            var uidClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(uidClaim, out var uid))
            {
                var profileId = await _context.Profiles.Where(p => p.UserId == uid).Select(p => (int?)p.Id).FirstOrDefaultAsync();
                if (profileId != null)
                {
                    ViewBag.AppliedAt = await _context.JobApplications
                        .Where(a => a.JobPostingId == id && a.ApplicantId == profileId && a.Status != JobApplicationStatus.Withdrawn)
                        .Select(a => (DateTime?)a.AppliedAt)
                        .FirstOrDefaultAsync();
                }
            }

            if (job.BusinessAccountId.HasValue)
            {
                ViewBag.CompanyOpenJobs = await _context.JobPostings.CountAsync(j => j.BusinessAccountId == job.BusinessAccountId && j.isActive);
                ViewBag.CompanyJobs = await _context.JobPostings
                    .Include(j => j.Locations)
                    .Where(j => j.BusinessAccountId == job.BusinessAccountId && j.isActive && j.Id != id)
                    .OrderByDescending(j => j.CreatedAt)
                    .Take(4)
                    .ToListAsync();
            }

            if (!string.IsNullOrWhiteSpace(job.Category))
            {
                ViewBag.SimilarJobs = await _context.JobPostings
                    .Include(j => j.Locations)
                    .Include(j => j.BusinessAccount)
                    .Where(j => j.isActive && j.Id != id && j.Category == job.Category && j.BusinessAccountId != job.BusinessAccountId)
                    .OrderByDescending(j => j.CreatedAt)
                    .Take(4)
                    .ToListAsync();
            }

            return View(job);
        }

        [HttpGet]
        public async Task<IActionResult> GetAiRecommendations(int topK = 5, bool force = false)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Content("");
            int currentUserId = int.Parse(userIdClaim);

            topK = Math.Clamp(topK, 1, 50);

            var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.UserId == currentUserId);
            if (profile == null)
                return Content("<div class='p-4 text-center text-muted'>Vui lòng hoàn thiện hồ sơ cá nhân để nhận gợi ý việc làm.</div>");

            // Chọn đúng CV engine sử dụng: CV mới nhất có VectorId hợp lệ (theo LastUpdatedAt DESC, Id DESC)
            var resume = await _context.Resumes
                .Where(r => r.EmployeeId == profile.Id && !string.IsNullOrEmpty(r.VectorId))
                .OrderByDescending(r => r.LastUpdatedAt)
                .ThenByDescending(r => r.Id)
                .FirstOrDefaultAsync();

            if (resume == null)
            {
                var anyResume = await _context.Resumes.AnyAsync(r => r.EmployeeId == profile.Id);
                if (!anyResume)
                {
                    return Content("<div class='p-4 text-center text-muted'><h6 class='fw-semibold'>Chưa có CV</h6><p class='small mb-3'>Hãy tạo hoặc tải lên CV để nhận gợi ý việc làm phù hợp.</p><a href='/Resume' class='a-btn a-btn--primary a-btn--sm'>Tạo hoặc tải CV</a></div>");
                }
                return Content("<div class='p-4 text-center text-muted'><h6 class='fw-semibold'>CV đang được xử lý</h6><p class='small mb-3'>Hệ thống đang trích xuất dữ liệu và tạo vector cho CV của bạn. Vui lòng quay lại sau ít phút.</p><a href='/Resume' class='a-btn a-btn--secondary a-btn--sm'>Quản lý CV</a></div>");
            }

            int resumeIdBefore = resume.Id;
            DateTime currentResumeVersion = resume.LastUpdatedAt;

            int recommendTimeoutSeconds = int.TryParse(_config["AiCore:RecommendTimeoutSeconds"], out var rts) && rts > 0 ? rts : 95;
            var userLock = _userLocks.GetOrAdd(currentUserId, _ => new SemaphoreSlim(1, 1));
            bool lockAcquired = false;

            try
            {
                lockAcquired = await userLock.WaitAsync(TimeSpan.FromSeconds(recommendTimeoutSeconds));
                if (!lockAcquired)
                {
                    return Content("<div class='p-4 text-center text-warning'><p class='mb-1'>Yêu cầu gợi ý việc làm quá thời gian chờ.</p><button type='button' class='a-btn a-btn--secondary a-btn--sm mt-2' onclick='refreshAiRecommendations()'>Thử lại</button></div>");
                }

                // 1. Kiểm tra xem trong DB đã có bao nhiêu gợi ý cho version và CV này rồi (khớp chặt UserId, ResumeVersion và ResumeId - R2)
                List<UserRecommendations> existingRecs = new();
                List<JobPosting> allSavedJobsInDb = new();
                List<JobPosting> cachedJobs = new();
                var cachedActiveDtos = new List<JobRecommendationDTO>();
                bool hasFullEvaluation = false;
                DateTime? batchCreatedAt = null;
                bool isBatchDegraded = false;
                bool allRealJobsActive = false;
                List<int> savedJobIds = new();

                try
                {
                    existingRecs = await _context.UserRecommendations
                        .Where(r => r.UserId == currentUserId &&
                                    r.ResumeVersion == currentResumeVersion &&
                                    r.ResumeId == resumeIdBefore)
                        .ToListAsync();

                    // F5: Bỏ trùng theo JobId, giữ bản ghi mới nhất
                    existingRecs = existingRecs
                        .GroupBy(r => r.JobId)
                        .Select(g => g.OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id).First())
                        .OrderBy(r => r.Rank.HasValue ? r.Rank.Value : int.MaxValue)
                        .ThenByDescending(r => r.Score.HasValue ? r.Score.Value : r.MatchScore)
                        .ToList();

                    if (existingRecs.Count > 0)
                    {
                        batchCreatedAt = existingRecs.Max(r => r.CreatedAt);
                        foreach (var r in existingRecs)
                        {
                            if (!string.IsNullOrWhiteSpace(r.PayloadJson))
                            {
                                try
                                {
                                    var p = JsonSerializer.Deserialize<AiRecommendationPayload>(r.PayloadJson);
                                    if (p?.Degraded != null && p.Degraded.Count > 0)
                                    {
                                        isBatchDegraded = true;
                                        break;
                                    }
                                }
                                catch { }
                            }
                        }
                    }

                    // Lấy danh sách job active tương ứng từ cache (chỉ lấy các job thật Id > 0, bỏ qua marker 0-job)
                    savedJobIds = existingRecs.Where(r => r.JobId > 0).Select(r => r.JobId).Distinct().ToList();
                    allSavedJobsInDb = savedJobIds.Count > 0
                        ? await _context.JobPostings
                            .Include(j => j.Locations)
                            .Where(j => savedJobIds.Contains(j.Id))
                            .ToListAsync()
                        : new List<JobPosting>();

                    cachedJobs = allSavedJobsInDb.Where(j => j.isActive).ToList();
                    allRealJobsActive = savedJobIds.Count > 0 && allSavedJobsInDb.Count == savedJobIds.Count && allSavedJobsInDb.All(j => j.isActive);

                    foreach (var rec in existingRecs)
                    {
                        var job = cachedJobs.FirstOrDefault(j => j.Id == rec.JobId);
                        if (job != null)
                        {
                            AiRecommendationPayload? payload = null;
                            if (!string.IsNullOrWhiteSpace(rec.PayloadJson))
                            {
                                try
                                {
                                    payload = JsonSerializer.Deserialize<AiRecommendationPayload>(rec.PayloadJson);
                                }
                                catch
                                {
                                    payload = null;
                                }
                            }

                            var dto = new JobRecommendationDTO
                            {
                                Id = job.Id,
                                PostingId = job.Id,
                                JobTitle = job.Title,
                                Company = job.Company,
                                Category = job.Category,
                                Score = rec.Score ?? payload?.Score ?? (rec.MatchScore > 0 ? rec.MatchScore : null),
                                Reason = !string.IsNullOrWhiteSpace(rec.Reason) ? rec.Reason : (payload?.Reason ?? string.Empty),
                                Advice = payload?.Advice ?? string.Empty,
                                MatchedSkills = payload?.MatchedSkills,
                                MissingSkills = payload?.MissingSkills,
                                Evidence = payload?.Evidence,
                                ExplanationStatus = payload?.ExplanationStatus,
                                LlmModel = payload?.LlmModel
                            };
                            cachedActiveDtos.Add(dto);
                        }
                    }

                    // 2. Nếu không yêu cầu ép tải lại (force) và cache có dữ liệu đủ hoặc đợt đánh giá đã hoàn tất (R6)
                    hasFullEvaluation = existingRecs.Any(r =>
                    {
                        if (string.IsNullOrWhiteSpace(r.PayloadJson)) return false;
                        try
                        {
                            var p = JsonSerializer.Deserialize<AiRecommendationPayload>(r.PayloadJson);
                            return p?.RequestedTopK.HasValue == true && p.RequestedTopK.Value >= topK;
                        }
                        catch { return false; }
                    });
                }
                catch (Exception ex)
                {
                    _logger?.LogError(ex, "Lỗi khi đọc cache gợi ý người dùng {UserId}", currentUserId);
                    existingRecs = new List<UserRecommendations>();
                    allSavedJobsInDb = new List<JobPosting>();
                    cachedJobs = new List<JobPosting>();
                    cachedActiveDtos = new List<JobRecommendationDTO>();
                    hasFullEvaluation = false;
                    batchCreatedAt = null;
                    isBatchDegraded = false;
                    allRealJobsActive = false;
                    savedJobIds = new List<int>();
                }

                int cacheHours = int.TryParse(_config["AiCore:RecommendationCacheHours"], out var ch) && ch > 0 ? ch : 24;
                int degradedMinutes = int.TryParse(_config["AiCore:DegradedCacheMinutes"], out var dm) && dm > 0 ? dm : 30;

                bool isExpiredByHours = batchCreatedAt == null || (DateTime.UtcNow - batchCreatedAt.Value).TotalHours > cacheHours;
                bool isExpiredByDegraded = isBatchDegraded && (batchCreatedAt == null || (DateTime.UtcNow - batchCreatedAt.Value).TotalMinutes > degradedMinutes);

                // F2: Quy tắc lô đã lưu được dùng thay cho gọi AiCore
                bool isMarkerBatch = existingRecs.Count > 0 && savedJobIds.Count == 0 && existingRecs.Any(r => r.JobId == 0);
                bool isRealJobBatchValid = savedJobIds.Count > 0
                    && allRealJobsActive
                    && !isExpiredByHours
                    && (!isBatchDegraded || !isExpiredByDegraded)
                    && (cachedActiveDtos.Count >= topK || (cachedActiveDtos.Count > 0 && hasFullEvaluation));

                bool isMarkerBatchValid = isMarkerBatch
                    && hasFullEvaluation
                    && !isExpiredByHours
                    && (!isBatchDegraded || !isExpiredByDegraded);

                bool isCacheSufficient = isRealJobBatchValid || isMarkerBatchValid;

                if (!force && isCacheSufficient)
                {
                    if (isBatchDegraded)
                    {
                        ViewData["IsDegraded"] = true;
                    }

                    if (cachedActiveDtos.Count > 0)
                    {
                        return PartialView("_RecommendedJobsPartial", cachedActiveDtos.Take(topK).ToList());
                    }
                    if (isMarkerBatchValid)
                    {
                        return Content("<div class='p-4 text-center text-muted'><p class='mb-0'>Hiện tại chưa có công việc đang mở tuyển phù hợp với hồ sơ của bạn. Hãy quay lại sau.</p></div>");
                    }
                }

                void SetFallbackViewData()
                {
                    ViewData["IsFallbackCache"] = true;
                    if (batchCreatedAt.HasValue)
                    {
                        var localTime = DateTime.SpecifyKind(batchCreatedAt.Value, DateTimeKind.Utc).ToLocalTime();
                        ViewData["FallbackNotice"] = $"Kết quả đã lưu lúc {localTime:HH:mm dd/MM}";
                    }
                    else
                    {
                        ViewData["FallbackNotice"] = "Kết quả đã lưu trước đó";
                    }
                    if (isBatchDegraded)
                    {
                        ViewData["IsDegraded"] = true;
                    }
                }

                IActionResult? GetFallbackResult()
                {
                    if (cachedActiveDtos.Count > 0)
                    {
                        SetFallbackViewData();
                        return PartialView("_RecommendedJobsPartial", cachedActiveDtos.Take(topK).ToList());
                    }

                    if (isMarkerBatch)
                    {
                        var notice = batchCreatedAt.HasValue
                            ? $"Kết quả đã lưu lúc {DateTime.SpecifyKind(batchCreatedAt.Value, DateTimeKind.Utc).ToLocalTime():HH:mm dd/MM}"
                            : "Kết quả đã lưu trước đó";
                        return Content($"<div class='p-4 text-center text-muted'><div class='alert alert-warning py-2 px-3 mb-3 small d-inline-flex align-items-center gap-2'><i data-lucide='clock' class='flex-shrink-0'></i><span>{notice}</span></div><p class='mb-0'>Hiện tại chưa có công việc đang mở tuyển phù hợp với hồ sơ của bạn. Hãy quay lại sau.</p></div>");
                    }

                    return null;
                }

                // 3. Nếu chưa có hoặc cần làm mới -> Gọi AI để lấy thêm
                try
                {
                    using (var client = _httpClientFactory.CreateClient())
                    {
                        client.Timeout = TimeSpan.FromSeconds(recommendTimeoutSeconds);

                        var nvc = new List<KeyValuePair<string, string>> {
                            new("employee_id", profile.Id.ToString()),
                            new("top_k", topK.ToString())
                        };

                        var aiCoreBaseUrl = (_config["AiCore:BaseUrl"] ?? "http://localhost:8001").TrimEnd('/');
                        var response = await client.PostAsync($"{aiCoreBaseUrl}/recommend-jobs-for-employee", new FormUrlEncodedContent(nvc));

                        if (response.IsSuccessStatusCode)
                        {
                            var jsonResponse = await response.Content.ReadAsStringAsync();
                            var result = JsonSerializer.Deserialize<AiResponseWrapper>(jsonResponse, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                            if (result?.Status == "no_cv")
                            {
                                return Content("<div class='p-4 text-center text-muted'><h6 class='fw-semibold'>Chưa có dữ liệu phân tích</h6><p class='small mb-3'>CV của bạn chưa được trích xuất dữ liệu hoàn chỉnh. Hãy cập nhật lại CV.</p><a href='/Resume' class='a-btn a-btn--primary a-btn--sm'>Quản lý CV</a></div>");
                            }

                            if (result?.Status == "vector_pending")
                            {
                                return Content("<div class='p-4 text-center text-muted'><h6 class='fw-semibold'>Dữ liệu Vector đang được xử lý</h6><p class='small mb-3'>Hệ thống đang hoàn tất xử lý vector cho CV của bạn. Vui lòng thử lại sau giây lát.</p><a href='/Jobs' class='a-btn a-btn--secondary a-btn--sm'>Tải lại</a></div>");
                            }

                            if (result?.Status == "vector_empty")
                            {
                                return Content("<div class='p-4 text-center text-muted'><h6 class='fw-semibold'>Dữ liệu phân tích rỗng</h6><p class='small mb-3'>Dữ liệu vector của CV chưa có nội dung để đánh giá. Vui lòng kiểm tra lại CV của bạn.</p><a href='/Resume' class='a-btn a-btn--primary a-btn--sm'>Quản lý CV</a></div>");
                            }

                            if (result?.Matching?.Degraded != null && result.Matching.Degraded.Count > 0)
                            {
                                ViewData["IsDegraded"] = true;
                            }

                            // Kiểm tra lại danh tính và phiên bản CV trước khi lưu dùng AsNoTracking() và kiểm tra CV latest (R3)
                            var latestResumeAfter = await _context.Resumes
                                .AsNoTracking()
                                .Where(r => r.EmployeeId == profile.Id && !string.IsNullOrEmpty(r.VectorId))
                                .OrderByDescending(r => r.LastUpdatedAt)
                                .ThenByDescending(r => r.Id)
                                .Select(r => new { r.Id, r.LastUpdatedAt })
                                .FirstOrDefaultAsync();

                            bool isCvUnchanged = latestResumeAfter != null &&
                                                 latestResumeAfter.Id == resumeIdBefore &&
                                                 latestResumeAfter.LastUpdatedAt == currentResumeVersion;

                            if (result?.Recommendations != null && result.Recommendations.Count > 0)
                            {
                                var validRecommendations = new List<JobRecommendationDTO>();
                                int rankIndex = 1;
                                var newJobIds = new HashSet<int>();

                                foreach (var rec in result.Recommendations)
                                {
                                    // 1. Ưu tiên đối chiếu theo PostingId (JobPostings.Id trong SQL)
                                    JobPosting? jobInDb = null;
                                    if (rec.PostingId.HasValue && rec.PostingId.Value > 0)
                                    {
                                        jobInDb = await _context.JobPostings.Include(j => j.Locations).FirstOrDefaultAsync(j => j.Id == rec.PostingId.Value);
                                    }

                                    // 2. Dự phòng bằng OriginalUrl duy nhất nếu PostingId không có
                                    if (jobInDb == null && !string.IsNullOrWhiteSpace(rec.OriginalUrl))
                                    {
                                        jobInDb = await _context.JobPostings.Include(j => j.Locations).FirstOrDefaultAsync(j => j.OriginalUrl == rec.OriginalUrl);
                                    }

                                    // KHÔNG match theo Title để tránh nối nhầm việc giữa các công ty khác nhau!
                                    // Chỉ nhận tin còn hoạt động (isActive)
                                    if (jobInDb != null && jobInDb.isActive)
                                    {
                                        rec.Id = jobInDb.Id;
                                        rec.PostingId = jobInDb.Id;
                                        rec.JobTitle = jobInDb.Title;
                                        rec.Company = jobInDb.Company;
                                        rec.Category = jobInDb.Category;
                                        newJobIds.Add(jobInDb.Id);
                                        validRecommendations.Add(rec);
                                    }
                                }

                                if (isCvUnchanged)
                                {
                                    try
                                    {
                                        // Lấy danh sách bản ghi cache hiện tại của đúng CV và version này để cập nhật đè hoặc loại bỏ job cũ (R5)
                                        var oldBatchRecords = await _context.UserRecommendations
                                            .Where(r => r.UserId == currentUserId &&
                                                        r.ResumeVersion == currentResumeVersion &&
                                                        r.ResumeId == resumeIdBefore)
                                            .ToListAsync();

                                        foreach (var rec in validRecommendations)
                                        {
                                            var existing = oldBatchRecords.FirstOrDefault(r => r.JobId == rec.Id);

                                            var payload = new AiRecommendationPayload
                                            {
                                                Version = 1,
                                                Score = rec.Score,
                                                Reason = rec.Reason,
                                                Advice = rec.Advice,
                                                MatchedSkills = rec.MatchedSkills,
                                                MissingSkills = rec.MissingSkills,
                                                Evidence = rec.Evidence,
                                                ExplanationStatus = rec.ExplanationStatus,
                                                LlmModel = rec.LlmModel,
                                                Rank = rankIndex,
                                                RequestedTopK = topK,
                                                Degraded = result?.Matching?.Degraded
                                            };
                                            string payloadJson = JsonSerializer.Serialize(payload);

                                            if (existing == null)
                                            {
                                                _context.UserRecommendations.Add(new UserRecommendations
                                                {
                                                    UserId = currentUserId,
                                                    JobId = rec.Id,
                                                    ResumeId = resumeIdBefore,
                                                    MatchScore = rec.Score ?? 0.0,
                                                    Score = rec.Score,
                                                    Reason = rec.Reason ?? string.Empty,
                                                    Rank = rankIndex,
                                                    PayloadJson = payloadJson,
                                                    CreatedAt = DateTime.UtcNow,
                                                    ResumeVersion = currentResumeVersion
                                                });
                                            }
                                            else
                                            {
                                                // Cập nhật đè toàn bộ điểm, thứ hạng, lý do và payload mới từ batch mới (R5)
                                                existing.ResumeId = resumeIdBefore;
                                                existing.MatchScore = rec.Score ?? 0.0;
                                                existing.Score = rec.Score;
                                                existing.Rank = rankIndex;
                                                existing.PayloadJson = payloadJson;
                                                existing.Reason = rec.Reason ?? string.Empty;
                                                existing.ResumeVersion = currentResumeVersion;
                                                existing.CreatedAt = DateTime.UtcNow;
                                            }
                                            rankIndex++;
                                        }

                                        // Loại bỏ các bản ghi job của batch cũ không còn nằm trong batch gợi ý mới này (R5)
                                        var obsoleteRecords = oldBatchRecords.Where(r => !newJobIds.Contains(r.JobId)).ToList();
                                        if (obsoleteRecords.Count > 0)
                                        {
                                            _context.UserRecommendations.RemoveRange(obsoleteRecords);
                                        }

                                        if (validRecommendations.Count == 0)
                                        {
                                            // Tất cả gợi ý từ AI đều không còn active trong DB -> lưu marker 0-job (R6)
                                            var emptyMarkerPayload = new AiRecommendationPayload
                                            {
                                                Version = 1,
                                                RequestedTopK = topK,
                                                Degraded = result?.Matching?.Degraded
                                            };
                                            _context.UserRecommendations.Add(new UserRecommendations
                                            {
                                                UserId = currentUserId,
                                                JobId = 0,
                                                ResumeId = resumeIdBefore,
                                                MatchScore = 0.0,
                                                Score = null,
                                                Reason = string.Empty,
                                                Rank = null,
                                                PayloadJson = JsonSerializer.Serialize(emptyMarkerPayload),
                                                CreatedAt = DateTime.UtcNow,
                                                ResumeVersion = currentResumeVersion
                                            });
                                        }

                                        await _context.SaveChangesAsync();
                                    }
                                    catch (Exception ex)
                                    {
                                        _logger?.LogError(ex, "Lỗi khi lưu cache gợi ý người dùng {UserId}", currentUserId);
                                    }
                                }

                                if (validRecommendations.Count > 0)
                                {
                                    return PartialView("_RecommendedJobsPartial", validRecommendations.Take(topK).ToList());
                                }

                                return Content("<div class='p-4 text-center text-muted'><p class='mb-0'>Hiện tại chưa có công việc đang mở tuyển phù hợp với hồ sơ của bạn. Hãy quay lại sau.</p></div>");
                            }
                            else if (result?.Status == "success" || (result != null && result.Status != "error" && result.Recommendations != null))
                            {
                                // AI trả về rỗng (0 recommendations). Xoá sạch cache cũ và lưu marker hoàn tất 0-job (R5, R6)
                                if (isCvUnchanged)
                                {
                                    var oldBatchRecords = await _context.UserRecommendations
                                        .Where(r => r.UserId == currentUserId &&
                                                    r.ResumeVersion == currentResumeVersion &&
                                                    r.ResumeId == resumeIdBefore)
                                        .ToListAsync();

                                    if (oldBatchRecords.Count > 0)
                                    {
                                        _context.UserRecommendations.RemoveRange(oldBatchRecords);
                                    }

                                    var emptyMarkerPayload = new AiRecommendationPayload
                                    {
                                        Version = 1,
                                        RequestedTopK = topK,
                                        Degraded = result?.Matching?.Degraded
                                    };
                                    _context.UserRecommendations.Add(new UserRecommendations
                                    {
                                        UserId = currentUserId,
                                        JobId = 0,
                                        ResumeId = resumeIdBefore,
                                        MatchScore = 0.0,
                                        Score = null,
                                        Reason = string.Empty,
                                        Rank = null,
                                        PayloadJson = JsonSerializer.Serialize(emptyMarkerPayload),
                                        CreatedAt = DateTime.UtcNow,
                                        ResumeVersion = currentResumeVersion
                                    });

                                    try
                                    {
                                        await _context.SaveChangesAsync();
                                    }
                                    catch (Exception ex)
                                    {
                                        _logger?.LogError(ex, "Lỗi khi lưu cache gợi ý người dùng {UserId}", currentUserId);
                                    }
                                }

                                return Content("<div class='p-4 text-center text-muted'><p class='mb-0'>Hiện tại chưa có công việc đang mở tuyển phù hợp với hồ sơ của bạn. Hãy quay lại sau.</p></div>");
                            }
                            else
                            {
                                return Content("<div class='p-4 text-center text-muted'><p class='mb-0'>Không thể lấy gợi ý việc làm từ hệ thống AI lúc này. Vui lòng thử lại sau.</p></div>");
                            }
                        }
                        else
                        {
                            // Fallback to cache if available
                            var fallback = GetFallbackResult();
                            if (fallback != null) return fallback;
                            return Content($"<div class='p-4 text-center text-danger'><p class='mb-1'>Không thể kết nối dịch vụ gợi ý việc làm (HTTP {(int)response.StatusCode}).</p><button type='button' class='a-btn a-btn--secondary a-btn--sm mt-2' onclick='refreshAiRecommendations()'>Thử lại</button></div>");
                        }
                    }
                }
                catch (OperationCanceledException)
                {
                    var fallback = GetFallbackResult();
                    if (fallback != null) return fallback;
                    return Content("<div class='p-4 text-center text-warning'><p class='mb-1'>Yêu cầu gợi ý việc làm quá thời gian chờ.</p><button type='button' class='a-btn a-btn--secondary a-btn--sm mt-2' onclick='refreshAiRecommendations()'>Thử lại</button></div>");
                }
                catch (Exception)
                {
                    var fallback = GetFallbackResult();
                    if (fallback != null) return fallback;
                    return Content("<div class='p-4 text-center text-danger'><p class='mb-1'>Có lỗi xảy ra khi tải gợi ý việc làm.</p><button type='button' class='a-btn a-btn--secondary a-btn--sm mt-2' onclick='refreshAiRecommendations()'>Thử lại</button></div>");
                }
            }
            finally
            {
                if (lockAcquired)
                {
                    userLock.Release();
                }
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetCandidateResumes()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
            {
                return Unauthorized(new { success = false, message = "Vui lòng đăng nhập." });
            }
            int currentUserId = int.Parse(userIdClaim);

            var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.UserId == currentUserId);
            if (profile == null)
            {
                return Ok(new { success = true, resumes = new List<object>() });
            }

            var resumes = await _context.Resumes
                .Where(r => r.EmployeeId == profile.Id)
                .OrderByDescending(r => !string.IsNullOrEmpty(r.VectorId))
                .ThenByDescending(r => r.LastUpdatedAt)
                .ThenByDescending(r => r.Id)
                .Select(r => new
                {
                    id = r.Id,
                    label = !string.IsNullOrWhiteSpace(r.Label) ? r.Label : (!string.IsNullOrWhiteSpace(r.Name) ? r.Name : "CV của tôi"),
                    name = string.IsNullOrWhiteSpace(r.Name) ? "CV chưa đặt tên" : r.Name,
                    lastUpdatedAt = r.LastUpdatedAt,
                    hasVector = !string.IsNullOrEmpty(r.VectorId),
                    fileUrl = r.FileUrl
                })
                .ToListAsync();

            return Ok(new { success = true, resumes });
        }

        // "Nên học gì tiếp" — kỹ năng CV còn thiếu theo đồ thị kỹ năng của AiCore. Dùng trong
        // ngăn "Vì sao?" của gợi ý việc làm và đơn ứng tuyển. Kết quả giữ 20 phút mỗi người.
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, (DateTime At, object Payload)> _learningPathCache = new();

        [HttpGet]
        public async Task<IActionResult> GetLearningPath(int limit = 6)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var currentUserId))
                return Unauthorized(new { success = false, message = "Vui lòng đăng nhập." });

            var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.UserId == currentUserId);
            if (profile == null) return Ok(new { success = false, message = "Chưa có hồ sơ ứng viên." });

            limit = Math.Clamp(limit, 1, 10);
            if (_learningPathCache.TryGetValue(profile.Id, out var cached) && DateTime.UtcNow - cached.At < TimeSpan.FromMinutes(20))
                return Ok(cached.Payload);

            try
            {
                using var client = _httpClientFactory.CreateClient();
                int timeout = int.TryParse(_config["AiCore:RecommendTimeoutSeconds"], out var rts) && rts > 0 ? rts : 95;
                client.Timeout = TimeSpan.FromSeconds(timeout);
                var baseUrl = (_config["AiCore:BaseUrl"] ?? "http://localhost:8001").TrimEnd('/');
                using var response = await client.PostAsJsonAsync($"{baseUrl}/api/v2/skills/learning-path",
                    new { employee_id = profile.Id, limit }, HttpContext.RequestAborted);
                if (!response.IsSuccessStatusCode)
                    return Ok(new { success = false, message = response.StatusCode == System.Net.HttpStatusCode.NotFound
                        ? "AiCore chưa có hồ sơ của bạn." : $"Dịch vụ kỹ năng tạm thời lỗi (HTTP {(int)response.StatusCode})." });

                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                var root = doc.RootElement;
                var status = root.TryGetProperty("status", out var st) ? st.GetString() : "success";
                if (status == "no_cv")
                    return Ok(new { success = false, status = "no_cv", message = "Tải CV lên để Aris gợi ý kỹ năng nên học." });

                var suggestions = new List<object>();
                if (root.TryGetProperty("suggestions", out var arr) && arr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var el in arr.EnumerateArray())
                    {
                        var skill = el.TryGetProperty("skill", out var sk) ? sk.GetString() : null;
                        if (string.IsNullOrWhiteSpace(skill)) continue;
                        suggestions.Add(new
                        {
                            skill,
                            recommendedJobs = el.TryGetProperty("recommended_jobs", out var rj) && rj.ValueKind == JsonValueKind.Number ? rj.GetInt32() : 0,
                            activePostings = el.TryGetProperty("active_postings", out var ap) && ap.ValueKind == JsonValueKind.Number ? ap.GetInt32() : 0,
                            relatedTo = el.TryGetProperty("related_to", out var rt) && rt.ValueKind == JsonValueKind.Array
                                ? rt.EnumerateArray().Select(x => x.GetString()).Where(x => !string.IsNullOrWhiteSpace(x)).Take(3).ToList()
                                : new List<string?>(),
                            exampleJobs = el.TryGetProperty("example_jobs", out var ej) && ej.ValueKind == JsonValueKind.Array
                                ? ej.EnumerateArray().Select(x => x.GetString()).Where(x => !string.IsNullOrWhiteSpace(x)).Take(3).ToList()
                                : new List<string?>()
                        });
                    }
                }
                var cvSkills = root.TryGetProperty("cv_skills", out var cs) && cs.ValueKind == JsonValueKind.Array
                    ? cs.EnumerateArray().Select(x => x.GetString()).Where(x => !string.IsNullOrWhiteSpace(x)).ToList()
                    : new List<string?>();

                var payload = new { success = true, cvSkills, suggestions };
                _learningPathCache[profile.Id] = (DateTime.UtcNow, payload);
                return Ok(payload);
            }
            catch (OperationCanceledException)
            {
                return Ok(new { success = false, message = "Dịch vụ kỹ năng phản hồi quá lâu." });
            }
            catch (Exception)
            {
                return Ok(new { success = false, message = "Không kết nối được dịch vụ kỹ năng." });
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ScoreCvForJob([FromBody] ScoreCvRequestDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
            {
                return Unauthorized(new { success = false, message = "Vui lòng đăng nhập." });
            }
            int currentUserId = int.Parse(userIdClaim);

            var profile = await _context.Profiles.FirstOrDefaultAsync(p => p.UserId == currentUserId);
            if (profile == null)
            {
                return BadRequest(new { success = false, message = "Chưa tìm thấy hồ sơ ứng viên." });
            }

            if (dto == null || dto.JobId <= 0)
            {
                return BadRequest(new { success = false, message = "Thông tin việc làm không hợp lệ." });
            }

            var job = await _context.JobPostings.FirstOrDefaultAsync(j => j.Id == dto.JobId);
            if (job == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy tin tuyển dụng." });
            }

            // Xác định resume và kiểm tra quyền sở hữu chặt chẽ:
            Resume? resume = null;
            if (dto.ResumeId.HasValue && dto.ResumeId.Value > 0)
            {
                resume = await _context.Resumes.FirstOrDefaultAsync(r => r.Id == dto.ResumeId.Value);
                if (resume == null || resume.EmployeeId != profile.Id)
                {
                    // Chống gian lận: Ứng viên không được đối chiếu CV của người khác!
                    return StatusCode(403, new { success = false, message = "Bạn không có quyền truy cập CV này." });
                }
            }
            else
            {
                // Ưu tiên CV mới nhất có VectorId (chuẩn AiCore)
                resume = await _context.Resumes
                    .Where(r => r.EmployeeId == profile.Id && !string.IsNullOrEmpty(r.VectorId))
                    .OrderByDescending(r => r.LastUpdatedAt)
                    .ThenByDescending(r => r.Id)
                    .FirstOrDefaultAsync();

                if (resume == null)
                {
                    resume = await _context.Resumes
                        .Where(r => r.EmployeeId == profile.Id)
                        .OrderByDescending(r => r.LastUpdatedAt)
                        .ThenByDescending(r => r.Id)
                        .FirstOrDefaultAsync();
                }
            }

            if (resume == null)
            {
                return Ok(new
                {
                    success = false,
                    status = "no_cv",
                    message = "Bạn chưa có CV nào trong hệ thống. Hãy tạo hoặc tải CV lên trước khi đối chiếu."
                });
            }

            int resumeIdBefore = resume.Id;
            DateTime resumeVersionBefore = resume.LastUpdatedAt;

            try
            {
                using var client = _httpClientFactory.CreateClient();
                int scoreTimeoutSeconds = int.TryParse(_config["AiCore:ScoreTimeoutSeconds"], out var sts) && sts > 0 ? sts : 45;
                client.Timeout = TimeSpan.FromSeconds(scoreTimeoutSeconds);

                var aiCoreBaseUrl = (_config["AiCore:BaseUrl"] ?? "http://localhost:8001").TrimEnd('/');
                var requestPayload = new
                {
                    employee_id = profile.Id,
                    resume_id = resume.Id,
                    posting_id = job.Id,
                    original_url = job.OriginalUrl
                };

                var response = await client.PostAsJsonAsync($"{aiCoreBaseUrl}/score-cv-for-job", requestPayload);
                if (response.IsSuccessStatusCode)
                {
                    bool cvModifiedDuringEvaluation = false;
                    if (dto.ResumeId.HasValue && dto.ResumeId.Value > 0)
                    {
                        var resumeAfter = await _context.Resumes
                            .AsNoTracking()
                            .Where(r => r.Id == resumeIdBefore)
                            .Select(r => new { r.Id, r.LastUpdatedAt })
                            .FirstOrDefaultAsync();
                        cvModifiedDuringEvaluation = resumeAfter == null || resumeAfter.LastUpdatedAt != resumeVersionBefore;
                    }
                    else
                    {
                        var latestResumeAfter = await _context.Resumes
                            .AsNoTracking()
                            .Where(r => r.EmployeeId == profile.Id && !string.IsNullOrEmpty(r.VectorId))
                            .OrderByDescending(r => r.LastUpdatedAt)
                            .ThenByDescending(r => r.Id)
                            .Select(r => new { r.Id, r.LastUpdatedAt })
                            .FirstOrDefaultAsync();
                        cvModifiedDuringEvaluation = latestResumeAfter == null ||
                                                     latestResumeAfter.Id != resumeIdBefore ||
                                                     latestResumeAfter.LastUpdatedAt != resumeVersionBefore;
                    }

                    var jsonStr = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(jsonStr);
                    var root = doc.RootElement;
                    var status = root.TryGetProperty("status", out var s) ? s.GetString() : "success";

                    if (status == "no_cv")
                    {
                        var msg = root.TryGetProperty("message", out var m) ? m.GetString() : "CV chưa có nội dung trích xuất.";
                        return Ok(new { success = false, status = "no_cv", message = msg });
                    }

                    if (status == "vector_pending")
                    {
                        var msg = root.TryGetProperty("message", out var m) ? m.GetString() : "Dữ liệu Vector của CV đang được xử lý. Vui lòng thử lại sau vài giây.";
                        return Ok(new { success = false, status = "vector_pending", message = msg });
                    }

                    if (status == "vector_empty")
                    {
                        var msg = root.TryGetProperty("message", out var m) ? m.GetString() : "Dữ liệu Vector của CV rỗng. Vui lòng kiểm tra lại CV của bạn.";
                        return Ok(new { success = false, status = "vector_empty", message = msg });
                    }

                    double? finalScore = null;
                    if (root.TryGetProperty("final_score", out var fsProp) && fsProp.ValueKind == JsonValueKind.Number)
                    {
                        finalScore = fsProp.GetDouble();
                    }

                    string? reason = root.TryGetProperty("reason", out var rProp) ? rProp.GetString() : null;
                    string? advice = root.TryGetProperty("advice", out var aProp) ? aProp.GetString() : null;
                    string? explanationStatus = root.TryGetProperty("explanation_status", out var esProp) ? esProp.GetString() : null;
                    string? llmModel = null;
                    if (root.TryGetProperty("meta", out var metaProp) && metaProp.TryGetProperty("llm_model", out var llmProp))
                    {
                        llmModel = llmProp.GetString();
                    }

                    var matchedSkills = new List<string>();
                    if (root.TryGetProperty("matched_skills", out var msProp) && msProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in msProp.EnumerateArray())
                        {
                            var val = el.GetString();
                            if (!string.IsNullOrWhiteSpace(val)) matchedSkills.Add(val);
                        }
                    }

                    var missingSkills = new List<string>();
                    if (root.TryGetProperty("missing_skills", out var missProp) && missProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in missProp.EnumerateArray())
                        {
                            var val = el.GetString();
                            if (!string.IsNullOrWhiteSpace(val)) missingSkills.Add(val);
                        }
                    }

                    var evidence = new List<AiRecommendationEvidenceDto>();
                    if (root.TryGetProperty("evidence", out var evProp) && evProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in evProp.EnumerateArray())
                        {
                            var cvQuote = el.TryGetProperty("cv_quote", out var cq) ? cq.GetString() : null;
                            var jobQuote = el.TryGetProperty("job_quote", out var jq) ? jq.GetString() : null;
                            evidence.Add(new AiRecommendationEvidenceDto { CvQuote = cvQuote, JobQuote = jobQuote });
                        }
                    }

                    return Ok(new
                    {
                        success = true,
                        status = "success",
                        data = new
                        {
                            jobId = job.Id,
                            jobTitle = job.Title,
                            company = job.Company,
                            resumeId = resume.Id,
                            resumeName = resume.Name,
                            resumeVersion = resume.LastUpdatedAt,
                            cvModifiedDuringEvaluation = cvModifiedDuringEvaluation,
                            finalScore = finalScore,
                            reason = reason,
                            advice = advice,
                            matchedSkills = matchedSkills,
                            missingSkills = missingSkills,
                            evidence = evidence,
                            explanationStatus = explanationStatus,
                            llmModel = llmModel
                        }
                    });
                }
                else if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return Ok(new { success = false, message = "Không tìm thấy dữ liệu CV hoặc tin tuyển dụng tương ứng trên AiCore." });
                }
                else
                {
                    return Ok(new { success = false, message = $"Dịch vụ đối chiếu AI tạm thời không khả dụng (HTTP {(int)response.StatusCode})." });
                }
            }
            catch (OperationCanceledException)
            {
                return Ok(new { success = false, message = "Yêu cầu đối chiếu CV quá thời gian phản hồi." });
            }
            catch (Exception)
            {
                return Ok(new { success = false, message = "Có lỗi xảy ra trong quá trình đối chiếu hồ sơ." });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetJobs(int skip = 0, int take = 10, string? q = null, string? location = null, string? category = null, string? workMode = null, string? sort = null)
        {
            var query = _context.JobPostings
                .Include(j => j.Locations)
                .Include(j => j.BusinessAccount)
                .Where(j => j.isActive);

            if (!string.IsNullOrWhiteSpace(q))
            {
                var search = q.Trim().ToLower();
                query = query.Where(j => j.Title.ToLower().Contains(search) || j.Company.ToLower().Contains(search) || j.Category.ToLower().Contains(search));
            }

            if (!string.IsNullOrWhiteSpace(location))
            {
                var loc = location.Trim().ToLower();
                query = query.Where(j => j.Locations.Any(l => l.City.ToLower().Contains(loc) || l.Address.ToLower().Contains(loc)) || j.LocationTags.ToLower().Contains(loc));
            }

            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(j => j.Category == category);
            }

            if (!string.IsNullOrWhiteSpace(workMode))
            {
                query = query.Where(j => j.WorkTime.Contains(workMode));
            }

            if (sort == "oldest")
            {
                query = query.OrderBy(j => j.CreatedAt);
            }
            else
            {
                query = query.OrderByDescending(j => j.CreatedAt);
            }

            var jobs = await query
                .Skip(skip)
                .Take(take)
                .ToListAsync();

            if (!jobs.Any()) return Json(new { success = false });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdClaim))
            {
                ViewData["UserRole"] = await _context.Users
                    .Where(u => u.Id == int.Parse(userIdClaim))
                    .Select(u => u.Role)
                    .FirstOrDefaultAsync();
            }

            return PartialView("_JobCardPartial", jobs);
        }

        // Đăng tin tuyển dụng thật qua backend của chính ArisSkyve (thay vì JS gọi
        // thẳng sang AiCore như trước — không auth, không gắn được BusinessAccountId).
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> CreateJobPosting([FromBody] CreateJobPostingDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
                return Json(new { success = false, message = "Phiên đăng nhập không hợp lệ." });
            int userId = int.Parse(userIdClaim);

            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null || user.Role != "Business" || user.Profile is not BussinessAccount business)
            {
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể đăng tin tuyển dụng." });
            }

            if (dto == null || string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Company))
            {
                return Json(new { success = false, message = "Vui lòng nhập đầy đủ tiêu đề và tên công ty." });
            }

            DateTime? deadline = null;
            if (!string.IsNullOrWhiteSpace(dto.Deadline) &&
                DateTime.TryParseExact(dto.Deadline, new[] { "dd/MM/yyyy", "yyyy-MM-dd" }, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDeadline))
            {
                deadline = parsedDeadline;
            }

            var job = new JobPosting
            {
                Title = dto.Title,
                Company = dto.Company,
                Responsibilities = JsonSerializer.Serialize(dto.Responsibilities ?? new List<string>()),
                Requirements = JsonSerializer.Serialize(dto.Requirements ?? new List<string>()),
                Benefits = JsonSerializer.Serialize(dto.Benefits ?? new List<string>()),
                WorkTime = dto.WorkTime is { Count: > 0 } ? string.Join(", ", dto.WorkTime) : string.Empty,
                Salary = dto.Salary ?? string.Empty,
                Experience = dto.Experience ?? string.Empty,
                Deadline = deadline,
                Category = dto.Category ?? string.Empty,
                Hashtags = JsonSerializer.Serialize(dto.Keywords ?? new List<string>()),
                LocationTags = JsonSerializer.Serialize(dto.LocationTags ?? new List<string>()),
                FullText = string.IsNullOrWhiteSpace(dto.FullText) ? dto.Title : dto.FullText,
                OriginalUrl = dto.OriginalUrl ?? string.Empty,
                ScreeningQuestions = JsonSerializer.Serialize((dto.ScreeningQuestions ?? new List<string>()).Where(q => !string.IsNullOrWhiteSpace(q)).ToList()),
                Openings = dto.Openings is > 0 and <= 999 ? dto.Openings : null,
                BusinessAccountId = business.Id,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            foreach (var locStr in dto.Locations ?? new List<string>())
            {
                if (string.IsNullOrWhiteSpace(locStr)) continue;

                string city = dto.LocationTags is { Count: > 0 } ? dto.LocationTags[0] : "";
                string address = locStr;
                if (locStr.Contains(':'))
                {
                    var parts = locStr.Split(':', 2);
                    city = parts[0].Trim();
                    address = parts[1].Trim();
                }

                job.Locations.Add(new JobLocation
                {
                    City = city.Length > 100 ? city[..100] : city,
                    Address = address.Length > 2000 ? address[..2000] : address
                });
            }

            _context.JobPostings.Add(job);
            await _context.SaveChangesAsync();

            // Fire-and-forget style: auto-share to whichever channels the employer opted into
            // via the Jobs/Index sidebar toggle (SocialConnectController.ToggleAutoShare). A
            // failure here (n8n unreachable, workflow not published, etc.) must never fail the
            // job creation response itself — the manual "Chia sẻ" button remains the fallback.
            var autoShareConnections = await _context.SocialChannelConnections
                .Where(c => c.BusinessAccountId == business.Id && c.IsActive && c.AutoShareEnabled)
                .ToListAsync();
            if (autoShareConnections.Count > 0)
            {
                try
                {
                    var payloadChannels = BuildSharePayloadChannels(job, autoShareConnections, null);
                    await PostJobShareToN8nAsync(job, payloadChannels);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"DEBUG: Auto-share to n8n failed for job {job.Id}: {ex.Message}");
                }
            }

            return Json(new { success = true, jobId = job.Id });
        }

        // Employer-only: fetches an existing posting's editable fields, in the same shape
        // the create-job form's JSON/PDF prefill handlers already use, so #postJobModal can
        // be reopened in "edit" mode instead of needing a separate edit form/page.
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetJobPostingForEdit(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
                return Json(new { success = false, message = "Phiên đăng nhập không hợp lệ." });
            int userId = int.Parse(userIdClaim);

            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user?.Profile is not BussinessAccount business)
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể sửa tin." });

            var job = await _context.JobPostings.Include(j => j.Locations).FirstOrDefaultAsync(j => j.Id == id);
            if (job == null) return Json(new { success = false, message = "Không tìm thấy tin tuyển dụng." });
            if (job.BusinessAccountId != business.Id)
                return Json(new { success = false, message = "Bạn không có quyền sửa tin này." });

            return Json(new
            {
                success = true,
                job = new
                {
                    id = job.Id,
                    title = job.Title,
                    company = job.Company,
                    salary = job.Salary,
                    cate = job.Category,
                    deadline = job.Deadline?.ToString("yyyy-MM-dd"),
                    experience = job.Experience,
                    originalUrl = job.OriginalUrl,
                    fullText = job.FullText,
                    responsibilities = ParseJsonList(job.Responsibilities),
                    requirements = ParseJsonList(job.Requirements),
                    screeningQuestions = ParseJsonList(job.ScreeningQuestions),
                    locations = job.Locations.Select(l => string.IsNullOrWhiteSpace(l.City) ? l.Address : $"{l.City}: {l.Address}").ToList(),
                    isActive = job.isActive,
                    openings = job.Openings
                }
            });
        }

        // Employer-only: saves edits made through #postJobModal's edit mode. Mirrors
        // CreateJobPosting's field mapping, but updates the existing row (and replaces its
        // Locations) instead of inserting a new one.
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> UpdateJobPosting(int id, [FromBody] CreateJobPostingDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
                return Json(new { success = false, message = "Phiên đăng nhập không hợp lệ." });
            int userId = int.Parse(userIdClaim);

            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user?.Profile is not BussinessAccount business)
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể sửa tin." });

            var job = await _context.JobPostings.Include(j => j.Locations).FirstOrDefaultAsync(j => j.Id == id);
            if (job == null) return Json(new { success = false, message = "Không tìm thấy tin tuyển dụng." });
            if (job.BusinessAccountId != business.Id)
                return Json(new { success = false, message = "Bạn không có quyền sửa tin này." });

            if (dto == null || string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Company))
                return Json(new { success = false, message = "Vui lòng nhập đầy đủ tiêu đề và tên công ty." });

            DateTime? deadline = null;
            if (!string.IsNullOrWhiteSpace(dto.Deadline) &&
                DateTime.TryParseExact(dto.Deadline, new[] { "dd/MM/yyyy", "yyyy-MM-dd" }, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDeadline))
            {
                deadline = parsedDeadline;
            }

            job.Title = dto.Title;
            job.Company = dto.Company;
            job.Responsibilities = JsonSerializer.Serialize(dto.Responsibilities ?? new List<string>());
            job.Requirements = JsonSerializer.Serialize(dto.Requirements ?? new List<string>());
            job.Benefits = JsonSerializer.Serialize(dto.Benefits ?? new List<string>());
            job.WorkTime = dto.WorkTime is { Count: > 0 } ? string.Join(", ", dto.WorkTime) : string.Empty;
            job.Salary = dto.Salary ?? string.Empty;
            job.Experience = dto.Experience ?? string.Empty;
            job.Deadline = deadline;
            job.Category = dto.Category ?? string.Empty;
            job.Hashtags = JsonSerializer.Serialize(dto.Keywords ?? new List<string>());
            job.LocationTags = JsonSerializer.Serialize(dto.LocationTags ?? new List<string>());
            job.FullText = string.IsNullOrWhiteSpace(dto.FullText) ? dto.Title : dto.FullText;
            job.OriginalUrl = dto.OriginalUrl ?? string.Empty;
            job.ScreeningQuestions = JsonSerializer.Serialize((dto.ScreeningQuestions ?? new List<string>()).Where(q => !string.IsNullOrWhiteSpace(q)).ToList());
            job.Openings = dto.Openings is > 0 and <= 999 ? dto.Openings : null;
            job.UpdatedAt = DateTime.UtcNow;

            _context.JobLocations.RemoveRange(job.Locations);
            job.Locations.Clear();
            foreach (var locStr in dto.Locations ?? new List<string>())
            {
                if (string.IsNullOrWhiteSpace(locStr)) continue;

                string city = dto.LocationTags is { Count: > 0 } ? dto.LocationTags[0] : "";
                string address = locStr;
                if (locStr.Contains(':'))
                {
                    var parts = locStr.Split(':', 2);
                    city = parts[0].Trim();
                    address = parts[1].Trim();
                }

                job.Locations.Add(new JobLocation
                {
                    City = city.Length > 100 ? city[..100] : city,
                    Address = address.Length > 2000 ? address[..2000] : address
                });
            }

            await _context.SaveChangesAsync();

            return Json(new { success = true, jobId = job.Id });
        }

        // Employer-only: flips a posting between open/closed without deleting it (and its
        // application history) — deactivating hides it from the public feed while keeping
        // it visible on the employer's own list and the company page.
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> ToggleJobActive(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
                return Json(new { success = false, message = "Phiên đăng nhập không hợp lệ." });
            int userId = int.Parse(userIdClaim);

            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user?.Profile is not BussinessAccount business)
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể thao tác." });

            var job = await _context.JobPostings.FirstOrDefaultAsync(j => j.Id == id);
            if (job == null) return Json(new { success = false, message = "Không tìm thấy tin tuyển dụng." });
            if (job.BusinessAccountId != business.Id)
                return Json(new { success = false, message = "Bạn không có quyền thao tác trên tin này." });

            job.isActive = !job.isActive;
            job.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Json(new { success = true, isActive = job.isActive });
        }

        // Employer-only: powers the "Chia sẻ" modal — connected social channels plus an
        // auto-generated caption the employer can tweak before sending, per channel.
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetShareOptions(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
                return Json(new { success = false, message = "Phiên đăng nhập không hợp lệ." });
            int userId = int.Parse(userIdClaim);

            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user?.Profile is not BussinessAccount business)
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể chia sẻ tin." });

            var job = await _context.JobPostings.Include(j => j.Locations).FirstOrDefaultAsync(j => j.Id == id);
            if (job == null) return Json(new { success = false, message = "Không tìm thấy tin tuyển dụng." });
            if (job.BusinessAccountId != business.Id)
                return Json(new { success = false, message = "Bạn không có quyền chia sẻ tin này." });

            var channels = await _context.SocialChannelConnections
                .Where(c => c.BusinessAccountId == business.Id && c.IsActive)
                .OrderBy(c => c.Platform)
                .Select(c => new { id = c.Id, platform = c.Platform.ToString(), displayName = c.DisplayName })
                .ToListAsync();

            return Json(new
            {
                success = true,
                channels,
                defaultMessage = BuildDefaultShareCaption(job)
            });
        }

        // Employer-only: sends the job to whichever connected channels were selected, via
        // the n8n webhook that fans it out to the right platform API per channel. Only
        // externalId/access tokens travel in the payload — the shared Zalo bot token stays
        // in n8n's own credential store, never leaves it.
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> ShareJob([FromBody] ShareJobRequestDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
                return Json(new { success = false, message = "Phiên đăng nhập không hợp lệ." });
            int userId = int.Parse(userIdClaim);

            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user?.Profile is not BussinessAccount business)
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể chia sẻ tin." });

            var job = await _context.JobPostings.Include(j => j.Locations).FirstOrDefaultAsync(j => j.Id == dto.JobId);
            if (job == null) return Json(new { success = false, message = "Không tìm thấy tin tuyển dụng." });
            if (job.BusinessAccountId != business.Id)
                return Json(new { success = false, message = "Bạn không có quyền chia sẻ tin này." });

            if (dto.Channels == null || dto.Channels.Count == 0)
                return Json(new { success = false, message = "Vui lòng chọn ít nhất một kênh." });

            var channelIds = dto.Channels.Select(c => c.ChannelId).ToList();
            var connections = await _context.SocialChannelConnections
                .Where(c => c.BusinessAccountId == business.Id && c.IsActive && channelIds.Contains(c.Id))
                .ToListAsync();

            var overrideMessages = dto.Channels.ToDictionary(c => c.ChannelId, c => c.Message);
            var payloadChannels = BuildSharePayloadChannels(job, connections, overrideMessages);

            var webhookUrl = _config["Social:N8n:WebhookUrl"];
            if (string.IsNullOrWhiteSpace(webhookUrl))
                return Json(new { success = false, message = "Thiếu cấu hình Social:N8n:WebhookUrl trong appsettings." });

            var (success, message, body) = await PostJobShareToN8nAsync(job, payloadChannels);
            if (!success)
                return Json(new { success = false, message, detail = body });

            return Content(body!, "application/json");
        }

        // Builds the per-channel n8n payload shape shared by the manual "Chia sẻ" flow
        // (ShareJob, per-channel caption overrides from the modal) and the auto-share-on-create
        // path (CreateJobPosting, always uses the default caption — overrideMessages is null).
        private static List<object> BuildSharePayloadChannels(JobPosting job, List<SocialChannelConnection> connections, Dictionary<int, string?>? overrideMessages)
        {
            var defaultMessage = BuildDefaultShareCaption(job);
            var payloadChannels = new List<object>();
            foreach (var conn in connections)
            {
                var overrideMsg = overrideMessages != null && overrideMessages.TryGetValue(conn.Id, out var m) ? m : null;
                var message = string.IsNullOrWhiteSpace(overrideMsg) ? defaultMessage : overrideMsg;

                var channel = conn.Platform switch
                {
                    SocialPlatform.FacebookPage => (object)new { channelId = conn.Id, type = "facebook", pageId = conn.ExternalId, accessToken = conn.AccessToken, message },
                    SocialPlatform.ZaloOa => new { channelId = conn.Id, type = "zalo_oa", oaId = conn.ExternalId, accessToken = conn.AccessToken, message },
                    SocialPlatform.ZaloGroup => new { channelId = conn.Id, type = "zalo_group", chatId = conn.ExternalId, message },
                    _ => null
                };
                if (channel != null) payloadChannels.Add(channel);
            }
            return payloadChannels;
        }

        // Posts the fanned-out job-share request to the n8n webhook. Only externalId/access
        // tokens travel in the payload — the shared Zalo bot token stays in n8n's own
        // credential store, never leaves it.
        private async Task<(bool success, string message, string? body)> PostJobShareToN8nAsync(JobPosting job, List<object> payloadChannels)
        {
            var webhookUrl = _config["Social:N8n:WebhookUrl"];
            if (string.IsNullOrWhiteSpace(webhookUrl))
                return (false, "Thiếu cấu hình Social:N8n:WebhookUrl trong appsettings.", null);

            var payload = new
            {
                jobId = job.Id,
                title = job.Title,
                company = job.Company,
                applyUrl = Url.Action("Details", "Jobs", new { id = job.Id }, Request.Scheme),
                channels = payloadChannels
            };

            var client = _httpClientFactory.CreateClient();
            using var request = new HttpRequestMessage(HttpMethod.Post, webhookUrl)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json")
            };
            var webhookSecret = _config["Social:N8n:WebhookSecret"];
            if (!string.IsNullOrWhiteSpace(webhookSecret))
                request.Headers.Add("X-Webhook-Secret", webhookSecret);

            try
            {
                var response = await client.SendAsync(request);
                var body = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                    return (false, "n8n từ chối yêu cầu.", body);

                return (true, "OK", body);
            }
            catch (HttpRequestException)
            {
                return (false, "Không thể kết nối tới n8n.", null);
            }
        }

        private static string BuildDefaultShareCaption(JobPosting job)
        {
            var locations = job.Locations is { Count: > 0 }
                ? string.Join(", ", job.Locations.Select(l => string.IsNullOrWhiteSpace(l.City) ? l.Address : l.City).Distinct())
                : "Nhiều địa điểm";
            var salary = string.IsNullOrWhiteSpace(job.Salary) ? "Thỏa thuận" : job.Salary;

            return $"🚀 Tuyển dụng: {job.Title} tại {job.Company}\n" +
                   $"💰 Lương: {salary}\n" +
                   $"📍 Địa điểm: {locations}\n\n" +
                   $"Ứng tuyển ngay trên Aris!";
        }

        private static List<string> ParseJsonList(string? data)
        {
            if (string.IsNullOrWhiteSpace(data)) return new List<string>();
            try
            {
                return JsonSerializer.Deserialize<List<string>>(data) ?? new List<string>();
            }
            catch (JsonException)
            {
                return new List<string>();
            }
        }

        // Proxy file PDF sang AiCore để AI trích xuất thông tin tin tuyển dụng, dùng để
        // tự động điền form đăng tin thay vì HR phải gõ tay lại từ file JD có sẵn.
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> ExtractJobFromPdf(IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return Json(new { success = false, message = "Vui lòng chọn file." });

            var aiCoreBaseUrl = _config["AiCore:BaseUrl"];
            var client = _httpClientFactory.CreateClient();

            try
            {
                using var content = new MultipartFormDataContent();
                using var stream = file.OpenReadStream();
                var streamContent = new StreamContent(stream);
                streamContent.Headers.ContentType = new MediaTypeHeaderValue(
                    string.IsNullOrEmpty(file.ContentType) ? "application/octet-stream" : file.ContentType);
                content.Add(streamContent, "file", file.FileName);

                var response = await client.PostAsync($"{aiCoreBaseUrl}/extract-job-from-pdf", content);
                if (!response.IsSuccessStatusCode)
                {
                    return Json(new { success = false, message = "Không thể trích xuất nội dung từ file." });
                }

                var json = await response.Content.ReadAsStringAsync();
                return Content(json, "application/json");
            }
            catch (Exception)
            {
                return Json(new { success = false, message = "Lỗi kết nối tới dịch vụ AI." });
            }
        }

     }
 }
