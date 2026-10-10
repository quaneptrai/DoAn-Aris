using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Humanizer;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Facebook;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace ArisSkyve.Controllers
{
    public class AccountController : Controller
    {
        public ArisDBContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IWebHostEnvironment _env;
        private readonly IEmailService _emailService;
        private readonly IV7FeatureGate _featureGate;

        public AccountController(ArisDBContext context, IConfiguration config, IHttpClientFactory httpClientFactory, IWebHostEnvironment env, IEmailService emailService, IV7FeatureGate featureGate)
        {
            _context = context;
            _config = config;
            _httpClientFactory = httpClientFactory;
            _env = env;
            _emailService = emailService;
            _featureGate = featureGate;
        }
        // Shared by all three signup paths (magic-link, Google, Facebook) so a
        // duplicate desired username -- e.g. two different emails both starting
        // with "john", or two people named "Tuan Khanh" on Google -- doesn't
        // silently collide. Tries the plain name first, then name2, name3, ...
        private async Task<string> GenerateUniqueUsernameAsync(string baseName)
        {
            var sanitized = string.IsNullOrWhiteSpace(baseName) ? "user" : baseName.Trim();
            if (!await _context.Users.AnyAsync(u => u.Username == sanitized))
                return sanitized;

            for (int suffix = 2; suffix < 1000; suffix++)
            {
                var candidate = $"{sanitized}{suffix}";
                if (!await _context.Users.AnyAsync(u => u.Username == candidate))
                    return candidate;
            }

            return $"{sanitized}{Guid.NewGuid().ToString("N")[..6]}";
        }

        private const string IntentCookie = "aris_intent";
        public const string ExternalAuthenticationScheme = "Aris.External";
        private const string TermsAcceptedProperty = "aris:terms-accepted";
        private const string AuthReturnViewProperty = "aris:return-view";
        private const string AuthReturnUrlProperty = "aris:return-url";
        private const string AuthIntentProperty = "aris:intent";

        private static string? NormalizeIntent(string? intent) =>
            string.Equals(intent, "business", StringComparison.OrdinalIgnoreCase) ? "business"
            : string.Equals(intent, "candidate", StringComparison.OrdinalIgnoreCase) ? "candidate"
            : null;

        private bool IsLoopbackDevelopmentRequest()
        {
            if (!_env.IsDevelopment()) return false;
            var remoteIp = HttpContext.Connection.RemoteIpAddress;
            return remoteIp is not null && IPAddress.IsLoopback(remoteIp);
        }

        private bool HasExternalLoginConfiguration(string provider) =>
            !string.IsNullOrWhiteSpace(_config[$"Authentication:{provider}:ClientId"])
            && !string.IsNullOrWhiteSpace(_config[$"Authentication:{provider}:ClientSecret"]);

        private bool TryGetMagicLinkSecret(out string secret)
        {
            secret = _config["Auth:MagicLinkSecret"]?.Trim() ?? string.Empty;
            return secret.Length >= 32;
        }

        private void RememberIntent(string? intent)
        {
            intent = NormalizeIntent(intent);
            if (intent == null) return;
            Response.Cookies.Append(IntentCookie, intent, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                IsEssential = true,
                MaxAge = TimeSpan.FromMinutes(30)
            });
        }

        private static string NormalizeReturnView(string? returnView) =>
            string.Equals(returnView, "Register", StringComparison.Ordinal) ? "Register" : "Login";

        private IActionResult AuthFormError(string? returnView, string? returnUrl, string? intent, string error)
        {
            returnView = NormalizeReturnView(returnView);
            ViewBag.ReturnUrl = returnUrl;
            ViewBag.Intent = NormalizeIntent(intent) ?? "candidate";
            ViewBag.AcceptTerms = false;
            ViewBag.Error = error;
            return View(returnView);
        }

        private static bool HasAcceptedTerms(AuthenticationProperties? properties) =>
            properties?.Items.TryGetValue(TermsAcceptedProperty, out var value) == true && value == "true";

        private static string? GetAuthProperty(AuthenticationProperties? properties, string key) =>
            properties != null && properties.Items.TryGetValue(key, out var value) ? value : null;

        private async Task RecordPrivacyAcceptanceAsync(User user)
        {
            if (user.PrivacyAcceptedAt != null) return;
            user.PrivacyAcceptedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        public IActionResult Login(string? returnUrl = null)
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
                    return Redirect(returnUrl);
                return RedirectToAction("Index", "Dashboard");
            }
            ViewBag.ReturnUrl = returnUrl;
            return View();
        }

        public IActionResult Register(string? returnUrl = null, string? intent = null)
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
                    return Redirect(returnUrl);
                return RedirectToAction("Index", "Dashboard");
            }
            ViewBag.ReturnUrl = returnUrl;
            ViewBag.Intent = NormalizeIntent(intent) ?? "candidate";
            return View();
        }

        [HttpGet]
        public async Task<IActionResult> QuickLogin(string? email = null, string? returnUrl = null)
        {
            // Đăng nhập không cần xác minh email — chỉ để phát triển/kiểm thử, tắt hẳn ở môi trường khác
            if (!IsLoopbackDevelopmentRequest()) return NotFound();

            email = string.IsNullOrWhiteSpace(email) ? "ungvien@aris.vn" : email.Trim().ToLowerInvariant();
            var user = await EnsureUserAsync(email);
            await SignInUserAsync(user);

            if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
                return Redirect(returnUrl);

            return RedirectToAction("Index", "Dashboard");
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DirectLogin(string email, string? returnUrl = null, string returnView = "Login")
        {
            // Như QuickLogin: bỏ qua xác minh email nên chỉ tồn tại ở Development
            if (!IsLoopbackDevelopmentRequest()) return NotFound();

            returnView = returnView == "Register" ? "Register" : "Login";

            if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            {
                ViewBag.Error = "Vui lòng nhập email hợp lệ.";
                ViewBag.ReturnUrl = returnUrl;
                return View(returnView);
            }

            email = email.Trim().ToLowerInvariant();
            var user = await EnsureUserAsync(email);
            await SignInUserAsync(user);

            if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
                return Redirect(returnUrl);

            return RedirectToAction("Index", "Dashboard");
        }

        private async Task<User> EnsureUserAsync(string email)
        {
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Email == email);

            if (user == null)
            {
                var baseName = email.Split('@')[0];
                user = new User
                {
                    Email = email,
                    Username = await GenerateUniqueUsernameAsync(baseName),
                    ShowActiveStatus = true,
                    Profile = new EmployesAccount
                    {
                        FullName = baseName,
                        AvatarUrl = "/images/default-avatar.png",
                        Location = "Chưa cập nhật",
                        JobTitle = "Ứng viên tiềm năng"
                    }
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }
            else if (user.Profile == null)
            {
                user.Profile = new EmployesAccount
                {
                    FullName = user.Username,
                    AvatarUrl = "/images/default-avatar.png",
                    Location = "Chưa cập nhật",
                    JobTitle = "Ứng viên tiềm năng",
                    UserId = user.Id
                };
                _context.Profiles.Add(user.Profile);
                await _context.SaveChangesAsync();
            }

            return user;
        }
        [Authorize]
        [HttpGet]
        public async Task<IActionResult> NewUserInfor()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out var userId))
                return Challenge();

            var user = await _context.Users
                .Include(u => u.Profile)
                    .ThenInclude(p => p.Education)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound();

            ViewBag.UserId = user.Id;
            ViewBag.Username = user.Username;
            ViewBag.Intent = (user.Role == "Business" || user.Role == "Admin") ? "done-business"
                : (NormalizeIntent(Request.Query["intent"]) ?? NormalizeIntent(Request.Cookies[IntentCookie]) ?? "candidate");

            var dto = new NewUserInforDTO
            {
                UserId = user.Id,
                Location = user.Profile?.Location,
                JobTitle = user.Profile?.JobTitle,
                IsStudent = user.Profile?.isStudent ?? false,
                JobSearchingStatus = user.Profile?.IsLookingForJob == true ? "Looking" : "NotLooking",
                IsRemoteJob = user.Profile?.IsRemoteJob ?? false,
                ShareWithRecruiters = user.Profile?.ShareWithRecruiters ?? true,
                AcceptPrivacy = user.PrivacyAcceptedAt != null,
                AllowCvAi = user.CvAiConsentAt != null,
                Education = user.Profile?.Education != null ? new EducationDTO
                {
                    School = user.Profile.Education.School,
                    Degree = user.Profile.Education.Degree,
                    FieldOfStudy = user.Profile.Education.FieldOfStudy,
                    StartYear = user.Profile.Education.StartYear,
                    gpa = user.Profile.Education.GPA
                } : null
            };

            return View(dto);
        }

        [Authorize]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> NewUserInfor(NewUserInforDTO dto)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdStr, out var userId))
                return Challenge();

            var user = await _context.Users
                .Include(u => u.Profile)
                    .ThenInclude(p => p.Education)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound();

            if (!dto.AcceptPrivacy && user.PrivacyAcceptedAt == null)
            {
                ModelState.AddModelError(nameof(dto.AcceptPrivacy), "Bạn cần đồng ý với Chính sách quyền riêng tư để tiếp tục.");
            }

            if (!ModelState.IsValid)
            {
                ViewBag.UserId = user.Id;
                ViewBag.Username = user.Username;
                return View(dto);
            }

            user.PrivacyAcceptedAt ??= DateTime.UtcNow;
            if (dto.AllowCvAi) user.CvAiConsentAt ??= DateTime.UtcNow;

            if (user.Profile == null)
            {
                user.Profile = new EmployesAccount { UserId = user.Id };
                _context.Profiles.Add(user.Profile);
            }

            user.Profile.Location = dto.Location ?? string.Empty;
            user.Profile.JobTitle = dto.JobTitle;
            user.Profile.isStudent = dto.IsStudent;
            user.Profile.IsLookingForJob = dto.JobSearchingStatus == "Looking";

            var bioParts = new List<string>();
            if (!string.IsNullOrWhiteSpace(dto.DesiredJobTitle)) bioParts.Add($"Vị trí mong muốn: {dto.DesiredJobTitle}");
            if (!string.IsNullOrWhiteSpace(dto.DesiredCompany)) bioParts.Add($"Nơi làm việc mong muốn: {dto.DesiredCompany}");
            if (bioParts.Count > 0)
            {
                user.Profile.Bio = string.Join(" | ", bioParts);
            }

            user.Profile.ShareWithRecruiters = dto.ShareWithRecruiters;
            user.Profile.IsRemoteJob = dto.IsRemoteJob;

            if (dto.IsStudent && dto.Education != null && !string.IsNullOrWhiteSpace(dto.Education.School))
            {
                if (user.Profile.Education == null)
                {
                    user.Profile.Education = new Education { EmployesAccountId = user.Profile.Id };
                    _context.Add(user.Profile.Education);
                }

                user.Profile.Education.School = dto.Education.School ?? string.Empty;
                user.Profile.Education.Degree = dto.Education.Degree ?? string.Empty;
                user.Profile.Education.FieldOfStudy = dto.Education.FieldOfStudy ?? string.Empty;
                user.Profile.Education.StartYear = dto.Education.StartYear > 0 ? dto.Education.StartYear : DateTime.UtcNow.Year;
                user.Profile.Education.GPA = (float)(dto.Education.gpa ?? 0);
            }
            else if (user.Profile.Education != null && !dto.IsStudent)
            {
                _context.Remove(user.Profile.Education);
                user.Profile.Education = null;
            }

            await _context.SaveChangesAsync();
            await SignInUserAsync(user);
            // Đăng ký với ý định "nhà tuyển dụng" → đi tiếp sang bước tạo hồ sơ công ty.
            if (NormalizeIntent(Request.Cookies[IntentCookie]) == "business" && (user.Role != "Business" && user.Role != "Admin"))
            {
                Response.Cookies.Delete(IntentCookie);
                return RedirectToAction("BecomeEmployer");
            }
            return RedirectToAction("Index", "Dashboard");
        }

        // Trang 3 bước chuyển tài khoản cá nhân thành tài khoản nhà tuyển dụng (thay modal cũ).
        [Authorize]
        [HttpGet]
        public async Task<IActionResult> BecomeEmployer()
        {
            if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
                return Challenge();
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound();
            if (user.Role == "Business" || user.Role == "Admin" && user.Profile is BussinessAccount) return RedirectToAction("Index", "Employer");

            var profileId = user.Profile?.Id ?? 0;
            var model = new BecomeEmployerViewModel
            {
                FullName = user.Profile?.FullName ?? user.Username,
                Email = user.Email,
                AvatarUrl = user.Profile?.AvatarUrl,
                Location = user.Profile?.Location,
                ResumeCount = profileId == 0 ? 0 : await _context.Resumes.CountAsync(r => r.EmployeeId == profileId),
                OpenApplicationCount = profileId == 0 ? 0 : await _context.JobApplications.CountAsync(a => a.ApplicantId == profileId
                    && a.Status != JobApplicationStatus.Withdrawn && a.Status != JobApplicationStatus.Rejected && a.Status != JobApplicationStatus.Hired)
            };
            return View(model);
        }

        // ================= MAGIC-LINK LOGIN/REGISTER =================
        // Một form (email-only) dùng chung cho cả đăng nhập lẫn đăng ký: nếu email
        // đã tồn tại thì đây là đăng nhập, chưa tồn tại thì tạo user mới -> không cần
        // 2 luồng tách biệt, và không còn kiểu "Login chỉ check email, không check
        // password" như code cũ (lỗ hổng: đăng nhập được vào tài khoản bất kỳ chỉ
        // cần biết email). Token là HMAC tự ký (email + hạn dùng), không lưu DB nên
        // không cần thêm bảng/migration nào.
        [HttpPost]
        [ValidateAntiForgeryToken]
        [EnableRateLimiting(AuthRateLimits.MagicLinkRequest)]
        public async Task<IActionResult> RequestMagicLink(string email, string? returnUrl = null, string returnView = "Login", string? intent = null, bool acceptTerms = false)
        {
            returnView = NormalizeReturnView(returnView);
            intent = NormalizeIntent(intent);
            ViewBag.ReturnUrl = returnUrl;
            ViewBag.Intent = intent ?? "candidate";
            ViewBag.AcceptTerms = acceptTerms;

            if (!acceptTerms)
            {
                ViewBag.Error = "Vui lòng đồng ý với điều khoản và chính sách quyền riêng tư để tiếp tục.";
                return View(returnView);
            }

            if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            {
                ViewBag.Error = "Vui lòng nhập email hợp lệ.";
                return View(returnView);
            }

            email = email.Trim().ToLowerInvariant();
            ViewBag.SubmittedEmail = email;
            if (!TryGetMagicLinkSecret(out _))
            {
                ViewBag.Error = "Đăng nhập bằng liên kết xác nhận đang chưa được cấu hình. Vui lòng liên hệ quản trị viên.";
                return View(returnView);
            }

            // Mỗi địa chỉ nhận tối đa vài email đăng nhập (MagicLinkThrottle) để không ai dùng Aris spam hộp thư người khác.
            var throttle = HttpContext.RequestServices.GetRequiredService<MagicLinkThrottle>();
            if (!throttle.TryAcquire(email, out var retryAfter))
            {
                var minutes = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalMinutes));
                ViewBag.Error = minutes >= 60
                    ? $"Email này đã nhận nhiều liên kết đăng nhập hôm nay. Vui lòng kiểm tra hộp thư (kể cả spam) hoặc thử lại sau khoảng {(int)Math.Ceiling(minutes / 60.0)} giờ."
                    : $"Bạn vừa yêu cầu nhiều liên kết cho email này. Vui lòng kiểm tra hộp thư (kể cả spam) hoặc thử lại sau {minutes} phút.";
                return View(returnView);
            }

            var token = GenerateMagicToken(email, privacyAccepted: true);
            var confirmUrl = Url.Action("ConfirmMagicLink", "Account", new { token, returnUrl, intent }, Request.Scheme);

            bool sendSuccess = false;
            try
            {
                // Ưu tiên gửi trực tiếp qua Brevo SMTP (kèm fallback REST API)
                sendSuccess = await _emailService.SendVerificationEmailAsync(email, confirmUrl ?? string.Empty);

                // Dự phòng nếu chưa gửi được và có AiCore URL
                if (!sendSuccess)
                {
                    var aiCoreBaseUrl = _config["AiCore:BaseUrl"];
                    if (!string.IsNullOrWhiteSpace(aiCoreBaseUrl))
                    {
                        var client = _httpClientFactory.CreateClient();
                        var response = await client.PostAsJsonAsync($"{aiCoreBaseUrl}/send-verification-email", new { email, confirm_url = confirmUrl });
                        if (response.IsSuccessStatusCode)
                        {
                            sendSuccess = true;
                        }
                    }
                }
            }
            catch (Exception)
            {
                // In local dev, mail provider may not be reachable
            }

            // Liên kết xác nhận chỉ được hiện ra trên trang ở môi trường Development.
            // (Trước đây hiện cả khi gửi mail lỗi ở production → ai cũng vào được tài khoản bất kỳ.)
            if (_env.IsDevelopment())
            {
                ViewBag.DevConfirmUrl = confirmUrl;
            }

            if (!sendSuccess && !_env.IsDevelopment())
            {
                ViewBag.Error = "Không gửi được email xác nhận lúc này. Vui lòng thử lại sau hoặc chọn đăng nhập trực tiếp.";
                return View(returnView);
            }

            ViewBag.Message = $"Đã gửi liên kết xác nhận tới {email}. Vui lòng kiểm tra hộp thư (kể cả mục spam).";
            ViewBag.MailSent = sendSuccess;
            return View(returnView);
        }

        [EnableRateLimiting(AuthRateLimits.MagicLinkConfirm)]
        public async Task<IActionResult> ConfirmMagicLink(string token, string? returnUrl = null, string? intent = null)
        {
            var tokenData = ValidateMagicToken(token ?? "");
            if (tokenData == null)
            {
                ViewBag.Error = "Liên kết đăng nhập không hợp lệ hoặc đã hết hạn (hiệu lực 30 phút). Nhập email để nhận liên kết mới.";
                ViewBag.ReturnUrl = returnUrl;
                return View("Login");
            }

            var isNew = !await _context.Users.AnyAsync(u => u.Email == tokenData.Email);
            var user = await EnsureUserAsync(tokenData.Email);
            if (tokenData.PrivacyAccepted)
                await RecordPrivacyAcceptanceAsync(user);
            await SignInUserAsync(user);

            if (isNew)
            {
                RememberIntent(intent);
                return RedirectToAction("NewUserInfor", new { intent = NormalizeIntent(intent) });
            }

            if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
                return Redirect(returnUrl);

            return RedirectToAction("Index", "Dashboard");
        }

        private string GenerateMagicToken(string email, bool privacyAccepted)
        {
            if (!TryGetMagicLinkSecret(out var secret))
                throw new InvalidOperationException("Auth:MagicLinkSecret must be configured before issuing magic links.");

            var expiresAtUnix = DateTimeOffset.UtcNow.AddMinutes(30).ToUnixTimeSeconds();
            var payloadBytes = Encoding.UTF8.GetBytes($"{email}|{expiresAtUnix}|{(privacyAccepted ? "1" : "0")}");

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var signature = hmac.ComputeHash(payloadBytes);

            return $"{WebEncoders.Base64UrlEncode(payloadBytes)}.{WebEncoders.Base64UrlEncode(signature)}";
        }

        private sealed record MagicTokenData(string Email, bool PrivacyAccepted);

        private MagicTokenData? ValidateMagicToken(string token)
        {
            var parts = token.Split('.');
            if (parts.Length != 2) return null;

            byte[] payloadBytes, signature;
            try
            {
                payloadBytes = WebEncoders.Base64UrlDecode(parts[0]);
                signature = WebEncoders.Base64UrlDecode(parts[1]);
            }
            catch (FormatException)
            {
                return null;
            }

            if (!TryGetMagicLinkSecret(out var secret)) return null;

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var expectedSignature = hmac.ComputeHash(payloadBytes);

            if (!CryptographicOperations.FixedTimeEquals(signature, expectedSignature)) return null;

            var payloadParts = Encoding.UTF8.GetString(payloadBytes).Split('|');
            if (payloadParts.Length != 3 || payloadParts[2] != "1") return null;
            if (!long.TryParse(payloadParts[1], out var expiresAtUnix)) return null;
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expiresAtUnix) return null;

            return new MagicTokenData(payloadParts[0], true);
        }

        private async Task SignInUserAsync(User user)
        {
            if (user.IsSuspended) { TempData["LoginError"] = "Tài khoản đang bị tạm khóa. Liên hệ quản trị viên."; return; }
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Name, user.Username)
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);

            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                principal,
                new AuthenticationProperties
                {
                    IsPersistent = true,
                    ExpiresUtc = DateTime.UtcNow.AddDays(7)
                });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(
                CookieAuthenticationDefaults.AuthenticationScheme);

            return RedirectToAction("Login", "Account");
        }

        [HttpPost]
        [Authorize]
        [Route("Account/SignOutEverywhere")]
        public async Task<IActionResult> SignOutEverywhere()
        {
            if (!_featureGate.Enabled)
            {
                return Json(new { success = false, message = "Tính năng chưa được bật." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return Unauthorized();
            int userId = int.Parse(userIdClaim);

            var session = await _context.UserSessionVersions.FirstOrDefaultAsync(s => s.UserId == userId);
            if (session == null)
            {
                session = new UserSessionVersion
                {
                    UserId = userId,
                    Version = Guid.NewGuid().ToString("N"),
                    UpdatedAt = DateTime.UtcNow
                };
                _context.UserSessionVersions.Add(session);
            }
            else
            {
                session.Version = Guid.NewGuid().ToString("N");
                session.UpdatedAt = DateTime.UtcNow;
            }
            await _context.SaveChangesAsync();

            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

            return Json(new { success = true, message = "Đã đăng xuất khỏi tất cả thiết bị." });
        }
        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult GoogleLogin(bool acceptTerms, string? intent = null, string? returnView = null, string? returnUrl = null)
        {
            if (!acceptTerms)
                return AuthFormError(returnView, returnUrl, intent, "Vui lòng đồng ý với điều khoản và chính sách quyền riêng tư để tiếp tục.");
            if (!HasExternalLoginConfiguration("Google")) return NotFound();

            RememberIntent(intent);
            var redirectUrl = Url.Action("GoogleResponse", "Account");

            var properties = new AuthenticationProperties
            {
                RedirectUri = redirectUrl
            };
            properties.Items[TermsAcceptedProperty] = "true";
            properties.Items[AuthReturnViewProperty] = NormalizeReturnView(returnView);
            properties.Items[AuthReturnUrlProperty] = returnUrl ?? string.Empty;
            properties.Items[AuthIntentProperty] = NormalizeIntent(intent) ?? string.Empty;

            return Challenge(properties, GoogleDefaults.AuthenticationScheme);
        }
        public async Task<IActionResult> GoogleResponse()
        {
            if (!HasExternalLoginConfiguration("Google")) return NotFound();

            var result = await HttpContext.AuthenticateAsync(ExternalAuthenticationScheme);
            var properties = result.Properties;
            await HttpContext.SignOutAsync(ExternalAuthenticationScheme);
            var returnView = GetAuthProperty(properties, AuthReturnViewProperty);
            var returnUrl = GetAuthProperty(properties, AuthReturnUrlProperty);
            var intent = GetAuthProperty(properties, AuthIntentProperty);
            if (!HasAcceptedTerms(properties))
                return AuthFormError(returnView, returnUrl, intent, "Phiên đăng nhập chưa ghi nhận việc đồng ý với điều khoản và chính sách quyền riêng tư. Vui lòng thử lại.");

            if (!result.Succeeded || result.Principal == null)
            {
                return AuthFormError(returnView, returnUrl, intent, "Đăng nhập Google không thành công hoặc đã bị hủy.");
            }

            var email = result.Principal.FindFirst(ClaimTypes.Email)?.Value;
            var name = result.Principal.FindFirst(ClaimTypes.Name)?.Value ?? email?.Split('@')[0] ?? "user";

            if (string.IsNullOrWhiteSpace(email))
            {
                return AuthFormError(returnView, returnUrl, intent, "Không tìm thấy địa chỉ email từ tài khoản Google của bạn.");
            }

            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Email == email);

            if (user == null)
            {
                user = new User
                {
                    Email = email,
                    Username = await GenerateUniqueUsernameAsync(name),
                    ShowActiveStatus = true,
                    PrivacyAcceptedAt = DateTime.UtcNow,
                    Profile = new EmployesAccount
                    {
                        FullName = name,
                        AvatarUrl = "/images/default-avatar.png"
                    }
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                await SignInUserAsync(user);
                return RedirectToAction("NewUserInfor");
            }

            if (user.Profile == null)
            {
                await RecordPrivacyAcceptanceAsync(user);
                await SignInUserAsync(user);
                return RedirectToAction("NewUserInfor");
            }

            await RecordPrivacyAcceptanceAsync(user);
            await SignInUserAsync(user);
            return RedirectToAction("Index", "Dashboard");
        }
        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult FacebookLogin(bool acceptTerms, string? intent = null, string? returnView = null, string? returnUrl = null)
        {
            if (!acceptTerms)
                return AuthFormError(returnView, returnUrl, intent, "Vui lòng đồng ý với điều khoản và chính sách quyền riêng tư để tiếp tục.");
            if (!HasExternalLoginConfiguration("Facebook")) return NotFound();

            RememberIntent(intent);
            var redirectUrl = Url.Action("FacebookResponse", "Account");

            var properties = new AuthenticationProperties
            {
                RedirectUri = redirectUrl
            };
            properties.Items[TermsAcceptedProperty] = "true";
            properties.Items[AuthReturnViewProperty] = NormalizeReturnView(returnView);
            properties.Items[AuthReturnUrlProperty] = returnUrl ?? string.Empty;
            properties.Items[AuthIntentProperty] = NormalizeIntent(intent) ?? string.Empty;

            return Challenge(properties, FacebookDefaults.AuthenticationScheme);
        }
        public async Task<IActionResult> FacebookResponse()
        {
            if (!HasExternalLoginConfiguration("Facebook")) return NotFound();

            var result = await HttpContext.AuthenticateAsync(ExternalAuthenticationScheme);
            var properties = result.Properties;
            await HttpContext.SignOutAsync(ExternalAuthenticationScheme);
            var returnView = GetAuthProperty(properties, AuthReturnViewProperty);
            var returnUrl = GetAuthProperty(properties, AuthReturnUrlProperty);
            var intent = GetAuthProperty(properties, AuthIntentProperty);
            if (!HasAcceptedTerms(properties))
                return AuthFormError(returnView, returnUrl, intent, "Phiên đăng nhập chưa ghi nhận việc đồng ý với điều khoản và chính sách quyền riêng tư. Vui lòng thử lại.");

            if (!result.Succeeded || result.Principal == null)
            {
                return AuthFormError(returnView, returnUrl, intent, "Đăng nhập Facebook không thành công hoặc đã bị hủy.");
            }

            var email = result.Principal.FindFirst(ClaimTypes.Email)?.Value;
            var name = result.Principal.FindFirst(ClaimTypes.Name)?.Value ?? email?.Split('@')[0] ?? "user";

            if (string.IsNullOrWhiteSpace(email))
            {
                return AuthFormError(returnView, returnUrl, intent, "Không tìm thấy địa chỉ email từ tài khoản Facebook của bạn.");
            }

            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Email == email);

            if (user == null)
            {
                user = new User
                {
                    Email = email,
                    Username = await GenerateUniqueUsernameAsync(name),
                    ShowActiveStatus = true,
                    PrivacyAcceptedAt = DateTime.UtcNow,
                    Profile = new EmployesAccount
                    {
                        FullName = name,
                        AvatarUrl = "/images/default-avatar.png"
                    }
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                await SignInUserAsync(user);
                return RedirectToAction("NewUserInfor");
            }
            if (user.Profile == null)
            {
                await RecordPrivacyAcceptanceAsync(user);
                await SignInUserAsync(user);
                return RedirectToAction("NewUserInfor");
            }

            await RecordPrivacyAcceptanceAsync(user);
            await SignInUserAsync(user);
            return RedirectToAction("Index", "Dashboard");
        }
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpgradeToBusiness(BussinessAccount model)
        {
            // 1. Lấy ID của User (Lưu ý: Id trong DB của bạn là int)
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Json(new { success = false, message = "Phiên đăng nhập không hợp lệ." });
            }

            if (string.IsNullOrWhiteSpace(model?.CompanyName))
            {
                return Json(new { success = false, message = "Vui lòng nhập tên doanh nghiệp." });
            }
            if (string.IsNullOrWhiteSpace(model.Industry))
            {
                return Json(new { success = false, message = "Vui lòng chọn lĩnh vực kinh doanh." });
            }
            if (model.FoundedYear.HasValue && (model.FoundedYear < 1900 || model.FoundedYear > DateTime.UtcNow.Year))
            {
                return Json(new { success = false, message = "Năm thành lập không hợp lệ." });
            }
            if (!string.IsNullOrWhiteSpace(model.TaxCode) && !System.Text.RegularExpressions.Regex.IsMatch(model.TaxCode.Trim(), @"^\d{10}(-\d{3})?$"))
            {
                return Json(new { success = false, message = "Mã số thuế gồm 10 chữ số (chi nhánh: 10 số + \"-\" + 3 số)." });
            }
            if (!string.IsNullOrWhiteSpace(model.WebsiteUrl) && !model.WebsiteUrl.Trim().StartsWith("http", StringComparison.OrdinalIgnoreCase))
            {
                model.WebsiteUrl = "https://" + model.WebsiteUrl.Trim();
            }

            // 2. Load User kèm theo Profile hiện tại
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return Json(new { success = false, message = "Không tìm thấy người dùng." });
            if (user.Role == "Business" || user.Role == "Admin" && user.Profile is BussinessAccount) return Json(new { success = true, redirectUrl = Url.Action("Index", "Employer") });

            try
            {
                // 3. Cập nhật Role cho User
                if (user.Role != "Admin") user.Role = "Business";

                // 4. EmployesAccount/BussinessAccount dùng chung 1 bảng (TPH, phân biệt bằng cột
                // Discriminator), nên EF không cho đổi "type" của 1 row đang track trực tiếp.
                // Cách đúng để chuyển đổi mà KHÔNG mất dữ liệu liên quan (Resume/Education/
                // ContactMethod đều trỏ FK tới Profile.Id): giữ lại đúng Id cũ, detach bản ghi cũ
                // rồi attach 1 instance BussinessAccount mới với cùng Id, đánh dấu Modified —
                // EF sẽ tự ghi lại Discriminator + toàn bộ cột khi SaveChanges. Nếu xoá rồi tạo
                // Id mới như code cũ thì mọi Resume/Education/ContactMethod của user sẽ mồ côi.
                var oldProfile = user.Profile;

                var newBusinessProfile = new BussinessAccount
                {
                    // Giữ lại toàn bộ thông tin cá nhân cũ, không riêng vài trường
                    FullName = oldProfile?.FullName ?? user.Username,
                    Location = oldProfile?.Location ?? "Chưa cập nhật",
                    AvatarUrl = oldProfile?.AvatarUrl,
                    JobTitle = oldProfile?.JobTitle,
                    Bio = oldProfile?.Bio,
                    CoverPhotoUrl = oldProfile?.CoverPhotoUrl,
                    IsLookingForJob = oldProfile?.IsLookingForJob ?? true,
                    ShareWithRecruiters = oldProfile?.ShareWithRecruiters ?? false,
                    isStudent = oldProfile?.isStudent ?? false,
                    IsRemoteJob = oldProfile?.IsRemoteJob ?? false,
                    ResumeUrl = oldProfile?.ResumeUrl,
                    UserId = user.Id,

                    // Cập nhật thông tin doanh nghiệp mới từ Form
                    CompanyName = model.CompanyName.Trim(),
                    Industry = model.Industry.Trim(),
                    TaxCode = model.TaxCode,
                    FoundedYear = model.FoundedYear,
                    CompanySize = model.CompanySize,
                    WebsiteUrl = model.WebsiteUrl,
                    CompanyAddress = model.CompanyAddress,
                    Description = model.Description,
                    IsVerified = false
                };

                if (oldProfile != null)
                {
                    newBusinessProfile.Id = oldProfile.Id;
                    _context.Entry(oldProfile).State = EntityState.Detached;
                    _context.Profiles.Attach(newBusinessProfile);
                    _context.Entry(newBusinessProfile).State = EntityState.Modified;
                }
                else
                {
                    _context.Profiles.Add(newBusinessProfile);
                }

                user.Profile = newBusinessProfile;

                await _context.SaveChangesAsync();
                return Json(new { success = true, profileId = newBusinessProfile.Id, redirectUrl = Url.Action("Index", "Employer", new { welcome = 1 }) });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "Lỗi hệ thống: " + ex.Message });
            }

        }
    }
}
