using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArisSkyve.Infrastructure.Services
{
    // Aris đăng nhập không mật khẩu (magic link qua email, Google, Facebook), nên chỗ dễ bị lạm dụng là
    // yêu cầu gửi email đăng nhập (spam hộp thư người khác, tốn hạn mức SMTP) và dò link xác nhận.
    // Giới hạn theo IP ở đây; giới hạn theo email người nhận ở MagicLinkThrottle.
    // Lưu ý triển khai: phân vùng theo RemoteIpAddress — sau reverse proxy phải bật ForwardedHeaders,
    // nếu không mọi người dùng sẽ chung một IP của proxy.
    public static class AuthRateLimits
    {
        public const string MagicLinkRequest = "magic-link-request";
        public const string MagicLinkConfirm = "magic-link-confirm";

        public static void Configure(RateLimiterOptions options)
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(MagicLinkRequest, context => PerIp(context, "RateLimits:MagicLinkRequestsPerIp", 5));
            options.AddPolicy(MagicLinkConfirm, context => PerIp(context, "RateLimits:MagicLinkConfirmsPerIp", 20));
            options.OnRejected = async (rejected, cancellationToken) =>
            {
                var minutes = rejected.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
                    ? Math.Max(1, (int)Math.Ceiling(retryAfter.TotalMinutes)) : 15;
                var response = rejected.HttpContext.Response;
                response.Headers.RetryAfter = (minutes * 60).ToString();
                var message = $"Bạn thao tác quá nhanh. Để bảo vệ tài khoản, Aris tạm giới hạn yêu cầu đăng nhập từ mạng của bạn. Vui lòng thử lại sau khoảng {minutes} phút.";
                if (WantsJson(rejected.HttpContext.Request))
                {
                    await response.WriteAsJsonAsync(new { error = message, code = "rate_limited", retryAfterMinutes = minutes }, cancellationToken);
                    return;
                }
                response.ContentType = "text/html; charset=utf-8";
                await response.WriteAsync(
                    "<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
                    "<title>Thử lại sau ít phút — Aris</title></head><body style=\"font-family:system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 16px;line-height:1.55\">" +
                    $"<h1 style=\"font-size:1.4rem\">Thử lại sau ít phút</h1><p>{WebUtility.HtmlEncode(message)}</p>" +
                    "<p><a href=\"/Account/Login\">Quay lại trang đăng nhập</a></p></body></html>", cancellationToken);
            };
        }

        private static RateLimitPartition<string> PerIp(HttpContext context, string configKey, int defaultPermits)
        {
            var permits = Math.Max(1, context.RequestServices.GetRequiredService<IConfiguration>().GetValue(configKey, defaultPermits));
            return RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = permits,
                    Window = TimeSpan.FromMinutes(15),
                    QueueLimit = 0,
                    AutoReplenishment = true
                });
        }

        private static bool WantsJson(HttpRequest request) =>
            request.Headers.Accept.Any(value => value?.Contains("application/json", StringComparison.OrdinalIgnoreCase) == true) ||
            string.Equals(request.Headers["X-Requested-With"], "XMLHttpRequest", StringComparison.OrdinalIgnoreCase);
    }

    // Giới hạn số email đăng nhập gửi tới cùng một địa chỉ: 3 lần / 15 phút và 10 lần / ngày.
    // Lưu trong bộ nhớ của tiến trình: đủ cho triển khai một máy chủ; nhiều instance cần bộ đếm dùng chung.
    public sealed class MagicLinkThrottle
    {
        public static readonly TimeSpan ShortWindow = TimeSpan.FromMinutes(15);
        public static readonly TimeSpan LongWindow = TimeSpan.FromDays(1);
        private readonly IMemoryCache _cache;
        private readonly int _perShortWindow;
        private readonly int _perDay;
        private readonly object _gate = new();

        public MagicLinkThrottle(IMemoryCache cache, IConfiguration configuration)
        {
            _cache = cache;
            _perShortWindow = Math.Max(1, configuration.GetValue("RateLimits:MagicLinkEmailsPer15Minutes", 3));
            _perDay = Math.Max(_perShortWindow, configuration.GetValue("RateLimits:MagicLinkEmailsPerDay", 10));
        }

        public bool TryAcquire(string email, out TimeSpan retryAfter)
        {
            var key = "magic-link-email:" + email.Trim().ToLowerInvariant();
            var now = DateTimeOffset.UtcNow;
            lock (_gate)
            {
                var sends = _cache.Get<List<DateTimeOffset>>(key) ?? new List<DateTimeOffset>();
                sends.RemoveAll(sent => now - sent >= LongWindow);
                var recent = sends.Where(sent => now - sent < ShortWindow).ToList();
                if (recent.Count >= _perShortWindow)
                {
                    retryAfter = recent.Min() + ShortWindow - now;
                    return false;
                }
                if (sends.Count >= _perDay)
                {
                    retryAfter = sends.Min() + LongWindow - now;
                    return false;
                }
                sends.Add(now);
                _cache.Set(key, sends, LongWindow);
                retryAfter = TimeSpan.Zero;
                return true;
            }
        }
    }
}
