using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
namespace ArisSkyve.Infrastructure.Services;
public sealed record InterviewServiceStatus(bool Paused, bool? Llm, bool? Video, bool? Tts, bool Ffmpeg);
public sealed class InterviewAdministration(IHttpClientFactory clients, IOptionsMonitor<InterviewEngineOptions> options)
{
    private async Task<JsonDocument> CallAsync(string path, object? body, CancellationToken token)
    {
        var config = options.CurrentValue.Administration;
        if (!config.Enabled || string.IsNullOrWhiteSpace(config.ApiKey)) throw new InterviewEngineException("Kết nối quản trị dịch vụ chưa được cấu hình.");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token); timeout.CancelAfter(TimeSpan.FromSeconds(25));
        using var request = new HttpRequestMessage(body == null ? HttpMethod.Get : HttpMethod.Post, config.BaseUrl!.TrimEnd('/') + "/" + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config.ApiKey.Trim());
        if (body != null) request.Content = new StringContent(InterviewJson.Write(body), Encoding.UTF8, "application/json");
        try {
            using var response = await clients.CreateClient(InterviewEngine.HttpClientName).SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode) throw new InterviewEngineException("Chưa thực hiện được thao tác quản trị dịch vụ. Thử lại sau.");
            return JsonDocument.Parse(await response.Content.ReadAsStringAsync(timeout.Token));
        } catch (Exception e) when (e is HttpRequestException or JsonException || e is OperationCanceledException && !token.IsCancellationRequested) {
            throw new InterviewEngineException("Dịch vụ tạm thời không phản hồi. Thử lại sau.");
        }
    }
    public async Task<InterviewServiceStatus> StatusAsync(CancellationToken token)
    {
        using var json = await CallAsync("status", null, token); var root = json.RootElement; var services = root.GetProperty("services");
        static bool? Value(JsonElement root, string name) => root.GetProperty(name).ValueKind == JsonValueKind.Null ? null : root.GetProperty(name).GetBoolean();
        return new(root.GetProperty("paused").GetBoolean(), Value(services,"llm"), Value(services,"video"), Value(services,"tts"), services.GetProperty("ffmpeg").GetBoolean());
    }
    public async Task PauseAsync(bool paused, CancellationToken token) { using var json = await CallAsync(paused ? "pause" : "resume", new { }, token); }
    public async Task GrantAsync(int requestId, int userId, int actorId, int credits, string day, CancellationToken token)
    {
        using var json = await CallAsync("credit-grants", new { id = "support-" + requestId, account = InterviewEngine.BillingAccount(userId,true), actor = InterviewEngine.BillingAccount(actorId,true), credits, day }, token);
        if (!json.RootElement.TryGetProperty("ok", out var ok) || !ok.GetBoolean()) throw new InterviewEngineException("Chưa xác nhận được khoản credit bổ sung.");
    }
}
