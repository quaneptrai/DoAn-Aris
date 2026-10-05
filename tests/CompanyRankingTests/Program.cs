using System.Net;
using System.Security.Claims;
using System.Text;
using ArisSkyve.Application.DTOs;
using ArisSkyve.Controllers;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Presentation;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

var databaseName = $"company-ranking-{Guid.NewGuid():N}";
var options = new DbContextOptionsBuilder<ArisDBContext>().UseInMemoryDatabase(databaseName).Options;
await using var db = new ArisDBContext(options);

var users = new List<User>();
var companies = new List<BussinessAccount>();
for (var id = 1; id <= 55; id++)
{
    var user = new User { Id = 1000 + id, Username = $"owner{id}", Email = $"owner{id}@fixture.test", Role = "Business" };
    var company = new BussinessAccount
    {
        Id = id,
        UserId = user.Id,
        User = user,
        FullName = $"Owner {id}",
        Location = "Hà Nội",
        CompanyName = id switch { 1 => "Alpha", 2 => "Beta", 3 => "Gamma", _ => $"Company {id:D2}" },
        Industry = id switch { 1 or 2 => "Technology", 3 => "Healthcare", _ => "Other" },
        AvatarUrl = id == 1 ? "https://drive.google.com/uc?export=view&id=1AbcDEFghijKLMnopQRstuVWxyz12345" : null
    };
    users.Add(user);
    companies.Add(company);
}

var candidateUser = new User { Id = 5000, Username = "candidate", Email = "candidate@fixture.test", Role = "Candidate" };
var candidate = new EmployesAccount { Id = 9000, UserId = candidateUser.Id, User = candidateUser, FullName = "Candidate", Location = "Hà Nội" };
candidateUser.Profile = candidate;
users.Add(candidateUser);

var followerUsers = Enumerable.Range(1, 8)
    .Select(id => new User { Id = 6000 + id, Username = $"follower{id}", Email = $"follower{id}@fixture.test" })
    .ToList();
users.AddRange(followerUsers);
db.Users.AddRange(users);
db.Profiles.AddRange(companies.Cast<EmployesAccount>().Append(candidate));

var alphaJob = new JobPosting { Id = 101, Title = "Alpha Engineer", Company = "Alpha", BusinessAccountId = 1, BusinessAccount = companies[0], Category = "Engineering" };
var alphaSecondJob = new JobPosting { Id = 102, Title = "Alpha Designer", Company = "Alpha", BusinessAccountId = 1, BusinessAccount = companies[0], Category = "Design" };
var betaJob = new JobPosting { Id = 103, Title = "Beta Engineer", Company = "Beta", BusinessAccountId = 2, BusinessAccount = companies[1], Category = "Engineering" };
var gammaJob = new JobPosting { Id = 104, Title = "Gamma Engineer", Company = "Gamma", BusinessAccountId = 3, BusinessAccount = companies[2], Category = "Engineering" };
var jobs = new[] { alphaJob, alphaSecondJob, betaJob, gammaJob };
db.JobPostings.AddRange(jobs);
db.Resumes.Add(new Resume { Id = 1, EmployeeId = candidate.Id, LastUpdatedAt = DateTime.UtcNow, VectorId = "fixture-vector" });

db.JobApplications.AddRange(
    NewApplication(1, alphaJob, candidate),
    NewApplication(2, alphaSecondJob, candidate, JobApplicationStatus.Rejected),
    NewApplication(3, alphaJob, candidate, JobApplicationStatus.Withdrawn),
    NewApplication(4, betaJob, candidate),
    NewApplication(5, betaJob, candidate),
    NewApplication(6, gammaJob, candidate),
    NewApplication(7, gammaJob, candidate, JobApplicationStatus.Rejected));

var follows = new List<CompanyFollow>();
void AddFollows(int companyId, int count)
{
    var start = follows.Count;
    for (var i = start; i < start + count; i++)
    {
        follows.Add(new CompanyFollow
        {
            UserId = followerUsers[i].Id,
            BusinessAccountId = companyId,
            User = followerUsers[i],
            BusinessAccount = companies[companyId - 1]
        });
    }
}
AddFollows(1, 4);
AddFollows(2, 2);
AddFollows(3, 2);
db.CompanyFollows.AddRange(follows);

var views = new List<CompanyProfileView>();
void AddViews(int companyId, int count)
{
    for (var i = 0; i < count; i++)
        views.Add(new CompanyProfileView { BusinessAccountId = companyId, BusinessAccount = companies[companyId - 1] });
}
AddViews(1, 3);
AddViews(2, 5);
AddViews(3, 5);
db.CompanyProfileViews.AddRange(views);
await db.SaveChangesAsync();

var overall = await CompanyRankingQuery.Build(db, "overall", null, true).ToListAsync();
Check(overall.Take(3).Select(row => row.CompanyName).SequenceEqual(["Beta", "Gamma", "Alpha"]), "overall sort applies applications, views, followers, then company name in order");
Check(overall.Single(row => row.CompanyId == 1).ApplicationCount == 2, "withdrawn applications are excluded while rejected applications remain submitted applications");
Check((await CompanyRankingQuery.Build(db, "applications", null, true).Take(3).Select(row => row.CompanyName).ToListAsync()).SequenceEqual(["Alpha", "Beta", "Gamma"]), "application sort uses deterministic company-name ties");
Check((await CompanyRankingQuery.Build(db, "views", null, true).Take(3).Select(row => row.CompanyName).ToListAsync()).SequenceEqual(["Beta", "Gamma", "Alpha"]), "view sort ranks persisted profile visits and resolves ties deterministically");
Check((await CompanyRankingQuery.Build(db, "followers", null, true).Take(3).Select(row => row.CompanyName).ToListAsync()).SequenceEqual(["Alpha", "Beta", "Gamma"]), "follower sort uses persisted follows and deterministic ties");
Check((await CompanyRankingQuery.Build(db, "applications", "Technology", true).Select(row => row.CompanyName).ToListAsync()).SequenceEqual(["Alpha", "Beta"]), "industry filter is applied in the EF query");
Check((await CompanyRankingQuery.Build(db, "followers", null, false).Take(3).Select(row => row.CompanyName).ToListAsync()).SequenceEqual(["Beta", "Gamma", "Alpha"]), "disabled follower feature contributes no fabricated values and falls back to overall ordering");
Check((await CompanyRankingQuery.Build(db, "overall", "No matching industry", true).CountAsync()) == 0, "empty industry filter produces an empty result safely");
Check((await CompanyRankingQuery.Build(db, "overall", null, true, 1000).CountAsync()) == 50, "ranking query caps results at fifty rows");
Check((await CompanyRankingQuery.Build(db, "overall", null, true, 0).CountAsync()) == 1, "ranking query clamps an invalid page size to one row");
Check(overall.Single(row => row.CompanyId == 4) is { ProfileViewCount: 0, FollowerCount: 0, ApplicationCount: 0 }, "companies without recorded activity display real zero counts");

var companyController = CreateCompanyController(db, companies[0].UserId, new TestFeatureGate());
await companyController.Details(1);
Check(await db.CompanyProfileViews.CountAsync(view => view.BusinessAccountId == 1) == 3, "company owner visits do not inflate their own view count");
companyController = CreateCompanyController(db, 99999, new TestFeatureGate());
await companyController.Details(1);
Check(await db.CompanyProfileViews.CountAsync(view => view.BusinessAccountId == 1) == 4, "another authenticated profile visit is persisted once without visitor identity");

var jobController = CreateJobsController(db, candidateUser.Id, new StaticHttpClientFactory(_ => throw new Exception("Unexpected AI cache miss")));
var jobDetails = await jobController.Details(alphaJob.Id) as ViewResult;
Check(jobDetails?.Model is JobPosting { BusinessAccount.AvatarUrl: not null }, "job details query includes the stored company profile logo");
var related = (jobController.ViewBag.CompanyJobs as List<JobPosting>)?.SingleOrDefault();
Check(related?.BusinessAccount?.AvatarUrl == companies[0].AvatarUrl, "same-company job rail includes stored company logos");
Check(AvatarPresentation.HasImage(companies[0].AvatarUrl), "real company logos are preserved by avatar presentation");
Check(!AvatarPresentation.HasImage("https://ui-avatars.com/api/?name=Placeholder"), "generated placeholder avatars remain excluded");
Check(AvatarPresentation.ResolveCompanyAvatar(null) is null, "missing company logos use initials instead of a name-based or cover-image assignment");
Check(PublicMediaDeliveryUrl.ToDeliveryUrl(companies[0].AvatarUrl) == "/media/drive/1AbcDEFghijKLMnopQRstuVWxyz12345", "stored Drive logo URLs use the existing public media delivery route");

var fakeAi = new StaticHttpClientFactory(_ => new HttpResponseMessage(HttpStatusCode.OK)
{
    Content = new StringContent("""
        {"status":"success","recommendations":[{"posting_id":101,"job_title":"untrusted title","company":"untrusted company","avatar_url":"https://ui-avatars.com/api/?name=INVENTED","final_score":88,"reason":"fixture match"}]}
        """, Encoding.UTF8, "application/json")
});
var recommendationController = CreateJobsController(db, candidateUser.Id, fakeAi);
var freshRecommendation = await recommendationController.GetAiRecommendations(topK: 1, force: true) as PartialViewResult;
var freshDto = (freshRecommendation?.Model as List<JobRecommendationDTO>)?.SingleOrDefault();
Check(freshDto?.AvatarUrl == "/media/drive/1AbcDEFghijKLMnopQRstuVWxyz12345", "fresh AI recommendation uses the matched database company's logo, not an AI-supplied image");

var cachedRecommendation = await CreateJobsController(db, candidateUser.Id, new StaticHttpClientFactory(_ => throw new Exception("Cached recommendation must not call AI")))
    .GetAiRecommendations(topK: 1) as PartialViewResult;
var cachedDto = (cachedRecommendation?.Model as List<JobRecommendationDTO>)?.SingleOrDefault();
Check(cachedDto?.AvatarUrl == freshDto?.AvatarUrl, "cached recommended-job cards resolve the same stored company logo");

var relationalOptions = new DbContextOptionsBuilder<ArisDBContext>()
    .UseSqlServer("Server=127.0.0.1;Database=QueryTranslationOnly;User Id=translation;Password=translation;TrustServerCertificate=True")
    .Options;
await using (var relationalDb = new ArisDBContext(relationalOptions))
{
    var sql = CompanyRankingQuery.Build(relationalDb, "overall", null, true).ToQueryString();
    Check(sql.Contains("CompanyProfileViews", StringComparison.Ordinal) && sql.Contains("CompanyFollows", StringComparison.Ordinal)
        && sql.Contains("JobApplications", StringComparison.Ordinal) && sql.Contains("TOP(@p)", StringComparison.OrdinalIgnoreCase)
        && sql.Contains("DECLARE @p int = 50", StringComparison.OrdinalIgnoreCase),
        "SQL Server relational provider translates bounded correlated aggregates without opening a connection");
}

Console.WriteLine("Company ranking and logo regression checks passed.");

static JobApplication NewApplication(int id, JobPosting job, EmployesAccount candidate, string status = JobApplicationStatus.Submitted) => new()
{
    Id = id,
    JobPostingId = job.Id,
    JobPosting = job,
    ApplicantId = candidate.Id,
    Applicant = candidate,
    FullName = candidate.FullName,
    Email = $"candidate-{id}@fixture.test",
    Status = status
};

static CompanyController CreateCompanyController(ArisDBContext db, int userId, IV7FeatureGate featureGate)
{
    var controller = new CompanyController(db, featureGate);
    controller.ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "fixture"))
        }
    };
    return controller;
}

static JobsController CreateJobsController(ArisDBContext db, int userId, IHttpClientFactory httpClients)
{
    var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["AiCore:BaseUrl"] = "http://fixture-aicore",
        ["AiCore:RecommendationTimeoutSeconds"] = "2"
    }).Build();
    var controller = new JobsController(db, config, httpClients, new TestFeatureGate());
    controller.ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "fixture"))
        }
    };
    return controller;
}

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

sealed class StaticHttpClientFactory(Func<HttpRequestMessage, HttpResponseMessage> response) : IHttpClientFactory
{
    public HttpClient CreateClient(string name = "") => new(new StaticHandler(response));

    private sealed class StaticHandler(Func<HttpRequestMessage, HttpResponseMessage> response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(response(request));
    }
}
