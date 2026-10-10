using ArisSkyve.Domain.Entities;
using ArisSkyve.Hubs;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace ArisSkyve.Controllers
{
    public class DashboardController : Controller
    {
        public ArisDBContext _context;
        private readonly IV7FeatureGate _featureGate;
        private readonly IHubContext<ChatHub> _chatHubContext;
        private readonly IPublicMediaStore _publicMedia;

        public DashboardController(
            ArisDBContext context,
            IV7FeatureGate featureGate,
            IHubContext<ChatHub> chatHubContext,
            IPublicMediaStore publicMedia)
        {
            _context = context;
            _featureGate = featureGate;
            _chatHubContext = chatHubContext;
            _publicMedia = publicMedia;
        }

        private static string FormatTimeAgo(DateTime dt)
        {
            var span = DateTime.UtcNow - dt;
            if (span.TotalMinutes < 1) return "Vừa xong";
            if (span.TotalMinutes < 60) return $"{(int)span.TotalMinutes} phút";
            if (span.TotalHours < 24) return $"{(int)span.TotalHours} giờ";
            if (span.TotalDays < 2) return "Hôm qua";
            return $"{(int)span.TotalDays} ngày";
        }

        [Authorize]
        public async Task<IActionResult> Index()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return RedirectToAction("Login", "Account");

            int userId = int.Parse(userIdClaim);

            var user = await _context.Users
                .Include(u => u.Profile)
                .Include(u => u.Profile.Education)
                .Include(u => u.Profile.ContactMethods)
                .FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
            {
                // The in-memory preview gets a new database after each restart, but
                // the browser may retain its old, still-valid authentication cookie.
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return RedirectToAction("Login", "Account");
            }

            var friendIds = await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Accepted && (f.RequesterId == userId || f.AddresseeId == userId))
                .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
                .ToListAsync();

            var postsQuery = _context.Posts
                .Include(p => p.User)
                    .ThenInclude(u => u.Profile)
                .Include(p => p.PostMedias)
                .Where(p => p.IsPublic || p.UserId == userId || friendIds.Contains(p.UserId));

            if (_featureGate.Enabled)
            {
                var hiddenPostIds = await _context.HiddenPosts
                    .Where(h => h.UserId == userId)
                    .Select(h => h.PostId)
                    .ToListAsync();
                if (hiddenPostIds.Count > 0)
                {
                    postsQuery = postsQuery.Where(p => !hiddenPostIds.Contains(p.Id));
                }
            }

            var posts = await postsQuery
                .OrderByDescending(p => p.CreatedAt)
                .Take(10)
                .ToListAsync();

            var postIds = posts.Select(p => p.Id).ToList();
            var likedPostIds = await _context.Likes
                .Where(l => l.UserId == userId && postIds.Contains(l.PostId))
                .Select(l => l.PostId)
                .ToListAsync();

            ViewBag.Posts = posts;
            ViewBag.CurrentUserId = userId;
            ViewBag.LikedPostIds = new HashSet<int>(likedPostIds);
            ViewBag.ActiveJobCount = await _context.JobPostings.CountAsync(j => j.isActive);
            ViewBag.OnlineFriendsCount = await CountOnlineFriendsAsync(userId);

            // ---- Thẻ bài viết (thiết kế Aris Kinetic): công ty, quan hệ với tác giả, đã lưu, bạn bè đã thích ----
            var postMeta = await BuildPostMetaAsync(posts, userId, friendIds);
            var likedSet = likedPostIds.ToHashSet();
            ViewBag.InitialPosts = posts.Select(p => ToFeedDto(p, postMeta[p.Id], likedSet.Contains(p.Id), userId)).ToList();

            // ---- Cột phải: lời mời kết nối đang chờ mình trả lời ----
            var incoming = await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Pending && f.AddresseeId == userId)
                .OrderByDescending(f => f.CreatedAt)
                .Select(f => new
                {
                    f.Id,
                    f.RequesterId,
                    f.Requester.Username,
                    FullName = f.Requester.Profile != null ? f.Requester.Profile.FullName : null,
                    AvatarUrl = f.Requester.Profile != null ? f.Requester.Profile.AvatarUrl : null,
                    JobTitle = f.Requester.Profile != null ? f.Requester.Profile.JobTitle : null
                })
                .Take(3)
                .ToListAsync();
            var requestItems = new List<ArisSkyve.Application.DTOs.FeedRequestItem>();
            if (incoming.Count > 0)
            {
                var reqIds = incoming.Select(r => r.RequesterId).ToList();
                var reqFriendships = await _context.Friendships
                    .Where(f => f.Status == FriendshipStatus.Accepted && (reqIds.Contains(f.RequesterId) || reqIds.Contains(f.AddresseeId)))
                    .Select(f => new { f.RequesterId, f.AddresseeId })
                    .ToListAsync();
                var myFriends = friendIds.ToHashSet();
                foreach (var r in incoming)
                {
                    int mutual = reqFriendships.Count(f =>
                        (f.RequesterId == r.RequesterId && myFriends.Contains(f.AddresseeId)) ||
                        (f.AddresseeId == r.RequesterId && myFriends.Contains(f.RequesterId)));
                    requestItems.Add(new ArisSkyve.Application.DTOs.FeedRequestItem(
                        r.Id, r.RequesterId,
                        string.IsNullOrWhiteSpace(r.FullName) ? r.Username : r.FullName!,
                        r.AvatarUrl,
                        string.IsNullOrWhiteSpace(r.JobTitle) || r.JobTitle == "Ứng viên tiềm năng" ? null : r.JobTitle,
                        mutual));
                }
            }
            ViewBag.Requests = requestItems;
            ViewBag.RequestCount = await _context.Friendships.CountAsync(f => f.Status == FriendshipStatus.Pending && f.AddresseeId == userId);

            // ---- Cột phải: việc cần làm (chỉ từ dữ liệu thật) ----
            var todos = new List<ArisSkyve.Application.DTOs.FeedTodoItem>();
            if (user?.Profile != null && (user.Role == "Business" || user.Role == "Admin" && user.Profile is BussinessAccount))
            {
                var bizId = user.Profile.Id;
                var since = DateTime.UtcNow.AddDays(-7);
                var newApplicants = await _context.JobApplications.CountAsync(a => a.JobPosting.BusinessAccountId == bizId && a.AppliedAt >= since && a.Status != JobApplicationStatus.Withdrawn);
                var openJobs = await _context.JobPostings.CountAsync(j => j.BusinessAccountId == bizId && j.isActive);
                if (newApplicants > 0)
                    todos.Add(new("users", $"{newApplicants} ứng viên mới tuần này", "Xem và phân loại hồ sơ trong bảng tuyển dụng", "/Employer", "Mở bảng"));
                if (openJobs == 0)
                    todos.Add(new("megaphone", "Chưa có tin tuyển dụng đang mở", "Đăng tin để ứng viên tìm thấy công ty bạn", "/Jobs", "Đăng tin"));
                ViewBag.HasCv = false;
                ViewBag.AppliedCount = 0;
                ViewBag.UpcomingInterview = null;
                ViewBag.ProfilePercent = 100;
            }
            else if (user?.Profile != null)
            {
                var hasCv = await _context.Resumes.AnyAsync(r => r.EmployeeId == user.Profile.Id);
                ViewBag.HasCv = hasCv;
                ViewBag.AppliedCount = await _context.JobApplications.CountAsync(a => a.ApplicantId == user.Profile.Id && a.Status != "Withdrawn");
                ViewBag.UpcomingInterview = await _context.JobApplications
                    .Include(a => a.JobPosting).ThenInclude(j => j.BusinessAccount)
                    .Where(a => a.ApplicantId == user.Profile.Id && a.Status == "InterviewScheduled" && a.InterviewAt >= DateTime.UtcNow)
                    .OrderBy(a => a.InterviewAt)
                    .FirstOrDefaultAsync();

                var (percent, missing) = ProfileCompleteness.Compute(user.Profile, hasCv);
                ViewBag.ProfilePercent = percent;
                if (!hasCv)
                {
                    todos.Add(new("file-plus-2", "Tạo CV đầu tiên", "Nhà tuyển dụng cần CV để xem xét hồ sơ của bạn", "/Resume", "Tạo CV"));
                }
                else
                {
                    todos.Add(new("sparkles", "Việc làm phù hợp CV", "Khám phá các vị trí được Aris AI gợi ý riêng cho bạn", "/Jobs?tab=ai", "Xem gợi ý"));
                }

                if (ViewBag.AppliedCount > 0)
                {
                    todos.Add(new("send", $"{ViewBag.AppliedCount} hồ sơ đã nộp", "Theo dõi tiến độ duyệt và phản hồi tuyển dụng", "/JobApplications/MyApplications", "Theo dõi"));
                }

                if (percent < 100)
                {
                    todos.Add(new("user-cog", $"Hoàn thiện hồ sơ ({percent}%)", "Còn thiếu: " + string.Join(", ", missing.Take(3)), "/Profile", "Cập nhật"));
                }
            }
            else
            {
                ViewBag.HasCv = false;
                ViewBag.AppliedCount = 0;
                ViewBag.UpcomingInterview = null;
                ViewBag.ProfilePercent = 0;
            }
            ViewBag.Todos = todos;

            ViewBag.RecentJobs = await _context.JobPostings
                .Include(j => j.Locations)
                .Include(j => j.BusinessAccount)
                .Where(j => j.isActive)
                .OrderByDescending(j => j.CreatedAt)
                .Take(3)
                .ToListAsync();

            return View(user);
        }

        /// <summary>
        /// Một bài trên Bảng tin ở dạng JSON cho feed.js (Index nhúng sẵn, GetPosts trả khi cuộn / có bài mới).
        /// </summary>
        private static object ToFeedDto(Post p, ArisSkyve.Application.DTOs.FeedPostMeta meta, bool liked, int userId)
        {
            var prof = p.User?.Profile;
            var name = meta.IsCompany && meta.CompanyName != null
                ? meta.CompanyName
                : (!string.IsNullOrWhiteSpace(prof?.FullName) ? prof!.FullName : (p.User?.Username ?? "Người dùng"));
            var jobTitle = prof?.JobTitle;
            if (string.IsNullOrWhiteSpace(jobTitle) || jobTitle == "Ứng viên tiềm năng") jobTitle = null;
            var location = prof?.Location;
            if (string.IsNullOrWhiteSpace(location) || location == "Chưa cập nhật") location = null;

            return new
            {
                id = p.Id,
                userId = p.UserId,
                authorName = name,
                authorAvatar = string.IsNullOrWhiteSpace(prof?.AvatarUrl) ? "/images/default-avatar.png" : prof!.AvatarUrl,
                authorTitle = jobTitle,
                authorLocation = location,
                title = p.Title,
                text = p.Content ?? string.Empty,
                time = p.CreatedAt.ToString("o"),
                mins = (int)Math.Max(0, (DateTime.UtcNow - p.CreatedAt).TotalMinutes),
                likes = p.LikeCount,
                liked,
                myReaction = liked ? meta.MyReaction ?? ReactionKinds.Default : null,
                reactions = ReactionJson(meta.Reactions),
                commentCount = p.CommentCount,
                isOwner = p.UserId == userId,
                media = (p.PostMedias ?? Enumerable.Empty<PostMedias>())
                    .Select(m => new { src = m.MediaUrl, kind = m.MediaType == "video" ? "video" : "image" })
                    .ToList(),
                isCompany = meta.IsCompany,
                companyId = meta.CompanyId,
                industry = meta.Industry,
                companyAddress = meta.CompanyAddress,
                verified = meta.Verified,
                openJobs = meta.OpenJobs,
                following = meta.Following,
                relation = meta.Relation,
                saved = meta.Saved,
                friendLikers = meta.FriendLikers
            };
        }

        /// <summary>
        /// Dữ liệu phụ cho thẻ bài viết: tác giả là công ty (xác minh, số việc đang tuyển, mình có theo dõi không),
        /// quan hệ bạn bè với tác giả, bài đã lưu, và tối đa 2 người bạn đã thích bài.
        /// </summary>
        private async Task<Dictionary<int, ArisSkyve.Application.DTOs.FeedPostMeta>> BuildPostMetaAsync(List<Post> posts, int userId, List<int> friendIds)
        {
            var result = new Dictionary<int, ArisSkyve.Application.DTOs.FeedPostMeta>();
            if (posts.Count == 0) return result;

            var postIds = posts.Select(p => p.Id).ToList();
            var bizIds = posts.Select(p => p.User?.Profile).OfType<BussinessAccount>().Select(b => b.Id).Distinct().ToList();

            var openJobsByBiz = new Dictionary<int, int>();
            if (bizIds.Count > 0)
            {
                openJobsByBiz = await _context.JobPostings
                    .Where(j => j.isActive && j.BusinessAccountId != null && bizIds.Contains(j.BusinessAccountId.Value))
                    .GroupBy(j => j.BusinessAccountId!.Value)
                    .Select(g => new { Id = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.Id, x => x.Count);
            }

            var followed = new HashSet<int>();
            var saved = new HashSet<int>();
            if (_featureGate.Enabled)
            {
                if (bizIds.Count > 0)
                {
                    followed = (await _context.CompanyFollows
                        .Where(cf => cf.UserId == userId && bizIds.Contains(cf.BusinessAccountId))
                        .Select(cf => cf.BusinessAccountId)
                        .ToListAsync()).ToHashSet();
                }
                saved = (await _context.SavedPosts
                    .Where(sp => sp.UserId == userId && postIds.Contains(sp.PostId))
                    .Select(sp => sp.PostId)
                    .ToListAsync()).ToHashSet();
            }

            var pending = (await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Pending && (f.RequesterId == userId || f.AddresseeId == userId))
                .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
                .ToListAsync()).ToHashSet();
            var friends = friendIds.ToHashSet();

            var likers = new Dictionary<int, List<string>>();
            if (friendIds.Count > 0)
            {
                var rows = await _context.Likes
                    .Where(l => postIds.Contains(l.PostId) && friendIds.Contains(l.UserId))
                    .OrderByDescending(l => l.CreatedAt)
                    .Select(l => new { l.PostId, Name = l.User.Profile != null && l.User.Profile.FullName != "" ? l.User.Profile.FullName : l.User.Username })
                    .ToListAsync();
                foreach (var g in rows.GroupBy(r => r.PostId))
                    likers[g.Key] = g.Select(r => r.Name).Where(n => !string.IsNullOrWhiteSpace(n)).Distinct().Take(2).ToList();
            }

            var reactionCounts = await PostReactionSummaryAsync(postIds);
            var myKinds = _featureGate.PostReactions
                ? await _context.PostReactions
                    .Where(r => r.UserId == userId && postIds.Contains(r.PostId))
                    .ToDictionaryAsync(r => r.PostId, r => r.Kind)
                : new Dictionary<int, string>();

            foreach (var p in posts)
            {
                var biz = p.User?.Profile as BussinessAccount;
                result[p.Id] = new ArisSkyve.Application.DTOs.FeedPostMeta
                {
                    IsCompany = biz != null,
                    CompanyId = biz?.Id,
                    CompanyName = string.IsNullOrWhiteSpace(biz?.CompanyName) ? null : biz!.CompanyName,
                    Industry = biz?.Industry,
                    CompanyAddress = biz?.CompanyAddress,
                    Verified = biz?.IsVerified ?? false,
                    OpenJobs = biz != null && openJobsByBiz.TryGetValue(biz.Id, out var n) ? n : 0,
                    Following = biz != null && followed.Contains(biz.Id),
                    Relation = p.UserId == userId ? "self" : friends.Contains(p.UserId) ? "friend" : pending.Contains(p.UserId) ? "pending" : "none",
                    Saved = saved.Contains(p.Id),
                    FriendLikers = likers.TryGetValue(p.Id, out var fl) ? fl : new List<string>(),
                    MyReaction = myKinds.TryGetValue(p.Id, out var mk) ? mk : null,
                    Reactions = reactionCounts.TryGetValue(p.Id, out var rc) ? rc : new List<(string Kind, int Count)>()
                };
            }
            return result;
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetLiveStats()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            var activeJobCount = await _context.JobPostings.CountAsync(j => j.isActive);
            var onlineFriendsCount = await CountOnlineFriendsAsync(userId);

            return Json(new { activeJobCount, onlineFriendsCount });
        }

        private async Task<int> CountOnlineFriendsAsync(int userId)
        {
            var friendUserIds = await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Accepted && (f.RequesterId == userId || f.AddresseeId == userId))
                .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
                .ToListAsync();

            if (friendUserIds.Count == 0) return 0;

            var showStatusIds = await _context.Users
                .Where(u => friendUserIds.Contains(u.Id) && u.ShowActiveStatus)
                .Select(u => u.Id)
                .ToListAsync();

            return showStatusIds.Count(id => ChatHub.IsConnected(id));
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetPosts(int? before = null, int take = 10)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            take = Math.Clamp(take, 1, 50);

            var friendIds = await _context.Friendships
                .Where(f => f.Status == FriendshipStatus.Accepted && (f.RequesterId == userId || f.AddresseeId == userId))
                .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
                .ToListAsync();

            var query = _context.Posts
                .Include(p => p.User).ThenInclude(u => u.Profile)
                .Include(p => p.PostMedias)
                .Where(p => p.IsPublic || p.UserId == userId || friendIds.Contains(p.UserId));

            if (before.HasValue && before.Value > 0)
            {
                query = query.Where(p => p.Id < before.Value);
            }

            if (_featureGate.Enabled)
            {
                var hiddenPostIds = await _context.HiddenPosts
                    .Where(h => h.UserId == userId)
                    .Select(h => h.PostId)
                    .ToListAsync();
                if (hiddenPostIds.Count > 0)
                {
                    query = query.Where(p => !hiddenPostIds.Contains(p.Id));
                }
            }

            var posts = await query
                .OrderByDescending(p => p.CreatedAt)
                .Take(take + 1)
                .ToListAsync();

            bool hasMore = posts.Count > take;
            var list = posts.Take(take).ToList();
            var postIds = list.Select(p => p.Id).ToList();

            var likedPostIds = await _context.Likes
                .Where(l => l.UserId == userId && postIds.Contains(l.PostId))
                .Select(l => l.PostId)
                .ToListAsync();

            var meta = await BuildPostMetaAsync(list, userId, friendIds);
            var likedSet = likedPostIds.ToHashSet();
            var result = list.Select(p => ToFeedDto(p, meta[p.Id], likedSet.Contains(p.Id), userId)).ToList();

            return Json(new { success = true, posts = result, hasMore });
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreatePost(
            string? content,
            string? title,
            List<IFormFile>? mediaFiles,
            bool isPublic = true,
            string? aspectRatio = null,
            int? jobPostingId = null,
            int? repostOfId = null,
            string? pollQuestion = null,
            List<string>? pollOptions = null,
            int pollDurationDays = 3,
            List<int>? mentionIds = null)
        {
            bool hasMedia = mediaFiles != null && mediaFiles.Count > 0;
            bool hasPoll = !string.IsNullOrWhiteSpace(pollQuestion) && pollOptions != null && pollOptions.Count >= 2;

            var validatedMedia = new List<(IFormFile File, ValidatedPublicMedia Media)>();
            if (hasMedia)
            {
                // The composer limits this to ten items in the browser. Keep the
                // same bound on the server before doing any storage or DB work.
                if (mediaFiles!.Count > 10)
                {
                    return Json(new { success = false, message = "Mỗi bài đăng chỉ được đính kèm tối đa 10 tệp." });
                }

                foreach (var file in mediaFiles)
                {
                    var validation = await PublicMediaValidator.ValidateAsync(file, HttpContext.RequestAborted);
                    if (!validation.IsValid || validation.Media is null)
                    {
                        return Json(new { success = false, message = validation.Error ?? "Tệp đính kèm không hợp lệ." });
                    }

                    validatedMedia.Add((file, validation.Media));
                }
            }

            if (string.IsNullOrWhiteSpace(content) && string.IsNullOrWhiteSpace(title) && !hasMedia && !hasPoll && !repostOfId.HasValue)
            {
                return Json(new { success = false, message = "Dữ liệu không hợp lệ" });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
                return Json(new { success = false, message = "User not authenticated" });

            int userId = int.Parse(userIdClaim);

            // Upload every validated file before creating the post. If Drive cannot
            // store all attachments, fail the request rather than publishing a post
            // with silently missing media or falling back to local disk.
            List<(PublicMediaUpload Upload, string Type)> uploadedMedia = new();
            if (hasMedia)
            {
                try
                {
                    uploadedMedia = await UploadPostMediaAsync(validatedMedia);
                }
                catch (PublicMediaStorageException)
                {
                    return Json(new { success = false, message = "Google Drive could not store the upload. Please try again." });
                }
            }

            var post = new Post
            {
                Content = content ?? string.Empty,
                UserId = userId,
                CreatedAt = DateTime.UtcNow,
                IsPublic = isPublic,
                Title = !string.IsNullOrEmpty(title) ? title : null
            };

            _context.Posts.Add(post);
            await _context.SaveChangesAsync();

            if (uploadedMedia.Count > 0)
            {
                int order = 0;
                foreach (var (upload, type) in uploadedMedia)
                {
                    var pm = new PostMedias
                    {
                        PostId = post.Id,
                        MediaUrl = upload.Url,
                        MediaType = type
                    };
                    _context.PostMedias.Add(pm);
                    await _context.SaveChangesAsync();

                    if (_featureGate.Enabled)
                    {
                        _context.PostMediaOrders.Add(new PostMediaOrder
                        {
                            PostMediaId = pm.Id,
                            SortOrder = order++
                        });
                    }
                }
                if (_featureGate.Enabled) await _context.SaveChangesAsync();
            }

            if (_featureGate.Enabled)
            {
                if (aspectRatio != null || jobPostingId != null || repostOfId != null)
                {
                    _context.PostExtras.Add(new PostExtra
                    {
                        PostId = post.Id,
                        AspectRatio = aspectRatio,
                        JobPostingId = jobPostingId,
                        RepostOfId = repostOfId
                    });
                }

                if (hasPoll)
                {
                    var poll = new PostPoll
                    {
                        PostId = post.Id,
                        Question = pollQuestion!.Trim(),
                        EndsAt = DateTime.UtcNow.AddDays(Math.Clamp(pollDurationDays, 1, 7))
                    };
                    _context.PostPolls.Add(poll);
                    await _context.SaveChangesAsync();

                    int sOrder = 0;
                    foreach (var opt in pollOptions!)
                    {
                        if (!string.IsNullOrWhiteSpace(opt))
                        {
                            _context.PollOptions.Add(new PollOption
                            {
                                PostId = post.Id,
                                Label = opt.Trim(),
                                SortOrder = sOrder++
                            });
                        }
                    }
                }

                if (mentionIds != null && mentionIds.Count > 0)
                {
                    foreach (var mId in mentionIds.Distinct())
                    {
                        _context.Mentions.Add(new Mention
                        {
                            PostId = post.Id,
                            MentionedUserId = mId,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                if (!string.IsNullOrEmpty(content))
                {
                    var regex = new Regex(@"#([\p{L}\d_]+)");
                    var matches = regex.Matches(content);
                    foreach (Match match in matches)
                    {
                        var tagVal = match.Groups[1].Value.ToLower();
                        _context.PostHashTags.Add(new PostHashTag { PostId = post.Id, Tag = tagVal });
                    }
                }

                await _context.SaveChangesAsync();

                try
                {
                    var friendIds = await _context.Friendships
                        .Where(f => f.Status == FriendshipStatus.Accepted && (f.RequesterId == userId || f.AddresseeId == userId))
                        .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
                        .ToListAsync();

                    var authorUser = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
                    foreach (var fId in friendIds)
                    {
                        await _chatHubContext.Clients.User(fId.ToString()).SendAsync("NewPost", new
                        {
                            postId = post.Id,
                            authorId = userId,
                            authorName = authorUser?.Profile?.FullName ?? authorUser?.Username ?? "Bạn bè",
                            authorAvatar = authorUser?.Profile?.AvatarUrl ?? "/images/default-avatar.png"
                        });
                    }
                }
                catch { /* Ignore SignalR broadcast error */ }
            }

            var postWithUser = await _context.Posts
                .Include(p => p.User)
                .ThenInclude(u => u.Profile)
                .Include(p => p.PostMedias)
                .FirstOrDefaultAsync(p => p.Id == post.Id);

            return Json(new
            {
                success = true,
                data = new
                {
                    id = postWithUser!.Id,
                    username = postWithUser.User.Username,
                    avatar = postWithUser.User.Profile?.AvatarUrl ?? "/images/default-avatar.png",
                    content = postWithUser.Content,
                    title = postWithUser.Title,
                    time = "Vừa xong",
                    isArticle = !string.IsNullOrEmpty(postWithUser.Title),
                    media = postWithUser.PostMedias.Select(m => new { url = m.MediaUrl, type = m.MediaType }),
                    likeCount = 0,
                    commentCount = 0,
                    isLiked = false
                }
            });
        }

        private async Task<List<(PublicMediaUpload Upload, string Type)>> UploadPostMediaAsync(
            IReadOnlyList<(IFormFile File, ValidatedPublicMedia Media)> files)
        {
            var results = new List<(PublicMediaUpload, string)>();

            foreach (var (file, media) in files)
            {
                try
                {
                    var upload = await _publicMedia.UploadAsync(PublicMediaStorage.Posts, file, media, HttpContext.RequestAborted);
                    results.Add((upload, media.MediaType));
                }
                catch
                {
                    await DeleteUploadedMediaAsync(results);
                    throw;
                }
            }

            return results;
        }

        private async Task DeleteUploadedMediaAsync(IEnumerable<(PublicMediaUpload Upload, string Type)> uploads)
        {
            foreach (var (upload, _) in uploads)
            {
                // This is compensating cleanup after an upload failure. The request
                // may already be cancelled, so never reuse RequestAborted here.
                try { await _publicMedia.DeleteAsync(upload.FileId, CancellationToken.None); }
                catch { /* The primary upload failure is the actionable error. */ }
            }
        }

        /// <summary>
        /// Thích / thả cảm xúc. Không có <paramref name="kind"/>: bật/tắt tim như trước (trang cũ vẫn dùng).
        /// Có kind: đặt cảm xúc đó; chọn lại đúng cảm xúc đang có thì gỡ. Trước khi có migration
        /// AddPostReactions mọi lựa chọn đều thành tim.
        /// </summary>
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> ToggleLike(int postId, string? kind = null)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();

            int userId = int.Parse(userIdClaim);

            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == postId);
            if (post == null) return NotFound();

            var reactions = _featureGate.PostReactions;
            if (string.IsNullOrWhiteSpace(kind)) kind = null;
            else if (!ReactionKinds.IsKnown(kind)) return Json(new { success = false, message = "Cảm xúc không hợp lệ." });
            else if (!reactions) kind = ReactionKinds.Default;

            var existingLike = await _context.Likes.FirstOrDefaultAsync(l => l.UserId == userId && l.PostId == postId);
            var row = existingLike != null && reactions
                ? await _context.PostReactions.FirstOrDefaultAsync(r => r.UserId == userId && r.PostId == postId)
                : null;
            var current = existingLike == null ? null : row?.Kind ?? ReactionKinds.Default;
            var next = kind == null
                ? (current == null ? ReactionKinds.Default : null)
                : (kind == current ? null : kind);

            if (next == null)
            {
                if (row != null) _context.PostReactions.Remove(row);
                if (existingLike != null)
                {
                    _context.Likes.Remove(existingLike);
                    if (post.LikeCount > 0) post.LikeCount -= 1;
                }
            }
            else
            {
                if (existingLike == null)
                {
                    _context.Likes.Add(new Like { UserId = userId, PostId = postId, CreatedAt = DateTime.UtcNow });
                    post.LikeCount += 1;
                }
                // The heart needs no row; any other kind is stored on (or replaces) the row.
                if (reactions)
                {
                    if (next == ReactionKinds.Default) { if (row != null) _context.PostReactions.Remove(row); }
                    else if (row == null) _context.PostReactions.Add(new PostReaction { UserId = userId, PostId = postId, Kind = next });
                    else { row.Kind = next; row.UpdatedAt = DateTime.UtcNow; }
                }
            }
            await _context.SaveChangesAsync();

            var summary = await PostReactionSummaryAsync(new List<int> { postId });
            return Json(new
            {
                success = true,
                liked = next != null,
                kind = next,
                likeCount = post.LikeCount,
                reactions = ReactionJson(summary.GetValueOrDefault(postId))
            });
        }

        private static object ReactionJson(List<(string Kind, int Count)>? counts) =>
            (counts ?? new List<(string Kind, int Count)>()).Select(c => new { kind = c.Kind, count = c.Count }).ToList();

        // Per-kind counts, most used first. A like without a reaction row is a heart.
        private static List<(string Kind, int Count)> MergeKinds(int totalLikes, IEnumerable<(string Kind, int Count)> faces)
        {
            var list = faces.Where(f => f.Count > 0 && f.Kind != ReactionKinds.Default).ToList();
            var hearts = totalLikes - list.Sum(f => f.Count);
            if (hearts > 0) list.Add((ReactionKinds.Default, hearts));
            return list.OrderByDescending(f => f.Count).ThenBy(f => Array.IndexOf(ReactionKinds.All, f.Kind)).ToList();
        }

        private async Task<Dictionary<int, List<(string Kind, int Count)>>> PostReactionSummaryAsync(List<int> postIds)
        {
            var result = new Dictionary<int, List<(string Kind, int Count)>>();
            if (postIds.Count == 0) return result;

            var totals = await _context.Likes
                .Where(l => postIds.Contains(l.PostId))
                .GroupBy(l => l.PostId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count);
            var faces = _featureGate.PostReactions
                ? (await _context.PostReactions
                    .Where(r => postIds.Contains(r.PostId))
                    .GroupBy(r => new { r.PostId, r.Kind })
                    .Select(g => new { g.Key.PostId, g.Key.Kind, Count = g.Count() })
                    .ToListAsync())
                    .ToLookup(x => x.PostId, x => (x.Kind, x.Count))
                : Enumerable.Empty<(int PostId, string Kind, int Count)>().ToLookup(x => x.PostId, x => (x.Kind, x.Count));

            foreach (var (postId, total) in totals)
                result[postId] = MergeKinds(total, faces[postId]);
            return result;
        }

        private async Task<Dictionary<int, List<(string Kind, int Count)>>> CommentReactionSummaryAsync(List<int> commentIds, IReadOnlyDictionary<int, int> likeCounts)
        {
            var faces = _featureGate.PostReactions && commentIds.Count > 0
                ? (await _context.CommentReactions
                    .Where(r => commentIds.Contains(r.CommentId))
                    .GroupBy(r => new { r.CommentId, r.Kind })
                    .Select(g => new { g.Key.CommentId, g.Key.Kind, Count = g.Count() })
                    .ToListAsync())
                    .ToLookup(x => x.CommentId, x => (x.Kind, x.Count))
                : Enumerable.Empty<(int CommentId, string Kind, int Count)>().ToLookup(x => x.CommentId, x => (x.Kind, x.Count));

            return likeCounts.ToDictionary(kv => kv.Key, kv => MergeKinds(kv.Value, faces[kv.Key]));
        }

        /// <summary>
        /// Ai đã thả cảm xúc cho một bài viết hoặc một bình luận (mới nhất trước), kèm số theo từng loại.
        /// </summary>
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetReactions(int? postId, int? commentId)
        {
            if (postId.HasValue == commentId.HasValue) return BadRequest();
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);
            const int Max = 300;

            List<(User? User, DateTime At)> likers;
            Dictionary<int, string> kinds;
            int total;
            if (postId.HasValue)
            {
                if (!await _context.Posts.AnyAsync(p => p.Id == postId)) return NotFound();
                var query = _context.Likes.Where(l => l.PostId == postId);
                total = await query.CountAsync();
                likers = (await query.Include(l => l.User).ThenInclude(u => u.Profile)
                        .OrderByDescending(l => l.CreatedAt).Take(Max).AsNoTracking().ToListAsync())
                    .Select(l => ((User?)l.User, l.CreatedAt)).ToList();
                kinds = _featureGate.PostReactions
                    ? await _context.PostReactions.Where(r => r.PostId == postId).ToDictionaryAsync(r => r.UserId, r => r.Kind)
                    : new Dictionary<int, string>();
            }
            else
            {
                if (!_featureGate.Enabled) return Json(new { success = true, total = 0, counts = Array.Empty<object>(), people = Array.Empty<object>() });
                var query = _context.CommentLikes.Where(l => l.CommentId == commentId);
                total = await query.CountAsync();
                likers = (await query.Include(l => l.User).ThenInclude(u => u!.Profile)
                        .OrderByDescending(l => l.CreatedAt).Take(Max).AsNoTracking().ToListAsync())
                    .Select(l => (l.User, l.CreatedAt)).ToList();
                kinds = _featureGate.PostReactions
                    ? await _context.CommentReactions.Where(r => r.CommentId == commentId).ToDictionaryAsync(r => r.UserId, r => r.Kind)
                    : new Dictionary<int, string>();
            }

            var counts = MergeKinds(total, kinds.Values.GroupBy(k => k).Select(g => (g.Key, g.Count())));
            var people = likers.Where(x => x.User != null).Select(x =>
            {
                var u = x.User!;
                var biz = u.Profile as BussinessAccount;
                return new
                {
                    userId = u.Id,
                    name = ChatController.DisplayName(u),
                    avatar = string.IsNullOrWhiteSpace(u.Profile?.AvatarUrl) ? "/images/default-avatar.png" : u.Profile!.AvatarUrl,
                    subtitle = biz != null ? biz.Industry : u.Profile?.JobTitle is { } t && t != "Ứng viên tiềm năng" ? t : null,
                    href = u.Id == userId ? "/Profile" : biz != null ? $"/Company/Details/{biz.Id}" : $"/Profile/View/{u.Id}",
                    isCompany = biz != null,
                    isMe = u.Id == userId,
                    kind = kinds.TryGetValue(u.Id, out var k) ? k : ReactionKinds.Default
                };
            }).ToList();

            return Json(new { success = true, total, counts = ReactionJson(counts), people });
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetComments(int postId)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int currentUserId = string.IsNullOrEmpty(userIdClaim) ? 0 : int.Parse(userIdClaim);

            var comments = await _context.Comments
                .Include(c => c.User).ThenInclude(u => u.Profile)
                .Where(c => c.PostId == postId)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            var commentIds = comments.Select(c => c.Id).ToList();
            Dictionary<int, int> parentMap = new();
            Dictionary<int, int> likeCounts = new();
            HashSet<int> myLikes = new();

            if (_featureGate.Enabled && commentIds.Count > 0)
            {
                parentMap = await _context.CommentReplies
                    .Where(r => commentIds.Contains(r.CommentId))
                    .ToDictionaryAsync(r => r.CommentId, r => r.ParentCommentId);

                likeCounts = await _context.CommentLikes
                    .Where(l => commentIds.Contains(l.CommentId))
                    .GroupBy(l => l.CommentId)
                    .Select(g => new { id = g.Key, count = g.Count() })
                    .ToDictionaryAsync(x => x.id, x => x.count);

                if (currentUserId > 0)
                {
                    myLikes = (await _context.CommentLikes
                        .Where(l => l.UserId == currentUserId && commentIds.Contains(l.CommentId))
                        .Select(l => l.CommentId)
                        .ToListAsync()).ToHashSet();
                }
            }

            var reactionCounts = await CommentReactionSummaryAsync(commentIds, likeCounts);
            var myKinds = _featureGate.PostReactions && currentUserId > 0 && myLikes.Count > 0
                ? await _context.CommentReactions
                    .Where(r => r.UserId == currentUserId && commentIds.Contains(r.CommentId))
                    .ToDictionaryAsync(r => r.CommentId, r => r.Kind)
                : new Dictionary<int, string>();

            var postOwnerId = await _context.Posts.Where(p => p.Id == postId).Select(p => (int?)p.UserId).FirstOrDefaultAsync();
            var present = commentIds.ToHashSet();

            var result = comments.Select(c => new
            {
                id = c.Id,
                userId = c.UserId,
                username = c.User == null ? "Người dùng" : ChatController.DisplayName(c.User),
                avatar = c.User?.Profile?.AvatarUrl ?? "/images/default-avatar.png",
                content = c.Content,
                createdAt = DateTime.SpecifyKind(c.CreatedAt, DateTimeKind.Utc),
                parentCommentId = ThreadRoot(c.Id, parentMap, present),
                likeCount = likeCounts.TryGetValue(c.Id, out var lc) ? lc : 0,
                isLiked = myLikes.Contains(c.Id),
                myReaction = myLikes.Contains(c.Id) ? myKinds.GetValueOrDefault(c.Id, ReactionKinds.Default) : null,
                reactions = ReactionJson(reactionCounts.GetValueOrDefault(c.Id)),
                isMine = currentUserId > 0 && c.UserId == currentUserId,
                canDelete = currentUserId > 0 && (c.UserId == currentUserId || postOwnerId == currentUserId)
            });

            return Json(result);
        }

        // Threads are one level deep: a reply to a reply hangs under the top-level comment.
        private static int? ThreadRoot(int commentId, IReadOnlyDictionary<int, int> parents, IReadOnlySet<int> present)
        {
            if (!parents.TryGetValue(commentId, out var root)) return null;
            for (var hops = 0; hops < 16 && parents.TryGetValue(root, out var next); hops++) root = next;
            return present.Contains(root) ? root : null;
        }

        [HttpPost]
        [Authorize]
        [Route("Dashboard/AddComment")]
        [Route("Comments/Reply")]
        public async Task<IActionResult> AddComment(int postId, string content, int? parentCommentId = null)
        {
            if (string.IsNullOrWhiteSpace(content))
                return Json(new { success = false, message = "Bình luận không được để trống" });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
                return Json(new { success = false, message = "User not authenticated" });
            int userId = int.Parse(userIdClaim);

            if (parentCommentId.HasValue && !_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == postId);
            if (post == null) return NotFound();

            // Validate the reply target before saving anything: it must be a comment of this
            // post (your own comments included). The thread root is its top-level comment.
            Comment? answered = null;
            int? threadRootId = null;
            if (parentCommentId.HasValue)
            {
                answered = await _context.Comments.FirstOrDefaultAsync(c => c.Id == parentCommentId.Value && c.PostId == postId);
                if (answered == null) return Json(new { success = false, message = "Bình luận bạn trả lời không còn tồn tại." });
                threadRootId = answered.Id;
                for (var hops = 0; hops < 16; hops++)
                {
                    var up = await _context.CommentReplies.Where(r => r.CommentId == threadRootId).Select(r => (int?)r.ParentCommentId).FirstOrDefaultAsync();
                    if (up == null || !await _context.Comments.AnyAsync(c => c.Id == up && c.PostId == postId)) break;
                    threadRootId = up;
                }
            }

            var comment = new Comment
            {
                Content = content.Trim(),
                UserId = userId,
                PostId = postId,
                CreatedAt = DateTime.UtcNow
            };
            _context.Comments.Add(comment);
            post.CommentCount += 1;

            // Bell: the person answered, and the post owner — never yourself, never twice.
            var preview = comment.Content.Length > 80 ? comment.Content[..80] + "…" : comment.Content;
            var link = $"/Dashboard?post={postId}";
            StagedNotification? toAnswered = null, toOwner = null;
            if (answered != null)
                toAnswered = await NotificationWriter.StageAsync(_context, answered.UserId, userId, "CommentReply", $"đã trả lời bình luận của bạn: “{preview}”", link);
            if (post.UserId != answered?.UserId)
                toOwner = await NotificationWriter.StageAsync(_context, post.UserId, userId, "PostComment",
                    answered == null ? $"đã bình luận về bài viết của bạn: “{preview}”" : $"đã trả lời một bình luận trong bài viết của bạn: “{preview}”", link);

            await _context.SaveChangesAsync();

            if (threadRootId.HasValue)
            {
                _context.CommentReplies.Add(new CommentReply { CommentId = comment.Id, ParentCommentId = threadRootId.Value });
                await _context.SaveChangesAsync();
            }

            await NotificationWriter.PushAsync(_chatHubContext, _context, toAnswered);
            await NotificationWriter.PushAsync(_chatHubContext, _context, toOwner);

            var user = await _context.Users.Include(u => u.Profile).FirstAsync(u => u.Id == userId);

            return Json(new
            {
                success = true,
                commentCount = post.CommentCount,
                comment = new
                {
                    id = comment.Id,
                    userId,
                    username = ChatController.DisplayName(user),
                    avatar = user.Profile?.AvatarUrl ?? "/images/default-avatar.png",
                    content = comment.Content,
                    createdAt = comment.CreatedAt,
                    parentCommentId = threadRootId,
                    likeCount = 0,
                    isLiked = false,
                    myReaction = (string?)null,
                    reactions = Array.Empty<object>(),
                    isMine = true,
                    canDelete = true
                }
            });
        }

        [HttpPost]
        [Authorize]
        [Route("Dashboard/ToggleCommentLike/{id?}")]
        [Route("Dashboard/ToggleCommentLike")]
        [Route("Comments/Like/{id}")]
        public async Task<IActionResult> ToggleCommentLike(int? id, int? commentId, string? kind = null)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            int cId = id ?? commentId ?? 0;
            if (cId <= 0) return Json(new { success = false, message = "ID bình luận không hợp lệ." });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            // Same rules as ToggleLike: no kind toggles the heart, a kind sets it, the same kind again removes it.
            var reactions = _featureGate.PostReactions;
            if (string.IsNullOrWhiteSpace(kind)) kind = null;
            else if (!ReactionKinds.IsKnown(kind)) return Json(new { success = false, message = "Cảm xúc không hợp lệ." });
            else if (!reactions) kind = ReactionKinds.Default;

            var existing = await _context.CommentLikes.FirstOrDefaultAsync(l => l.CommentId == cId && l.UserId == userId);
            var row = existing != null && reactions
                ? await _context.CommentReactions.FirstOrDefaultAsync(r => r.CommentId == cId && r.UserId == userId)
                : null;
            var current = existing == null ? null : row?.Kind ?? ReactionKinds.Default;
            var next = kind == null
                ? (current == null ? ReactionKinds.Default : null)
                : (kind == current ? null : kind);

            if (next == null)
            {
                if (row != null) _context.CommentReactions.Remove(row);
                if (existing != null) _context.CommentLikes.Remove(existing);
            }
            else
            {
                if (existing == null)
                {
                    if (!await _context.Comments.AnyAsync(c => c.Id == cId))
                        return Json(new { success = false, message = "Bình luận không còn tồn tại." });
                    _context.CommentLikes.Add(new CommentLike
                    {
                        CommentId = cId,
                        UserId = userId,
                        CreatedAt = DateTime.UtcNow
                    });
                }
                if (reactions)
                {
                    if (next == ReactionKinds.Default) { if (row != null) _context.CommentReactions.Remove(row); }
                    else if (row == null) _context.CommentReactions.Add(new CommentReaction { CommentId = cId, UserId = userId, Kind = next });
                    else { row.Kind = next; row.UpdatedAt = DateTime.UtcNow; }
                }
            }
            await _context.SaveChangesAsync();

            int count = await _context.CommentLikes.CountAsync(l => l.CommentId == cId);
            var summary = await CommentReactionSummaryAsync(new List<int> { cId }, new Dictionary<int, int> { [cId] = count });
            return Json(new
            {
                success = true,
                liked = next != null,
                kind = next,
                likeCount = count,
                reactions = ReactionJson(summary.GetValueOrDefault(cId))
            });
        }

        [HttpDelete]
        [Authorize]
        [Route("Dashboard/DeleteComment/{id}")]
        [Route("Dashboard/DeleteComment")]
        public async Task<IActionResult> DeleteComment(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            var comment = await _context.Comments.Include(c => c.Post).FirstOrDefaultAsync(c => c.Id == id);
            if (comment == null) return NotFound();

            if (comment.UserId != userId && comment.Post?.UserId != userId)
            {
                return Json(new { success = false, message = "Bạn không có quyền xoá bình luận này." });
            }

            // A comment goes together with its replies (they used to turn into top-level comments).
            var removed = new List<Comment> { comment };
            if (_featureGate.Enabled)
            {
                var frontier = new List<int> { id };
                for (var depth = 0; depth < 16 && frontier.Count > 0; depth++)
                {
                    var childIds = await _context.CommentReplies.Where(r => frontier.Contains(r.ParentCommentId)).Select(r => r.CommentId).ToListAsync();
                    var children = await _context.Comments.Where(c => childIds.Contains(c.Id) && c.PostId == comment.PostId).ToListAsync();
                    children.RemoveAll(c => removed.Any(r => r.Id == c.Id));
                    removed.AddRange(children);
                    frontier = children.Select(c => c.Id).ToList();
                }

                var removedIds = removed.Select(c => c.Id).ToList();
                _context.CommentReplies.RemoveRange(await _context.CommentReplies
                    .Where(r => removedIds.Contains(r.CommentId) || removedIds.Contains(r.ParentCommentId)).ToListAsync());
                _context.CommentLikes.RemoveRange(await _context.CommentLikes.Where(l => removedIds.Contains(l.CommentId)).ToListAsync());
            }

            if (comment.Post != null)
            {
                comment.Post.CommentCount = Math.Max(0, comment.Post.CommentCount - removed.Count);
            }
            _context.Comments.RemoveRange(removed);
            await _context.SaveChangesAsync();

            return Json(new { success = true, removedIds = removed.Select(c => c.Id), commentCount = comment.Post?.CommentCount });
        }

        [HttpPost]
        [Authorize]
        [Route("Dashboard/ToggleSave/{id?}")]
        [Route("Dashboard/ToggleSave")]
        [Route("Posts/SavePost/{id}")]
        public async Task<IActionResult> ToggleSave(int? id, int? postId)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            int pId = id ?? postId ?? 0;
            if (pId <= 0) return Json(new { success = false, message = "ID bài viết không hợp lệ." });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == pId);
            if (post == null) return NotFound();

            var existing = await _context.SavedPosts.FirstOrDefaultAsync(s => s.UserId == userId && s.PostId == pId);
            bool saved = false;
            if (existing != null)
            {
                _context.SavedPosts.Remove(existing);
                saved = false;
            }
            else
            {
                _context.SavedPosts.Add(new SavedPost
                {
                    UserId = userId,
                    PostId = pId,
                    CreatedAt = DateTime.UtcNow
                });
                saved = true;
            }
            await _context.SaveChangesAsync();

            return Json(new { success = true, saved });
        }

        [HttpGet]
        [Authorize]
        [Route("Dashboard/Saved")]
        public async Task<IActionResult> Saved(int? before = null, int take = 10)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            take = Math.Clamp(take, 1, 50);

            var query = _context.SavedPosts
                .Include(s => s.Post).ThenInclude(p => p.User).ThenInclude(u => u.Profile)
                .Include(s => s.Post).ThenInclude(p => p.PostMedias)
                .Where(s => s.UserId == userId);

            if (before.HasValue && before.Value > 0)
            {
                query = query.Where(s => s.PostId < before.Value);
            }

            var savedList = await query
                .OrderByDescending(s => s.CreatedAt)
                .Take(take)
                .Select(s => new
                {
                    id = s.Post.Id,
                    username = s.Post.User.Username,
                    avatar = s.Post.User.Profile != null ? s.Post.User.Profile.AvatarUrl : "/images/default-avatar.png",
                    content = s.Post.Content,
                    title = s.Post.Title,
                    time = FormatTimeAgo(s.Post.CreatedAt),
                    isArticle = !string.IsNullOrEmpty(s.Post.Title),
                    media = (s.Post.PostMedias ?? Enumerable.Empty<PostMedias>()).Select(m => new { url = m.MediaUrl, type = m.MediaType }),
                    likeCount = s.Post.LikeCount,
                    commentCount = s.Post.CommentCount,
                    savedAt = s.CreatedAt.ToString("o")
                })
                .ToListAsync();

            return Json(new { success = true, posts = savedList });
        }

        [HttpPost]
        [Authorize]
        [Route("Dashboard/Vote")]
        [Route("Polls/Vote")]
        public async Task<IActionResult> Vote(int postId, int optionId)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            var poll = await _context.PostPolls.Include(p => p.Options).FirstOrDefaultAsync(p => p.PostId == postId);
            if (poll == null) return NotFound();
            if (DateTime.UtcNow > poll.EndsAt)
            {
                return Json(new { success = false, message = "Bình chọn này đã kết thúc." });
            }

            var option = poll.Options.FirstOrDefault(o => o.Id == optionId);
            if (option == null) return NotFound();

            var existingVote = await _context.PollVotes
                .FirstOrDefaultAsync(v => v.UserId == userId && poll.Options.Select(o => o.Id).Contains(v.PollOptionId));

            if (existingVote != null)
            {
                _context.PollVotes.Remove(existingVote);
            }

            _context.PollVotes.Add(new PollVote
            {
                PollOptionId = optionId,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            var votes = await _context.PollVotes
                .Where(v => poll.Options.Select(o => o.Id).Contains(v.PollOptionId))
                .GroupBy(v => v.PollOptionId)
                .Select(g => new { optionId = g.Key, count = g.Count() })
                .ToDictionaryAsync(x => x.optionId, x => x.count);

            return Json(new { success = true, myOptionId = optionId, votes });
        }

        [HttpDelete]
        [Authorize]
        [Route("Dashboard/Vote/{postId}")]
        [Route("Dashboard/Vote")]
        public async Task<IActionResult> DeleteVote(int postId)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            var optionIds = await _context.PollOptions.Where(o => o.PostId == postId).Select(o => o.Id).ToListAsync();
            var existingVote = await _context.PollVotes
                .FirstOrDefaultAsync(v => v.UserId == userId && optionIds.Contains(v.PollOptionId));

            if (existingVote != null)
            {
                _context.PollVotes.Remove(existingVote);
                await _context.SaveChangesAsync();
            }

            return Json(new { success = true });
        }

        [HttpPost]
        [Authorize]
        [Route("Dashboard/Hide/{id?}")]
        [Route("Dashboard/Hide")]
        [Route("Posts/Hide/{id}")]
        public async Task<IActionResult> Hide(int? id, int? postId)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            int pId = id ?? postId ?? 0;
            if (pId <= 0) return Json(new { success = false, message = "ID bài viết không hợp lệ." });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            var existing = await _context.HiddenPosts.FirstOrDefaultAsync(h => h.UserId == userId && h.PostId == pId);
            if (existing == null)
            {
                _context.HiddenPosts.Add(new HiddenPost
                {
                    UserId = userId,
                    PostId = pId,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }

            return Json(new { success = true });
        }

        [HttpDelete]
        [Authorize]
        [Route("Dashboard/Hide/{postId}")]
        [Route("Dashboard/Hide")]
        public async Task<IActionResult> Unhide(int postId)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            var existing = await _context.HiddenPosts.FirstOrDefaultAsync(h => h.UserId == userId && h.PostId == postId);
            if (existing != null)
            {
                _context.HiddenPosts.Remove(existing);
                await _context.SaveChangesAsync();
            }

            return Json(new { success = true });
        }

        [HttpPost]
        [Authorize]
        [Route("Dashboard/Report/{id?}")]
        [Route("Dashboard/Report")]
        [Route("Posts/Report/{id}")]
        public async Task<IActionResult> Report(int? id, int? postId, string reason, string? detail)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            int pId = id ?? postId ?? 0;
            if (pId <= 0) return Json(new { success = false, message = "ID bài viết không hợp lệ." });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            _context.PostReports.Add(new PostReport
            {
                PostId = pId,
                ReporterId = userId,
                Reason = string.IsNullOrWhiteSpace(reason) ? "Khác" : reason.Trim(),
                Detail = detail?.Trim(),
                Status = "Pending",
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            return Json(new { success = true });
        }

        [HttpPost]
        [Authorize]
        [Route("Dashboard/Repost")]
        public async Task<IActionResult> Repost(int postId, string? content)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            var originalPost = await _context.Posts.FirstOrDefaultAsync(p => p.Id == postId);
            if (originalPost == null) return NotFound();

            var post = new Post
            {
                Content = content?.Trim() ?? string.Empty,
                UserId = userId,
                CreatedAt = DateTime.UtcNow,
                IsPublic = true
            };
            _context.Posts.Add(post);
            await _context.SaveChangesAsync();

            _context.PostExtras.Add(new PostExtra
            {
                PostId = post.Id,
                RepostOfId = postId
            });
            await _context.SaveChangesAsync();

            return Json(new { success = true, postId = post.Id });
        }

        [HttpGet]
        [Authorize]
        [Route("Dashboard/Tag")]
        public async Task<IActionResult> Tag(string name, int? before = null, int take = 10)
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            if (string.IsNullOrWhiteSpace(name))
                return Json(new { success = false, message = "Chủ đề không hợp lệ." });

            var tagLower = name.Trim().ToLower().TrimStart('#');
            take = Math.Clamp(take, 1, 50);

            var query = _context.PostHashTags
                .Include(pt => pt.Post).ThenInclude(p => p.User).ThenInclude(u => u.Profile)
                .Include(pt => pt.Post).ThenInclude(p => p.PostMedias)
                .Where(pt => pt.Tag == tagLower);

            if (before.HasValue && before.Value > 0)
            {
                query = query.Where(pt => pt.PostId < before.Value);
            }

            var posts = await query
                .OrderByDescending(pt => pt.Post.CreatedAt)
                .Take(take)
                .Select(pt => new
                {
                    id = pt.Post.Id,
                    username = pt.Post.User.Username,
                    avatar = pt.Post.User.Profile != null ? pt.Post.User.Profile.AvatarUrl : "/images/default-avatar.png",
                    content = pt.Post.Content,
                    title = pt.Post.Title,
                    time = FormatTimeAgo(pt.Post.CreatedAt),
                    isArticle = !string.IsNullOrEmpty(pt.Post.Title),
                    media = (pt.Post.PostMedias ?? Enumerable.Empty<PostMedias>()).Select(m => new { url = m.MediaUrl, type = m.MediaType }),
                    likeCount = pt.Post.LikeCount,
                    commentCount = pt.Post.CommentCount
                })
                .ToListAsync();

            return Json(new { success = true, tag = tagLower, posts });
        }

        [HttpDelete]
        [Authorize]
        public async Task<IActionResult> DeletePost(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Json(new { success = false });

            int userId = int.Parse(userIdClaim);

            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);

            if (post == null)
            {
                return Json(new { success = false, message = "Bài viết không tồn tại hoặc bạn không có quyền xóa." });
            }

            try
            {
                var likes = _context.Likes.Where(l => l.PostId == id);
                var comments = _context.Comments.Where(c => c.PostId == id);
                var medias = _context.PostMedias.Where(m => m.PostId == id);
                _context.Likes.RemoveRange(likes);
                _context.Comments.RemoveRange(comments);
                _context.PostMedias.RemoveRange(medias);

                if (_featureGate.Enabled)
                {
                    // Reply links point at comments with a Restrict FK: remove them first.
                    var commentIds = await _context.Comments.Where(c => c.PostId == id).Select(c => c.Id).ToListAsync();
                    _context.CommentReplies.RemoveRange(await _context.CommentReplies
                        .Where(r => commentIds.Contains(r.CommentId) || commentIds.Contains(r.ParentCommentId)).ToListAsync());
                    _context.CommentLikes.RemoveRange(await _context.CommentLikes.Where(l => commentIds.Contains(l.CommentId)).ToListAsync());

                    var extras = _context.PostExtras.Where(e => e.PostId == id);
                    var polls = _context.PostPolls.Where(p => p.PostId == id);
                    var tags = _context.PostHashTags.Where(t => t.PostId == id);
                    var reports = _context.PostReports.Where(r => r.PostId == id);
                    var mentions = _context.Mentions.Where(m => m.PostId == id);
                    var saved = _context.SavedPosts.Where(s => s.PostId == id);
                    var hidden = _context.HiddenPosts.Where(h => h.PostId == id);
                    _context.PostExtras.RemoveRange(extras);
                    _context.PostPolls.RemoveRange(polls);
                    _context.PostHashTags.RemoveRange(tags);
                    _context.PostReports.RemoveRange(reports);
                    _context.Mentions.RemoveRange(mentions);
                    _context.SavedPosts.RemoveRange(saved);
                    _context.HiddenPosts.RemoveRange(hidden);
                }

                _context.Posts.Remove(post);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return Json(new { success = false, message = "Không thể xóa bài viết (có thể do dữ liệu liên quan). Vui lòng thử lại." });
            }

            return Json(new { success = true });
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> EditPost(int id, string content, string? title)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Json(new { success = false });

            int userId = int.Parse(userIdClaim);

            if (string.IsNullOrWhiteSpace(content))
            {
                return Json(new { success = false, message = "Nội dung bài viết không được để trống." });
            }

            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);

            if (post == null)
            {
                return Json(new { success = false, message = "Bài viết không tồn tại hoặc bạn không có quyền sửa." });
            }

            post.Content = content.Trim();
            post.Title = string.IsNullOrWhiteSpace(title) ? null : title.Trim();
            post.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Json(new { success = true, content = post.Content, title = post.Title });
        }
    }
}
