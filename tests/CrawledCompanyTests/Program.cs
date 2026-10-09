using System.Security.Claims;
using ArisSkyve.Application.DTOs;
using ArisSkyve.Controllers;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

// Crawled company profiles (the AiCore crawler's dbo.Companies) on the Aris company pages:
// name matching, the discover list (dedupe against registered accounts, open crawled jobs) and /Company/Info.
var services = new ServiceCollection();
var dbName = $"crawled-companies-{Guid.NewGuid():N}";
services.AddDbContext<ArisDBContext>(o => o.UseInMemoryDatabase(dbName));
await using var provider = services.BuildServiceProvider();

var now = DateTime.UtcNow;
using (var scope = provider.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ArisDBContext>();
    var owner = new User { Id = 1, Username = "fpt", Email = "fpt@fixture.test", Role = "Business" };
    var viewer = new User { Id = 2, Username = "viewer", Email = "viewer@fixture.test", Role = "Employee" };
    db.Users.AddRange(owner, viewer);
    db.Profiles.Add(new EmployesAccount { Id = 20, UserId = 2, User = viewer, FullName = "Viewer", Location = "Hà Nội" });
    db.BussinessAccounts.Add(new BussinessAccount
    {
        Id = 10, UserId = 1, User = owner, FullName = "FPT", Location = "Hà Nội", CompanyName = "FPT Software", Industry = "Phần mềm"
    });
    db.CrawledCompanies.AddRange(
        new CrawledCompany
        {
            Id = 1, MatchKey = "abc", Name = "Công ty TNHH ABC", NameVariants = "[\"CÔNG TY TNHH ABC\", \"ABC Co., Ltd\"]",
            AvatarUrl = "https://cdn.fixture/abc.png", Description = "ABC làm phần mềm.", Industry = "Phần mềm",
            CompanySize = "100-499", Address = "Hà Nội", FacebookUrl = "https://facebook.com/abc", TaxCode = "0101234567",
            ProfileLinks = "[\"https://www.vietnamworks.com/nha-tuyen-dung/abc\", \"not a url\"]",
            JobSources = "[\"vietnamworks\", \"glints\"]", ResearchStatus = "found", UpdatedAt = now
        },
        // Same company as a registered account: only the official page should show
        new CrawledCompany { Id = 2, MatchKey = "fpt software", Name = "FPT Software", NameVariants = "[\"Công ty TNHH Phần mềm FPT\"]", ResearchStatus = "found", UpdatedAt = now },
        // Expired Facebook avatar → fallback logo
        new CrawledCompany
        {
            Id = 3, MatchKey = "xyz", Name = "XYZ Corp", AvatarUrl = "https://scontent.fbcdn.net/x.jpg", AvatarExpiresAt = now.AddDays(-1),
            AvatarFallbackUrl = "https://xyz.vn/favicon.png", ResearchStatus = "not_found", UpdatedAt = now
        });
    db.JobPostings.AddRange(
        Job(100, "Backend Developer", "  công ty tnhh  ABC ", active: true, createdAt: now.AddHours(-2)),
        Job(101, "Tester", "ABC Co., Ltd", active: true, createdAt: now.AddHours(-1)),
        Job(102, "Old role", "Công ty TNHH ABC", active: false, createdAt: now.AddDays(-40)),
        Job(103, "Account Manager", "Công ty TNHH Phần mềm FPT", active: true, createdAt: now.AddHours(-3)),
        Job(104, "Official job", "FPT Software", active: true, createdAt: now.AddHours(-4), businessAccountId: 10));
    await db.SaveChangesAsync();
}

var directory = new CrawledCompanyDirectory(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<CrawledCompanyDirectory>.Instance);
await directory.EnsureFreshAsync();

Check(directory.All.Count == 3, "directory loads every crawled company");
Check(directory.Match("  công ty tnhh  ABC ")?.Id == 1, "a job's company name matches case- and space-insensitively");
Check(directory.Match("abc co., ltd")?.Id == 1, "a name variant from the job board matches too");
Check(directory.Match("Unknown Ltd") == null && directory.Match("") == null, "unknown or empty names match nothing");
Check(directory.Find(3)?.Logo == "https://xyz.vn/favicon.png", "an expired Facebook avatar falls back to the non-expiring logo");
Check(CrawledCompanyDirectory.NormalizeSize("BETWEEN_51_AND_200") == "51–200 nhân sự"
    && CrawledCompanyDirectory.NormalizeSize("1-50 employees") == "1-50 nhân sự"
    && CrawledCompanyDirectory.NormalizeSize("100+\nCán bộ") == "100+ nhân sự"
    && CrawledCompanyDirectory.NormalizeSize("500-999 nhân viên") == "500-999 nhân viên"
    && CrawledCompanyDirectory.NormalizeSize("600") == "600 nhân sự"
    && CrawledCompanyDirectory.NormalizeSize("  ") == null,
    "company sizes from every board read as one Vietnamese form with a unit");
Check(directory.Find(1)?.Size == "100-499 nhân sự", "the directory applies the size normalisation");
var abc = directory.Find(1)!;
Check(abc.Socials.Count == 1 && abc.Socials[0].Network == "Facebook", "social links come from their columns");
Check(abc.ReferencePages.Count == 1 && abc.Sources.SequenceEqual(new[] { "VietnamWorks", "Glints" }), "reference pages keep only URLs; sources get display names");

using (var scope = provider.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ArisDBContext>();
    var controller = Controller(db, directory);

    var index = (await controller.Index()) as ViewResult;
    var model = index?.Model as CompanyDiscoverViewModel;
    Check(model != null, "Company/Index renders");
    var list = model!.Companies;
    Check(list.Count(c => c.CompanyName == "FPT Software") == 1 && list.Single(c => c.CompanyName == "FPT Software").IsCrawled == false,
        "a crawled company with a registered account under the same name is not listed twice");
    var abcItem = list.Single(c => c.IsCrawled && c.Id == 1);
    Check(abcItem.OpenJobCount == 2, $"open crawled jobs are counted by name (got {abcItem.OpenJobCount})");
    Check(abcItem.LatestJobId == 101, "the newest open job is shown on the card");
    Check(abcItem.Href == "/Company/Info/1", "crawled cards link to /Company/Info");
    Check(list.Single(c => c.IsCrawled && c.Id == 3).OpenJobCount == 0, "a crawled company without open jobs is still listed");
    Check(list.IndexOf(list.First(c => c.IsCrawled)) > list.IndexOf(list.First(c => !c.IsCrawled)), "registered companies come before crawled ones");

    var info = (await controller.Info(1)) as ViewResult;
    var page = info?.Model as CrawledCompanyPageViewModel;
    Check(page != null && page.Company.Id == 1, "Company/Info renders a crawled company");
    Check(page!.Jobs.Select(j => j.Id).OrderBy(x => x).SequenceEqual(new[] { 100, 101, 102 }), "its page lists every job of the company (open and closed)");

    var redirect = (await controller.Info(2)) as RedirectToActionResult;
    Check(redirect?.ActionName == "Details" && Equals(redirect.RouteValues?["id"], 10), "a crawled duplicate of a registered company redirects to the official page");
    Check(await controller.Info(999) is NotFoundResult, "an unknown id is 404");

    // Applying: an aggregated job has no Aris employer, so the candidate is sent to the original posting
    var apps = new JobApplicationsController(db)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "2")], "fixture")) }
        }
    };
    var modal = JsonOf(await apps.GetApplyModal(100));
    Check(!modal.GetProperty("success").GetBoolean() && modal.GetProperty("external").GetBoolean()
        && modal.GetProperty("url").GetString() == "https://www.vietnamworks.com/100-jv"
        && modal.GetProperty("message").GetString()!.Contains("VietnamWorks"), "the apply form of an aggregated job points to its original posting");
    var applied = JsonOf(await apps.Apply(100, new SubmitJobApplicationDto { ResumeId = 1, ScreeningAnswers = new() }));
    Check(!applied.GetProperty("success").GetBoolean() && applied.GetProperty("external").GetBoolean() && !await db.JobApplications.AnyAsync(),
        "applying to an aggregated job creates no application nobody would receive");
    Check(JsonOf(await apps.GetApplyModal(104)).GetProperty("success").GetBoolean(), "a job posted by an Aris employer still opens the apply form");
    Check(ArisSkyve.Infrastructure.Presentation.JobSourcePresentation.SourceName("https://glints.com/vn/en/opportunities/jobs/x/1") == "Glints"
        && ArisSkyve.Infrastructure.Presentation.JobSourcePresentation.SourceName("https://jobs.example.org/a") == "jobs.example.org",
        "source names: known boards by name, others by host");
}

Console.WriteLine("Crawled company checks passed.");

static JobPosting Job(int id, string title, string company, bool active, DateTime createdAt, int? businessAccountId = null) => new()
{
    Id = id,
    Title = title,
    Company = company,
    OriginalUrl = businessAccountId == null ? $"https://www.vietnamworks.com/{id}-jv" : string.Empty,
    isActive = active,
    Deadline = active ? createdAt.AddDays(30) : createdAt.AddDays(1),
    CreatedAt = createdAt,
    UpdatedAt = createdAt,
    BusinessAccountId = businessAccountId
};

static CompanyController Controller(ArisDBContext db, ICrawledCompanyDirectory directory) => new(db, new TestFeatureGate(), directory)
{
    ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "2")], "fixture"))
        }
    }
};

static System.Text.Json.JsonElement JsonOf(IActionResult result) => System.Text.Json.JsonSerializer.SerializeToElement(((JsonResult)result).Value);

static void Check(bool passed, string description)
{
    if (!passed) throw new InvalidOperationException(description);
    Console.WriteLine($"PASS {description}");
}

sealed class TestFeatureGate : IV7FeatureGate
{
    public bool Enabled => true;
    public bool Stories => true;
    public bool Polls => true;
    public bool SavedJobs => true;
}
