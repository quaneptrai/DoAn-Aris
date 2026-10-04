using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Threading.Tasks;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace ArisSkyve.Controllers
{
    [Authorize]
    [Route("Stories")]
    public class StoriesController : Controller
    {
        private readonly ArisDBContext _context;
        private readonly IV7FeatureGate _featureGate;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly Microsoft.AspNetCore.Hosting.IWebHostEnvironment _env;

        public StoriesController(
            ArisDBContext context,
            IV7FeatureGate featureGate,
            IConfiguration config,
            IHttpClientFactory httpClientFactory,
            Microsoft.AspNetCore.Hosting.IWebHostEnvironment env)
        {
            _env = env;
            _context = context;
            _featureGate = featureGate;
            _config = config;
            _httpClientFactory = httpClientFactory;
        }

        private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        // Chỉ một route: [Route("Stories")] + "Feed" = /Stories/Feed (khai báo thêm "/Stories/Feed" gây AmbiguousMatchException → 500)
        [HttpGet("Feed")]
        public async Task<IActionResult> Feed(string? scope = null)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            int userId = CurrentUserId;
            var now = DateTime.UtcNow;

            var friendIds = await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Accepted && (f.RequesterId == userId || f.AddresseeId == userId))
                .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
                .ToListAsync();

            var followedCompanyIds = await _context.CompanyFollows
                .Where(cf => cf.UserId == userId)
                .Select(cf => cf.BusinessAccountId)
                .ToListAsync();

            // scope=companies (trang Khám phá công ty): tin của MỌI doanh nghiệp, không chỉ công ty mình theo dõi
            bool allCompanies = string.Equals(scope, "companies", StringComparison.OrdinalIgnoreCase);
            var companyUserIds = allCompanies
                ? await _context.BussinessAccounts.Select(b => b.UserId).ToListAsync()
                : await _context.BussinessAccounts
                    .Where(b => followedCompanyIds.Contains(b.Id))
                    .Select(b => b.UserId)
                    .ToListAsync();

            var stories = await _context.Stories
                .Include(s => s.User).ThenInclude(u => u.Profile)
                .Where(s => s.ExpiresAt > now && (allCompanies
                    ? companyUserIds.Contains(s.UserId)
                    : (s.UserId == userId || friendIds.Contains(s.UserId) || companyUserIds.Contains(s.UserId))))
                .OrderBy(s => s.CreatedAt)
                .ToListAsync();

            var storyIds = stories.Select(s => s.Id).ToList();
            var viewedStoryIds = (await _context.StoryViews
                .Where(v => v.ViewerId == userId && storyIds.Contains(v.StoryId))
                .Select(v => v.StoryId)
                .ToListAsync()).ToHashSet();

            var feed = stories.GroupBy(s => s.UserId).Select(g =>
            {
                var u = g.First().User;
                var biz = u?.Profile as BussinessAccount;
                bool isOrg = u?.Role == "Business";
                bool allSeen = g.All(s => viewedStoryIds.Contains(s.Id));
                return new
                {
                    userId = g.Key,
                    name = !string.IsNullOrWhiteSpace(biz?.CompanyName) ? biz!.CompanyName
                        : (!string.IsNullOrWhiteSpace(u?.Profile?.FullName) ? u!.Profile!.FullName : (u?.Username ?? "Người dùng")),
                    avatar = u?.Profile?.AvatarUrl ?? "/images/default-avatar.png",
                    isOrg = isOrg,
                    companyId = biz?.Id,
                    seen = allSeen,
                    items = g.Select(s => new
                    {
                        id = s.Id,
                        mediaUrl = s.MediaUrl,
                        mediaType = s.MediaType,
                        caption = s.Caption,
                        link = !string.IsNullOrEmpty(s.LinkUrl)
                            ? new { url = s.LinkUrl, label = s.LinkLabel ?? "Xem liên kết" }
                            : null,
                        createdAt = s.CreatedAt.ToString("o")
                    }).ToList()
                };
            }).OrderBy(u => u.seen ? 1 : 0).ThenBy(u => u.userId == userId ? 0 : 1).ToList();

            return Json(feed);
        }

        [HttpPost]
        [HttpPost("Create")]
        [RequestSizeLimit(60_000_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = 60_000_000)]
        public async Task<IActionResult> Create(IFormFile? media, string? caption, string? linkUrl, string? linkLabel)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            if (media == null || media.Length == 0)
            {
                return Json(new { success = false, message = "Vui lòng chọn hình ảnh hoặc video cho tin." });
            }

            var validation = await PublicMediaValidator.ValidateBrowserMediaAsync(media, HttpContext.RequestAborted);
            if (!validation.IsValid || validation.Media is null)
            {
                return Json(new { success = false, message = validation.Error ?? "Định dạng tệp không được hỗ trợ." });
            }

            int userId = CurrentUserId;
            string mediaType = validation.Media.MediaType;
            string mediaUrl = await UploadMediaAsync(media, validation.Media);
            if (string.IsNullOrEmpty(mediaUrl))
            {
                return Json(new { success = false, message = "Tải lên tệp không thành công." });
            }

            var story = new Story
            {
                UserId = userId,
                MediaUrl = mediaUrl,
                MediaType = mediaType,
                Caption = caption != null && caption.Length > 80 ? caption.Substring(0, 80) : caption,
                LinkUrl = linkUrl,
                LinkLabel = linkLabel,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(24)
            };

            _context.Stories.Add(story);
            await _context.SaveChangesAsync();

            return Json(new
            {
                success = true,
                story = new
                {
                    id = story.Id,
                    mediaUrl = story.MediaUrl,
                    mediaType = story.MediaType,
                    caption = story.Caption,
                    linkUrl = story.LinkUrl,
                    linkLabel = story.LinkLabel,
                    createdAt = story.CreatedAt.ToString("o")
                }
            });
        }

        [HttpPost("{id}/View")]
        [HttpPost("/Stories/View/{id}")]
        public async Task<IActionResult> RecordView(int id)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            int userId = CurrentUserId;
            var alreadyViewed = await _context.StoryViews.AnyAsync(v => v.StoryId == id && v.ViewerId == userId);
            if (!alreadyViewed)
            {
                _context.StoryViews.Add(new StoryView
                {
                    StoryId = id,
                    ViewerId = userId,
                    ViewedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }

            return Json(new { success = true });
        }

        [HttpGet("{id}/Viewers")]
        [HttpGet("/Stories/Viewers/{id}")]
        public async Task<IActionResult> Viewers(int id)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            int userId = CurrentUserId;
            var story = await _context.Stories.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
            if (story == null)
            {
                return Json(new { success = false, message = "Tin không tồn tại hoặc bạn không có quyền xem." });
            }

            var viewers = await _context.StoryViews
                .Include(v => v.Viewer).ThenInclude(u => u.Profile)
                .Where(v => v.StoryId == id)
                .OrderByDescending(v => v.ViewedAt)
                .Select(v => new
                {
                    userId = v.ViewerId,
                    name = v.Viewer.Profile != null ? v.Viewer.Profile.FullName : v.Viewer.Username,
                    avatar = v.Viewer.Profile != null ? v.Viewer.Profile.AvatarUrl : "/images/default-avatar.png",
                    viewedAt = v.ViewedAt.ToString("o")
                })
                .ToListAsync();

            return Json(new { success = true, count = viewers.Count, viewers });
        }

        private async Task<string> UploadMediaAsync(IFormFile file, ValidatedPublicMedia media)
        {
            var aiCoreBaseUrl = _config["AiCore:BaseUrl"];
            if (!string.IsNullOrEmpty(aiCoreBaseUrl))
            {
                try
                {
                    var client = _httpClientFactory.CreateClient();
                    string endpoint = media.Kind == PublicMediaKind.Video ? "/upload-video" : "/upload-image";

                    using var content = new MultipartFormDataContent();
                    using var stream = file.OpenReadStream();
                    var streamContent = new StreamContent(stream);
                    streamContent.Headers.ContentType = new MediaTypeHeaderValue(media.ContentType);
                    content.Add(streamContent, "file", media.CreateStorageFileName());

                    var response = await client.PostAsync($"{aiCoreBaseUrl}{endpoint}", content);
                    if (response.IsSuccessStatusCode)
                    {
                        var result = await response.Content.ReadFromJsonAsync<UploadResultDto>();
                        if (PublicMediaValidator.IsSafeRemoteMediaUrl(result?.Url)) return result!.Url!;
                    }
                }
                catch
                {
                    // Fall back to local storage if external service is unreachable
                }
            }

            // Local fallback is deliberately outside wwwroot. PublicMediaController
            // is the only path that can serve it with a fixed MIME type + nosniff.
            try
            {
                if (!PublicMediaStorage.TryGetStorageDirectory(_env.ContentRootPath, PublicMediaStorage.Stories, out var storageDirectory))
                {
                    return string.Empty;
                }

                var uniqueName = await PublicMediaValidator.SaveAsync(file, media, storageDirectory, HttpContext.RequestAborted);
                return $"/media/{PublicMediaStorage.Stories}/{uniqueName}";
            }
            catch
            {
                return string.Empty;
            }
        }

        private class UploadResultDto
        {
            public string? Url { get; set; }
        }
    }
}
