using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using ArisSkyve.Domain.Entities;

namespace ArisSkyve.Infrastructure.Services.Recruitment
{
    public class GapStep
    {
        [JsonPropertyName("skill")] public string Skill { get; set; } = string.Empty;
        [JsonPropertyName("stage")] public int Stage { get; set; }
        [JsonPropertyName("stageLabel")] public string StageLabel { get; set; } = string.Empty;
        [JsonPropertyName("relatedTo")] public List<string> RelatedTo { get; set; } = new();
        [JsonPropertyName("after")] public List<string> After { get; set; } = new();
        [JsonPropertyName("activePostings")] public int ActivePostings { get; set; }
        [JsonPropertyName("opens")] public int Opens { get; set; }
    }

    // Lộ trình bù khoảng cách CV ↔ một tin (AiCore /api/v2/skills/gap-plan), dạng camelCase cho JS.
    public class GapPlan
    {
        [JsonPropertyName("cvSkills")] public List<string> CvSkills { get; set; } = new();
        [JsonPropertyName("matched")] public List<string> Matched { get; set; } = new();
        [JsonPropertyName("coverageNow")] public int? CoverageNow { get; set; }
        [JsonPropertyName("coverageAfterStage1")] public int? CoverageAfterStage1 { get; set; }
        [JsonPropertyName("steps")] public List<GapStep> Steps { get; set; } = new();
        [JsonPropertyName("totalSteps")] public int TotalSteps { get; set; }
        [JsonPropertyName("softSkills")] public List<string> SoftSkills { get; set; } = new();
        [JsonPropertyName("unmapped")] public List<string> Unmapped { get; set; } = new();
    }

    public record GapPlanOutcome(bool Success, string? Message, GapPlan? Plan);

    // "Nên học gì để lần sau đạt tin này": dựa trên CV đã nộp + kỹ năng AI thấy CV chưa nhắc.
    // Không gọi LLM phía AiCore (vài chục ms), nhưng vẫn giữ 30 phút mỗi đơn cho đỡ gọi lặp.
    public class SkillGapService
    {
        private static readonly ConcurrentDictionary<(int AppId, DateTime? ScoredAt), (DateTime At, GapPlan Plan)> Cache = new();

        private readonly IHttpClientFactory _httpFactory;
        private readonly IConfiguration _config;
        private readonly ILogger<SkillGapService> _logger;

        public SkillGapService(IHttpClientFactory httpFactory, IConfiguration config, ILogger<SkillGapService> logger)
        {
            _httpFactory = httpFactory;
            _config = config;
            _logger = logger;
        }

        public async Task<GapPlanOutcome> ForApplicationAsync(JobApplication app, MatchDetail? detail, CancellationToken ct = default)
        {
            var key = (app.Id, app.MatchScoredAt);
            if (Cache.TryGetValue(key, out var hit) && DateTime.UtcNow - hit.At < TimeSpan.FromMinutes(30))
                return new(true, null, hit.Plan);

            try
            {
                using var client = _httpFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(20);
                var baseUrl = (_config["AiCore:BaseUrl"] ?? "http://localhost:8001").TrimEnd('/');
                using var response = await client.PostAsJsonAsync($"{baseUrl}/api/v2/skills/gap-plan", new
                {
                    employee_id = app.ApplicantId,
                    posting_id = app.JobPostingId,
                    resume_id = app.ResumeId,
                    job_title = app.JobPosting?.Title ?? string.Empty,
                    missing = (detail?.Missing ?? new List<string>()).Take(20).ToList(),
                    limit = 8
                }, ct);

                if (response.StatusCode == HttpStatusCode.NotFound)
                    return new(false, "AiCore chưa có hồ sơ của bạn.", null);
                if (!response.IsSuccessStatusCode)
                    return new(false, $"Dịch vụ kỹ năng tạm thời lỗi (HTTP {(int)response.StatusCode}).", null);

                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
                var root = doc.RootElement;
                if ((Str(root, "status") ?? "success") == "no_cv")
                    return new(false, "Tải CV lên để Aris dựng lộ trình kỹ năng.", null);

                var plan = new GapPlan
                {
                    CvSkills = StrList(root, "cv_skills"),
                    Matched = StrList(root, "matched"),
                    TotalSteps = Int(root, "total_steps") ?? 0,
                    SoftSkills = StrList(root, "soft_skills"),
                    Unmapped = StrList(root, "unmapped")
                };
                if (root.TryGetProperty("coverage", out var cov) && cov.ValueKind == JsonValueKind.Object)
                {
                    plan.CoverageNow = Int(cov, "now");
                    plan.CoverageAfterStage1 = Int(cov, "after_stage1");
                }
                if (root.TryGetProperty("steps", out var steps) && steps.ValueKind == JsonValueKind.Array)
                {
                    foreach (var s in steps.EnumerateArray())
                    {
                        var skill = Str(s, "skill");
                        if (string.IsNullOrWhiteSpace(skill)) continue;
                        plan.Steps.Add(new GapStep
                        {
                            Skill = skill,
                            Stage = Int(s, "stage") ?? 3,
                            StageLabel = Str(s, "stage_label") ?? string.Empty,
                            RelatedTo = StrList(s, "related_to"),
                            After = StrList(s, "after"),
                            ActivePostings = Int(s, "active_postings") ?? 0,
                            Opens = Int(s, "opens") ?? 0
                        });
                    }
                }
                Cache[key] = (DateTime.UtcNow, plan);
                return new(true, null, plan);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                return new(false, "Dịch vụ kỹ năng phản hồi quá thời gian.", null);
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException)
            {
                _logger.LogWarning("AiCore gap-plan failed for application {Id}: {Msg}", app.Id, ex.Message);
                return new(false, "Không kết nối được dịch vụ kỹ năng.", null);
            }
        }

        private static string? Str(JsonElement el, string name) =>
            el.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;

        private static int? Int(JsonElement el, string name) =>
            el.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Number ? (int)Math.Round(p.GetDouble()) : null;

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
