using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace ArisSkyve.Infrastructure.Services;

/// <summary>Image generation uses the same preview/approval contract as video; provider tokens stay here.</summary>
public sealed class InterviewAvatarEngine(
    IHttpClientFactory clients, IOptionsMonitor<InterviewEngineOptions> options,
    IWebHostEnvironment environment, ILogger<InterviewAvatarEngine> logger)
{
    public const int MaximumBytes = 4 * 1024 * 1024;
    public const string DefaultUrl = "/images/interview/interviewer-avatar.webp";
    public sealed record Image(byte[] Bytes, string ContentType);
    private sealed record Pending(string Token, string Body, string BaseUrl, string? Key, DateTime Expires, string? BillingAccount);
    private readonly ConcurrentDictionary<string, Pending> quotes = new();
    public bool CanRender => options.CurrentValue.Avatar.Enabled
        && !string.IsNullOrWhiteSpace(options.CurrentValue.Avatar.BaseUrl ?? options.CurrentValue.Video.BaseUrl)
        && !string.IsNullOrWhiteSpace(options.CurrentValue.Avatar.Model);

    public async Task<Image> DefaultAsync(CancellationToken token) =>
        new(await File.ReadAllBytesAsync(Path.Combine(environment.WebRootPath, "images", "interview", "interviewer-avatar.webp"), token), "image/webp");

    public async Task<InterviewVideoQuote> QuoteAsync(string prompt, Image? reference, CancellationToken token, int? billingUserId = null)
    {
        if (!CanRender) throw new InterviewEngineException("Tạo avatar tự động chưa được bật. Bạn có thể dùng avatar mặc định hoặc tải ảnh lên.");
        if (string.IsNullOrWhiteSpace(prompt) || prompt.Length > 2000)
            throw new InterviewEngineException("Nhập mô tả avatar từ 1 đến 2.000 ký tự.");
        if (reference != null) await ValidateAsync(reference.Bytes, token);
        foreach (var (id, old) in quotes) if (old.Expires <= DateTime.UtcNow) quotes.TryRemove(id, out _);
        if (quotes.Count >= 128) throw new InterviewEngineException("Đang có nhiều báo giá ảnh. Vui lòng thử lại sau ít phút.");
        var config = options.CurrentValue;
        var baseUrl = config.Avatar.BaseUrl ?? config.Video.BaseUrl!;
        var key = config.Avatar.ApiKey ?? config.Video.ApiKey;
        var content = new List<object>
        {
            new { type = "text", text = "Tạo ảnh nhân vật phỏng vấn duy nhất, trung cảnh ngang 16:9, nhìn vào camera, ánh sáng rõ, khuôn mặt và trang phục rõ nét. Không chữ, không logo, không phụ đề. "
                + (reference != null ? "Dùng ảnh tham chiếu để giữ nhận diện và phong cách nhân vật. " : "") + prompt.Trim() }
        };
        if (reference != null) content.Add(new { type = "image_url", image_url = new { url = $"data:{reference.ContentType};base64,{Convert.ToBase64String(reference.Bytes)}" } });
        var body = new Dictionary<string, object>
        {
            ["model"] = config.Avatar.Model,
            ["messages"] = new[] { new { role = "user", content } }, ["stream"] = false
        };
        if (config.Video.AccountId is > 0) body["account_id"] = config.Video.AccountId.Value;
        var bodyText = JsonSerializer.Serialize(body);
        using var request = Request(baseUrl, "generation/preview", key, bodyText);
        var account = InterviewEngine.BillingAccount(billingUserId, config.Video.BillingIdentityRequired);
        if (account != null) request.Headers.Add("X-Aris-Account", account);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
        timeout.CancelAfter(TimeSpan.FromSeconds(60));
        using var response = await SendAsync(request, timeout.Token);
        using var json = JsonDocument.Parse(await ReadLimitedAsync(response, 256 * 1024, timeout.Token));
        var root = json.RootElement;
        var approval = root.TryGetProperty("approval_token", out var a) && a.ValueKind == JsonValueKind.String ? a.GetString() : null;
        if (string.IsNullOrWhiteSpace(approval)) throw new InterviewEngineException("Dịch vụ chưa báo giá được avatar. Thử lại sau.");
        // The image service does not price images in advance (estimated_credits is null): the quote carries no cost,
        // the dialog says so, and it is never auto-approved. A negative estimate is not a price.
        var cost = root.IntOrNull("estimated_credits") is int estimate && estimate >= 0 ? estimate : (int?)null;
        var seconds = root.IntOrNull("expires_in") is int expiry ? Math.Clamp(expiry - 5, 1, 270) : 270;
        var quote = new InterviewVideoQuote(Guid.NewGuid().ToString("N"), cost);
        quotes[quote.Id] = new Pending(approval, bodyText, baseUrl, key, DateTime.UtcNow.AddSeconds(seconds), account);
        return quote;
    }

    public async Task<Image> RenderAsync(string quoteId, CancellationToken token)
    {
        if (!quotes.TryRemove(quoteId, out var quote) || quote.Expires <= DateTime.UtcNow)
            throw new InterviewEngineException("Báo giá avatar đã hết hạn hoặc đã được dùng. Xem lại chi phí trước khi tạo.");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
        timeout.CancelAfter(TimeSpan.FromMinutes(15));
        using var request = Request(quote.BaseUrl, "chat/completions", quote.Key, quote.Body);
        request.Headers.TryAddWithoutValidation("X-Flow-Approval", quote.Token);
        if (quote.BillingAccount != null) request.Headers.Add("X-Aris-Account", quote.BillingAccount);
        using var response = await SendAsync(request, timeout.Token);
        var reply = Encoding.UTF8.GetString(await ReadLimitedAsync(response, MaximumBytes * 2, timeout.Token));
        var content = Extract(reply);
        var markdown = Regex.Match(content, @"!\[[^\]]*\]\(([^\s)]+)\)");
        var html = Regex.Match(content, "<img[^>]*\\bsrc\\s*=\\s*[\"']([^\"']+)[\"']", RegexOptions.IgnoreCase);
        var url = markdown.Success ? markdown.Groups[1].Value : html.Success ? html.Groups[1].Value : content.Trim();
        url = WebUtility.HtmlDecode(url);
        if (url.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            var data = Regex.Match(url, @"^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$", RegexOptions.IgnoreCase);
            if (!data.Success || data.Groups[2].Length > (MaximumBytes + 2L) / 3 * 4)
                throw new InterviewEngineException("Ảnh avatar trả về không hợp lệ hoặc lớn hơn 4 MB.");
            return await ValidateAsync(Convert.FromBase64String(data.Groups[2].Value), timeout.Token);
        }
        var origin = new Uri(quote.BaseUrl.TrimEnd('/') + "/");
        if (!Uri.TryCreate(origin, url, out var uri) || uri.Scheme is not ("http" or "https") || !string.IsNullOrEmpty(uri.UserInfo))
            throw new InterviewEngineException("Dịch vụ tạo avatar chưa trả về ảnh hợp lệ.");
        using var download = new HttpRequestMessage(HttpMethod.Get, uri);
        // Only the provider's own origin gets its credentials, even when it returns a CDN link.
        if (uri.Authority == origin.Authority && uri.Scheme == origin.Scheme) Authenticate(download, quote.Key);
        using var file = await SendAsync(download, timeout.Token);
        return await ValidateAsync(await ReadLimitedAsync(file, MaximumBytes, timeout.Token), timeout.Token);
    }

    public static async Task<Image> ValidateAsync(byte[] bytes, CancellationToken token)
    {
        var (type, extension) = bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) ? ("image/png", ".png")
            : bytes.AsSpan().StartsWith(new byte[] { 255, 216, 255 }) ? ("image/jpeg", ".jpg")
            : bytes.Length >= 12 && Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP" ? ("image/webp", ".webp") : ("", "");
        using var stream = new MemoryStream(bytes);
        var file = new FormFile(stream, 0, bytes.Length, "avatar", "avatar" + extension) { Headers = new HeaderDictionary(), ContentType = type };
        var validation = await PublicMediaValidator.ValidateImageAsync(file, MaximumBytes, token);
        if (!validation.IsValid || validation.Media == null)
            throw new InterviewEngineException("Avatar phải là ảnh JPEG, PNG hoặc WEBP hợp lệ, tối đa 4 MB.");
        return new Image(bytes, validation.Media.ContentType);
    }

    private static string Extract(string reply)
    {
        static string Content(JsonElement root)
        {
            if (root.TryGetProperty("url", out var url) && url.ValueKind == JsonValueKind.String) return url.GetString() ?? "";
            if (root.TryGetProperty("choices", out var choices) && choices.ValueKind == JsonValueKind.Array && choices.GetArrayLength() > 0)
            {
                var choice = choices[0];
                if ((choice.TryGetProperty("message", out var message) || choice.TryGetProperty("delta", out message))
                    && message.TryGetProperty("content", out var value) && value.ValueKind == JsonValueKind.String) return value.GetString() ?? "";
            }
            return "";
        }
        if (reply.TrimStart().StartsWith('{')) { using var json = JsonDocument.Parse(reply); return Content(json.RootElement); }
        var result = new StringBuilder();
        foreach (var line in reply.Split('\n'))
        {
            if (!line.StartsWith("data:")) continue;
            var data = line[5..].Trim();
            if (data is "" or "[DONE]") continue;
            using var chunk = JsonDocument.Parse(data);
            result.Append(Content(chunk.RootElement));
        }
        return result.ToString();
    }

    private static HttpRequestMessage Request(string baseUrl, string operation, string? key, string body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, baseUrl.TrimEnd('/') + "/" + operation);
        Authenticate(request, key);
        request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        return request;
    }
    private static void Authenticate(HttpRequestMessage request, string? key)
    {
        if (!string.IsNullOrWhiteSpace(key)) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Regex.Replace(key.Trim(), "^(?:Bearer\\s+)+", "", RegexOptions.IgnoreCase));
    }
    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
    {
        try
        {
            var response = await clients.CreateClient(InterviewEngine.HttpClientName).SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
            if (response.IsSuccessStatusCode) return response;
            var status = (int)response.StatusCode;
            var detail = status is 423 or 429 ? await response.Content.ReadAsStringAsync(token) : "";
            response.Dispose();
            logger.LogWarning("Avatar service returned {Status} for {Path}.", status, request.RequestUri?.AbsolutePath);
            if (InterviewEngine.ServiceLimit(status, detail) is { } limit) throw new InterviewEngineException(limit);
            throw new InterviewEngineException(status is 409 or 428 ? "Báo giá avatar không còn hiệu lực. Xem lại chi phí trước khi tạo."
                : status == 429 ? "Dịch vụ tạo avatar đang quá tải hoặc hết hạn mức. Thử lại sau."
                : "Dịch vụ tạo avatar không thực hiện được yêu cầu. Thử lại hoặc đổi mô tả/ảnh tham chiếu.");
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException)
        {
            logger.LogWarning(exception, "Avatar service unavailable.");
            throw new InterviewEngineException("Dịch vụ tạo avatar đang không phản hồi. Thử lại sau.");
        }
    }
    private static async Task<byte[]> ReadLimitedAsync(HttpResponseMessage response, int limit, CancellationToken token)
    {
        if (response.Content.Headers.ContentLength > limit) throw new InterviewEngineException("Dữ liệu avatar trả về quá lớn.");
        using var stream = await response.Content.ReadAsStreamAsync(token);
        using var buffer = new MemoryStream();
        var chunk = new byte[8192];
        int size;
        while ((size = await stream.ReadAsync(chunk, token)) > 0)
        {
            if (buffer.Length + size > limit) throw new InterviewEngineException("Dữ liệu avatar trả về quá lớn.");
            buffer.Write(chunk, 0, size);
        }
        return buffer.ToArray();
    }
}
