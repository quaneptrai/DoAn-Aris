using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Controllers;

[Authorize, ApiController, Route("api/resume-engine")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ResumeEngineController(ArisDBContext db, IHttpClientFactory clients,
    IConfiguration configuration, IAntiforgery antiforgery, ResumeOriginalLifecycle originals) : ControllerBase
{
    private const string EngineVersion = "aris-resume/v1";
    private const string OriginalFetchClientName = "resume-original-fetch";
    private const string LayoutImportMode = "layout";
    private const string OcrLayoutImportMode = "layout-ocr";
    private const string TemplateImportMode = "template";
    private const int CoachTargetMaxLength = 120;
    private const int CoachResponseMaxCharacters = 512 * 1024;
    private const int CoachMaxCvSkills = 30;
    private const int CoachMaxTargetSkills = 15;
    private const int CoachMaxRoles = 6;
    private const int CoachMaxPlanSteps = 15;
    private const int CoachMaxPostings = 1_000_000;
    private const int CoachMaxSkillLength = 80;
    private const int CoachMaxRoleTitleLength = 180;
    private const int CoachMaxStageLabelLength = 120;
    private const int CoachMaxSampleTitleLength = 240;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex ImportedEmailPattern = new(@"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", RegexOptions.CultureInvariant);
    private sealed record StoredDocument(string Engine, string TemplateId, bool Published, JsonElement Data);
    private sealed record ParserCapabilities(bool LayoutOcr, string? LayoutOcrReason);
    private sealed record CoachRole(
        [property: JsonPropertyName("title")] string Title,
        [property: JsonPropertyName("postings")] int Postings,
        [property: JsonPropertyName("coverage")] int Coverage,
        [property: JsonPropertyName("matched")] IReadOnlyList<string> Matched,
        [property: JsonPropertyName("missing")] IReadOnlyList<string> Missing);
    private sealed record CoachTargetSkill(
        [property: JsonPropertyName("skill")] string Skill,
        [property: JsonPropertyName("share")] double Share,
        [property: JsonPropertyName("postings")] int Postings,
        [property: JsonPropertyName("have")] bool Have);
    private sealed record CoachCoverage(
        [property: JsonPropertyName("now")] int? Now,
        [property: JsonPropertyName("after_stage1")] int? AfterStage1);
    private sealed record CoachPlanStep(
        [property: JsonPropertyName("skill")] string Skill,
        [property: JsonPropertyName("stage")] int Stage,
        [property: JsonPropertyName("stage_label")] string StageLabel,
        [property: JsonPropertyName("related_to")] IReadOnlyList<string> RelatedTo,
        [property: JsonPropertyName("after")] IReadOnlyList<string> After,
        [property: JsonPropertyName("active_postings")] int ActivePostings,
        [property: JsonPropertyName("opens")] int Opens);
    private sealed record CoachPlan(
        [property: JsonPropertyName("coverage")] CoachCoverage Coverage,
        [property: JsonPropertyName("steps")] IReadOnlyList<CoachPlanStep> Steps,
        [property: JsonPropertyName("total_steps")] int TotalSteps,
        [property: JsonPropertyName("soft_skills")] IReadOnlyList<string> SoftSkills,
        [property: JsonPropertyName("matched")] IReadOnlyList<string> Matched);
    private sealed record CoachTarget(
        [property: JsonPropertyName("query")] string Query,
        [property: JsonPropertyName("postings")] int Postings,
        [property: JsonPropertyName("skills")] IReadOnlyList<CoachTargetSkill> Skills,
        [property: JsonPropertyName("sample_titles")] IReadOnlyList<string> SampleTitles,
        [property: JsonPropertyName("plan")] CoachPlan Plan);
    private sealed record CoachResponse(
        [property: JsonPropertyName("status")] string Status,
        [property: JsonPropertyName("cv_skills")] IReadOnlyList<string> CvSkills,
        [property: JsonPropertyName("roles")] IReadOnlyList<CoachRole> Roles,
        [property: JsonPropertyName("target")] CoachTarget? Target,
        [property: JsonPropertyName("titles_indexed")] bool TitlesIndexed,
        [property: JsonPropertyName("marketDataScope")] string MarketDataScope);
    public sealed record SaveDocumentRequest(int? ResumeId, JsonElement Data, string TemplateId = "t3");
    public sealed record CoachRequest(JsonElement Data, string? Target);

    [HttpGet("/Resume/Studio")]
    public IActionResult Studio([FromServices] IWebHostEnvironment environment) =>
        PhysicalFile(Path.Combine(environment.WebRootPath, "resume-engine", "index.html"), "text/html; charset=utf-8");

    [HttpGet("session")]
    public IActionResult Session()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();
        return Ok(new { userId, token = antiforgery.GetAndStoreTokens(HttpContext).RequestToken });
    }

    [HttpGet("capabilities")]
    public async Task<IActionResult> Capabilities(CancellationToken cancellationToken)
    {
        var capabilities = await GetParserCapabilities(cancellationToken);
        return Ok(new
        {
            layoutOcr = capabilities.LayoutOcr,
            layoutOcrReason = capabilities.LayoutOcrReason,
            // Kept in the API so Studio can accurately explain the bounded
            // retention window for a parsed original that has not been saved yet.
            originalRetentionHours = originals.RetentionHours
        });
    }

    [HttpGet("document/{resumeId:int}")]
    public async Task<IActionResult> GetDocument(int resumeId, CancellationToken cancellationToken)
    {
        var resume = await OwnedResume(resumeId, cancellationToken);
        if (resume is null) return NotFound();
        var document = ReadDocument(resume);
        if (document is not null) return Ok(new { document.Data, document.TemplateId, document.Published, resumeId });

        // CV tải lên hoặc của trình dựng cũ: dựng bản Studio từ dữ liệu sẵn có (AiCore đọc lại toàn văn
        // nếu có). Chưa ghi gì cho tới khi người dùng bấm Lưu.
        var hasOriginalFile = !string.IsNullOrWhiteSpace(resume.FileUrl);
        var (data, source) = await BuildLegacyAsync(resume, cancellationToken, includeAiStructure: !hasOriginalFile);
        return Ok(new { data, templateId = "t1", published = false, resumeId, imported = true, importSource = source, hasOriginalFile });
    }

    [HttpPost("document"), ValidateAntiForgeryToken, RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<IActionResult> SaveDocument([FromBody] SaveDocumentRequest request, CancellationToken cancellationToken)
    {
        if (!CanonicalResumeContract.IsValid(request.Data) || !ValidTemplate(request.TemplateId))
            return BadRequest(new { error = "Dữ liệu CV không đúng CanonicalResumeSchema." });
        if (RequiresOcrReview(request.Data))
            return UnprocessableEntity(new
            {
                error = "Hãy xác nhận đã đối chiếu từng trang OCR với file gốc trước khi lưu hoặc công khai.",
                code = "ocr_review_required"
            });
        if (request.Data.GetRawText().Length > 10_000_000) return StatusCode(413, new { error = "Dữ liệu CV quá lớn." });
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) || userId <= 0) return Unauthorized();
        Resume? resume = null;
        StoredDocument? previous = null;
        if (request.ResumeId is int id)
        {
            resume = await OwnedResume(id, cancellationToken);
            if (resume is null) return NotFound();
            previous = ReadDocument(resume);
        }
        if (resume is null)
        {
            var user = await db.Users.Include(x => x.Profile).FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
            if (user is null) return Unauthorized();
            if (user.Profile is null)
            {
                user.Profile = new EmployesAccount { UserId = user.Id, FullName = user.Username ?? "User", Location = "" };
                db.Profiles.Add(user.Profile);
                await db.SaveChangesAsync(cancellationToken);
            }
            resume = new Resume { EmployeeId = user.Profile.Id, CreatedAt = DateTime.UtcNow };
            db.Resumes.Add(resume);
        }
        // Positioned-layout edits happen in importedLayout. Keep the canonical
        // identity and Resume row in sync even if an older client sends stale
        // basics after changing the visible name or email overlay.
        var data = SynchronizeImportedBasics(request.Data);
        var previousSourceId = previous is null ? null : ResumeOriginalLifecycle.TryGetSourceId(previous.Data);
        var currentSourceId = ResumeOriginalLifecycle.TryGetSourceId(data);
        // A cloud-backed imported layout is valid only when the server has the
        // matching private Drive mapping for this owner. Source IDs are opaque
        // browser values, never authority to attach an arbitrary Drive object.
        if (currentSourceId is not null && originals.RequiresCloudMapping &&
            !await originals.HasStoredOriginalAsync(userId, currentSourceId, cancellationToken))
        {
            return UnprocessableEntity(new { error = "Không tìm thấy file PDF gốc riêng tư tương ứng. Hãy nhập lại file trước khi lưu." });
        }
        var basics = data.GetProperty("basics");
        resume.Name = basics.GetProperty("name").GetString()!;
        resume.Email = basics.GetProperty("email").GetString()!;
        if (previous is null && (resume.Id == 0 || string.IsNullOrWhiteSpace(resume.Label))) resume.Label = $"CV · {resume.Name}";
        WriteDocument(resume, new StoredDocument(EngineVersion, request.TemplateId, previous?.Published ?? false, data));
        // Persist the authoritative text in the same save as the document, even while AI is offline.
        var text = LegacyResumeConverter.ToPlainText(data);
        resume.ExtractedFullText = text.Length > 30000 ? text[..30000] : text;
        resume.SearchVectorContent = text.Length > 4000 ? text[..4000] : text;
        await db.SaveChangesAsync(cancellationToken);

        if (currentSourceId is not null)
        {
            try
            {
                await originals.MarkReferencedAsync(userId, currentSourceId, cancellationToken);
            }
            catch (PrivateResumeOriginalStorageException)
            {
                // The SQL CV save is authoritative. The cleanup worker rechecks
                // references before deletion and will repair this state later.
            }
        }

        // Do not eagerly delete a replaced source here. A stale Studio tab may still
        // hold a valid document pointing at it. Once this DB commit proves no saved
        // document references the old file, start a fresh bounded retention window;
        // the server worker reclaims it only after that window expires.
        if (!string.Equals(previousSourceId, currentSourceId, StringComparison.Ordinal))
            await originals.DeferUnreferencedCleanupAsync(userId, previousSourceId, cancellationToken);

        // CV vẫn được lưu; chỉ gửi sang AiCore để lập chỉ mục khi người dùng đã đồng ý AI xử lý CV.
        var aiSync = await CvAiConsent.HasConsentAsync(db, User)
            ? await ReindexAsync(resume.EmployeeId, resume.Id, text, resume.LastUpdatedAt)
            : "consent_required";
        return Ok(new { resumeId = resume.Id, published = previous?.Published ?? false, aiSync });
    }

    [HttpPost("document/{resumeId:int}/publish"), ValidateAntiForgeryToken]
    public async Task<IActionResult> Publish(int resumeId, CancellationToken cancellationToken)
    {
        var resume = await OwnedResume(resumeId, cancellationToken);
        if (resume is null) return NotFound();
        var document = ReadDocument(resume);
        if (document is null)
        {
            if (!string.IsNullOrWhiteSpace(resume.FileUrl))
                return UnprocessableEntity(new
                {
                    error = "CV tải lên chưa được mở trong Resume Studio. Hãy chọn giữ bố cục gốc hoặc chuyển sang mẫu Studio, lưu CV rồi mới công khai.",
                    code = "resume_studio_choice_required",
                    studioUrl = $"/Resume/Studio?resumeId={resumeId}"
                });
            var (data, _) = await BuildLegacyAsync(resume, cancellationToken);
            using var parsed = JsonDocument.Parse(data.ToJsonString());
            if (!CanonicalResumeContract.IsValid(parsed.RootElement))
                return UnprocessableEntity(new { error = "CV cần bổ sung thông tin trong Resume Studio trước khi công khai." });
            document = new StoredDocument(EngineVersion, "t1", false, parsed.RootElement.Clone());
        }
        if (RequiresOcrReview(document.Data))
            return UnprocessableEntity(new
            {
                error = "Hãy xác nhận đã đối chiếu từng trang OCR với file gốc trước khi công khai.",
                code = "ocr_review_required"
            });
        WriteDocument(resume, document with { Published = true });
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { published = true, url = $"/portfolio/{resumeId}" });
    }

    [HttpPost("document/{resumeId:int}/unpublish"), ValidateAntiForgeryToken]
    public async Task<IActionResult> Unpublish(int resumeId, CancellationToken cancellationToken)
    {
        var resume = await OwnedResume(resumeId, cancellationToken);
        var document = ReadDocument(resume);
        if (resume is null || document is null) return NotFound();
        WriteDocument(resume, document with { Published = false });
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { published = false });
    }

    [AllowAnonymous, HttpGet("public/{resumeId:int}")]
    public async Task<IActionResult> PublicDocument(int resumeId, CancellationToken cancellationToken)
    {
        var document = ReadDocument(await db.Resumes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == resumeId, cancellationToken));
        return document is not { Published: true } ? NotFound() : Ok(new { document.Data, document.TemplateId });
    }

    [AllowAnonymous, HttpGet("/portfolio/{resumeId:int}")]
    public async Task<IActionResult> PublicPortfolio(int resumeId, CancellationToken cancellationToken)
    {
        var document = ReadDocument(await db.Resumes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == resumeId, cancellationToken));
        if (document is not { Published: true }) return NotFound();
        var basics = document.Data.GetProperty("basics");
        var name = basics.GetProperty("name").GetString()!;
        var headline = basics.GetProperty("headline").GetString()!;
        var summary = Regex.Replace(basics.GetProperty("summary").GetString()!, @"[#*_`>\[\]]", "");
        var title = HtmlEncoder.Default.Encode($"{name} — {headline}");
        var description = HtmlEncoder.Default.Encode(summary.Length > 160 ? summary[..160] : summary);
        var siteUrl = HtmlEncoder.Default.Encode($"{Request.Scheme}://{Request.Host}/portfolio/{resumeId}");
        var image = basics.TryGetProperty("avatarUrl", out var avatar) && SafeWebUrl(avatar.GetString())
            ? $"<meta property=\"og:image\" content=\"{HtmlEncoder.Default.Encode(avatar.GetString()!)}\">" : "";
        return Content($"""
            <!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>{title}</title><meta name="description" content="{description}"><meta property="og:type" content="profile">
            <meta property="og:title" content="{title}"><meta property="og:description" content="{description}">
            <meta property="og:url" content="{siteUrl}">{image}<link rel="canonical" href="{siteUrl}">
            <link rel="stylesheet" href="/resume-engine/utilities.css"><link rel="stylesheet" href="/resume-engine/app.css"></head><body><div id="root"></div>
            <noscript><h1>{HtmlEncoder.Default.Encode(name)}</h1><p>{HtmlEncoder.Default.Encode(headline)}</p><p>{description}</p></noscript>
            <script type="module" src="/resume-engine/app.js"></script></body></html>
            """, "text/html; charset=utf-8");
    }

    // mode=template gửi CV sang OpenAI nên cần đồng ý AI; mode=layout xử lý trên parser, không dùng AI.
    [HttpPost("parse"), ValidateAntiForgeryToken, RequestSizeLimit(10 * 1024 * 1024 + 64 * 1024)]
    [RequireCvAiConsent(onlyWhenModeIs: "template")]
    public async Task<IActionResult> Parse(IFormFile file, CancellationToken cancellationToken, [FromForm] string mode = "layout")
    {
        if (await ValidateImportMode(mode, allowTemplate: true, cancellationToken: cancellationToken) is { } invalidMode) return invalidMode;
        if (file.Length == 0) return BadRequest(new { error = "Tệp trống." });
        if (file.Length > 10 * 1024 * 1024) return StatusCode(413, new { error = "Tệp vượt quá 10 MB." });
        var service = configuration["ResumeEngine:ParserUrl"] ?? "http://127.0.0.1:8765";
        using var client = clients.CreateClient();
        client.Timeout = TimeSpan.FromMinutes(3);
        using var form = new MultipartFormDataContent();
        await using var stream = file.OpenReadStream();
        using var body = new StreamContent(stream);
        body.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");
        form.Add(body, "file", Path.GetFileName(file.FileName));
        form.Add(new StringContent(mode), "mode");
        try
        {
            using var response = await client.PostAsync($"{service.TrimEnd('/')}/api/resume-engine/parse", form, cancellationToken);
            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                using var parsed = JsonDocument.Parse(json);
                if (parsed.RootElement.ValueKind != JsonValueKind.Object ||
                    !parsed.RootElement.TryGetProperty("data", out var data) || !CanonicalResumeContract.IsValid(data))
                    return UnprocessableEntity(new { error = "Nội dung cần bổ sung thông tin trước khi nhập.", draft = parsed.RootElement.Clone() });
                if (data.TryGetProperty("importedLayout", out _))
                {
                    if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) || userId <= 0) return Unauthorized();
                    var sourceId = Guid.NewGuid().ToString("N");
                    var payload = System.Text.Json.Nodes.JsonNode.Parse(json)!;
                    payload["data"]!["importedLayout"]!["sourceId"] = sourceId;
                    if (!await originals.StoreAsync(userId, sourceId, file, cancellationToken))
                        return StatusCode(503, new { error = "Chưa thể lưu an toàn file PDF gốc trên kho riêng tư. File chưa được nhập vào Studio." });
                    json = payload.ToJsonString();
                }
            }
            return new ContentResult { StatusCode = (int)response.StatusCode, ContentType = "application/json", Content = json };
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        { return StatusCode(504, new { error = "Dịch vụ phân tích mất quá nhiều thời gian. Hãy thử lại." }); }
        catch (HttpRequestException)
        { return StatusCode(503, new { error = "Dịch vụ phân tích CV chưa chạy." }); }
        catch (JsonException)
        { return StatusCode(502, new { error = "Dịch vụ phân tích trả dữ liệu không hợp lệ." }); }
        catch (PrivateResumeOriginalStorageException)
        { return StatusCode(503, new { error = "Kho lưu file PDF riêng tư hiện chưa sẵn sàng. Hãy thử lại sau." }); }
    }

    // Trợ lý CV trong Studio: gửi nội dung đang soạn (chưa cần lưu) cho AiCore /api/v2/skills/cv-coach —
    // kỹ năng nhận ra, hướng nghề hợp với CV, và kỹ năng còn thiếu cho vị trí muốn ứng tuyển.
    [HttpPost("coach"), ValidateAntiForgeryToken, RequestSizeLimit(12 * 1024 * 1024)]
    [RequireCvAiConsent]
    public async Task<IActionResult> Coach([FromBody] CoachRequest request, CancellationToken cancellationToken)
    {
        if (!CanonicalResumeContract.IsValid(request.Data))
            return BadRequest(new { error = "Dữ liệu CV không đúng CanonicalResumeSchema." });
        var target = (request.Target ?? "").Trim();
        if (target.Length > CoachTargetMaxLength)
            return BadRequest(new { error = $"Vị trí mục tiêu tối đa {CoachTargetMaxLength} ký tự." });
        var text = LegacyResumeConverter.ToPlainText(request.Data);
        if (text.Length < 20)
            return Ok(new CoachResponse("empty", Array.Empty<string>(), Array.Empty<CoachRole>(), null, false, "indexed_skill_graph"));
        using var client = clients.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(20);
        try
        {
            using var response = await client.PostAsJsonAsync($"{AiCoreBase}/api/v2/skills/cv-coach",
                new { cv_text = text.Length > 30000 ? text[..30000] : text, target, limit = 8 }, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return StatusCode(502, new { error = "Trợ lý CV tạm thời không phản hồi." });
            if (response.Content.Headers.ContentLength is > CoachResponseMaxCharacters)
                return StatusCode(502, new { error = "Trợ lý CV trả quá nhiều dữ liệu." });
            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            if (json.Length > CoachResponseMaxCharacters || !TryNormalizeCoachResponse(json, target, out var result))
                return StatusCode(502, new { error = "Trợ lý CV trả dữ liệu không hợp lệ." });
            return Ok(result);
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException && !cancellationToken.IsCancellationRequested)
        { return StatusCode(503, new { error = "Không kết nối được dịch vụ AI." }); }
        catch (JsonException)
        { return StatusCode(502, new { error = "Trợ lý CV trả dữ liệu không hợp lệ." }); }
    }

    private static bool TryNormalizeCoachResponse(string json, string requestedTarget, out CoachResponse? result)
    {
        result = null;
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object ||
            !root.TryGetProperty("status", out var status) || status.ValueKind != JsonValueKind.String ||
            !string.Equals(status.GetString(), "success", StringComparison.OrdinalIgnoreCase))
            return false;

        var cvSkills = ReadCoachStrings(root, "cv_skills", CoachMaxCvSkills, CoachMaxSkillLength);
        var cvSkillSet = new HashSet<string>(cvSkills, StringComparer.OrdinalIgnoreCase);
        var roles = ReadCoachRoles(root, cvSkillSet);
        CoachTarget? target = null;
        if (requestedTarget.Length > 0)
        {
            if (!TryGetObject(root, "target", out var rawTarget) || !TryReadCoachTarget(rawTarget, requestedTarget, cvSkillSet, out target))
                return false;
        }

        result = new CoachResponse(
            "success",
            cvSkills,
            roles,
            target,
            root.TryGetProperty("titles_indexed", out var titlesIndexed) && titlesIndexed.ValueKind == JsonValueKind.True,
            "indexed_skill_graph");
        return true;
    }

    private static IReadOnlyList<CoachRole> ReadCoachRoles(JsonElement root, HashSet<string> cvSkillSet)
    {
        if (!root.TryGetProperty("roles", out var rawRoles) || rawRoles.ValueKind != JsonValueKind.Array)
            return Array.Empty<CoachRole>();
        var values = new List<CoachRole>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var rawRole in rawRoles.EnumerateArray())
        {
            if (values.Count >= CoachMaxRoles || rawRole.ValueKind != JsonValueKind.Object) break;
            var title = ReadCoachString(rawRole, "title", CoachMaxRoleTitleLength);
            if (title is null || !seen.Add(title)) continue;
            var matched = ReadCoachStrings(rawRole, "matched", 5, CoachMaxSkillLength)
                .Where(cvSkillSet.Contains).ToArray();
            var missing = ReadCoachStrings(rawRole, "missing", 4, CoachMaxSkillLength)
                .Where(skill => !cvSkillSet.Contains(skill)).ToArray();
            values.Add(new CoachRole(
                title,
                ReadCoachInt(rawRole, "postings", 0, CoachMaxPostings),
                ReadCoachInt(rawRole, "coverage", 0, 100),
                matched,
                missing));
        }
        return values;
    }

    private static bool TryReadCoachTarget(JsonElement rawTarget, string requestedTarget, HashSet<string> cvSkillSet, out CoachTarget? target)
    {
        target = null;
        if (!TryGetObject(rawTarget, "plan", out var rawPlan)) return false;
        var skills = new List<CoachTargetSkill>();
        var seenSkills = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (rawTarget.TryGetProperty("skills", out var rawSkills) && rawSkills.ValueKind == JsonValueKind.Array)
        {
            foreach (var rawSkill in rawSkills.EnumerateArray())
            {
                if (skills.Count >= CoachMaxTargetSkills || rawSkill.ValueKind != JsonValueKind.Object) break;
                var skill = ReadCoachString(rawSkill, "skill", CoachMaxSkillLength);
                if (skill is null || !seenSkills.Add(skill)) continue;
                skills.Add(new CoachTargetSkill(
                    skill,
                    ReadCoachShare(rawSkill, "share"),
                    ReadCoachInt(rawSkill, "postings", 0, CoachMaxPostings),
                    cvSkillSet.Contains(skill)));
            }
        }

        var coverage = TryGetObject(rawPlan, "coverage", out var rawCoverage)
            ? new CoachCoverage(ReadCoachNullableInt(rawCoverage, "now", 0, 100), ReadCoachNullableInt(rawCoverage, "after_stage1", 0, 100))
            : new CoachCoverage(null, null);
        var steps = ReadCoachPlanSteps(rawPlan);
        var plan = new CoachPlan(
            coverage,
            steps,
            ReadCoachInt(rawPlan, "total_steps", 0, CoachMaxPostings),
            ReadCoachStrings(rawPlan, "soft_skills", 12, CoachMaxSkillLength),
            ReadCoachStrings(rawPlan, "matched", CoachMaxCvSkills, CoachMaxSkillLength).Where(cvSkillSet.Contains).ToArray());
        target = new CoachTarget(
            requestedTarget,
            ReadCoachInt(rawTarget, "postings", 0, CoachMaxPostings),
            skills,
            ReadCoachStrings(rawTarget, "sample_titles", 5, CoachMaxSampleTitleLength),
            plan);
        return true;
    }

    private static IReadOnlyList<CoachPlanStep> ReadCoachPlanSteps(JsonElement rawPlan)
    {
        if (!rawPlan.TryGetProperty("steps", out var rawSteps) || rawSteps.ValueKind != JsonValueKind.Array)
            return Array.Empty<CoachPlanStep>();
        var values = new List<CoachPlanStep>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var rawStep in rawSteps.EnumerateArray())
        {
            if (values.Count >= CoachMaxPlanSteps || rawStep.ValueKind != JsonValueKind.Object) break;
            var skill = ReadCoachString(rawStep, "skill", CoachMaxSkillLength);
            // A malformed stage must not be silently repaired into a valid one: otherwise a
            // service response such as stage=4 becomes the trusted final stage (3).
            if (!rawStep.TryGetProperty("stage", out var rawStage) || rawStage.ValueKind != JsonValueKind.Number ||
                !rawStage.TryGetInt32(out var stage) || stage is < 1 or > 3 || skill is null || !seen.Add(skill)) continue;
            values.Add(new CoachPlanStep(
                skill,
                stage,
                ReadCoachString(rawStep, "stage_label", CoachMaxStageLabelLength) ?? "",
                ReadCoachStrings(rawStep, "related_to", 6, CoachMaxSkillLength),
                ReadCoachStrings(rawStep, "after", 6, CoachMaxSkillLength),
                ReadCoachInt(rawStep, "active_postings", 0, CoachMaxPostings),
                ReadCoachInt(rawStep, "opens", 0, CoachMaxPostings)));
        }
        return values;
    }

    private static bool TryGetObject(JsonElement source, string name, out JsonElement value)
    {
        if (source.TryGetProperty(name, out value) && value.ValueKind == JsonValueKind.Object) return true;
        value = default;
        return false;
    }

    private static string? ReadCoachString(JsonElement source, string name, int maxLength)
    {
        if (!source.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String) return null;
        var text = value.GetString()?.Trim();
        return string.IsNullOrWhiteSpace(text) || text.Length > maxLength || text.Any(char.IsControl) ? null : text;
    }

    private static IReadOnlyList<string> ReadCoachStrings(JsonElement source, string name, int maxItems, int maxLength)
    {
        if (!source.TryGetProperty(name, out var rawValues) || rawValues.ValueKind != JsonValueKind.Array)
            return Array.Empty<string>();
        var values = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var rawValue in rawValues.EnumerateArray())
        {
            if (values.Count >= maxItems || rawValue.ValueKind != JsonValueKind.String) break;
            var value = rawValue.GetString()?.Trim();
            if (string.IsNullOrWhiteSpace(value) || value.Length > maxLength || value.Any(char.IsControl) || !seen.Add(value)) continue;
            values.Add(value);
        }
        return values;
    }

    private static int ReadCoachInt(JsonElement source, string name, int minimum, int maximum) =>
        source.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number)
            ? Math.Clamp(number, minimum, maximum) : 0;

    private static int? ReadCoachNullableInt(JsonElement source, string name, int minimum, int maximum) =>
        source.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number)
            ? Math.Clamp(number, minimum, maximum) : null;

    private static double ReadCoachShare(JsonElement source, string name) =>
        source.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var share) && double.IsFinite(share)
            ? Math.Clamp(share, 0, 1) : 0;

    private string AiCoreBase => (configuration["AiCore:BaseUrl"] ?? "http://localhost:8001").TrimEnd('/');

    private async Task<IActionResult?> ValidateImportMode(string? mode, bool allowTemplate, CancellationToken cancellationToken)
    {
        var known = mode == LayoutImportMode || mode == OcrLayoutImportMode || allowTemplate && mode == TemplateImportMode;
        if (!known) return BadRequest(new { error = "Chế độ nhập CV không hợp lệ.", code = "invalid_import_mode" });
        if (mode == OcrLayoutImportMode)
        {
            var capabilities = await GetParserCapabilities(cancellationToken);
            if (capabilities.LayoutOcr) return null;
            return StatusCode(503, new
            {
                error = "OCR giữ bố cục chưa sẵn sàng trên máy chủ này. File gốc chưa bị thay đổi.",
                code = "ocr_unavailable",
                reason = capabilities.LayoutOcrReason,
                actions = new[]
                {
                    new { id = "use-layout", label = "Giữ bố cục PDF có lớp chữ" },
                    new { id = "use-template", label = "Chuyển sang mẫu Studio mới" }
                }
            });
        }
        return null;
    }

    private async Task<ParserCapabilities> GetParserCapabilities(CancellationToken cancellationToken)
    {
        var service = (configuration["ResumeEngine:ParserUrl"] ?? "http://127.0.0.1:8765").TrimEnd('/');
        try
        {
            using var client = clients.CreateClient();
            // The parser performs a lightweight isolated-runtime preflight for OCR;
            // allow it a little longer than an ordinary loopback GET without making
            // document import wait on this capability probe.
            client.Timeout = TimeSpan.FromSeconds(5);
            using var response = await client.GetAsync($"{service}/api/resume-engine/capabilities", cancellationToken);
            if (!response.IsSuccessStatusCode) return new(false, "ocr_service_unavailable");
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            var root = document.RootElement;
            var enabled = root.TryGetProperty("layoutOcr", out var layoutOcr) && layoutOcr.ValueKind == JsonValueKind.True;
            var reason = root.TryGetProperty("layoutOcrReason", out var layoutOcrReason) && layoutOcrReason.ValueKind == JsonValueKind.String
                ? layoutOcrReason.GetString() : enabled ? null : "ocr_unavailable";
            return new(enabled, reason);
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or JsonException)
        { return new(false, "ocr_service_unavailable"); }
    }

    [HttpGet("original/{sourceId}")]
    public async Task<IActionResult> Original(string sourceId, CancellationToken cancellationToken)
    {
        if (!ResumeOriginalLifecycle.IsValidSourceId(sourceId) ||
            !int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) || userId <= 0)
            return NotFound();

        try
        {
            var original = await originals.OpenAsync(userId, sourceId, cancellationToken);
            if (original is null) return NotFound();
            var result = File(original.Content, original.ContentType, original.DownloadName);
            result.EnableRangeProcessing = true;
            return result;
        }
        catch (PrivateResumeOriginalStorageException)
        {
            return StatusCode(503, new { error = "Chưa thể mở file PDF gốc từ kho riêng tư." });
        }
    }

    // Parsing must retain an original long enough for the owner to compare it in
    // Studio. If that unsaved import is explicitly abandoned, remove only the
    // owner's exact file after proving no persisted Studio document references it.
    [HttpPost("original/{sourceId}/discard"), ValidateAntiForgeryToken]
    public async Task<IActionResult> DiscardOriginal(string sourceId, CancellationToken cancellationToken)
    {
        if (!ResumeOriginalLifecycle.IsValidSourceId(sourceId) ||
            !int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) || userId <= 0)
            return NotFound();

        return await originals.DeleteIfUnreferencedAsync(userId, sourceId, cancellationToken) switch
        {
            ResumeOriginalDeleteResult.Deleted or ResumeOriginalDeleteResult.Missing => NoContent(),
            ResumeOriginalDeleteResult.Referenced => Conflict(new { error = "File gốc đang được một CV đã lưu sử dụng nên không thể bỏ." }),
            ResumeOriginalDeleteResult.Failed => StatusCode(409, new { error = "Chưa thể xóa file PDF gốc khỏi kho riêng tư." }),
            _ => NotFound()
        };
    }

    [HttpPost("document/{resumeId:int}/import-layout"), ValidateAntiForgeryToken]
    public async Task<IActionResult> ImportLayout(int resumeId, CancellationToken cancellationToken, [FromForm] string mode = LayoutImportMode)
    {
        if (await ValidateImportMode(mode, allowTemplate: false, cancellationToken: cancellationToken) is { } invalidMode) return invalidMode;
        var resume = await OwnedResume(resumeId, cancellationToken);
        if (resume is null) return NotFound();
        var current = ReadDocument(resume);
        if (current?.Data.TryGetProperty("importedLayout", out _) == true)
            return Ok(new { data = current.Data, current.TemplateId, current.Published, resumeId });
        // Only fetch known CV storage, never arbitrary URLs supplied by an import request.
        if (!Uri.TryCreate(resume.FileUrl, UriKind.Absolute, out var stored) || !string.IsNullOrEmpty(stored.UserInfo))
            return UnprocessableEntity(new { error = "Không có file gốc truy cập được. Hãy nhập lại PDF gốc bằng nút Giữ bố cục." });
        var ai = new Uri(AiCoreBase);
        var local = stored.Scheme == ai.Scheme && stored.Authority == ai.Authority && stored.AbsolutePath.StartsWith("/storage/cv-folder/", StringComparison.Ordinal);
        var remote = stored.Scheme == Uri.UriSchemeHttps && stored.IsDefaultPort &&
                     string.Equals(stored.Host, "storage.quandang.site", StringComparison.OrdinalIgnoreCase) &&
                     stored.AbsolutePath.StartsWith("/cv-folder/", StringComparison.Ordinal);
        if (!local && !remote) return UnprocessableEntity(new { error = "Nguồn file gốc chưa hỗ trợ nhập trực tiếp. Hãy tải file về và nhập PDF gốc." });
        try
        {
            using var client = clients.CreateClient(OriginalFetchClientName);
            client.Timeout = TimeSpan.FromSeconds(30);
            var target = stored;
            if (remote)
            {
                var key = Uri.UnescapeDataString(stored.AbsolutePath["/cv-folder/".Length..]);
                using var signed = await client.GetAsync($"{AiCoreBase}/media-refresh-url?bucket=cv-folder&object_name={Uri.EscapeDataString(key)}", cancellationToken);
                if (!signed.IsSuccessStatusCode) return StatusCode(502, new { error = "Chưa lấy được file gốc. Hãy thử lại hoặc nhập PDF gốc." });
                using var info = JsonDocument.Parse(await signed.Content.ReadAsStringAsync(cancellationToken));
                if (!info.RootElement.TryGetProperty("url", out var url) || !Uri.TryCreate(url.GetString(), UriKind.Absolute, out target) ||
                    target.Scheme != Uri.UriSchemeHttps || !target.IsDefaultPort || !string.IsNullOrEmpty(target.UserInfo) ||
                    !string.Equals(target.Host, stored.Host, StringComparison.OrdinalIgnoreCase) ||
                    !target.AbsolutePath.StartsWith("/cv-folder/", StringComparison.Ordinal))
                    return StatusCode(502, new { error = "Đường dẫn file gốc không hợp lệ." });
            }
            using var response = await client.GetAsync(target, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode) return StatusCode(502, new { error = "Không tải được file CV gốc." });
            if (response.Content.Headers.ContentLength > 10 * 1024 * 1024) return StatusCode(413);
            await using var source = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var buffer = new MemoryStream();
            var chunk = new byte[65536];
            int read;
            while ((read = await source.ReadAsync(chunk, cancellationToken)) > 0)
            {
                if (buffer.Length + read > 10 * 1024 * 1024) return StatusCode(413);
                await buffer.WriteAsync(chunk.AsMemory(0, read), cancellationToken);
            }
            buffer.Position = 0;
            var file = new FormFile(buffer, 0, buffer.Length, "file", "CV-original.pdf");
            return await Parse(file, cancellationToken, mode);
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or OperationCanceledException)
        { return StatusCode(503, new { error = "Không kết nối được kho CV gốc. Hãy nhập lại PDF từ máy của bạn." }); }
    }

    // Chuyển CV cũ sang mẫu Studio gọi AiCore /cv/structure (AI) nên cần đồng ý AI xử lý CV.
    [HttpPost("document/{resumeId:int}/import-template"), ValidateAntiForgeryToken]
    [RequireCvAiConsent]
    public async Task<IActionResult> ImportTemplate(int resumeId, CancellationToken cancellationToken)
    {
        var resume = await OwnedResume(resumeId, cancellationToken);
        if (resume is null) return NotFound();
        var current = ReadDocument(resume);
        if (current is not null)
            return Ok(new { data = current.Data, current.TemplateId, current.Published, resumeId });
        var (data, source) = await BuildLegacyAsync(resume, cancellationToken, includeAiStructure: true);
        return Ok(new { data, templateId = "t1", published = false, resumeId, imported = true, importSource = source });
    }

    private async Task<(System.Text.Json.Nodes.JsonObject Data, string Source)> BuildLegacyAsync(Resume resume, CancellationToken cancellationToken, bool includeAiStructure = true)
    {
        await db.Entry(resume).Collection(r => r.Skills).LoadAsync(cancellationToken);
        await db.Entry(resume).Collection(r => r.Experiences).LoadAsync(cancellationToken);
        await db.Entry(resume).Collection(r => r.Educations).LoadAsync(cancellationToken);
        var profile = await db.Profiles.FirstOrDefaultAsync(p => p.Id == resume.EmployeeId, cancellationToken);
        var email = profile is null ? null : await db.Users.Where(u => u.Id == profile.UserId).Select(u => u.Email).FirstOrDefaultAsync(cancellationToken);

        JsonElement? structure = null, links = null;
        var source = string.IsNullOrWhiteSpace(resume.BuilderDataJson) ? "basic" : "builder";
        if (includeAiStructure && (resume.ExtractedFullText ?? "").Trim().Length >= 50)
        {
            try
            {
                using var client = clients.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(100);
                using var response = await client.PostAsJsonAsync($"{AiCoreBase}/api/v2/cv/structure",
                    new { employee_id = resume.EmployeeId, resume_id = resume.Id }, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                    if (doc.RootElement.TryGetProperty("structure", out var st) && st.ValueKind == JsonValueKind.Object)
                    {
                        structure = st.Clone();
                        if (doc.RootElement.TryGetProperty("links", out var l)) links = l.Clone();
                        source = "ai";
                    }
                }
            }
            catch (Exception exception) when (exception is HttpRequestException or JsonException or OperationCanceledException && !cancellationToken.IsCancellationRequested) { }
        }
        var data = LegacyResumeConverter.ToCanonical(resume, profile, email, structure, links, $"{Request.Scheme}://{Request.Host}");
        return (data, source);
    }

    // Wait for acknowledgement, not embedding. A failed sync is visible and retryable by saving again.
    private async Task<string> ReindexAsync(int employeeId, int resumeId, string text, DateTime updatedAt)
    {
        var url = $"{AiCoreBase}/api/v2/cv/reindex";
        try
        {
            using var client = clients.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(8);
            using var response = await client.PostAsJsonAsync(url, new { employee_id = employeeId, resume_id = resumeId, text = text.Length > 30000 ? text[..30000] : text, revision_ms = new DateTimeOffset(DateTime.SpecifyKind(updatedAt, DateTimeKind.Utc)).ToUnixTimeMilliseconds() });
            if (!response.IsSuccessStatusCode) return "pending";
            using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return result.RootElement.TryGetProperty("status", out var status) && status.GetString() is "scheduled" or "too_short" ? status.GetString()! : "pending";
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or JsonException)
        { return "pending"; }
    }

    private async Task<Resume?> OwnedResume(int id, CancellationToken cancellationToken)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return null;
        return await db.Resumes.FirstOrDefaultAsync(x => x.Id == id && x.Account.UserId == userId, cancellationToken);
    }
    private static bool ValidTemplate(string? value) => value is not null && Regex.IsMatch(value, @"^t([1-9]|[12][0-9]|3[0-2])$");
    private static bool RequiresOcrReview(JsonElement data) =>
        data.ValueKind == JsonValueKind.Object &&
        data.TryGetProperty("importedLayout", out var layout) && layout.ValueKind == JsonValueKind.Object &&
        layout.TryGetProperty("ocrReviewRequired", out var required) && required.ValueKind == JsonValueKind.True &&
        (!layout.TryGetProperty("ocrReviewConfirmed", out var confirmed) || confirmed.ValueKind != JsonValueKind.True);
    private static JsonElement SynchronizeImportedBasics(JsonElement data)
    {
        if (data.ValueKind != JsonValueKind.Object ||
            !data.TryGetProperty("importedLayout", out var layout) || layout.ValueKind != JsonValueKind.Object ||
            !layout.TryGetProperty("pages", out var pages) || pages.ValueKind != JsonValueKind.Array)
            return data;

        var selectedNameElementId = layout.TryGetProperty("nameElementId", out var selectedIdElement) &&
                                    selectedIdElement.ValueKind == JsonValueKind.String &&
                                    selectedIdElement.GetString() is { Length: > 0 and <= 80 } selectedId
            ? selectedId
            : null;
        string? fallbackName = null;
        string? selectedName = null;
        var email = "";
        foreach (var page in pages.EnumerateArray())
        {
            if (page.ValueKind != JsonValueKind.Object ||
                !page.TryGetProperty("elements", out var elements) || elements.ValueKind != JsonValueKind.Array)
                continue;
            foreach (var element in elements.EnumerateArray())
            {
                if (element.ValueKind != JsonValueKind.Object ||
                    !element.TryGetProperty("text", out var textElement) ||
                    textElement.ValueKind != JsonValueKind.String)
                    continue;
                var text = textElement.GetString() ?? "";
                if (!string.IsNullOrWhiteSpace(text))
                {
                    if (fallbackName is null) fallbackName = text.Length > 150 ? text[..150] : text;
                    if (selectedNameElementId is not null &&
                        element.TryGetProperty("id", out var idElement) && idElement.ValueKind == JsonValueKind.String &&
                        string.Equals(idElement.GetString(), selectedNameElementId, StringComparison.Ordinal))
                        selectedName = text.Length > 150 ? text[..150] : text;
                }
                if (email.Length == 0)
                {
                    var match = ImportedEmailPattern.Match(text);
                    if (match.Success) email = match.Value;
                }
            }
        }
        var name = selectedName ?? fallbackName;
        if (name is null) return data;

        var node = JsonNode.Parse(data.GetRawText())?.AsObject();
        if (node?["basics"] is not JsonObject basics) return data;
        basics["name"] = name;
        basics["email"] = email;
        return JsonSerializer.SerializeToElement(node, JsonOptions);
    }
    private static bool SafeWebUrl(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https";
    private static StoredDocument? ReadDocument(Resume? resume)
    {
        if (string.IsNullOrWhiteSpace(resume?.BuilderDataJson)) return null;
        try
        {
            using var json = JsonDocument.Parse(resume.BuilderDataJson);
            var root = json.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return null;
            if (root.TryGetProperty("engine", out var engine) && engine.GetString() == EngineVersion)
            {
                var stored = root.Deserialize<StoredDocument>(JsonOptions);
                return stored is not null && ValidTemplate(stored.TemplateId) && CanonicalResumeContract.IsValid(stored.Data) ? stored : null;
            }
            return CanonicalResumeContract.IsValid(root)
                ? new StoredDocument(EngineVersion, "t3", resume.Category == "portfolio-public", root.Clone()) : null;
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException or ArgumentException)
        { return null; }
    }
    private static void WriteDocument(Resume resume, StoredDocument document)
    {
        resume.BuilderDataJson = JsonSerializer.Serialize(document, JsonOptions);
        if (resume.Category == "portfolio-public") resume.Category = "";
        resume.LastUpdatedAt = DateTime.UtcNow;
    }
}
