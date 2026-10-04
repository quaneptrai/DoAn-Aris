using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace ArisSkyve.Controllers
{
    // Employer-only: connecting/disconnecting the social destinations a job posting can be
    // auto-shared to (Facebook Page via Facebook Login for Business, Zalo OA via Zalo's OA
    // OAuth, Zalo Group via the shared Aris bot on the Zalo Bot Platform). The actual
    // publishing of a job happens in JobsController.ShareJob, which hands the stored
    // token/chat id for each selected row here to the n8n workflow.
    [Authorize]
    public class SocialConnectController : Controller
    {
        private readonly ArisDBContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpClientFactory;

        public SocialConnectController(ArisDBContext context, IConfiguration config, IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _config = config;
            _httpClientFactory = httpClientFactory;
        }

        private async Task<BussinessAccount?> CurrentBusinessAsync()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim)) return null;
            int userId = int.Parse(userIdClaim);

            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            return user?.Profile as BussinessAccount;
        }

        // ---------------------------------------------------------------
        // Channel listing / disconnect — used by both Jobs/Index (sidebar) and the Share modal
        // ---------------------------------------------------------------

        [HttpGet]
        public async Task<IActionResult> Channels()
        {
            var business = await CurrentBusinessAsync();
            if (business == null) return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có kênh mạng xã hội." });

            var channels = await _context.SocialChannelConnections
                .Where(c => c.BusinessAccountId == business.Id && c.IsActive)
                .OrderBy(c => c.Platform)
                .Select(c => new
                {
                    id = c.Id,
                    platform = c.Platform.ToString(),
                    displayName = c.DisplayName,
                    connectedAt = c.ConnectedAt,
                    autoShareEnabled = c.AutoShareEnabled
                })
                .ToListAsync();

            return Json(new { success = true, channels });
        }

        // Employer-only: flips whether newly created job postings get auto-shared to this
        // channel (Jobs/Index sidebar toggle). The manual "Chia sẻ" flow on JobsController
        // is unaffected either way — this only controls the auto-post-on-create behavior.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ToggleAutoShare(int id, bool enabled)
        {
            var business = await CurrentBusinessAsync();
            if (business == null) return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể thao tác." });

            var channel = await _context.SocialChannelConnections.FirstOrDefaultAsync(c => c.Id == id && c.BusinessAccountId == business.Id);
            if (channel == null) return Json(new { success = false, message = "Không tìm thấy kênh." });

            channel.AutoShareEnabled = enabled;
            await _context.SaveChangesAsync();
            return Json(new { success = true, autoShareEnabled = channel.AutoShareEnabled });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Disconnect(int id)
        {
            var business = await CurrentBusinessAsync();
            if (business == null) return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể thao tác." });

            var channel = await _context.SocialChannelConnections.FirstOrDefaultAsync(c => c.Id == id && c.BusinessAccountId == business.Id);
            if (channel == null) return Json(new { success = false, message = "Không tìm thấy kênh." });

            _context.SocialChannelConnections.Remove(channel);
            await _context.SaveChangesAsync();
            return Json(new { success = true });
        }

        // ---------------------------------------------------------------
        // Facebook Page (Facebook Login for Business)
        // ---------------------------------------------------------------

        [HttpGet]
        public IActionResult ConnectFacebook()
        {
            var appId = _config["Social:Facebook:AppId"];
            if (string.IsNullOrWhiteSpace(appId))
                return Content("Thiếu cấu hình Social:Facebook:AppId trong appsettings.");

            var state = Guid.NewGuid().ToString("N");
            HttpContext.Response.Cookies.Append("fb_oauth_state", state, new CookieOptions { HttpOnly = true, MaxAge = TimeSpan.FromMinutes(10) });

            var redirectUri = Url.Action("FacebookCallback", "SocialConnect", null, Request.Scheme);
            var authUrl = $"https://www.facebook.com/v20.0/dialog/oauth?client_id={Uri.EscapeDataString(appId)}" +
                          $"&redirect_uri={Uri.EscapeDataString(redirectUri!)}&state={state}";

            // Meta retired plain scope= requests for Page permissions on apps without a
            // "Facebook Login for Business" login configuration (raises "Invalid Scopes").
            // When a config_id is set, it already encodes the requested permissions/assets
            // and must be used instead of scope=; only fall back to the legacy scope list
            // for older apps that still accept it.
            var configId = _config["Social:Facebook:LoginConfigId"];
            authUrl += string.IsNullOrWhiteSpace(configId)
                ? $"&scope={Uri.EscapeDataString("pages_show_list,pages_manage_posts,pages_read_engagement")}"
                : $"&config_id={Uri.EscapeDataString(configId)}";

            return Redirect(authUrl);
        }

        [HttpGet]
        public async Task<IActionResult> FacebookCallback(string? code, string? state, string? error)
        {
            var business = await CurrentBusinessAsync();
            if (business == null) return RedirectToAction("Index", "Settings");

            var expectedState = Request.Cookies["fb_oauth_state"];
            if (!string.IsNullOrEmpty(error) || string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state) || state != expectedState)
                return RedirectToAction("Index", "Settings", new { socialError = "facebook_denied" });

            var appId = _config["Social:Facebook:AppId"];
            var appSecret = _config["Social:Facebook:AppSecret"];
            var redirectUri = Url.Action("FacebookCallback", "SocialConnect", null, Request.Scheme);
            var client = _httpClientFactory.CreateClient();

            // 1) code -> short-lived user token
            var tokenResp = await client.GetAsync(
                $"https://graph.facebook.com/v20.0/oauth/access_token?client_id={Uri.EscapeDataString(appId!)}" +
                $"&redirect_uri={Uri.EscapeDataString(redirectUri!)}&client_secret={Uri.EscapeDataString(appSecret!)}&code={Uri.EscapeDataString(code)}");
            if (!tokenResp.IsSuccessStatusCode)
                return RedirectToAction("Index", "Settings", new { socialError = "facebook_token_exchange_failed" });

            using var tokenDoc = JsonDocument.Parse(await tokenResp.Content.ReadAsStringAsync());
            var shortLivedToken = tokenDoc.RootElement.GetProperty("access_token").GetString();

            // 2) short-lived -> long-lived user token (so the Page tokens we get next don't expire)
            var exchangeResp = await client.GetAsync(
                $"https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token" +
                $"&client_id={Uri.EscapeDataString(appId!)}&client_secret={Uri.EscapeDataString(appSecret!)}" +
                $"&fb_exchange_token={Uri.EscapeDataString(shortLivedToken!)}");
            if (!exchangeResp.IsSuccessStatusCode)
                return RedirectToAction("Index", "Settings", new { socialError = "facebook_token_exchange_failed" });

            using var exchangeDoc = JsonDocument.Parse(await exchangeResp.Content.ReadAsStringAsync());
            var longLivedUserToken = exchangeDoc.RootElement.GetProperty("access_token").GetString();

            // 3) list Pages the user manages, with their (effectively non-expiring) Page tokens
            var pagesResp = await client.GetAsync(
                $"https://graph.facebook.com/v20.0/me/accounts?access_token={Uri.EscapeDataString(longLivedUserToken!)}");
            if (!pagesResp.IsSuccessStatusCode)
                return RedirectToAction("Index", "Settings", new { socialError = "facebook_pages_fetch_failed" });

            var pagesJson = await pagesResp.Content.ReadAsStringAsync();
            using var pagesDoc = JsonDocument.Parse(pagesJson);
            var pages = new List<Dictionary<string, string>>();
            if (pagesDoc.RootElement.TryGetProperty("data", out var dataArr))
            {
                foreach (var p in dataArr.EnumerateArray())
                {
                    pages.Add(new Dictionary<string, string>
                    {
                        ["id"] = p.GetProperty("id").GetString() ?? "",
                        ["name"] = p.GetProperty("name").GetString() ?? "",
                        ["access_token"] = p.GetProperty("access_token").GetString() ?? ""
                    });
                }
            }

            if (pages.Count == 0)
                return RedirectToAction("Index", "Settings", new { socialError = "facebook_no_pages" });

            // Stash the candidate pages in TempData (cookie-backed) so the confirm step
            // doesn't need a server-side session store; the raw tokens never reach the browser.
            TempData["fb_pages"] = JsonSerializer.Serialize(pages);
            return View("SelectFacebookPage", pages.Select(p => (p["id"], p["name"])).ToList());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ConfirmFacebookPage(string pageId)
        {
            var business = await CurrentBusinessAsync();
            if (business == null) return RedirectToAction("Index", "Settings");

            var pagesJson = TempData["fb_pages"] as string;
            if (string.IsNullOrEmpty(pagesJson))
                return RedirectToAction("Index", "Settings", new { socialError = "facebook_session_expired" });

            var pages = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(pagesJson) ?? new();
            var selected = pages.FirstOrDefault(p => p["id"] == pageId);
            if (selected == null)
                return RedirectToAction("Index", "Settings", new { socialError = "facebook_invalid_page" });

            var existing = await _context.SocialChannelConnections.FirstOrDefaultAsync(c =>
                c.BusinessAccountId == business.Id && c.Platform == SocialPlatform.FacebookPage && c.ExternalId == selected["id"]);

            if (existing != null)
            {
                existing.DisplayName = selected["name"];
                existing.AccessToken = selected["access_token"];
                existing.IsActive = true;
            }
            else
            {
                _context.SocialChannelConnections.Add(new SocialChannelConnection
                {
                    BusinessAccountId = business.Id,
                    Platform = SocialPlatform.FacebookPage,
                    ExternalId = selected["id"],
                    DisplayName = selected["name"],
                    AccessToken = selected["access_token"]
                });
            }

            await _context.SaveChangesAsync();
            return RedirectToAction("Index", "Settings", new { socialConnected = "facebook" });
        }

        // Fallback for when the app's own OAuth flow can't grant Page permissions (e.g. Meta
        // now gates pages_manage_posts/pages_read_engagement behind "Facebook Login for
        // Business", which itself requires a Business Portfolio + verification the employer
        // may not have/want). The employer instead mints a long-lived Page access token
        // themselves via Meta's own Graph API Explorer (developers.facebook.com/tools/explorer,
        // app dropdown set to "Graph API Explorer" — Meta's first-party app, not ours — so none
        // of our app's product/permission gating applies) and pastes the Page id + token here.
        // We only verify the token actually resolves to that Page before storing it.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ConnectFacebookManual(string pageId, string pageAccessToken)
        {
            var business = await CurrentBusinessAsync();
            if (business == null) return Json(new { success = false, message = "Chỉ tài khoản doanh nghiệp mới có thể kết nối." });

            if (string.IsNullOrWhiteSpace(pageId) || string.IsNullOrWhiteSpace(pageAccessToken))
                return Json(new { success = false, message = "Vui lòng nhập đầy đủ Page ID và Access Token." });

            var client = _httpClientFactory.CreateClient();
            HttpResponseMessage verifyResp;
            try
            {
                verifyResp = await client.GetAsync(
                    $"https://graph.facebook.com/v20.0/{Uri.EscapeDataString(pageId)}?fields=name&access_token={Uri.EscapeDataString(pageAccessToken)}");
            }
            catch (HttpRequestException)
            {
                return Json(new { success = false, message = "Không thể kết nối tới Facebook." });
            }

            if (!verifyResp.IsSuccessStatusCode)
                return Json(new { success = false, message = "Page ID hoặc Access Token không hợp lệ (hoặc đã hết hạn)." });

            using var doc = JsonDocument.Parse(await verifyResp.Content.ReadAsStringAsync());
            var pageName = doc.RootElement.TryGetProperty("name", out var n) ? (n.GetString() ?? pageId) : pageId;

            var existing = await _context.SocialChannelConnections.FirstOrDefaultAsync(c =>
                c.BusinessAccountId == business.Id && c.Platform == SocialPlatform.FacebookPage && c.ExternalId == pageId);

            if (existing != null)
            {
                existing.DisplayName = pageName;
                existing.AccessToken = pageAccessToken;
                existing.IsActive = true;
            }
            else
            {
                _context.SocialChannelConnections.Add(new SocialChannelConnection
                {
                    BusinessAccountId = business.Id,
                    Platform = SocialPlatform.FacebookPage,
                    ExternalId = pageId,
                    DisplayName = pageName,
                    AccessToken = pageAccessToken
                });
            }

            await _context.SaveChangesAsync();
            return Json(new { success = true, displayName = pageName });
        }

        // ---------------------------------------------------------------
        // Zalo Official Account
        // ---------------------------------------------------------------

        [HttpGet]
        public IActionResult ConnectZaloOa()
        {
            var appId = _config["Social:ZaloOa:AppId"];
            if (string.IsNullOrWhiteSpace(appId))
                return Content("Thiếu cấu hình Social:ZaloOa:AppId trong appsettings.");

            var state = Guid.NewGuid().ToString("N");
            HttpContext.Response.Cookies.Append("zalo_oauth_state", state, new CookieOptions { HttpOnly = true, MaxAge = TimeSpan.FromMinutes(10) });

            var redirectUri = Url.Action("ZaloOaCallback", "SocialConnect", null, Request.Scheme);
            var authUrl = $"https://oauth.zaloapp.com/v4/oa/permission?app_id={Uri.EscapeDataString(appId)}" +
                          $"&redirect_uri={Uri.EscapeDataString(redirectUri!)}&state={state}";

            return Redirect(authUrl);
        }

        [HttpGet]
        public async Task<IActionResult> ZaloOaCallback(string? code, string? state, string? oa_id)
        {
            var business = await CurrentBusinessAsync();
            if (business == null) return RedirectToAction("Index", "Settings");

            var expectedState = Request.Cookies["zalo_oauth_state"];
            if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state) || state != expectedState)
                return RedirectToAction("Index", "Settings", new { socialError = "zalo_oa_denied" });

            var appId = _config["Social:ZaloOa:AppId"];
            var appSecret = _config["Social:ZaloOa:AppSecret"];
            var client = _httpClientFactory.CreateClient();

            var request = new HttpRequestMessage(HttpMethod.Post, "https://oauth.zaloapp.com/v4/oa/access_token")
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["code"] = code,
                    ["app_id"] = appId!,
                    ["grant_type"] = "authorization_code"
                })
            };
            request.Headers.Add("secret_key", appSecret);

            var tokenResp = await client.SendAsync(request);
            if (!tokenResp.IsSuccessStatusCode)
                return RedirectToAction("Index", "Settings", new { socialError = "zalo_oa_token_exchange_failed" });

            using var tokenDoc = JsonDocument.Parse(await tokenResp.Content.ReadAsStringAsync());
            var root = tokenDoc.RootElement;
            var accessToken = root.GetProperty("access_token").GetString();
            var refreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
            var expiresInSeconds = root.TryGetProperty("expires_in", out var exp) && exp.ValueKind == JsonValueKind.String
                ? int.Parse(exp.GetString()!)
                : (root.TryGetProperty("expires_in", out var exp2) ? exp2.GetInt32() : 3600);

            // Fetch the OA's display name so Settings/the Share modal show something
            // recognizable instead of a raw numeric id.
            string oaName = oa_id ?? "Zalo OA";
            var oaInfoReq = new HttpRequestMessage(HttpMethod.Get, "https://openapi.zalo.me/v2.0/oa/getoa");
            oaInfoReq.Headers.Add("access_token", accessToken);
            var oaInfoResp = await client.SendAsync(oaInfoReq);
            string oaExternalId = oa_id ?? "";
            if (oaInfoResp.IsSuccessStatusCode)
            {
                using var oaDoc = JsonDocument.Parse(await oaInfoResp.Content.ReadAsStringAsync());
                if (oaDoc.RootElement.TryGetProperty("data", out var oaData))
                {
                    if (oaData.TryGetProperty("name", out var n)) oaName = n.GetString() ?? oaName;
                    if (oaData.TryGetProperty("oa_id", out var oid)) oaExternalId = oid.GetString() ?? oaExternalId;
                }
            }

            var existing = await _context.SocialChannelConnections.FirstOrDefaultAsync(c =>
                c.BusinessAccountId == business.Id && c.Platform == SocialPlatform.ZaloOa && c.ExternalId == oaExternalId);

            if (existing != null)
            {
                existing.DisplayName = oaName;
                existing.AccessToken = accessToken;
                existing.RefreshToken = refreshToken;
                existing.TokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresInSeconds);
                existing.IsActive = true;
            }
            else
            {
                _context.SocialChannelConnections.Add(new SocialChannelConnection
                {
                    BusinessAccountId = business.Id,
                    Platform = SocialPlatform.ZaloOa,
                    ExternalId = oaExternalId,
                    DisplayName = oaName,
                    AccessToken = accessToken,
                    RefreshToken = refreshToken,
                    TokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresInSeconds)
                });
            }

            await _context.SaveChangesAsync();
            return RedirectToAction("Index", "Settings", new { socialConnected = "zalo_oa" });
        }

        // ---------------------------------------------------------------
        // Zalo Group (shared Aris bot on the Zalo Bot Platform)
        // ---------------------------------------------------------------

        // Employer clicks "Kết nối nhóm Zalo" in Settings: we mint a short-lived code and
        // tell them to add the bot to their group, then paste "/link <code>" as a message.
        // ZaloBotWebhookController consumes it and turns it into a SocialChannelConnection.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> GenerateZaloGroupLinkCode()
        {
            var business = await CurrentBusinessAsync();
            if (business == null) return Json(new GenerateZaloGroupLinkCodeResultDto { Success = false, Message = "Chỉ tài khoản doanh nghiệp mới có thể kết nối nhóm Zalo." });

            var groupInviteLink = _config["Social:ZaloBot:GroupInviteLink"];
            var code = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
            var expiresAt = DateTime.UtcNow.AddMinutes(15);

            _context.ZaloGroupLinkCodes.Add(new ZaloGroupLinkCode
            {
                BusinessAccountId = business.Id,
                Code = code,
                ExpiresAt = expiresAt
            });
            await _context.SaveChangesAsync();

            return Json(new GenerateZaloGroupLinkCodeResultDto
            {
                Success = true,
                Code = code,
                BotDeepLink = string.IsNullOrWhiteSpace(groupInviteLink) ? null : groupInviteLink,
                ExpiresAt = expiresAt
            });
        }
    }
}
