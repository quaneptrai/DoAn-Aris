using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Services.Recruitment
{
    public record MatchScoreOutcome(bool Success, string? Message, MatchDetail? Detail);

    // Chấm đúng CV đã nộp với đúng tin qua AiCore /score-cv-for-job rồi lưu vào đơn.
    // Dùng chung cho worker nền (sau khi ứng tuyển), nút "Chấm lại" của nhà tuyển dụng và
    // lần đầu ứng viên mở "Vì sao?" khi đơn chưa có điểm.
    public class ApplicationMatchService
    {
        public const int MaxAttempts = 3;

        private readonly ArisDBContext _db;
        private readonly IHttpClientFactory _httpFactory;
        private readonly IConfiguration _config;
        private readonly ILogger<ApplicationMatchService> _logger;

        public ApplicationMatchService(ArisDBContext db, IHttpClientFactory httpFactory, IConfiguration config, ILogger<ApplicationMatchService> logger)
        {
            _db = db;
            _httpFactory = httpFactory;
            _config = config;
            _logger = logger;
        }

        public async Task<MatchScoreOutcome> ScoreAsync(int applicationId, CancellationToken ct = default)
        {
            var app = await _db.JobApplications
                .Include(a => a.JobPosting)
                .FirstOrDefaultAsync(a => a.Id == applicationId, ct);
            if (app == null) return new(false, "Không tìm thấy đơn ứng tuyển.", null);

            app.MatchAttempts++;

            MatchScoreOutcome outcome;
            try
            {
                outcome = await CallAiCoreAsync(app.ApplicantId, app.ResumeId, app.JobPostingId, app.JobPosting.OriginalUrl, ct);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                outcome = new(false, "AiCore phản hồi quá thời gian.", null);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning("AiCore score-cv-for-job unreachable for application {Id}: {Msg}", applicationId, ex.Message);
                outcome = new(false, "Không kết nối được dịch vụ AI.", null);
            }

            if (outcome.Success && outcome.Detail != null)
            {
                var d = outcome.Detail;
                d.ResumeId ??= app.ResumeId;
                app.MatchScore = d.Score.HasValue ? Math.Round(d.Score.Value, 1) : null;
                app.MatchSummary = MatchInsight.BuildSummary(d.Matched, d.Missing, d.Reason);
                app.MatchDetailJson = d.ToJson();
                app.MatchScoredAt = DateTime.UtcNow;
                app.MatchError = null;
            }
            else
            {
                app.MatchError = outcome.Message?.Length > 300 ? outcome.Message[..300] : outcome.Message;
            }

            await _db.SaveChangesAsync(ct);
            return outcome;
        }

        private async Task<MatchScoreOutcome> CallAiCoreAsync(int employeeId, int? resumeId, int postingId, string? originalUrl, CancellationToken ct)
        {
            using var client = _httpFactory.CreateClient();
            var timeout = int.TryParse(_config["AiCore:ScoreTimeoutSeconds"], out var t) && t > 0 ? t : 45;
            client.Timeout = TimeSpan.FromSeconds(timeout);
            var baseUrl = (_config["AiCore:BaseUrl"] ?? "http://localhost:8001").TrimEnd('/');

            using var response = await client.PostAsJsonAsync($"{baseUrl}/score-cv-for-job", new
            {
                employee_id = employeeId,
                resume_id = resumeId,
                posting_id = postingId,
                original_url = string.IsNullOrWhiteSpace(originalUrl) ? null : originalUrl
            }, ct);

            if (response.StatusCode == HttpStatusCode.NotFound)
                return new(false, "AiCore chưa có dữ liệu CV hoặc tin này.", null);
            if (!response.IsSuccessStatusCode)
                return new(false, $"Dịch vụ AI tạm thời lỗi (HTTP {(int)response.StatusCode}).", null);

            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            var root = doc.RootElement;
            var status = Str(root, "status") ?? "success";
            if (status != "success")
            {
                var msg = Str(root, "message") ?? status switch
                {
                    "no_cv" => "CV này chưa được AI đọc nội dung.",
                    "vector_pending" => "CV đang được xử lý, thử lại sau ít phút.",
                    _ => "AI chưa chấm được CV này."
                };
                return new(false, msg, null);
            }

            var detail = new MatchDetail
            {
                Score = Num(root, "final_score"),
                Reason = Str(root, "reason"),
                Advice = Str(root, "advice"),
                Matched = StrList(root, "matched_skills"),
                Missing = StrList(root, "missing_skills"),
                ExplanationStatus = Str(root, "explanation_status")
            };
            if (root.TryGetProperty("evidence", out var ev) && ev.ValueKind == JsonValueKind.Array)
            {
                foreach (var e in ev.EnumerateArray().Take(6))
                    detail.Evidence.Add(new MatchEvidence { Cv = Str(e, "cv_quote"), Job = Str(e, "job_quote") });
            }
            if (root.TryGetProperty("score_breakdown", out var sb) && sb.ValueKind == JsonValueKind.Object)
            {
                detail.SemanticScore = Num(sb, "semantic_score") ?? Num(sb, "base_score");
                detail.LlmScore = Num(sb, "llm_score");
                detail.LlmAdjustment = Num(sb, "llm_adjustment");
            }
            if (root.TryGetProperty("meta", out var meta) && meta.ValueKind == JsonValueKind.Object)
                detail.Model = Str(meta, "llm_model");
            if (root.TryGetProperty("candidate", out var cand) && cand.ValueKind == JsonValueKind.Object)
            {
                var rid = Num(cand, "resume_id");
                if (rid.HasValue) detail.ResumeId = (int)rid.Value;
            }

            return new(true, null, detail);
        }

        private static string? Str(JsonElement el, string name) =>
            el.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;

        private static double? Num(JsonElement el, string name) =>
            el.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Number ? p.GetDouble() : null;

        private static List<string> StrList(JsonElement el, string name)
        {
            var list = new List<string>();
            if (el.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Array)
            {
                foreach (var x in p.EnumerateArray())
                {
                    if (x.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(x.GetString()))
                        list.Add(x.GetString()!.Trim());
                }
            }
            return list;
        }
    }
}
