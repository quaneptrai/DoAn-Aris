using System.Net;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using ArisSkyve.Controllers;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;

var options = new DbContextOptionsBuilder<ArisDBContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
await using var db = new ArisDBContext(options);
var owner = new User { Id = 1, Username = "Example", Email = "example@example.com" };
var profile = new EmployesAccount { Id = 10, UserId = 1, User = owner, FullName = "Example" };
owner.Profile = profile;
db.Users.Add(owner); db.Profiles.Add(profile);
db.Users.Add(new User { Id = 2, Username = "Other", Email = "other@example.com" });
var legacy = new Resume { Id = 100, EmployeeId = 10, Account = profile, Name = "Example", Email = "example@example.com", Label = "My original", FileUrl = "https://storage.quandang.site/cv-folder/original.pdf", ExtractedFullText = "Previously extracted fixture content is long enough to trigger the optional AI structure path." };
var unpublishedUpload = new Resume { Id = 101, EmployeeId = 10, Account = profile, Name = "Unopened upload", Email = "upload@example.com", Label = "Unopened upload", FileUrl = "https://storage.quandang.site/cv-folder/unopened.pdf", ExtractedFullText = "A synthetic uploaded resume with enough text to request structured template conversion only after consent." };
db.Resumes.AddRange(legacy, unpublishedUpload);
await db.SaveChangesAsync();
var factory = new FixtureFactory();
var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
{
    ["AiCore:BaseUrl"] = "http://fixture-ai",
    ["ResumeEngine:OriginalRetentionHours"] = "168"
}).Build();
var defaultOriginalRoot = Path.GetFullPath(Path.Combine(".local", "resume-original-default-fixture"));
var defaultOriginals = new ResumeOriginalLifecycle(db, new WebHostEnvironmentFixture(defaultOriginalRoot), config);
ResumeEngineController Controller(int userId) {
    var controller = new ResumeEngineController(db, factory, config, new AntiforgeryFixture(), defaultOriginals);
    controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "fixture")) } };
    controller.Request.Scheme = "http"; controller.Request.Host = new HostString("localhost");
    return controller;
}
var ctl = Controller(1); var other = Controller(2);
var checks = 0;
void Check(bool condition, string label) { if (!condition) throw new Exception(label); checks++; Console.WriteLine($"PASS {label}"); }
JsonElement Json(IActionResult action) => JsonSerializer.SerializeToElement(((ObjectResult)action).Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
JsonElement Document(JsonNode node) => JsonSerializer.SerializeToElement(node);
IFormFile ImportFixture() { var stream = new MemoryStream([0x25, 0x50, 0x44, 0x46]); return new FormFile(stream, 0, stream.Length, "file", "fixture.pdf"); }
var ct = CancellationToken.None;

var invalidImportMode = await ctl.Parse(ImportFixture(), ct, "invalid");
Check(invalidImportMode is BadRequestObjectResult && Json(invalidImportMode).GetProperty("code").GetString() == "invalid_import_mode", "Parser rejects an unknown import mode before accepting a file");
var ocrUnavailable = await ctl.Parse(ImportFixture(), ct, "layout-ocr");
Check(ocrUnavailable is ObjectResult { StatusCode: 503 } && Json(ocrUnavailable).GetProperty("code").GetString() == "ocr_unavailable", "OCR mode is capability-gated before parser processing");
Check(!Json(await ctl.Capabilities(ct)).GetProperty("layoutOcr").GetBoolean(), "Studio capability endpoint reports OCR unavailable when parser has not enabled it");
Check(Json(await ctl.Capabilities(ct)).GetProperty("originalRetentionHours").GetInt32() == ResumeOriginalLifecycle.DefaultRetentionHours, "Studio capability endpoint exposes the seven-day original retention window");
var legacyOcrUnavailable = await ctl.ImportLayout(101, ct, "layout-ocr");
Check(legacyOcrUnavailable is ObjectResult { StatusCode: 503 } && Json(legacyOcrUnavailable).GetProperty("code").GetString() == "ocr_unavailable", "Legacy OCR is gated before the original file is fetched");

var first = Json(await ctl.GetDocument(100, ct));
Check(first.GetProperty("imported").GetBoolean(), "Legacy CV opens a Studio draft");
Check(first.GetProperty("hasOriginalFile").GetBoolean(), "Uploaded CV offers explicit layout choice");
Check(factory.StructureCalls == 0, "Uploaded CV defers AI structuring until the user chooses a Studio mode");
Check(db.Resumes.Count() == 2 && legacy.BuilderDataJson == null, "Opening legacy CV never overwrites original or creates duplicates");
var unopenedPublish = await ctl.Publish(101, ct);
Check(unopenedPublish is UnprocessableEntityObjectResult && Json(unopenedPublish).GetProperty("code").GetString() == "resume_studio_choice_required" && unpublishedUpload.BuilderDataJson == null, "Unopened uploaded CV cannot publish through a silent template conversion");
Check(Json(await ctl.ImportTemplate(101, ct)).GetProperty("imported").GetBoolean() && factory.StructureCalls == 1 && unpublishedUpload.BuilderDataJson == null, "Template conversion requests AI structure only after explicit choice");
Check(await ctl.ImportLayout(101, ct) is ObjectResult { StatusCode: 502 } && factory.LastClientName == "resume-original-fetch", "Original PDF retrieval uses the no-redirect client");
Check(await other.GetDocument(100, ct) is NotFoundResult, "Foreign user cannot read document");
Check(await ctl.PublicDocument(100, ct) is NotFoundResult, "Private legacy document is not public");
var canonical = JsonNode.Parse(first.GetProperty("data").GetRawText())!;
canonical["basics"]!["summary"] = "Built reliable Python SQL services and reduced query latency by thirty percent.";
Check(CanonicalResumeContract.IsValid(Document(canonical)), "Converted canonical document validates");
var savedWithoutConsent = Json(await ctl.SaveDocument(new(100, Document(canonical), "t2"), ct));
Check(savedWithoutConsent.GetProperty("aiSync").GetString() == "consent_required" && legacy.ExtractedFullText!.Contains("Python SQL") && !(factory.LastBody ?? "").Contains("revision_ms"),
    "Save without AI consent keeps the CV text but never sends it to AI indexing");
owner.CvAiConsentAt = DateTime.UtcNow;
await db.SaveChangesAsync();
var saved = Json(await ctl.SaveDocument(new(100, Document(canonical), "t2"), ct));
Check(saved.GetProperty("aiSync").GetString() == "scheduled", "Save awaits AI acknowledgement");
Check(legacy.ExtractedFullText!.Contains("Python SQL"), "SQL text updates together with Studio document");
Check(factory.LastBody!.Contains("revision_ms"), "AI sync carries saved revision to reject stale requests");
Check(legacy.FileUrl!.Contains("original.pdf") && legacy.Label == "My original", "Saving preserves original file and user label");
await ctl.SaveDocument(new(100, Document(canonical), "t2"), ct);
Check(db.Resumes.Count(x => x.Id == 100) == 1, "Repeated conversion/save is idempotent");

var coachCallsBeforeInvalid = factory.CoachCalls;
Check(await ctl.Coach(new(Document(new JsonObject()), "Backend Developer"), ct) is BadRequestObjectResult && factory.CoachCalls == coachCallsBeforeInvalid,
    "Coach rejects malformed CanonicalResume data before calling AiCore");
Check(await ctl.Coach(new(Document(canonical), new string('x', 121)), ct) is BadRequestObjectResult && factory.CoachCalls == coachCallsBeforeInvalid,
    "Coach bounds an overlong target before calling AiCore");
factory.CoachResponse = """
    {
      "status":"success",
      "cv_skills":["Python","SQL","Python"],
      "roles":[{"title":"Data Engineer","postings":2,"coverage":80,"matched":["Python","Invented"],"missing":["SQL","Docker"]}],
      "target":{
        "query":"untrusted target",
        "postings":2,
        "skills":[{"skill":"Python","share":1.5,"postings":2,"have":false},{"skill":"Docker","share":-1,"postings":-4,"have":true}],
        "sample_titles":["Data Engineer"],
        "plan":{"coverage":{"now":150,"after_stage1":-2},"steps":[{"skill":"Docker","stage":1,"stage_label":"Start","related_to":["Python"],"after":[],"active_postings":1,"opens":1},{"skill":"Invalid","stage":4,"stage_label":"Ignore","related_to":[],"after":[],"active_postings":1,"opens":1}],"total_steps":2,"soft_skills":["Teamwork"],"matched":["Python","Invented"]}
      },
      "titles_indexed":true,
      "unexpected":"must not be proxied"
    }
    """;
var coach = Json(await ctl.Coach(new(Document(canonical), "  Data Engineer  "), ct));
Check(factory.CoachCalls == coachCallsBeforeInvalid + 1 && factory.LastRequestPath == "/api/v2/skills/cv-coach", "Coach calls only the expected AiCore endpoint");
using (var sentCoach = JsonDocument.Parse(factory.LastBody!))
    Check(sentCoach.RootElement.GetProperty("target").GetString() == "Data Engineer" && sentCoach.RootElement.GetProperty("limit").GetInt32() == 8,
        "Coach sends a trimmed bounded target and fixed plan limit");
Check(coach.GetProperty("marketDataScope").GetString() == "indexed_skill_graph" && !coach.TryGetProperty("unexpected", out _),
    "Coach returns only its normalized response contract and declares graph scope");
Check(coach.GetProperty("cv_skills").GetArrayLength() == 2 && coach.GetProperty("roles")[0].GetProperty("matched").GetArrayLength() == 1 && coach.GetProperty("roles")[0].GetProperty("missing")[0].GetString() == "Docker",
    "Coach keeps role evidence consistent with recognized CV skills");
var coachTarget = coach.GetProperty("target");
Check(coachTarget.GetProperty("query").GetString() == "Data Engineer" && coachTarget.GetProperty("skills")[0].GetProperty("have").GetBoolean() && !coachTarget.GetProperty("skills")[1].GetProperty("have").GetBoolean(),
    "Coach derives market-skill possession from CV evidence instead of trusting AiCore flags");
Check(coachTarget.GetProperty("skills")[0].GetProperty("share").GetDouble() == 1 && coachTarget.GetProperty("skills")[1].GetProperty("postings").GetInt32() == 0,
    "Coach bounds target-skill numerical fields");
Check(coachTarget.GetProperty("plan").GetProperty("coverage").GetProperty("now").GetInt32() == 100 && coachTarget.GetProperty("plan").GetProperty("steps").GetArrayLength() == 1,
    "Coach bounds coverage and removes invalid plan steps");
factory.CoachResponse = "[]";
Check(await ctl.Coach(new(Document(canonical), "Data Engineer"), ct) is ObjectResult { StatusCode: 502 }, "Coach rejects an invalid AiCore response instead of proxying it");
Check(Json(await ctl.GetDocument(100, ct)).GetProperty("templateId").GetString() == "t2", "Reload preserves saved template");

Check(await other.SaveDocument(new(100, Document(canonical)), ct) is NotFoundResult, "Foreign user cannot edit");
Check(await other.Publish(100, ct) is NotFoundResult, "Foreign user cannot publish");
Check(await other.Unpublish(100, ct) is NotFoundResult, "Foreign user cannot unpublish");
Check(await ctl.SaveDocument(new(100, JsonSerializer.SerializeToElement(new { broken = true })), ct) is BadRequestObjectResult, "Invalid document rejected");
Check(await ctl.SaveDocument(new(100, Document(canonical), "unknown"), ct) is BadRequestObjectResult, "Invalid template rejected");
await ctl.Publish(100, ct);
Check(CanonicalResumeContract.IsPublished(legacy.BuilderDataJson), "Published badge uses persisted publication state");
Check(await ctl.PublicPortfolio(100, ct) is ContentResult, "Public portfolio HTML is available after publish");
canonical["basics"]!["summary"] = "Updated content for public site";
await ctl.SaveDocument(new(100, Document(canonical), "t2"), ct);
Check(Json(await ctl.PublicDocument(100, ct)).GetProperty("data").GetProperty("basics").GetProperty("summary").GetString() == "Updated content for public site", "Public site reflects latest saved content");
await ctl.Unpublish(100, ct);
Check(await ctl.PublicDocument(100, ct) is NotFoundResult && await ctl.PublicPortfolio(100, ct) is NotFoundResult, "Unpublish revokes JSON and HTML access");

factory.Status = HttpStatusCode.ServiceUnavailable;
canonical["basics"]!["summary"] = "Saved while AI is offline";
var offline = Json(await ctl.SaveDocument(new(100, Document(canonical)), ct));
Check(offline.GetProperty("aiSync").GetString() == "pending" && legacy.ExtractedFullText!.Contains("offline"), "AI outage preserves save and exposes retry status");
factory.Status = HttpStatusCode.OK;
factory.Throw = true;
Check(Json(await ctl.SaveDocument(new(100, Document(canonical)), ct)).GetProperty("aiSync").GetString() == "pending", "Network error remains a successful document save with pending AI");
factory.Throw = false;

var fixture = Path.GetFullPath(".local/cv-layout-fixture.json");
if (!File.Exists(fixture)) throw new Exception("Generate the layout fixture before running this test.");
var layoutData = JsonNode.Parse(await File.ReadAllTextAsync(fixture))!["data"]!;
var firstElement = layoutData["importedLayout"]!["pages"]![0]!["elements"]![0]!;
firstElement["text"] = "CURRICULUM VITAE";
var selectedNameElement = layoutData["importedLayout"]!["pages"]![0]!["elements"]![2]!;
selectedNameElement["text"] = "Selected Applicant Name";
layoutData["importedLayout"]!["nameElementId"] = selectedNameElement["id"]!.GetValue<string>();
var layoutEmailChanged = false;
foreach (var page in layoutData["importedLayout"]!["pages"]!.AsArray())
{
    foreach (var element in page!["elements"]!.AsArray())
    {
        if (element?["text"]?.GetValue<string>()?.Contains('@') != true) continue;
        element["text"] = "edited@example.com";
        layoutEmailChanged = true;
        break;
    }
    if (layoutEmailChanged) break;
}
Check(layoutEmailChanged, "Layout fixture exposes an editable email overlay");
layoutData["importedLayout"]!["ocrReviewRequired"] = true;
layoutData["importedLayout"]!["ocrReviewConfirmed"] = false;
var pendingOcrSave = await ctl.SaveDocument(new(100, Document(layoutData)), ct);
Check(pendingOcrSave is UnprocessableEntityObjectResult && Json(pendingOcrSave).GetProperty("code").GetString() == "ocr_review_required", "OCR layout cannot save before the original-file review is confirmed");
layoutData["importedLayout"]!["ocrReviewConfirmed"] = true;
var positionsBefore = layoutData["importedLayout"]!.ToJsonString();
await ctl.SaveDocument(new(100, Document(layoutData)), ct);
var reload = Json(await ctl.GetDocument(100, ct)).GetProperty("data");
Check(JsonNode.DeepEquals(JsonNode.Parse(reload.GetProperty("importedLayout").GetRawText()), JsonNode.Parse(positionsBefore)), "Positioned layout survives save/reload with exact coordinates and background");
Check(legacy.Name == "Selected Applicant Name" && legacy.Email == "edited@example.com", "Saving a positioned-layout edit honors the owner-selected name block and updated email");
Check(reload.GetProperty("basics").GetProperty("name").GetString() == "Selected Applicant Name" && reload.GetProperty("basics").GetProperty("email").GetString() == "edited@example.com", "Saved canonical basics mirror the selected positioned identity");
var layoutText = legacy.ExtractedFullText!.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
Check(layoutText.Contains("Selected Applicant Name") && layoutText.Contains("CURRICULUM VITAE"), "AI uses the current text of the edited layout block");
await ctl.Publish(100, ct);
Check(Json(await ctl.PublicDocument(100, ct)).GetProperty("data").GetProperty("importedLayout").GetProperty("nameElementId").GetString() == selectedNameElement["id"]!.GetValue<string>(), "Sharing preserves the owner-selected name block");
var storedDocument = JsonNode.Parse(legacy.BuilderDataJson!)!;
storedDocument["data"]!["importedLayout"]!["ocrReviewConfirmed"] = false;
legacy.BuilderDataJson = storedDocument.ToJsonString();
Check(await ctl.Publish(100, ct) is UnprocessableEntityObjectResult, "OCR layout cannot be published when the review acknowledgement is missing");
layoutData["importedLayout"]!["ocrReviewConfirmed"] = true;
await ctl.SaveDocument(new(100, Document(layoutData)), ct);
Check(await other.ImportLayout(100, ct) is NotFoundResult, "Foreign user cannot import someone else's source");
Check(other.Original("../secret") is NotFoundResult, "Original route rejects path traversal");

var cleanupData = layoutData.DeepClone();
const string cleanupSourceId = "0123456789abcdef0123456789abcdef";
cleanupData!["importedLayout"]!["sourceId"] = cleanupSourceId;
string StoredLayout(JsonNode data) => JsonSerializer.Serialize(
    new { engine = "aris-resume/v1", templateId = "t1", published = false, data },
    new JsonSerializerOptions(JsonSerializerDefaults.Web));
var cleanupResume = new Resume
{
    EmployeeId = 10, Account = profile, Name = "Cleanup fixture", Email = "cleanup@example.com", Label = "Cleanup fixture",
    BuilderDataJson = StoredLayout(cleanupData)
};
db.Resumes.Add(cleanupResume);
await db.SaveChangesAsync();
var cleanupRoot = Path.GetFullPath(Path.Combine(".local", "resume-original-cleanup-fixture"));
var cleanupFolder = Path.Combine(cleanupRoot, "App_Data", "resume-originals", "1");
Directory.CreateDirectory(cleanupFolder);
var cleanupEnvironment = new WebHostEnvironmentFixture(cleanupRoot);
var cleanupOriginals = new ResumeOriginalLifecycle(db, cleanupEnvironment, config);
var cleanupServices = new ServiceCollection().AddSingleton<IWebHostEnvironment>(cleanupEnvironment).BuildServiceProvider();
async Task<string> WritePrivateOriginalAsync(string sourceId, DateTime? lastWrite = null)
{
    var path = Path.Combine(cleanupFolder, sourceId + ".pdf");
    await File.WriteAllBytesAsync(path, [0x25, 0x50, 0x44, 0x46]);
    if (lastWrite is DateTime timestamp) File.SetLastWriteTimeUtc(path, timestamp);
    return path;
}

const string storedSourceId = "77777777777777777777777777777777";
var storedBytes = new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2d, 0x31 };
var storedForm = new FormFile(new MemoryStream(storedBytes), 0, storedBytes.Length, "file", "fixture.pdf");
Check(await cleanupOriginals.StoreAsync(1, storedSourceId, storedForm, ct) &&
      File.ReadAllBytes(Path.Combine(cleanupFolder, storedSourceId + ".pdf")).SequenceEqual(storedBytes),
    "Original storage publishes a completed private PDF through an exact owner path");
const string collisionSourceId = "88888888888888888888888888888888";
var collisionFile = await WritePrivateOriginalAsync(collisionSourceId);
var collisionForm = new FormFile(new MemoryStream([0x09, 0x09]), 0, 2, "file", "collision.pdf");
Check(!await cleanupOriginals.StoreAsync(1, collisionSourceId, collisionForm, ct) &&
      File.ReadAllBytes(collisionFile).SequenceEqual(new byte[] { 0x25, 0x50, 0x44, 0x46 }),
    "An original-source collision cannot overwrite or delete the existing private file");

var eightDaysAgo = DateTime.UtcNow.AddDays(-8);
var cleanupFile = await WritePrivateOriginalAsync(cleanupSourceId, eightDaysAgo);
const string oldOrphanSourceId = "11111111111111111111111111111111";
const string recentOrphanSourceId = "22222222222222222222222222222222";
var oldOrphanFile = await WritePrivateOriginalAsync(oldOrphanSourceId, eightDaysAgo);
var recentOrphanFile = await WritePrivateOriginalAsync(recentOrphanSourceId);
var malformedOldFile = Path.Combine(cleanupFolder, "not-a-source.pdf");
await File.WriteAllBytesAsync(malformedOldFile, [0x25, 0x50, 0x44, 0x46]);
File.SetLastWriteTimeUtc(malformedOldFile, eightDaysAgo);
var nestedFolder = Path.Combine(cleanupFolder, "nested");
Directory.CreateDirectory(nestedFolder);
var nestedOldFile = Path.Combine(nestedFolder, "66666666666666666666666666666666.pdf");
await File.WriteAllBytesAsync(nestedOldFile, [0x25, 0x50, 0x44, 0x46]);
File.SetLastWriteTimeUtc(nestedOldFile, eightDaysAgo);
var staleTemporaryFile = Path.Combine(cleanupFolder, "99999999999999999999999999999999.pdf.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.uploading");
await File.WriteAllBytesAsync(staleTemporaryFile, [0x25, 0x50, 0x44, 0x46]);
File.SetLastWriteTimeUtc(staleTemporaryFile, eightDaysAgo);
var ttlRemoved = await cleanupOriginals.CleanupExpiredUnreferencedAsync(1, ct);
Check(ttlRemoved == 1 && !File.Exists(oldOrphanFile) && !File.Exists(staleTemporaryFile), "TTL cleanup removes only an expired unreferenced owner-scoped original and stale private upload temp");
Check(File.Exists(cleanupFile) && File.Exists(recentOrphanFile) && File.Exists(malformedOldFile) && File.Exists(nestedOldFile), "TTL cleanup retains referenced, recent, malformed-name, and nested files");

var cleanupEngineController = new ResumeEngineController(db, factory, config, new AntiforgeryFixture(), cleanupOriginals)
{
    ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "1")], "fixture")), RequestServices = cleanupServices }
    }
};
Check(await cleanupEngineController.DiscardOriginal(cleanupSourceId, ct) is ConflictObjectResult && File.Exists(cleanupFile), "An original referenced by a saved Studio CV cannot be discarded");
const string abandonedSourceId = "fedcba9876543210fedcba9876543210";
var abandonedFile = await WritePrivateOriginalAsync(abandonedSourceId);
Check(await cleanupEngineController.DiscardOriginal(abandonedSourceId, ct) is NoContentResult && !File.Exists(abandonedFile), "An explicitly abandoned unreferenced original is removed only from the owner folder");

const string replacementOldSourceId = "44444444444444444444444444444444";
const string replacementNewSourceId = "55555555555555555555555555555555";
var replacementOldData = cleanupData.DeepClone();
replacementOldData!["importedLayout"]!["sourceId"] = replacementOldSourceId;
var replacementNewData = cleanupData.DeepClone();
replacementNewData!["importedLayout"]!["sourceId"] = replacementNewSourceId;
var replacementResume = new Resume
{
    EmployeeId = 10, Account = profile, Name = "Replacement fixture", Email = "replacement@example.com", Label = "Replacement fixture",
    BuilderDataJson = StoredLayout(replacementOldData)
};
db.Resumes.Add(replacementResume);
await db.SaveChangesAsync();
var replacementOldFile = await WritePrivateOriginalAsync(replacementOldSourceId, eightDaysAgo);
var replacementNewFile = await WritePrivateOriginalAsync(replacementNewSourceId);
Check(await cleanupEngineController.SaveDocument(new(replacementResume.Id, Document(replacementNewData)), ct) is OkObjectResult &&
      File.Exists(replacementOldFile) && File.GetLastWriteTimeUtc(replacementOldFile) > DateTime.UtcNow.AddMinutes(-1),
    "Replacing a saved original defers unreferenced old-file cleanup for a fresh retention window after DB commit");
File.SetLastWriteTimeUtc(replacementOldFile, eightDaysAgo);
await cleanupOriginals.CleanupExpiredUnreferencedAsync(1, ct);
Check(!File.Exists(replacementOldFile) && File.Exists(replacementNewFile), "Expired replaced original is reclaimed later while the newly referenced source remains");

const string sharedSourceId = "33333333333333333333333333333333";
var sharedDataOne = cleanupData.DeepClone();
sharedDataOne!["importedLayout"]!["sourceId"] = sharedSourceId;
var sharedDataTwo = cleanupData.DeepClone();
sharedDataTwo!["importedLayout"]!["sourceId"] = sharedSourceId;
var sharedFirst = new Resume { EmployeeId = 10, Account = profile, Name = "Shared one", Email = "one@example.com", Label = "Shared one", BuilderDataJson = StoredLayout(sharedDataOne) };
var sharedSecond = new Resume { EmployeeId = 10, Account = profile, Name = "Shared two", Email = "two@example.com", Label = "Shared two", BuilderDataJson = StoredLayout(sharedDataTwo) };
db.Resumes.AddRange(sharedFirst, sharedSecond);
await db.SaveChangesAsync();
var sharedFile = await WritePrivateOriginalAsync(sharedSourceId);
var cleanupController = new ResumeController(db, factory, config, cleanupOriginals)
{
    ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "1")], "fixture")), RequestServices = cleanupServices }
    }
};
await cleanupController.DeleteResume(sharedFirst.Id);
Check(File.Exists(sharedFile) && db.Resumes.Any(x => x.Id == sharedSecond.Id), "Deleting one of two CVs sharing a source keeps the still-referenced original");
await cleanupController.DeleteResume(sharedSecond.Id);
Check(!File.Exists(sharedFile), "Deleting the last saved reference removes that exact private original after the database commit");
await cleanupController.DeleteResume(cleanupResume.Id);
Check(!File.Exists(cleanupFile) && !db.Resumes.Any(x => x.Id == cleanupResume.Id), "Deleting a saved Studio CV removes only its referenced private original PDF");
Directory.Delete(cleanupRoot, recursive: true);
Console.WriteLine($"RESUME FLOW: {checks} checks passed (real controller + EF InMemory; no production database/model calls).");

sealed class FixtureFactory : IHttpClientFactory {
    public HttpStatusCode Status = HttpStatusCode.OK;
    public bool Throw;
    public string? LastBody;
    public string? LastRequestPath;
    public string? LastClientName;
    public int StructureCalls;
    public int CoachCalls;
    public string? CoachResponse;
    public HttpClient CreateClient(string name) { LastClientName = name; return new(new Handler(this)); }
    private sealed class Handler(FixtureFactory owner) : HttpMessageHandler {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct) {
            if (owner.Throw) throw new HttpRequestException("Fixture offline");
            owner.LastRequestPath = req.RequestUri?.AbsolutePath;
            if (req.RequestUri?.AbsolutePath == "/api/v2/cv/structure") owner.StructureCalls++;
            owner.LastBody = req.Content is null ? null : await req.Content.ReadAsStringAsync(ct);
            if (req.RequestUri?.AbsolutePath == "/api/v2/skills/cv-coach")
            {
                owner.CoachCalls++;
                return new HttpResponseMessage(owner.Status) { Content = new StringContent(owner.CoachResponse ?? "{}") };
            }
            return new HttpResponseMessage(owner.Status) { Content = new StringContent("{\"status\":\"scheduled\"}") };
        }
    }
}
sealed class AntiforgeryFixture : IAntiforgery {
    public AntiforgeryTokenSet GetAndStoreTokens(HttpContext context) => new("fixture", "cookie", "form", "header");
    public AntiforgeryTokenSet GetTokens(HttpContext context) => GetAndStoreTokens(context);
    public Task<bool> IsRequestValidAsync(HttpContext context) => Task.FromResult(true);
    public void SetCookieTokenAndHeader(HttpContext context) { }
    public Task ValidateRequestAsync(HttpContext context) => Task.CompletedTask;
}
sealed class WebHostEnvironmentFixture(string contentRoot) : IWebHostEnvironment {
    public string EnvironmentName { get; set; } = "Development";
    public string ApplicationName { get; set; } = "ResumeFlowTests";
    public string WebRootPath { get; set; } = contentRoot;
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public string ContentRootPath { get; set; } = contentRoot;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
