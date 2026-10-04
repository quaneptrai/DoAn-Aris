using System.Net;
using System.Net.Mail;
using System.Text;
using System.Text.Json;

namespace ArisSkyve.Infrastructure.Services;

/// <summary>
/// Sends account-verification email only through explicitly configured providers.
/// Credentials are never embedded in source or substituted with shared defaults.
/// </summary>
public sealed class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, IHttpClientFactory httpClientFactory, ILogger<EmailService> logger)
    {
        _config = config;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<bool> SendVerificationEmailAsync(string email, string confirmUrl)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(confirmUrl))
            return false;

        var host = _config["Smtp:Host"]?.Trim();
        var user = _config["Smtp:User"]?.Trim();
        var password = _config["Smtp:Password"];
        var fromEmail = _config["Smtp:FromEmail"]?.Trim();
        var fromName = _config["Smtp:FromName"]?.Trim();
        var apiKey = _config["Smtp:ApiKey"]?.Trim();
        var port = int.TryParse(_config["Smtp:Port"], out var parsedPort) ? parsedPort : 587;
        var smtpConfigured = !string.IsNullOrWhiteSpace(host)
            && !string.IsNullOrWhiteSpace(user)
            && !string.IsNullOrWhiteSpace(password)
            && !string.IsNullOrWhiteSpace(fromEmail);

        fromName = string.IsNullOrWhiteSpace(fromName) ? "Aris Career" : fromName;
        var encodedConfirmUrl = WebUtility.HtmlEncode(confirmUrl);
        var htmlContent = $"""
            <!doctype html>
            <html lang="vi"><head><meta charset="utf-8"></head>
            <body style="font-family:Segoe UI,Arial,sans-serif;color:#1e293b">
              <h1 style="font-size:20px">Xác nhận tài khoản Aris</h1>
              <p>Nhấn vào liên kết dưới đây để xác nhận đăng nhập hoặc hoàn tất đăng ký. Liên kết có hiệu lực trong 30 phút.</p>
              <p><a href="{encodedConfirmUrl}">Xác nhận tài khoản</a></p>
              <p>Nếu bạn không yêu cầu email này, hãy bỏ qua email.</p>
            </body></html>
            """;

        if (smtpConfigured)
        {
            try
            {
                using var client = new SmtpClient(host!, port)
                {
                    Credentials = new NetworkCredential(user!, password!),
                    EnableSsl = true,
                    Timeout = 12000
                };
                using var mail = new MailMessage
                {
                    From = new MailAddress(fromEmail!, fromName),
                    Subject = "Xác nhận tài khoản Aris",
                    Body = htmlContent,
                    IsBodyHtml = true
                };
                mail.To.Add(email);

                await client.SendMailAsync(mail);
                _logger.LogInformation("Verification email sent to {Email} via configured SMTP ({Host}:{Port})", email, host, port);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Configured SMTP delivery failed ({Host}:{Port}); trying the configured HTTP fallback.", host, port);
            }
        }
        else
        {
            _logger.LogWarning("SMTP verification email is disabled because its configuration is incomplete.");
        }

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(fromEmail))
        {
            _logger.LogWarning("HTTP verification-email fallback is disabled because its configuration is incomplete.");
            return false;
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            var payload = new
            {
                sender = new { name = fromName, email = fromEmail },
                to = new[] { new { email } },
                subject = "Xác nhận tài khoản Aris",
                htmlContent
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
            request.Headers.Add("api-key", apiKey);
            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            using var response = await client.SendAsync(request);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Verification email sent to {Email} via configured HTTP fallback", email);
                return true;
            }

            _logger.LogError("Verification-email HTTP fallback returned status {Status}.", response.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Configured verification-email HTTP fallback failed.");
        }

        return false;
    }
}
