using System.Security.Claims;
using System.Text.Json;
using ArisSkyve.Application.DTOs;
using ArisSkyve.Controllers;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;

var options = new DbContextOptionsBuilder<ArisDBContext>()
    .UseInMemoryDatabase(Guid.NewGuid().ToString())
    .Options;
await using var db = new ArisDBContext(options);

var owner = new User { Id = 1, Username = "builder-owner", Email = "owner@example.test" };
var profile = new EmployesAccount { Id = 10, UserId = owner.Id, User = owner, FullName = "Builder Owner" };
owner.Profile = profile;
var first = new Resume
{
    Id = 100,
    EmployeeId = profile.Id,
    Account = profile,
    Label = "CV đầu tiên",
    BuilderDataJson = "{\"personal\":{\"name\":\"First CV\",\"email\":\"first@example.test\"}}"
};
var second = new Resume
{
    Id = 101,
    EmployeeId = profile.Id,
    Account = profile,
    Label = "CV thứ hai",
    BuilderDataJson = "{\"personal\":{\"name\":\"Second CV\",\"email\":\"second@example.test\"}}"
};
db.Users.Add(owner);
db.Profiles.Add(profile);
db.Resumes.AddRange(first, second);
await db.SaveChangesAsync();

var tempRoot = Path.GetFullPath(Path.Combine(".local", "legacy-builder-targeting-" + Guid.NewGuid().ToString("N")));
var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
var originals = new ResumeOriginalLifecycle(db, new TestEnvironment(tempRoot), config);
var controller = new ResumeController(db, new NoopHttpClientFactory(), config, originals)
{
    ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "1")], "fixture"))
        }
    }
};

var checks = 0;
void Check(bool condition, string label)
{
    if (!condition) throw new Exception(label);
    checks++;
    Console.WriteLine($"PASS {label}");
}

JsonElement Json(IActionResult action)
{
    var result = action as ObjectResult ?? throw new Exception("Expected an object result.");
    return JsonSerializer.SerializeToElement(result.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
}

var genericLoad = Json(await controller.GetBuilderData());
Check(!genericLoad.GetProperty("hasResume").GetBoolean(),
    "A builder URL without resumeId does not load the first CV");

const string newlyCreatedData = "{\"personal\":{\"name\":\"Fresh Builder CV\",\"email\":\"fresh@example.test\"}}";
var firstSave = Json(await controller.SaveBuilderData(new SaveResumeBuilderDto { DataJson = newlyCreatedData }));
var createdId = firstSave.GetProperty("resumeId").GetInt32();
Check(createdId != first.Id && createdId != second.Id && db.Resumes.Count() == 3,
    "An id-less legacy-builder save creates a distinct CV instead of overwriting the first one");
Check(first.BuilderDataJson!.Contains("First CV") && second.BuilderDataJson!.Contains("Second CV"),
    "Creating the new legacy-builder CV leaves every existing CV unchanged");

const string updatedData = "{\"personal\":{\"name\":\"Fresh Builder CV updated\",\"email\":\"updated@example.test\"}}";
var update = Json(await controller.SaveBuilderData(new SaveResumeBuilderDto { ResumeId = createdId, DataJson = updatedData }));
Check(update.GetProperty("resumeId").GetInt32() == createdId && db.Resumes.Count() == 3,
    "A later save with the returned resumeId updates that exact new CV without creating another row");
Check(db.Resumes.Single(r => r.Id == createdId).BuilderDataJson!.Contains("updated@example.test") &&
      first.BuilderDataJson!.Contains("First CV"),
    "The exact-target update cannot alter the original first CV");

var selected = Json(await controller.GetBuilderData(createdId));
Check(selected.GetProperty("hasResume").GetBoolean() && selected.GetProperty("resumeId").GetInt32() == createdId,
    "An explicit resumeId loads the selected CV only");
Check(await controller.SaveBuilderData(new SaveResumeBuilderDto { ResumeId = 999999, DataJson = updatedData }) is NotFoundResult,
    "An unknown explicit target is rejected instead of falling back to another CV");
Check(await controller.SaveBuilderData(new SaveResumeBuilderDto { ResumeId = 0, DataJson = updatedData }) is BadRequestObjectResult,
    "An invalid explicit target is rejected before any CV can be changed");

Console.WriteLine($"LEGACY BUILDER TARGETING: {checks} checks passed.");

sealed class NoopHttpClientFactory : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new();
}

sealed class TestEnvironment(string contentRoot) : IWebHostEnvironment
{
    public string EnvironmentName { get; set; } = "Development";
    public string ApplicationName { get; set; } = "LegacyBuilderTargetingTests";
    public string WebRootPath { get; set; } = contentRoot;
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public string ContentRootPath { get; set; } = contentRoot;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
