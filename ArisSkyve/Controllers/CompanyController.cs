using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

using ArisSkyve.Infrastructure.Services;

namespace ArisSkyve.Controllers
{
    [Authorize]
    public class CompanyController : Controller
    {
        private readonly ArisDBContext _context;
        private readonly IV7FeatureGate _featureGate;
        private readonly ICrawledCompanyDirectory? _crawled;

        public CompanyController(ArisDBContext context, IV7FeatureGate featureGate, ICrawledCompanyDirectory? crawled = null)
        {
            _context = context;
            _featureGate = featureGate;
            _crawled = crawled;
        }

        private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        [HttpPost]
        [Route("Company/ToggleFollow/{id}")]
        [Route("Company/ToggleFollow")]
        [Route("Company/Follow/{id}")]
        public async Task<IActionResult> ToggleFollow(int id)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            int userId = CurrentUserId;
            var company = await _context.BussinessAccounts.FirstOrDefaultAsync(b => b.Id == id);
            if (company == null) return NotFound();

            var existing = await _context.CompanyFollows.FirstOrDefaultAsync(cf => cf.UserId == userId && cf.BusinessAccountId == id);
            bool following = false;
            if (existing != null)
            {
                _context.CompanyFollows.Remove(existing);
                following = false;
            }
            else
            {
                _context.CompanyFollows.Add(new CompanyFollow
                {
                    UserId = userId,
                    BusinessAccountId = id,
                    CreatedAt = DateTime.UtcNow
                });
                following = true;
            }

            await _context.SaveChangesAsync();
            int followerCount = await _context.CompanyFollows.CountAsync(cf => cf.BusinessAccountId == id);

            return Json(new { success = true, following, followerCount });
        }

        // Từ không mang nghĩa khi so chức danh với tên việc (gợi ý "phù hợp với bạn")
        private static readonly HashSet<string> TitleStopWords = new(StringComparer.OrdinalIgnoreCase)
        {
            "ứng", "viên", "tiềm", "năng", "nhân", "the", "and", "của", "và", "cho", "senior", "junior", "intern", "fresher"
        };

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            int userId = CurrentUserId;

            var companies = await _context.BussinessAccounts
                .Select(b => new CompanyListItemViewModel
                {
                    Id = b.Id,
                    UserId = b.UserId,
                    CompanyName = b.CompanyName,
                    Industry = b.Industry,
                    CompanyAddress = b.CompanyAddress,
                    AvatarUrl = b.AvatarUrl,
                    CoverPhotoUrl = b.CoverPhotoUrl,
                    CompanySize = b.CompanySize,
                    Description = b.Description,
                    IsVerified = b.IsVerified,
                    FoundedYear = b.FoundedYear,
                    OpenJobCount = _context.JobPostings.Count(j => j.BusinessAccountId == b.Id && j.isActive)
                })
                .ToListAsync();

            var model = new CompanyDiscoverViewModel { FollowEnabled = _featureGate.Enabled };

            // Người theo dõi (bảng mới V7 — chỉ đọc khi migration đã áp)
            HashSet<int> savedPostIds = new();
            if (_featureGate.Enabled && companies.Count > 0)
            {
                var followerCounts = await _context.CompanyFollows
                    .GroupBy(cf => cf.BusinessAccountId)
                    .Select(g => new { Id = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.Id, x => x.Count);
                var mine = (await _context.CompanyFollows
                    .Where(cf => cf.UserId == userId)
                    .Select(cf => cf.BusinessAccountId)
                    .ToListAsync()).ToHashSet();
                foreach (var c in companies)
                {
                    c.FollowerCount = followerCounts.TryGetValue(c.Id, out var n) ? n : 0;
                    c.IsFollowing = mine.Contains(c.Id);
                }
            }

            // Mặc định "Được quan tâm nhất": nhiều người theo dõi → đang tuyển nhiều → tên
            model.Companies = companies
                .OrderByDescending(c => c.FollowerCount)
                .ThenByDescending(c => c.OpenJobCount)
                .ThenBy(c => c.CompanyName)
                .ToList();

            model.TopIndustries = companies
                .Where(c => !string.IsNullOrWhiteSpace(c.Industry))
                .GroupBy(c => c.Industry!.Trim())
                .OrderByDescending(g => g.Count())
                .ThenBy(g => g.Key)
                .Select(g => g.Key)
                .Take(4)
                .ToList();

            // Câu chuyện văn hoá: bài công khai có ảnh/video do doanh nghiệp đăng
            var byUser = companies.GroupBy(c => c.UserId).ToDictionary(g => g.Key, g => g.First());
            var bizUserIds = byUser.Keys.ToList();
            if (bizUserIds.Count > 0)
            {
                var posts = await _context.Posts
                    .Include(p => p.PostMedias)
                    .Where(p => bizUserIds.Contains(p.UserId) && p.IsPublic && p.PostMedias.Any())
                    .OrderByDescending(p => p.CreatedAt)
                    .Take(6)
                    .ToListAsync();

                if (_featureGate.Enabled && posts.Count > 0)
                {
                    var ids = posts.Select(p => p.Id).ToList();
                    savedPostIds = (await _context.SavedPosts
                        .Where(sp => sp.UserId == userId && ids.Contains(sp.PostId))
                        .Select(sp => sp.PostId)
                        .ToListAsync()).ToHashSet();
                }

                model.Culture = posts.Select(p => new CultureStoryItem
                {
                    PostId = p.Id,
                    Company = byUser[p.UserId],
                    Title = p.Title,
                    Text = p.Content ?? string.Empty,
                    CreatedAt = p.CreatedAt,
                    Media = (p.PostMedias ?? new List<PostMedias>())
                        .Select(m => (m.MediaUrl, string.Equals(m.MediaType, "video", StringComparison.OrdinalIgnoreCase)))
                        .ToList(),
                    LikeCount = p.LikeCount,
                    CommentCount = p.CommentCount,
                    Saved = savedPostIds.Contains(p.Id)
                }).ToList();
            }

            // Gợi ý: việc đang mở khớp chức danh của người xem; không khớp thì công ty đang tuyển gần nhất
            var me = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            var myTitle = me?.Profile?.JobTitle;
            if (string.IsNullOrWhiteSpace(myTitle) || myTitle == "Ứng viên tiềm năng") myTitle = null;
            model.ViewerTitle = myTitle;
            model.ViewerId = userId;
            model.ViewerAvatar = me?.Profile?.AvatarUrl;
            model.ViewerIsBusiness = (me?.Role == "Business" || me?.Role == "Admin");
            model.ViewerCompanyId = (me?.Profile as BussinessAccount)?.Id;
            model.ViewerName = me?.Profile is BussinessAccount myBiz && !string.IsNullOrWhiteSpace(myBiz.CompanyName)
                ? myBiz.CompanyName
                : (!string.IsNullOrWhiteSpace(me?.Profile?.FullName) ? me!.Profile!.FullName : me?.Username);

            var activeJobs = await _context.JobPostings
                .Where(j => j.isActive && j.BusinessAccountId != null)
                .OrderByDescending(j => j.CreatedAt)
                .Take(200)
                .Select(j => new { j.Id, j.Title, j.Salary, BizId = j.BusinessAccountId!.Value })
                .ToListAsync();
            var byId = companies.ToDictionary(c => c.Id);

            // Tin đang mở mới nhất của từng công ty (activeJobs đã xếp mới → cũ)
            foreach (var j in activeJobs)
            {
                if (byId.TryGetValue(j.BizId, out var co) && co.LatestJobId == null)
                {
                    co.LatestJobId = j.Id;
                    co.LatestJobTitle = j.Title;
                    co.LatestJobSalary = string.IsNullOrWhiteSpace(j.Salary) ? null : j.Salary;
                }
            }
            var keywords = (myTitle ?? string.Empty)
                .Split(new[] { ' ', '/', '-', ',', '(', ')' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length >= 2 && !TitleStopWords.Contains(w))
                .ToList();

            var picked = new List<CompanySuggestionItem>();
            void Add(IEnumerable<(int Id, string Title, string Salary, int BizId)> jobs)
            {
                foreach (var j in jobs)
                {
                    if (picked.Count >= 4) break;
                    if (picked.Any(x => x.CompanyId == j.BizId) || !byId.TryGetValue(j.BizId, out var c)) continue;
                    picked.Add(new CompanySuggestionItem
                    {
                        CompanyId = c.Id,
                        CompanyName = c.CompanyName,
                        AvatarUrl = c.AvatarUrl,
                        IsVerified = c.IsVerified,
                        JobId = j.Id,
                        JobTitle = j.Title,
                        Salary = string.IsNullOrWhiteSpace(j.Salary) ? null : j.Salary
                    });
                }
            }
            var tuples = activeJobs.Select(j => (j.Id, j.Title, j.Salary, j.BizId)).ToList();
            if (keywords.Count > 0)
            {
                Add(tuples.Where(j => keywords.Any(k => (j.Title ?? string.Empty).Contains(k, StringComparison.OrdinalIgnoreCase))));
                model.SuggestionsMatched = picked.Count > 0;
            }
            Add(tuples);
            model.Suggestions = picked;

            // Công ty có tin crawl (hồ sơ do crawler tổng hợp) — sau công ty đã có tài khoản; trùng tên thì giữ trang chính thức
            var crawled = await CrawledCompanyItemsAsync(companies);
            if (crawled.Count > 0)
            {
                model.Companies.AddRange(crawled);
                model.TopIndustries = model.Companies
                    .Where(c => !string.IsNullOrWhiteSpace(c.Industry))
                    .GroupBy(c => c.Industry!.Trim())
                    .OrderByDescending(g => g.Count())
                    .ThenBy(g => g.Key)
                    .Select(g => g.Key)
                    .Take(4)
                    .ToList();
            }

            return View(model);
        }

        /// <summary>
        /// Crawled company profiles as directory cards, with their open crawled jobs (matched by company name).
        /// A company that already has an Aris account under the same name keeps only its official page.
        /// </summary>
        private async Task<List<CompanyListItemViewModel>> CrawledCompanyItemsAsync(IEnumerable<CompanyListItemViewModel> registered)
        {
            if (_crawled == null) return new();
            await _crawled.EnsureFreshAsync();
            if (_crawled.All.Count == 0) return new();

            var official = registered.Select(c => CrawledCompanyDirectory.NormalizeName(c.CompanyName)).ToHashSet();
            var items = _crawled.All
                .Where(c => !c.Names.Any(n => official.Contains(CrawledCompanyDirectory.NormalizeName(n))))
                .ToDictionary(c => c.Id, c => new CompanyListItemViewModel
                {
                    Id = c.Id,
                    CompanyName = c.Name,
                    Industry = c.Industry,
                    CompanyAddress = c.Address,
                    AvatarUrl = c.Logo,
                    CompanySize = c.Size,
                    Description = c.Description,
                    FoundedYear = c.FoundedYear,
                    IsCrawled = true
                });

            // Open crawled jobs, newest first → per company: count + latest one
            var jobs = await _context.JobPostings.AsNoTracking()
                .Where(j => j.isActive && j.BusinessAccountId == null && j.Company != "")
                .OrderByDescending(j => j.CreatedAt)
                .Select(j => new { j.Id, j.Title, j.Salary, j.Company })
                .ToListAsync();
            foreach (var j in jobs)
            {
                if (_crawled.Match(j.Company) is not { } card || !items.TryGetValue(card.Id, out var item)) continue;
                item.OpenJobCount++;
                if (item.LatestJobId == null)
                {
                    item.LatestJobId = j.Id;
                    item.LatestJobTitle = j.Title;
                    item.LatestJobSalary = string.IsNullOrWhiteSpace(j.Salary) ? null : j.Salary;
                }
            }
            return items.Values
                .OrderByDescending(c => c.OpenJobCount)
                .ThenByDescending(c => c.AvatarUrl != null)
                .ThenBy(c => c.CompanyName)
                .ToList();
        }

        /// <summary>Trang công ty tổng hợp từ tin tuyển dụng (hồ sơ do crawler thu thập, chưa được công ty xác minh).</summary>
        [HttpGet]
        [Route("Company/Info/{id:int}")]
        public async Task<IActionResult> Info(int id)
        {
            if (_crawled == null) return NotFound();
            await _crawled.EnsureFreshAsync();
            var card = _crawled.Find(id);
            if (card == null) return NotFound();

            // Already on Aris with an account under the same name → its official page
            var names = card.Names.Select(CrawledCompanyDirectory.NormalizeName).ToHashSet();
            var official = (await _context.BussinessAccounts.AsNoTracking()
                    .Where(b => b.CompanyName != null && b.CompanyName != "")
                    .Select(b => new { b.Id, b.CompanyName })
                    .ToListAsync())
                .FirstOrDefault(b => names.Contains(CrawledCompanyDirectory.NormalizeName(b.CompanyName)));
            if (official != null) return RedirectToAction(nameof(Details), new { id = official.Id });

            // Same name matching as the directory cards (case/space-insensitive), then load only those jobs
            var candidates = await _context.JobPostings.AsNoTracking()
                .Where(j => j.BusinessAccountId == null && j.Company != "")
                .Select(j => new { j.Id, j.Company })
                .ToListAsync();
            var ids = candidates.Where(j => _crawled.Match(j.Company)?.Id == card.Id).Select(j => j.Id).ToList();
            var jobs = ids.Count == 0
                ? new List<JobPosting>()
                : await _context.JobPostings.AsNoTracking()
                    .Include(j => j.Locations)
                    .Where(j => ids.Contains(j.Id))
                    .OrderByDescending(j => j.CreatedAt)
                    .Take(60)
                    .ToListAsync();

            return View(new CrawledCompanyPageViewModel { Company = card, Jobs = jobs });
        }

        [HttpGet]
        public async Task<IActionResult> Ranking(string? sortBy = "overall", string? industry = null)
        {
            var allowedSorts = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "overall", "views", "followers", "applications" };
            sortBy = allowedSorts.Contains(sortBy ?? string.Empty) ? sortBy!.ToLowerInvariant() : "overall";
            industry = string.IsNullOrWhiteSpace(industry) || industry.Trim().Length > 120
                ? null
                : industry.Trim();

            var industries = await _context.BussinessAccounts.AsNoTracking()
                .Where(company => company.Industry != null && company.Industry.Trim() != "")
                .Select(company => company.Industry!)
                .Distinct()
                .OrderBy(value => value)
                .Take(40)
                .ToListAsync();

            var followersAvailable = _featureGate.Enabled;
            if (!followersAvailable && sortBy == "followers") sortBy = "overall";
            var model = new CompanyRankingViewModel
            {
                SortBy = sortBy,
                Industry = industry,
                Industries = industries,
                FollowerMetricAvailable = followersAvailable,
                Companies = await CompanyRankingQuery
                    .Build(_context, sortBy, industry, followersAvailable)
                    .ToListAsync()
            };

            return View(model);
        }

        [HttpGet]
        public async Task<IActionResult> Details(int id)
        {
            var company = await _context.BussinessAccounts.FirstOrDefaultAsync(b => b.Id == id);
            if (company == null) return NotFound();
            var viewerUserId = CurrentUserId;

            // Tin đã hết hạn vẫn hiển thị ở đây (và tìm được qua Search) — chỉ ẩn khỏi
            // trang chủ Jobs/Index, không xoá và không giấu khỏi trang công ty.
            var jobs = await _context.JobPostings
                .Include(j => j.Locations)
                .Where(j => j.BusinessAccountId == id)
                .OrderByDescending(j => j.isActive)
                .ThenByDescending(j => j.CreatedAt)
                .ToListAsync();

            var model = new CompanyDetailsViewModel
            {
                Company = company,
                Jobs = jobs,
                OpenJobCount = jobs.Count(j => j.isActive),
                IsOwner = company.UserId == viewerUserId,
                FollowEnabled = _featureGate.Enabled
            };

            if (_featureGate.Enabled)
            {
                model.FollowerCount = await _context.CompanyFollows.CountAsync(cf => cf.BusinessAccountId == id);
                model.IsFollowing = await _context.CompanyFollows.AnyAsync(cf => cf.BusinessAccountId == id && cf.UserId == viewerUserId);
            }

            // "Khoảnh khắc": ảnh / video trong các bài công khai do chính công ty đăng
            model.PostCount = await _context.Posts.CountAsync(p => p.UserId == company.UserId && p.IsPublic);
            var mediaPosts = await _context.Posts
                .Include(p => p.PostMedias)
                .Where(p => p.UserId == company.UserId && p.IsPublic && p.PostMedias.Any())
                .OrderByDescending(p => p.CreatedAt)
                .Take(12)
                .ToListAsync();
            model.Moments = mediaPosts
                .SelectMany(p => (p.PostMedias ?? new List<PostMedias>()).Select(m => new CompanyMomentItem
                {
                    PostId = p.Id,
                    Url = m.MediaUrl,
                    IsVideo = string.Equals(m.MediaType, "video", StringComparison.OrdinalIgnoreCase),
                    Caption = string.IsNullOrWhiteSpace(p.Title) ? p.Content : p.Title,
                    CreatedAt = p.CreatedAt
                }))
                .Take(9)
                .ToList();

            if (company.UserId != viewerUserId)
            {
                _context.CompanyProfileViews.Add(new CompanyProfileView
                {
                    BusinessAccountId = company.Id,
                    ViewedAtUtc = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }

            return View(model);
        }

        // Lets a business account update its own public company profile — separate from
        // the one-shot fields captured at AccountController.UpgradeToBusiness time, which
        // otherwise could never be revisited.
        [HttpGet]
        public async Task<IActionResult> Edit()
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Role is not ("Business" or "Admin") || user.Profile is not BussinessAccount business)
                return RedirectToAction("BecomeEmployer", "Account");  // shows the upgrade form, or why it is unavailable

            return View(business);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit([FromForm] UpdateCompanyProfileDto dto)
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
            if (user?.Role is not ("Business" or "Admin") || user.Profile is not BussinessAccount business)
                return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể sửa hồ sơ công ty." });

            if (dto == null || string.IsNullOrWhiteSpace(dto.CompanyName))
                return Json(new { success = false, message = "Tên công ty không được để trống." });

            business.CompanyName = dto.CompanyName.Trim();
            business.CompanyAddress = dto.CompanyAddress?.Trim();
            business.Industry = dto.Industry?.Trim();
            business.Description = dto.Description?.Trim();
            business.WebsiteUrl = dto.WebsiteUrl?.Trim();
            business.CompanySize = dto.CompanySize;
            business.TaxCode = dto.TaxCode?.Trim();
            business.FoundedYear = dto.FoundedYear;

            await _context.SaveChangesAsync();

            return Json(new { success = true, companyId = business.Id });
        }
    }
}
