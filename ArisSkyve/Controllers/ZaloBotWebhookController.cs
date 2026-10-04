using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace ArisSkyve.Controllers
{
    // Public webhook endpoint (no [Authorize] — Zalo's Bot Platform calls this directly, it
    // never carries our login cookie) that receives updates for the single Aris bot shared
    // across all businesses. Its only job here is the group-linking handshake: an employer
    // pastes "/link <code>" (minted by SocialConnectController.GenerateZaloGroupLinkCode)
    // into a group the bot has been added to, and this promotes that code into a
    // SocialChannelConnection carrying the group's chat_id.
    //
    // Payload shape confirmed against https://bot.zaloplatforms.com/docs/webhook/ (2026-07-31):
    // { ok, result: { event_name, message: { from: {id, display_name, is_bot}, chat: {id, chat_type}, text, message_id, date } } }.
    // Note there is no group display name anywhere in this payload — chat only carries id + chat_type.
    [Route("webhooks/zalobot")]
    [ApiController]
    public class ZaloBotWebhookController : ControllerBase
    {
        private readonly ArisDBContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpClientFactory;

        public ZaloBotWebhookController(ArisDBContext context, IConfiguration config, IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _config = config;
            _httpClientFactory = httpClientFactory;
        }

        // This endpoint is invoked by Zalo, not a browser carrying an Aris
        // antiforgery cookie.  The configured webhook secret below is its
        // alternate authentication mechanism and is intentionally fail-closed.
        [HttpPost]
        [IgnoreAntiforgeryToken]
        public async Task<IActionResult> Receive()
        {
            // Zalo echoes back whatever secret_token was registered via setWebhook in this
            // header on every call, so this rejects requests that don't actually come from
            // Zalo. A missing secret is rejected too: accepting it would leave this public
            // mutation endpoint unauthenticated.
            var expectedSecret = _config["Social:ZaloBot:WebhookSecretToken"];
            if (string.IsNullOrWhiteSpace(expectedSecret) ||
                !string.Equals(Request.Headers["X-Bot-Api-Secret-Token"], expectedSecret, StringComparison.Ordinal))
                return Unauthorized();

            using var reader = new StreamReader(Request.Body);
            var raw = await reader.ReadToEndAsync();
            if (string.IsNullOrWhiteSpace(raw)) return Ok();

            JsonDocument doc;
            try { doc = JsonDocument.Parse(raw); }
            catch (JsonException) { return Ok(); }

            if (!doc.RootElement.TryGetProperty("result", out var result) || !result.TryGetProperty("message", out var message))
                return Ok();

            var text = message.TryGetProperty("text", out var t) ? t.GetString() : null;
            var chatId = message.TryGetProperty("chat", out var chat) && chat.TryGetProperty("id", out var cid) ? cid.GetString() : null;
            if (string.IsNullOrWhiteSpace(text) || string.IsNullOrWhiteSpace(chatId)) return Ok();

            text = text.Trim();
            if (!text.StartsWith("/link ", StringComparison.OrdinalIgnoreCase)) return Ok();

            var code = text[6..].Trim().ToUpperInvariant();
            var linkRequest = await _context.ZaloGroupLinkCodes
                .Include(z => z.BusinessAccount)
                .FirstOrDefaultAsync(z => z.Code == code && z.ConsumedAt == null && z.ExpiresAt > DateTime.UtcNow);

            if (linkRequest == null)
            {
                await SendMessageAsync(chatId, "Mã liên kết không hợp lệ hoặc đã hết hạn. Hãy tạo mã mới trong Cài đặt trên Aris.");
                return Ok();
            }

            // Zalo's webhook payload never includes a group display name (only chat.id +
            // chat_type) — fall back to a short label derived from the chat id and let the
            // employer rename it mentally by context (they just linked it themselves).
            var groupName = $"Nhóm Zalo #{chatId[^Math.Min(6, chatId.Length)..]}";

            var existing = await _context.SocialChannelConnections.FirstOrDefaultAsync(c =>
                c.BusinessAccountId == linkRequest.BusinessAccountId && c.Platform == SocialPlatform.ZaloGroup && c.ExternalId == chatId);

            if (existing != null)
            {
                existing.DisplayName = groupName;
                existing.IsActive = true;
            }
            else
            {
                _context.SocialChannelConnections.Add(new SocialChannelConnection
                {
                    BusinessAccountId = linkRequest.BusinessAccountId,
                    Platform = SocialPlatform.ZaloGroup,
                    ExternalId = chatId,
                    DisplayName = groupName
                });
            }

            linkRequest.ConsumedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await SendMessageAsync(chatId, $"Đã kết nối nhóm này với {linkRequest.BusinessAccount?.CompanyName ?? "doanh nghiệp"} trên Aris. Tin tuyển dụng có thể được chia sẻ vào đây từ giờ.");
            return Ok();
        }

        private async Task SendMessageAsync(string chatId, string text)
        {
            var botToken = _config["Social:ZaloBot:Token"];
            if (string.IsNullOrWhiteSpace(botToken)) return;

            var client = _httpClientFactory.CreateClient();
            var payload = JsonSerializer.Serialize(new { chat_id = chatId, text });
            using var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");
            try { await client.PostAsync($"https://bot-api.zaloplatforms.com/bot{botToken}/sendMessage", content); }
            catch (HttpRequestException) { /* best-effort acknowledgement, linking already succeeded */ }
        }
    }
}
