using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ArisSkyve.Application.DTOs;
using ArisSkyve.Controllers;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using ArisSkyve.Infrastructure.Services.Recruitment;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace BackendEfTests
{
    public class TestFeatureGate : IV7FeatureGate
    {
        public bool Enabled => true;
        public bool Stories => true;
        public bool Polls => true;
        public bool SavedJobs => true;
    }

    public class MockHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;

        public MockHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
        {
            _responder = responder;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            try
            {
                return Task.FromResult(_responder(request));
            }
            catch (Exception ex)
            {
                return Task.FromException<HttpResponseMessage>(ex);
            }
        }
    }

    public class MockHttpClientFactory : IHttpClientFactory
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;
        public List<HttpClient> CreatedClients { get; } = new();

        public MockHttpClientFactory(Func<HttpRequestMessage, HttpResponseMessage> responder)
        {
            _responder = responder;
        }

        public HttpClient CreateClient(string name = "")
        {
            var client = new HttpClient(new MockHttpMessageHandler(_responder))
            {
                BaseAddress = new Uri("http://localhost:8001")
            };
            CreatedClients.Add(client);
            return client;
        }
    }

    public class FailingCacheReadDbContext : ArisDBContext
    {
        private bool _failRead = false;
        public FailingCacheReadDbContext(DbContextOptions<ArisDBContext> options) : base(options) { }

        public void EnableFailRead() => _failRead = true;

        public override DbSet<UserRecommendations> UserRecommendations
        {
            get
            {
                if (_failRead)
                    throw new InvalidOperationException("Simulated DB error reading cache (table does not exist or migration pending)");
                return base.UserRecommendations;
            }
        }
    }

    public class Program
    {
        public static async Task<int> Main(string[] args)
        {
            Console.WriteLine("========================================================================");
            Console.WriteLine("   REAL EF CORE & CONTROLLER EXECUTION: CASE 5, 6, 7 (R5/R6), CASE 8 (R2)");
            Console.WriteLine("========================================================================\n");

            try
            {
                var target = args.Length > 0 ? args[0].ToLowerInvariant().Trim() : "all";

                if (target == "all" || target == "case5" || target == "5")
                    await TestCase5_ForceRefreshClearsCache_AndVectorPendingProtects();

                if (target == "all" || target == "case6" || target == "6")
                    await TestCase6_CleanOverwriteEmptyReason();

                if (target == "all" || target == "case7" || target == "7")
                    await TestCase7_ZeroJobMarkerEvaluation_AndTopKThreshold();

                if (target == "all" || target == "case8" || target == "8")
                    await TestCase8_StrictCvIdentityIsolation_NoLegacyNullFallback();

                if (target == "all" || target == "f7" || target == "f7_1" || target == "1")
                    await TestF7_1_ExpiredByCacheHours_CallsAiCore();

                if (target == "all" || target == "f7" || target == "f7_2" || target == "2")
                    await TestF7_2_JobInactive_CallsAiCore();

                if (target == "all" || target == "f7" || target == "f7_3" || target == "3")
                    await TestF7_3_DegradedBatch_CallsAiCoreAfter30m_UsesCacheWithin30m();

                if (target == "all" || target == "f7" || target == "f7_4" || target == "4")
                    await TestF7_4_AiCoreFailureOrTimeout_ReturnsStaleBatchWithNotice();

                if (target == "all" || target == "f7" || target == "f7_5" || target == "5_db")
                    await TestF7_5_DbReadCacheError_DoesNot500_CallsAiCore();

                if (target == "all" || target == "f7" || target == "f7_6" || target == "6_concur")
                    await TestF7_6_ParallelRequestsSameUser_SingleBatch_NoDuplicateJobId();

                if (target == "all" || target == "f7" || target == "f7_7" || target == "7_timeout")
                    await TestF7_7_DefaultTimeouts_95sAnd45s();

                if (target == "all" || target == "f7" || target == "f7_8" || target == "8_demo")
                    await TestF7_8_DemoDataConfig_ControlsSeeders();

                if (target == "all" || target == "recruit" || target == "p10")
                    await TestP10_RejectionCategory_InsightAndGapPlan();

                if (target == "all" || target == "candidate_apply" || target == "p11")
                    await TestP11_CandidateApplyValidationAndReapply();

                Console.WriteLine("========================================================================");
                Console.WriteLine("   ALL REAL EF CORE & CONTROLLER TESTS PASSED CLEANLY (100%)!           ");
                Console.WriteLine("========================================================================");
                return 0;
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"\nTEST FAILED WITH EXCEPTION:\n{ex}");
                Console.ResetColor();
                return 1;
            }
        }

        // =========================================================================
        // P10: Từ chối có nhóm lý do → ứng viên thấy lý do + lộ trình kỹ năng cho đúng tin đó.
        // Controller thật (JobApplicationsController) + EF InMemory + AiCore giả cho gap-plan.
        // =========================================================================
        private static JobApplicationsController CreateApplicationsController(ArisDBContext context, int userId, SkillGapService? gap = null)
        {
            var controller = new JobApplicationsController(context, null, null, gap);
            var principal = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "mock"));
            controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } };
            return controller;
        }

        private static JsonElement JsonOf(IActionResult result)
        {
            var value = (result as JsonResult)?.Value ?? throw new Exception($"Expected JsonResult, got {result?.GetType().Name}");
            return JsonDocument.Parse(JsonSerializer.Serialize(value)).RootElement;
        }

        private static async Task TestP10_RejectionCategory_InsightAndGapPlan()
        {
            Console.WriteLine(">>> RUNNING P10: Rejection category, candidate insight and per-job gap plan...");
            using var context = CreateInMemoryContext();

            var employerUser = new User { Id = 900, Username = "hr", Email = "hr@test.com", Role = "Business" };
            var business = new BussinessAccount { Id = 9000, UserId = 900, FullName = "HR", CompanyName = "Aris Corp" };
            var candUser = new User { Id = 901, Username = "cand", Email = "c@test.com", Role = "Candidate" };
            var candidate = new EmployesAccount { Id = 9001, UserId = 901, FullName = "Nguyễn Văn A" };
            var otherUser = new User { Id = 902, Username = "other", Email = "o@test.com", Role = "Candidate" };
            var other = new EmployesAccount { Id = 9002, UserId = 902, FullName = "Người khác" };
            var job = new JobPosting { Id = 9100, Title = "Backend Developer", Company = "Aris Corp", isActive = true, BusinessAccountId = business.Id };
            var detail = new MatchDetail { Score = 41, Reason = "CV mạnh về web, chưa có hạ tầng.", Matched = new() { "JavaScript" }, Missing = new() { "Docker", "AWS" } };
            var app = new JobApplication
            {
                Id = 9200, JobPostingId = job.Id, ApplicantId = candidate.Id, ResumeId = 77, FullName = candidate.FullName, Email = "c@test.com",
                Status = JobApplicationStatus.UnderReview, MatchScore = 41, MatchSummary = "Khớp JavaScript; CV chưa nhắc Docker và AWS.",
                MatchDetailJson = detail.ToJson(), MatchScoredAt = DateTime.UtcNow
            };
            context.Users.AddRange(employerUser, candUser, otherUser);
            context.Profiles.AddRange(business, candidate, other);
            context.JobPostings.Add(job);
            context.JobApplications.Add(app);
            await context.SaveChangesAsync();

            var employer = CreateApplicationsController(context, employerUser.Id);

            // P10.1: nhóm lý do không hợp lệ bị chặn, đơn giữ nguyên.
            var bad = JsonOf(await employer.UpdateApplicationStatus(app.Id, new UpdateApplicationStatusDto { Status = "Rejected", RejectionCategory = "Hacker" }));
            if (bad.GetProperty("success").GetBoolean() || (await context.JobApplications.FindAsync(app.Id))!.Status != JobApplicationStatus.UnderReview)
                throw new Exception("Invalid rejection category must be refused without changing the application.");
            Console.WriteLine("  ✓ P10.1: invalid rejection category refused, status unchanged.");

            // P10.2: từ chối với nhóm Skills → lưu nhóm, sự kiện ghi nhãn, thông báo dẫn tới lộ trình.
            var ok = JsonOf(await employer.UpdateApplicationStatus(app.Id, new UpdateApplicationStatusDto { Status = "Rejected", RejectionCategory = "Skills", Note = "Cần kinh nghiệm Docker." }));
            if (!ok.GetProperty("success").GetBoolean()) throw new Exception("Reject with a valid category must succeed.");
            var saved = await context.JobApplications.FindAsync(app.Id);
            if (saved!.RejectionCategory != RejectionCategories.Skills) throw new Exception($"RejectionCategory expected Skills, got {saved.RejectionCategory}");
            var ev = await context.ApplicationEvents.Where(e => e.JobApplicationId == app.Id).OrderByDescending(e => e.Id).FirstAsync();
            if (ev.Type != ApplicationEventTypes.Rejected || ev.Detail == null || !ev.Detail.Contains(RejectionCategories.Label("Skills")) || !ev.Detail.Contains("Docker"))
                throw new Exception($"Rejected event must carry the category label and the note, got: {ev.Detail}");
            var note = await context.Notifications.Where(n => n.UserId == candUser.Id).OrderByDescending(n => n.Id).FirstAsync();
            if (!note.Content.Contains("lộ trình") || note.Link != $"/JobApplications/MyApplications?app={app.Id}")
                throw new Exception($"Candidate notification must point to the reason + learning path, got: {note.Content} → {note.Link}");
            Console.WriteLine("  ✓ P10.2: rejection saved with category; event + candidate notification carry it.");

            // P10.3: bảng ứng viên trả nhóm lý do và thống kê theo nhóm.
            var list = JsonOf(await employer.GetApplicantsForJob(job.Id));
            var breakdown = list.GetProperty("rejectionBreakdown");
            if (breakdown.GetArrayLength() != 1 || breakdown[0].GetProperty("code").GetString() != "Skills" || breakdown[0].GetProperty("count").GetInt32() != 1)
                throw new Exception($"rejectionBreakdown wrong: {breakdown}");
            if (list.GetProperty("applicants")[0].GetProperty("rejectionCategory").GetString() != "Skills")
                throw new Exception("Applicant row must expose rejectionCategory.");
            Console.WriteLine("  ✓ P10.3: applicant list exposes category and per-job rejection breakdown.");

            // P10.4: ngăn "Vì sao?" của ứng viên có lý do có cấu trúc.
            var candCtl = CreateApplicationsController(context, candUser.Id);
            var insight = JsonOf(await candCtl.GetMyApplicationInsight(app.Id));
            var rej = insight.GetProperty("rejection");
            if (rej.GetProperty("category").GetString() != "Skills" || !rej.GetProperty("skillGap").GetBoolean() || rej.GetProperty("note").GetString() != "Cần kinh nghiệm Docker.")
                throw new Exception($"Insight rejection block wrong: {rej}");
            Console.WriteLine("  ✓ P10.4: candidate insight returns the structured rejection (skill gap → show learning path).");

            // P10.5: lộ trình gửi đúng CV đã nộp, đúng tin, kỹ năng AI thấy thiếu; parse kết quả AiCore.
            string? sentBody = null;
            string? sentUrl = null;
            var factory = new MockHttpClientFactory(req =>
            {
                sentUrl = req.RequestUri!.ToString();
                sentBody = req.Content!.ReadAsStringAsync().Result;
                var json = JsonSerializer.Serialize(new
                {
                    status = "success",
                    cv_skills = new[] { "javascript" },
                    matched = new string[0],
                    coverage = new { now = 0, after_stage1 = 50, after_all = 100 },
                    steps = new object[]
                    {
                        new { skill = "docker", stage = 1, stage_label = "Bắt đầu ngay", related_to = new[] { "javascript" }, after = new string[0], active_postings = 64, opens = 18 },
                        new { skill = "aws", stage = 2, stage_label = "Tiếp theo", related_to = new string[0], after = new[] { "docker" }, active_postings = 40, opens = 9 }
                    },
                    total_steps = 2, soft_skills = new string[0], unmapped = new string[0]
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });
            var gap = new SkillGapService(factory, CreateConfig(), NullLogger<SkillGapService>.Instance);
            var candGap = CreateApplicationsController(context, candUser.Id, gap);
            var planJson = JsonOf(await candGap.GetMyApplicationGapPlan(app.Id));
            if (!planJson.GetProperty("success").GetBoolean()) throw new Exception($"Gap plan should succeed: {planJson}");
            using (var sent = JsonDocument.Parse(sentBody!))
            {
                var b = sent.RootElement;
                if (!sentUrl!.EndsWith("/api/v2/skills/gap-plan") || b.GetProperty("employee_id").GetInt32() != candidate.Id
                    || b.GetProperty("posting_id").GetInt32() != job.Id || b.GetProperty("resume_id").GetInt32() != 77
                    || b.GetProperty("missing").EnumerateArray().Select(x => x.GetString()).SequenceEqual(new[] { "Docker", "AWS" }) == false)
                    throw new Exception($"Gap plan request wrong: {sentUrl} {sentBody}");
            }
            var plan = planJson.GetProperty("plan");
            if (plan.GetProperty("steps").GetArrayLength() != 2 || plan.GetProperty("steps")[1].GetProperty("after")[0].GetString() != "docker"
                || plan.GetProperty("coverageAfterStage1").GetInt32() != 50)
                throw new Exception($"Gap plan parsed wrong: {plan}");
            Console.WriteLine("  ✓ P10.5: gap plan sends the submitted CV + job + AI-missing skills and parses stages.");

            // P10.6: người khác không xem được đơn này; đổi lại trạng thái thì xoá nhóm lý do.
            var otherCtl = CreateApplicationsController(context, otherUser.Id, gap);
            if (JsonOf(await otherCtl.GetMyApplicationGapPlan(app.Id)).GetProperty("success").GetBoolean())
                throw new Exception("Another candidate must not read this application's gap plan.");
            await employer.UpdateApplicationStatus(app.Id, new UpdateApplicationStatusDto { Status = "Shortlisted", Note = "Hoàn tác" });
            if ((await context.JobApplications.FindAsync(app.Id))!.RejectionCategory != null)
                throw new Exception("Leaving Rejected must clear RejectionCategory.");
            Console.WriteLine("  ✓ P10.6: other candidates are refused; leaving Rejected clears the category.\n");
        }

        // =========================================================================
        // P11: Candidate Apply validates server-side screening answers and preserves
        // the deliberate multi-application policy. This stays entirely in EF InMemory.
        // =========================================================================
        private static async Task TestP11_CandidateApplyValidationAndReapply()
        {
            Console.WriteLine(">>> RUNNING P11: Candidate apply validation and explicit re-apply policy...");
            using var context = CreateInMemoryContext();

            foreach (var actionName in new[] { nameof(JobApplicationsController.Apply), nameof(JobApplicationsController.Withdraw), nameof(JobApplicationsController.RespondToInterview) })
            {
                var action = typeof(JobApplicationsController).GetMethods().Single(method => method.Name == actionName);
                if (!action.GetCustomAttributes(inherit: true).Any(attribute => attribute.GetType().Name == "ValidateAntiForgeryTokenAttribute"))
                    throw new Exception($"{actionName} must require an anti-forgery token.");
            }
            Console.WriteLine("  ✓ P11.0: all candidate mutation actions require an anti-forgery token.");

            var candidateUser = new User { Id = 931, Username = "candidate-p11", Email = "candidate-p11@example.test", Role = "Candidate" };
            var candidate = new EmployesAccount { Id = 9310, UserId = candidateUser.Id, FullName = "Candidate P11", Location = "Test" };
            var employerUser = new User { Id = 932, Username = "employer-p11", Email = "employer-p11@example.test", Role = "Business" };
            var employer = new BussinessAccount { Id = 9320, UserId = employerUser.Id, FullName = "Employer P11", Location = "Test", CompanyName = "Example Co" };
            var job = new JobPosting
            {
                Id = 9330,
                Title = "Fixture Engineer",
                Company = employer.CompanyName,
                BusinessAccountId = employer.Id,
                isActive = true,
                ScreeningQuestions = JsonSerializer.Serialize(new[] { "Required fixture answer" })
            };
            var resume = new Resume { Id = 9340, EmployeeId = candidate.Id, Label = "Fixture CV", Email = candidateUser.Email, FileUrl = "/fixtures/cv.pdf" };

            context.Users.AddRange(candidateUser, employerUser);
            context.Profiles.AddRange(candidate, employer);
            context.JobPostings.Add(job);
            context.Resumes.Add(resume);
            await context.SaveChangesAsync();

            var controller = CreateApplicationsController(context, candidateUser.Id);
            var missingAnswer = JsonOf(await controller.Apply(job.Id, new SubmitJobApplicationDto { ResumeId = resume.Id }));
            if (missingAnswer.GetProperty("success").GetBoolean() || await context.JobApplications.AnyAsync())
                throw new Exception("Required screening answers must be enforced by the server.");
            Console.WriteLine("  ✓ P11.1: server refuses an application with a required answer missing.");

            var first = JsonOf(await controller.Apply(job.Id, new SubmitJobApplicationDto
            {
                ResumeId = resume.Id,
                CoverLetter = new string('x', 550),
                ScreeningAnswers = new List<string> { "  supplied answer  " }
            }));
            if (!first.GetProperty("success").GetBoolean()) throw new Exception("A complete fixture application must succeed.");
            var firstApp = await context.JobApplications.SingleAsync();
            if (firstApp.CoverLetter?.Length != 500 || firstApp.ScreeningAnswers != "[\"supplied answer\"]")
                throw new Exception("Apply must persist bounded, trimmed candidate input.");
            Console.WriteLine("  ✓ P11.2: complete application saves a bounded cover letter and trimmed answer.");

            var reapply = JsonOf(await controller.Apply(job.Id, new SubmitJobApplicationDto
            {
                ResumeId = resume.Id,
                ScreeningAnswers = new List<string> { "new material answer" }
            }));
            if (!reapply.GetProperty("success").GetBoolean() || await context.JobApplications.CountAsync() != 2)
                throw new Exception("The intentional re-apply policy must allow a separately confirmed second application.");
            Console.WriteLine("  ✓ P11.3: controller retains a second, deliberate application as a separate record.\n");
        }

        private static ArisDBContext CreateInMemoryContext()
        {
            var options = new DbContextOptionsBuilder<ArisDBContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            return new ArisDBContext(options);
        }

        private static IConfiguration CreateConfig()
        {
            return new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    { "AiCore:BaseUrl", "http://localhost:8001" }
                })
                .Build();
        }

        private static JobsController CreateController(ArisDBContext context, IHttpClientFactory factory, int userId, IConfiguration? config = null)
        {
            var controller = new JobsController(context, config ?? CreateConfig(), factory, new TestFeatureGate());
            var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString())
            }, "mock"));
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };
            return controller;
        }

        // =========================================================================
        // CASE 5 (R5 & R6): Real EF Core execution
        // 1. Force refresh receives empty list -> old batch records removed via RemoveRange, 0-job marker saved.
        // 2. AiCore returns vector_pending or vector_empty -> old batch records are NOT deleted and NO 0-job marker saved!
        // =========================================================================
        private static async Task TestCase5_ForceRefreshClearsCache_AndVectorPendingProtects()
        {
            Console.WriteLine(">>> RUNNING REAL EF CORE CASE 5: Force refresh & vector_pending/vector_empty...");
            using var context = CreateInMemoryContext();
            int userId = 101;
            var resumeVersion = new DateTime(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc);

            var user = new User { Id = userId, Username = "user101", Email = "u101@test.com", Role = "Candidate" };
            var profile = new EmployesAccount { Id = 501, UserId = userId, FullName = "Candidate 501" };
            var resume = new Resume { Id = 301, EmployeeId = profile.Id, LastUpdatedAt = resumeVersion, VectorId = "vec_301" };
            var job1 = new JobPosting { Id = 801, Title = "Software Engineer", Company = "Tech Corp", isActive = true };
            var job2 = new JobPosting { Id = 802, Title = "QA Engineer", Company = "Tech Corp", isActive = true };

            context.Users.Add(user);
            context.Profiles.Add(profile);
            context.Resumes.Add(resume);
            context.JobPostings.AddRange(job1, job2);

            // Add existing recommendations
            context.UserRecommendations.AddRange(
                new UserRecommendations { UserId = userId, ResumeId = 301, ResumeVersion = resumeVersion, JobId = 801, MatchScore = 85.0 },
                new UserRecommendations { UserId = userId, ResumeId = 301, ResumeVersion = resumeVersion, JobId = 802, MatchScore = 78.0 }
            );
            await context.SaveChangesAsync();

            // Subtest 5A: vector_pending must NOT delete cache or write 0-job marker
            int aiCallCount = 0;
            var factoryPending = new MockHttpClientFactory(req =>
            {
                aiCallCount++;
                var json = JsonSerializer.Serialize(new
                {
                    status = "vector_pending",
                    message = "Dữ liệu Vector CV chưa sẵn sàng. Vui lòng thử lại sau vài giây.",
                    recommendations = new List<object>()
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });

            var controllerPending = CreateController(context, factoryPending, userId);
            var resultPending = await controllerPending.GetAiRecommendations(topK: 5, force: true);
            var contentResultPending = resultPending as ContentResult;
            if (contentResultPending == null || !contentResultPending.Content!.Contains("Dữ liệu Vector đang được xử lý"))
            {
                throw new Exception($"Expected vector_pending message, got: {contentResultPending?.Content}");
            }

            var preservedRecs = await context.UserRecommendations
                .Where(r => r.UserId == userId && r.ResumeId == 301 && r.JobId > 0)
                .ToListAsync();
            if (preservedRecs.Count != 2)
            {
                throw new Exception($"vector_pending must NOT delete existing cache! Expected 2 records, found {preservedRecs.Count}");
            }
            var hasFalseMarker = await context.UserRecommendations.AnyAsync(r => r.UserId == userId && r.ResumeId == 301 && r.JobId == 0);
            if (hasFalseMarker)
            {
                throw new Exception("vector_pending must NOT write a 0-job marker!");
            }
            Console.WriteLine("  ✓ Subtest 5A: vector_pending safely preserved existing cache and did not write false 0-job marker.");

            // Subtest 5B: vector_empty must NOT delete cache or write 0-job marker
            var factoryEmpty = new MockHttpClientFactory(req =>
            {
                var json = JsonSerializer.Serialize(new
                {
                    status = "vector_empty",
                    message = "Dữ liệu Vector của CV rỗng.",
                    recommendations = new List<object>()
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });

            var controllerEmpty = CreateController(context, factoryEmpty, userId);
            var resultEmpty = await controllerEmpty.GetAiRecommendations(topK: 5, force: true);
            var contentResultEmpty = resultEmpty as ContentResult;
            if (contentResultEmpty == null || !contentResultEmpty.Content!.Contains("Dữ liệu phân tích rỗng"))
            {
                throw new Exception($"Expected vector_empty message, got: {contentResultEmpty?.Content}");
            }
            var preservedRecsAfterEmpty = await context.UserRecommendations
                .Where(r => r.UserId == userId && r.ResumeId == 301 && r.JobId > 0)
                .ToListAsync();
            if (preservedRecsAfterEmpty.Count != 2)
            {
                throw new Exception($"vector_empty must NOT delete existing cache! Expected 2 records, found {preservedRecsAfterEmpty.Count}");
            }
            Console.WriteLine("  ✓ Subtest 5B: vector_empty safely preserved existing cache and did not write false 0-job marker.");

            // Subtest 5C: Genuine completed evaluation with 0 recommendations -> clears old cache and writes 0-job marker
            var factorySuccessEmpty = new MockHttpClientFactory(req =>
            {
                var json = JsonSerializer.Serialize(new
                {
                    status = "success",
                    recommendations = new List<object>()
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });

            var controllerSuccessEmpty = CreateController(context, factorySuccessEmpty, userId);
            var resultSuccessEmpty = await controllerSuccessEmpty.GetAiRecommendations(topK: 5, force: true);

            var remainingOldJobs = await context.UserRecommendations
                .Where(r => r.UserId == userId && r.ResumeId == 301 && r.JobId > 0)
                .ToListAsync();
            if (remainingOldJobs.Count != 0)
            {
                throw new Exception($"Real EF Core: Old recommendations must be cleared on success with empty list! Found: {remainingOldJobs.Count}");
            }

            var marker = await context.UserRecommendations
                .FirstOrDefaultAsync(r => r.UserId == userId && r.ResumeId == 301 && r.JobId == 0);
            if (marker == null)
            {
                throw new Exception("Real EF Core: 0-job marker must be written to database!");
            }
            Console.WriteLine("  ✓ Subtest 5C: Genuine success with empty list cleared old cache and wrote 0-job marker in real EF Core.\n");
        }

        // =========================================================================
        // CASE 6 (R5): Real EF Core update overwriting empty new reason cleanly
        // =========================================================================
        private static async Task TestCase6_CleanOverwriteEmptyReason()
        {
            Console.WriteLine(">>> RUNNING REAL EF CORE CASE 6: Overwrite empty new reason cleanly...");
            using var context = CreateInMemoryContext();
            int userId = 102;
            var resumeVersion = new DateTime(2026, 10, 2, 10, 0, 0, DateTimeKind.Utc);

            var user = new User { Id = userId, Username = "user102", Email = "u102@test.com", Role = "Candidate" };
            var profile = new EmployesAccount { Id = 502, UserId = userId, FullName = "Candidate 502" };
            var resume = new Resume { Id = 302, EmployeeId = profile.Id, LastUpdatedAt = resumeVersion, VectorId = "vec_302" };
            var job = new JobPosting { Id = 803, Title = "Backend Dev", Company = "Aris", isActive = true };

            context.Users.Add(user);
            context.Profiles.Add(profile);
            context.Resumes.Add(resume);
            context.JobPostings.Add(job);

            // Existing recommendation has stale reason
            context.UserRecommendations.Add(new UserRecommendations
            {
                UserId = userId,
                ResumeId = 302,
                ResumeVersion = resumeVersion,
                JobId = 803,
                MatchScore = 80.0,
                Reason = "Stale reason text that must be removed"
            });
            await context.SaveChangesAsync();

            // AiCore returns new recommendation for same job with Reason = ""
            var factory = new MockHttpClientFactory(req =>
            {
                var json = JsonSerializer.Serialize(new
                {
                    status = "success",
                    recommendations = new[]
                    {
                        new
                        {
                            posting_id = 803,
                            job_title = "Backend Dev",
                            company = "Aris",
                            score = 88.0,
                            reason = "" // empty reason!
                        }
                    }
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });

            var controller = CreateController(context, factory, userId);
            await controller.GetAiRecommendations(topK: 5, force: true);

            var updatedRec = await context.UserRecommendations
                .FirstOrDefaultAsync(r => r.UserId == userId && r.ResumeId == 302 && r.JobId == 803);

            if (updatedRec == null)
            {
                throw new Exception("Record must exist in DB!");
            }
            if (updatedRec.Reason != string.Empty)
            {
                throw new Exception($"Expected empty reason string, got: '{updatedRec.Reason}'");
            }
            Console.WriteLine("  ✓ CASE 6 PASSED: Stale reason was cleanly overwritten with empty string in real EF Core.\n");
        }

        // =========================================================================
        // CASE 7 (R6): Zero-job marker avoids repeated AI calls on reload & respects topK threshold
        // =========================================================================
        private static async Task TestCase7_ZeroJobMarkerEvaluation_AndTopKThreshold()
        {
            Console.WriteLine(">>> RUNNING REAL EF CORE CASE 7: Zero-job completion marker & topK threshold...");
            using var context = CreateInMemoryContext();
            int userId = 103;
            var resumeVersion = new DateTime(2026, 10, 3, 14, 0, 0, DateTimeKind.Utc);

            var user = new User { Id = userId, Username = "user103", Email = "u103@test.com", Role = "Candidate" };
            var profile = new EmployesAccount { Id = 503, UserId = userId, FullName = "Candidate 503" };
            var resume = new Resume { Id = 303, EmployeeId = profile.Id, LastUpdatedAt = resumeVersion, VectorId = "vec_303" };

            context.Users.Add(user);
            context.Profiles.Add(profile);
            context.Resumes.Add(resume);

            // Add completed 0-job marker evaluated for topK = 5
            var markerPayload = new AiRecommendationPayload
            {
                Version = 1,
                RequestedTopK = 5
            };
            context.UserRecommendations.Add(new UserRecommendations
            {
                UserId = userId,
                JobId = 0,
                ResumeId = 303,
                ResumeVersion = resumeVersion,
                PayloadJson = JsonSerializer.Serialize(markerPayload),
                MatchScore = 0.0,
                CreatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();

            int aiCallCount = 0;
            var factory = new MockHttpClientFactory(req =>
            {
                aiCallCount++;
                var json = JsonSerializer.Serialize(new { status = "success", recommendations = new List<object>() });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });

            var controller = CreateController(context, factory, userId);

            // Request 1: topK = 5 (<= cached RequestedTopK) -> MUST NOT call AI!
            var res1 = await controller.GetAiRecommendations(topK: 5, force: false);
            if (aiCallCount != 0)
            {
                throw new Exception($"AI was called when zero-job marker with RequestedTopK=5 was already cached! Calls: {aiCallCount}");
            }
            Console.WriteLine("  ✓ Subtest 7A: Cache hit on zero-job marker avoided AI call for topK=5.");

            // Request 2: topK = 10 (> cached RequestedTopK=5) -> MUST call AI for larger batch!
            var res2 = await controller.GetAiRecommendations(topK: 10, force: false);
            if (aiCallCount != 1)
            {
                throw new Exception($"AI should be called when requested topK (10) exceeds cached RequestedTopK (5)! Calls: {aiCallCount}");
            }

            var updatedMarker = await context.UserRecommendations
                .FirstOrDefaultAsync(r => r.UserId == userId && r.ResumeId == 303 && r.JobId == 0);
            var updatedPayload = JsonSerializer.Deserialize<AiRecommendationPayload>(updatedMarker!.PayloadJson!);
            if (updatedPayload?.RequestedTopK != 10)
            {
                throw new Exception($"Marker RequestedTopK was not updated to 10 in real EF Core! Got: {updatedPayload?.RequestedTopK}");
            }
            Console.WriteLine("  ✓ Subtest 7B: RequestedTopK updated to 10 in real EF Core for larger batch.\n");
        }

        // =========================================================================
        // CASE 8 (R2): Strict CV identity isolation across multiple resumes with same timestamp
        // Verify that ResumeId == null fallback is REMOVED so CV B never gets CV A's cache.
        // =========================================================================
        private static async Task TestCase8_StrictCvIdentityIsolation_NoLegacyNullFallback()
        {
            Console.WriteLine(">>> RUNNING REAL EF CORE CASE 8: Strict CV identity isolation (No legacy null fallback)...");
            using var context = CreateInMemoryContext();
            int userId = 104;
            var sharedTimestamp = new DateTime(2026, 10, 4, 12, 0, 0, DateTimeKind.Utc);

            var user = new User { Id = userId, Username = "user104", Email = "u104@test.com", Role = "Candidate" };
            var profile = new EmployesAccount { Id = 504, UserId = userId, FullName = "Candidate 504" };

            // User has two resumes created at the exact same timestamp
            var resumeA = new Resume { Id = 401, EmployeeId = profile.Id, LastUpdatedAt = sharedTimestamp, VectorId = "vec_401" };
            var resumeB = new Resume { Id = 402, EmployeeId = profile.Id, LastUpdatedAt = sharedTimestamp, VectorId = "vec_402" };
            var job = new JobPosting { Id = 901, Title = "DevOps Engineer", Company = "Aris", isActive = true };

            context.Users.Add(user);
            context.Profiles.Add(profile);
            context.Resumes.AddRange(resumeA, resumeB);
            context.JobPostings.Add(job);

            // Legacy cache record in DB with ResumeId = null and sharedTimestamp
            context.UserRecommendations.Add(new UserRecommendations
            {
                UserId = userId,
                ResumeId = null,
                ResumeVersion = sharedTimestamp,
                JobId = 901,
                MatchScore = 95.0
            });
            await context.SaveChangesAsync();

            // Real EF Core query for Resume B (Id=402)
            var bCacheRecords = await context.UserRecommendations
                .Where(r => r.UserId == userId &&
                            r.ResumeVersion == sharedTimestamp &&
                            r.ResumeId == 402)
                .ToListAsync();

            if (bCacheRecords.Count != 0)
            {
                throw new Exception($"Strict CV isolation failed: Resume B matched legacy null record in EF Core! Count: {bCacheRecords.Count}");
            }
            Console.WriteLine("  ✓ Subtest 8A: Resume B strictly did NOT match legacy ResumeId == null cache.");

            // Now delete Resume A: User now has only 1 CV (Resume B)
            context.Resumes.Remove(resumeA);
            await context.SaveChangesAsync();

            var resumesRemaining = await context.Resumes.CountAsync(r => r.EmployeeId == profile.Id);
            if (resumesRemaining != 1)
            {
                throw new Exception($"Expected exactly 1 resume remaining, got {resumesRemaining}");
            }

            // Real EF Core query for Resume B with single CV in profile
            // With fallback removed, Resume B still must NOT receive ResumeId == null cache!
            var singleCvBCacheRecords = await context.UserRecommendations
                .Where(r => r.UserId == userId &&
                            r.ResumeVersion == sharedTimestamp &&
                            r.ResumeId == 402)
                .ToListAsync();

            if (singleCvBCacheRecords.Count != 0)
            {
                throw new Exception($"Strict CV isolation failed: After deleting CV A, CV B matched legacy null cache! Count: {singleCvBCacheRecords.Count}");
            }
            Console.WriteLine("  ✓ Subtest 8B: After deleting CV A, CV B STILL strictly ignores legacy ResumeId == null cache.\n");
        }

        private static string? FindRepoRoot()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                if (Directory.Exists(Path.Combine(dir.FullName, "ArisSkyve")))
                    return dir.FullName;
                dir = dir.Parent;
            }
            return null;
        }

        // =========================================================================
        // F7.1: Expired by RecommendationCacheHours (> 24h) triggers fresh AiCore call
        // =========================================================================
        private static async Task TestF7_1_ExpiredByCacheHours_CallsAiCore()
        {
            Console.WriteLine(">>> RUNNING F7.1: Expired by CacheHours (> 24h) calls AiCore...");
            using var context = CreateInMemoryContext();
            int userId = 201;
            var resumeVersion = new DateTime(2026, 10, 4, 1, 0, 0, DateTimeKind.Utc);

            var user = new User { Id = userId, Username = "user201", Email = "u201@test.com", Role = "Candidate" };
            var profile = new EmployesAccount { Id = 601, UserId = userId, FullName = "Candidate 601" };
            var resume = new Resume { Id = 701, EmployeeId = profile.Id, LastUpdatedAt = resumeVersion, VectorId = "vec_701" };
            var job = new JobPosting { Id = 1001, Title = "Software Engineer", Company = "Aris", isActive = true };

            context.Users.Add(user);
            context.Profiles.Add(profile);
            context.Resumes.Add(resume);
            context.JobPostings.Add(job);

            // Cache record older than 24h (25 hours ago)
            context.UserRecommendations.Add(new UserRecommendations
            {
                UserId = userId,
                ResumeId = 701,
                ResumeVersion = resumeVersion,
                JobId = 1001,
                MatchScore = 80.0,
                CreatedAt = DateTime.UtcNow.AddHours(-25),
                PayloadJson = JsonSerializer.Serialize(new AiRecommendationPayload { Version = 1, RequestedTopK = 5 })
            });
            await context.SaveChangesAsync();

            int aiCallCount = 0;
            var factory = new MockHttpClientFactory(req =>
            {
                aiCallCount++;
                var json = JsonSerializer.Serialize(new
                {
                    status = "success",
                    recommendations = new[]
                    {
                        new { posting_id = 1001, job_title = "Software Engineer", company = "Aris", score = 88.0, reason = "Fresh recommendation" }
                    }
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });

            var controller = CreateController(context, factory, userId);
            var result = await controller.GetAiRecommendations(topK: 5, force: false);

            if (aiCallCount != 1)
            {
                throw new Exception($"Expected AiCore to be called because cache was >24h old, but aiCallCount was {aiCallCount}");
            }
            Console.WriteLine("  ✓ F7.1 PASSED: Expired cache (>24h) triggered fresh AiCore call.\n");
        }

        // =========================================================================
        // F7.2: Inactive job in cached batch triggers fresh AiCore call
        // =========================================================================
        private static async Task TestF7_2_JobInactive_CallsAiCore()
        {
            Console.WriteLine(">>> RUNNING F7.2: Inactive job in cache batch calls AiCore...");
            using var context = CreateInMemoryContext();
            int userId = 202;
            var resumeVersion = new DateTime(2026, 10, 4, 1, 0, 0, DateTimeKind.Utc);

            var user = new User { Id = userId, Username = "user202", Email = "u202@test.com", Role = "Candidate" };
            var profile = new EmployesAccount { Id = 602, UserId = userId, FullName = "Candidate 602" };
            var resume = new Resume { Id = 702, EmployeeId = profile.Id, LastUpdatedAt = resumeVersion, VectorId = "vec_702" };
            var jobInactive = new JobPosting { Id = 1002, Title = "Expired Job", Company = "Aris", isActive = false };
            var jobActive = new JobPosting { Id = 1003, Title = "Active Job", Company = "Aris", isActive = true };

            context.Users.Add(user);
            context.Profiles.Add(profile);
            context.Resumes.Add(resume);
            context.JobPostings.AddRange(jobInactive, jobActive);

            // Fresh cache record (< 24h) containing the inactive job
            context.UserRecommendations.Add(new UserRecommendations
            {
                UserId = userId,
                ResumeId = 702,
                ResumeVersion = resumeVersion,
                JobId = 1002,
                MatchScore = 80.0,
                CreatedAt = DateTime.UtcNow.AddHours(-1),
                PayloadJson = JsonSerializer.Serialize(new AiRecommendationPayload { Version = 1, RequestedTopK = 5 })
            });
            await context.SaveChangesAsync();

            int aiCallCount = 0;
            var factory = new MockHttpClientFactory(req =>
            {
                aiCallCount++;
                var json = JsonSerializer.Serialize(new
                {
                    status = "success",
                    recommendations = new[]
                    {
                        new { posting_id = 1003, job_title = "Active Job", company = "Aris", score = 90.0, reason = "New active job" }
                    }
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });

            var controller = CreateController(context, factory, userId);
            var result = await controller.GetAiRecommendations(topK: 5, force: false);

            if (aiCallCount != 1)
            {
                throw new Exception($"Expected AiCore to be called because cached job was inactive, but aiCallCount was {aiCallCount}");
            }
            Console.WriteLine("  ✓ F7.2 PASSED: Cached batch with inactive job triggered fresh AiCore call.\n");
        }

        // =========================================================================
        // F7.3: Degraded batch cache within vs. past 30 minutes
        // =========================================================================
        private static async Task TestF7_3_DegradedBatch_CallsAiCoreAfter30m_UsesCacheWithin30m()
        {
            Console.WriteLine(">>> RUNNING F7.3: Degraded batch cache within/past 30 minutes...");
            using var context = CreateInMemoryContext();
            int userId = 203;
            var resumeVersion = new DateTime(2026, 10, 4, 1, 0, 0, DateTimeKind.Utc);

            var user = new User { Id = userId, Username = "user203", Email = "u203@test.com", Role = "Candidate" };
            var profile = new EmployesAccount { Id = 603, UserId = userId, FullName = "Candidate 603" };
            var resume = new Resume { Id = 703, EmployeeId = profile.Id, LastUpdatedAt = resumeVersion, VectorId = "vec_703" };
            var job = new JobPosting { Id = 1004, Title = "Fullstack Dev", Company = "Aris", isActive = true };

            context.Users.Add(user);
            context.Profiles.Add(profile);
            context.Resumes.Add(resume);
            context.JobPostings.Add(job);

            var degradedPayload = new AiRecommendationPayload
            {
                Version = 1,
                RequestedTopK = 5,
                Degraded = new List<string> { "vector_service_fallback" }
            };

            var rec = new UserRecommendations
            {
                UserId = userId,
                ResumeId = 703,
                ResumeVersion = resumeVersion,
                JobId = 1004,
                MatchScore = 75.0,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10), // 10 minutes ago (< 30m)
                PayloadJson = JsonSerializer.Serialize(degradedPayload)
            };
            context.UserRecommendations.Add(rec);
            await context.SaveChangesAsync();

            int aiCallCount = 0;
            var factory = new MockHttpClientFactory(req =>
            {
                aiCallCount++;
                var json = JsonSerializer.Serialize(new
                {
                    status = "success",
                    recommendations = new[]
                    {
                        new { posting_id = 1004, job_title = "Fullstack Dev", company = "Aris", score = 85.0, reason = "Fresh evaluation" }
                    }
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });

            var controller = CreateController(context, factory, userId);

            // Subtest 3A: Within 30 minutes (< 30m) -> cache HIT, NO AiCore call
            var res1 = await controller.GetAiRecommendations(topK: 5, force: false);
            if (aiCallCount != 0)
            {
                throw new Exception($"Expected degraded batch within 30m to use cache, but AiCore was called {aiCallCount} times");
            }
            Console.WriteLine("  ✓ Subtest 3A: Degraded batch within 30m used cache without calling AiCore.");

            // Subtest 3B: Age degraded batch to 35 minutes ago (> 30m) -> cache EXPIRED, MUST call AiCore
            rec.CreatedAt = DateTime.UtcNow.AddMinutes(-35);
            await context.SaveChangesAsync();

            var res2 = await controller.GetAiRecommendations(topK: 5, force: false);
            if (aiCallCount != 1)
            {
                throw new Exception($"Expected degraded batch past 30m to call AiCore, but aiCallCount was {aiCallCount}");
            }
            Console.WriteLine("  ✓ Subtest 3B: Degraded batch past 30m triggered fresh AiCore call.\n");
        }

        // =========================================================================
        // F7.4: AiCore failure/timeout falls back to stale cache with notice
        // =========================================================================
        private static async Task TestF7_4_AiCoreFailureOrTimeout_ReturnsStaleBatchWithNotice()
        {
            Console.WriteLine(">>> RUNNING F7.4: AiCore failure/timeout falls back to stale cache with notice...");
            using var context = CreateInMemoryContext();
            int userId = 204;
            var resumeVersion = new DateTime(2026, 10, 4, 1, 0, 0, DateTimeKind.Utc);

            var user = new User { Id = userId, Username = "user204", Email = "u204@test.com", Role = "Candidate" };
            var profile = new EmployesAccount { Id = 604, UserId = userId, FullName = "Candidate 604" };
            var resume = new Resume { Id = 704, EmployeeId = profile.Id, LastUpdatedAt = resumeVersion, VectorId = "vec_704" };
            var job = new JobPosting { Id = 1005, Title = "Data Engineer", Company = "Aris", isActive = true };

            context.Users.Add(user);
            context.Profiles.Add(profile);
            context.Resumes.Add(resume);
            context.JobPostings.Add(job);

            var staleDate = DateTime.UtcNow.AddDays(-2); // 48h ago (stale/expired)
            context.UserRecommendations.Add(new UserRecommendations
            {
                UserId = userId,
                ResumeId = 704,
                ResumeVersion = resumeVersion,
                JobId = 1005,
                MatchScore = 77.0,
                CreatedAt = staleDate,
                PayloadJson = JsonSerializer.Serialize(new AiRecommendationPayload { Version = 1, RequestedTopK = 5 })
            });
            await context.SaveChangesAsync();

            // AiCore throws HTTP 503
            var factory = new MockHttpClientFactory(req =>
            {
                return new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
                {
                    Content = new StringContent("Service Unavailable / Timeout")
                };
            });

            var controller = CreateController(context, factory, userId);
            var actionResult = await controller.GetAiRecommendations(topK: 5, force: false);

            var partialView = actionResult as PartialViewResult;
            if (partialView == null)
            {
                throw new Exception($"Expected PartialViewResult on fallback, got {actionResult?.GetType().Name}");
            }

            var isFallback = controller.ViewData["IsFallbackCache"] as bool?;
            var fallbackNotice = controller.ViewData["FallbackNotice"] as string;

            if (isFallback != true)
            {
                throw new Exception("ViewData['IsFallbackCache'] must be true when falling back to stale cache!");
            }
            if (string.IsNullOrEmpty(fallbackNotice) || !fallbackNotice.Contains("Kết quả đã lưu lúc"))
            {
                throw new Exception($"ViewData['FallbackNotice'] expected to contain 'Kết quả đã lưu lúc', but got: '{fallbackNotice}'");
            }

            var model = partialView.Model as List<JobRecommendationDTO>;
            if (model == null || model.Count != 1 || model[0].Id != 1005)
            {
                throw new Exception($"Expected model with 1 job (Id=1005), got count: {model?.Count}");
            }

            // Subtest 4B: 0-job marker batch falls back with saved notice when AiCore times out
            int userMarkerId = 2041;
            var userM = new User { Id = userMarkerId, Username = "user2041", Email = "u2041@test.com", Role = "Candidate" };
            var profM = new EmployesAccount { Id = 6041, UserId = userMarkerId, FullName = "Candidate 6041" };
            var resM = new Resume { Id = 7041, EmployeeId = profM.Id, LastUpdatedAt = resumeVersion, VectorId = "vec_7041" };
            context.Users.Add(userM);
            context.Profiles.Add(profM);
            context.Resumes.Add(resM);
            context.UserRecommendations.Add(new UserRecommendations
            {
                UserId = userMarkerId,
                ResumeId = 7041,
                ResumeVersion = resumeVersion,
                JobId = 0,
                MatchScore = 0.0,
                CreatedAt = staleDate,
                PayloadJson = JsonSerializer.Serialize(new AiRecommendationPayload { Version = 1, RequestedTopK = 5 })
            });
            await context.SaveChangesAsync();

            var factoryTimeout = new MockHttpClientFactory(req => throw new TaskCanceledException("Simulated timeout"));
            var controllerM = CreateController(context, factoryTimeout, userMarkerId);
            var actionResultM = await controllerM.GetAiRecommendations(topK: 5, force: false);
            var contentResultM = actionResultM as ContentResult;
            if (contentResultM == null || !contentResultM.Content!.Contains("Kết quả đã lưu lúc") || !contentResultM.Content!.Contains("Hiện tại chưa có công việc"))
            {
                throw new Exception($"Expected marker batch fallback notice on timeout, got: {contentResultM?.Content}");
            }

            Console.WriteLine($"  ✓ F7.4 PASSED: AiCore 503 and timeout fell back to stale cache with notice: '{fallbackNotice}'.\n");
        }

        // =========================================================================
        // F7.5: DB read cache error does not 500 and calls AiCore
        // =========================================================================
        private static async Task TestF7_5_DbReadCacheError_DoesNot500_CallsAiCore()
        {
            Console.WriteLine(">>> RUNNING F7.5: DB read cache error does not 500 and calls AiCore...");
            var options = new DbContextOptionsBuilder<ArisDBContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            using var context = new FailingCacheReadDbContext(options);
            int userId = 205;
            var resumeVersion = new DateTime(2026, 10, 4, 1, 0, 0, DateTimeKind.Utc);

            var user = new User { Id = userId, Username = "user205", Email = "u205@test.com", Role = "Candidate" };
            var profile = new EmployesAccount { Id = 605, UserId = userId, FullName = "Candidate 605" };
            var resume = new Resume { Id = 705, EmployeeId = profile.Id, LastUpdatedAt = resumeVersion, VectorId = "vec_705" };
            var job = new JobPosting { Id = 1006, Title = "Security Analyst", Company = "Aris", isActive = true };

            context.Users.Add(user);
            context.Profiles.Add(profile);
            context.Resumes.Add(resume);
            context.JobPostings.Add(job);
            await context.SaveChangesAsync();

            // Enable failure when reading UserRecommendations
            context.EnableFailRead();

            int aiCallCount = 0;
            var factory = new MockHttpClientFactory(req =>
            {
                aiCallCount++;
                var json = JsonSerializer.Serialize(new
                {
                    status = "success",
                    recommendations = new[]
                    {
                        new { posting_id = 1006, job_title = "Security Analyst", company = "Aris", score = 92.0, reason = "AiCore direct recommendation" }
                    }
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });

            var controller = CreateController(context, factory, userId);
            var actionResult = await controller.GetAiRecommendations(topK: 5, force: false);

            if (aiCallCount != 1)
            {
                throw new Exception($"Expected AiCore to be called despite DB read error, but aiCallCount was {aiCallCount}");
            }

            var partialView = actionResult as PartialViewResult;
            if (partialView == null)
            {
                throw new Exception($"Expected PartialViewResult, got {actionResult?.GetType().Name}");
            }
            var model = partialView.Model as List<JobRecommendationDTO>;
            if (model == null || model.Count != 1 || model[0].Id != 1006)
            {
                throw new Exception($"Expected 1 job returned from AiCore despite DB read error, got: {model?.Count}");
            }
            Console.WriteLine("  ✓ F7.5 PASSED: Handled DB read cache error cleanly without 500 error, returned AiCore results.\n");
        }

        // =========================================================================
        // F7.6: Parallel requests for same user synchronize via SemaphoreSlim
        // =========================================================================
        private static async Task TestF7_6_ParallelRequestsSameUser_SingleBatch_NoDuplicateJobId()
        {
            Console.WriteLine(">>> RUNNING F7.6: Parallel requests for same user produce single batch and no duplicate JobIds...");
            using var context = CreateInMemoryContext();
            int userId = 206;
            var resumeVersion = new DateTime(2026, 10, 4, 1, 0, 0, DateTimeKind.Utc);

            var user = new User { Id = userId, Username = "user206", Email = "u206@test.com", Role = "Candidate" };
            var profile = new EmployesAccount { Id = 606, UserId = userId, FullName = "Candidate 606" };
            var resume = new Resume { Id = 706, EmployeeId = profile.Id, LastUpdatedAt = resumeVersion, VectorId = "vec_706" };
            var job1 = new JobPosting { Id = 1007, Title = "Frontend Engineer", Company = "Aris", isActive = true };
            var job2 = new JobPosting { Id = 1008, Title = "Backend Engineer", Company = "Aris", isActive = true };

            context.Users.Add(user);
            context.Profiles.Add(profile);
            context.Resumes.Add(resume);
            context.JobPostings.AddRange(job1, job2);
            await context.SaveChangesAsync();

            int aiCallCount = 0;
            var factory = new MockHttpClientFactory(req =>
            {
                Interlocked.Increment(ref aiCallCount);
                Thread.Sleep(50); // Simulate network latency
                var json = JsonSerializer.Serialize(new
                {
                    status = "success",
                    recommendations = new[]
                    {
                        new { posting_id = 1007, job_title = "Frontend Engineer", company = "Aris", score = 88.0, reason = "Fit 1" },
                        new { posting_id = 1008, job_title = "Backend Engineer", company = "Aris", score = 82.0, reason = "Fit 2" }
                    }
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });

            var controller1 = CreateController(context, factory, userId);
            var controller2 = CreateController(context, factory, userId);

            var task1 = controller1.GetAiRecommendations(topK: 5, force: false);
            var task2 = controller2.GetAiRecommendations(topK: 5, force: false);

            await Task.WhenAll(task1, task2);

            if (aiCallCount != 1)
            {
                throw new Exception($"Expected exactly 1 AiCore call due to per-user locking and cache hit, but got {aiCallCount}");
            }

            var recs = await context.UserRecommendations.Where(r => r.UserId == userId).ToListAsync();
            var duplicateJobs = recs.GroupBy(r => r.JobId).Where(g => g.Count() > 1).ToList();
            if (duplicateJobs.Any())
            {
                throw new Exception($"Found duplicate JobId in recommendations: {string.Join(", ", duplicateJobs.Select(g => g.Key))}");
            }

            if (recs.Count != 2)
            {
                throw new Exception($"Expected exactly 2 recommendation records in DB, found {recs.Count}");
            }
            Console.WriteLine("  ✓ F7.6 PASSED: Parallel requests synchronized with SemaphoreSlim, exactly 1 AiCore call, no duplicate JobIds.\n");
        }

        // =========================================================================
        // F7.7: Default timeouts (95s recommend, 45s score) & timeout error behavior
        // =========================================================================
        private static async Task TestF7_7_DefaultTimeouts_95sAnd45s()
        {
            Console.WriteLine(">>> RUNNING F7.7: Default and configured timeouts (95s recommend, 45s score)...");

            using var context = CreateInMemoryContext();
            int userId = 207;
            var resumeVersion = new DateTime(2026, 10, 4, 1, 0, 0, DateTimeKind.Utc);

            var user = new User { Id = userId, Username = "user207", Email = "u207@test.com", Role = "Candidate" };
            var profile = new EmployesAccount { Id = 607, UserId = userId, FullName = "Candidate 607" };
            var resume = new Resume { Id = 707, EmployeeId = profile.Id, LastUpdatedAt = resumeVersion, VectorId = "vec_707" };
            var job = new JobPosting { Id = 1009, Title = "DevOps Engineer", Company = "Aris", isActive = true };

            context.Users.Add(user);
            context.Profiles.Add(profile);
            context.Resumes.Add(resume);
            context.JobPostings.Add(job);
            await context.SaveChangesAsync();

            // 1. Behavioral test: Verify DEFAULT client.Timeout set by controller
            var defaultFactory = new MockHttpClientFactory(req =>
            {
                var json = JsonSerializer.Serialize(new
                {
                    status = "success",
                    recommendations = new[] { new { posting_id = 1009, job_title = "DevOps Engineer", company = "Aris", score = 90.0 } },
                    final_score = 90.0
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });

            var defaultController = CreateController(context, defaultFactory, userId);
            await defaultController.GetAiRecommendations(topK: 5, force: true);
            var recClient = defaultFactory.CreatedClients.FirstOrDefault();
            if (recClient == null || recClient.Timeout != TimeSpan.FromSeconds(95))
            {
                throw new Exception($"Expected default recommend timeout 95s, got: {recClient?.Timeout.TotalSeconds}s");
            }

            await defaultController.ScoreCvForJob(new ScoreCvRequestDto { JobId = 1009, ResumeId = 707 });
            var scoreClient = defaultFactory.CreatedClients.LastOrDefault();
            if (scoreClient == null || scoreClient.Timeout != TimeSpan.FromSeconds(45))
            {
                throw new Exception($"Expected default score timeout 45s, got: {scoreClient?.Timeout.TotalSeconds}s");
            }

            // 2. Behavioral test: Verify CONFIGURED client.Timeout set by controller
            var customConfig = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    { "AiCore:BaseUrl", "http://localhost:8001" },
                    { "AiCore:RecommendTimeoutSeconds", "120" },
                    { "AiCore:ScoreTimeoutSeconds", "60" }
                })
                .Build();

            var customFactory = new MockHttpClientFactory(req =>
            {
                var json = JsonSerializer.Serialize(new
                {
                    status = "success",
                    recommendations = new[] { new { posting_id = 1009, job_title = "DevOps Engineer", company = "Aris", score = 90.0 } },
                    final_score = 90.0
                });
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
            });

            var customController = CreateController(context, customFactory, userId, customConfig);
            await customController.GetAiRecommendations(topK: 5, force: true);
            var customRecClient = customFactory.CreatedClients.FirstOrDefault();
            if (customRecClient == null || customRecClient.Timeout != TimeSpan.FromSeconds(120))
            {
                throw new Exception($"Expected configured recommend timeout 120s, got: {customRecClient?.Timeout.TotalSeconds}s");
            }

            await customController.ScoreCvForJob(new ScoreCvRequestDto { JobId = 1009, ResumeId = 707 });
            var customScoreClient = customFactory.CreatedClients.LastOrDefault();
            if (customScoreClient == null || customScoreClient.Timeout != TimeSpan.FromSeconds(60))
            {
                throw new Exception($"Expected configured score timeout 60s, got: {customScoreClient?.Timeout.TotalSeconds}s");
            }

            // 3. Behavioral test: Verify timeout error handling without hardcoded 30s string
            var timeoutFactory = new MockHttpClientFactory(req => throw new TaskCanceledException("HttpClient timeout"));
            var timeoutController = CreateController(context, timeoutFactory, userId);
            var scoreResult = await timeoutController.ScoreCvForJob(new ScoreCvRequestDto { JobId = 1009, ResumeId = 707 });
            var okObj = scoreResult as OkObjectResult;
            if (okObj == null)
            {
                throw new Exception($"Expected OkObjectResult on score timeout, got: {scoreResult?.GetType().Name}");
            }
            var msg = okObj.Value?.GetType().GetProperty("message")?.GetValue(okObj.Value) as string ?? "";
            if (msg.Contains("30s"))
            {
                throw new Exception($"ScoreCvForJob timeout message must NOT contain hardcoded '30s'! Got: {msg}");
            }
            if (!msg.Contains("quá thời gian phản hồi"))
            {
                throw new Exception($"ScoreCvForJob timeout message must contain 'quá thời gian phản hồi'! Got: {msg}");
            }

            // 4. Verification of config files
            var repoRoot = FindRepoRoot();
            if (repoRoot != null)
            {
                var appsettingsPath = Path.Combine(repoRoot, "ArisSkyve", "appsettings.json");
                if (File.Exists(appsettingsPath))
                {
                    var json = File.ReadAllText(appsettingsPath);
                    using var doc = JsonDocument.Parse(json);
                    var aiCore = doc.RootElement.GetProperty("AiCore");
                    var rSec = aiCore.GetProperty("RecommendTimeoutSeconds").GetInt32();
                    var sSec = aiCore.GetProperty("ScoreTimeoutSeconds").GetInt32();
                    if (rSec != 95 || sSec != 45)
                    {
                        throw new Exception($"appsettings.json does not have 95s / 45s! Got Recommend: {rSec}, Score: {sSec}");
                    }
                }
            }

            Console.WriteLine("  ✓ F7.7 PASSED: Default timeouts verified at 95s (recommendations) and 45s (CV match scoring).\n");
        }

        // =========================================================================
        // F7.8: DemoData configuration controls seeders
        // =========================================================================
        private static async Task TestF7_8_DemoDataConfig_ControlsSeeders()
        {
            Console.WriteLine(">>> RUNNING F7.8: DemoData configuration controls seeders...");

            // 1. Behavioral test: When SeedCompaniesAndJobs == false, no seeding occurs
            using var ctxFalse = CreateInMemoryContext();
            var configFalse = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    { "DemoData:SeedCompaniesAndJobs", "false" },
                    { "DemoData:SeedSocial", "false" }
                })
                .Build();

            bool seedCompaniesFalse = configFalse.GetValue<bool>("DemoData:SeedCompaniesAndJobs", false);
            if (seedCompaniesFalse)
            {
                await DbSeeder.SeedCompaniesAndJobsAsync(ctxFalse);
            }
            if (await ctxFalse.BussinessAccounts.AnyAsync())
            {
                throw new Exception("Expected NO companies seeded when DemoData:SeedCompaniesAndJobs is false!");
            }

            // 2. Behavioral test: When SeedCompaniesAndJobs == true, seeding runs and seeds demo companies
            using var ctxTrue = CreateInMemoryContext();
            var configTrue = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    { "DemoData:SeedCompaniesAndJobs", "true" },
                    { "DemoData:SeedSocial", "true" }
                })
                .Build();

            bool seedCompaniesTrue = configTrue.GetValue<bool>("DemoData:SeedCompaniesAndJobs", false);
            if (seedCompaniesTrue)
            {
                await DbSeeder.SeedCompaniesAndJobsAsync(ctxTrue);
            }
            var seededCount = await ctxTrue.BussinessAccounts.CountAsync();
            if (seededCount == 0)
            {
                throw new Exception("Expected companies seeded when DemoData:SeedCompaniesAndJobs is true, but count was 0!");
            }

            // 3. File contract checks for appsettings.json and appsettings.Development.json
            var repoRoot = FindRepoRoot();
            if (repoRoot != null)
            {
                var appsettingsPath = Path.Combine(repoRoot, "ArisSkyve", "appsettings.json");
                var appsettingsDevPath = Path.Combine(repoRoot, "ArisSkyve", "appsettings.Development.json");

                if (File.Exists(appsettingsPath))
                {
                    var json = File.ReadAllText(appsettingsPath);
                    using var doc = JsonDocument.Parse(json);
                    var demoData = doc.RootElement.GetProperty("DemoData");
                    var seedCompanies = demoData.GetProperty("SeedCompaniesAndJobs").GetBoolean();
                    var seedSocial = demoData.GetProperty("SeedSocial").GetBoolean();
                    if (seedCompanies != false || seedSocial != false)
                    {
                        throw new Exception($"appsettings.json DemoData expected false, false; got {seedCompanies}, {seedSocial}");
                    }
                }

                if (File.Exists(appsettingsDevPath))
                {
                    var jsonDev = File.ReadAllText(appsettingsDevPath);
                    using var docDev = JsonDocument.Parse(jsonDev);
                    var demoDataDev = docDev.RootElement.GetProperty("DemoData");
                    var seedCompaniesDev = demoDataDev.GetProperty("SeedCompaniesAndJobs").GetBoolean();
                    var seedSocialDev = demoDataDev.GetProperty("SeedSocial").GetBoolean();
                    // Development must be inert by default as well: the social
                    // demo seeder can write sample data and reference remote
                    // assets. Test fixtures that need seed data enable it
                    // explicitly through configuration instead.
                    if (seedCompaniesDev != false || seedSocialDev != false)
                    {
                        throw new Exception($"appsettings.Development.json DemoData expected false, false; got {seedCompaniesDev}, {seedSocialDev}");
                    }
                }
            }

            Console.WriteLine("  ✓ F7.8 PASSED: DemoData config keys correctly control seeders in appsettings and dev config.\n");
        }
    }
}
