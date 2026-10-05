using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using ArisSkyve.Controllers;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;

var options = new DbContextOptionsBuilder<ArisDBContext>().UseInMemoryDatabase($"auth-consent-{Guid.NewGuid():N}").Options;
await using var db = new ArisDBContext(options);
var magicSecret = $"auth-consent-test-{Guid.NewGuid():N}-0123456789abcdef";
var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
{
    ["Auth:MagicLinkSecret"] = magicSecret,
    ["Authentication:Google:ClientId"] = "fixture-google-client",
    ["Authentication:Google:ClientSecret"] = "fixture-google-secret",
    ["Authentication:Facebook:ClientId"] = "fixture-facebook-client",
    ["Authentication:Facebook:ClientSecret"] = "fixture-facebook-secret",
    ["Smtp:Host"] = "",
    ["AiCore:BaseUrl"] = ""
}).Build();
var mail = new RecordingEmailService();
var services = new ServiceCollection()
    .AddLogging()
    .AddMemoryCache()
    .AddControllersWithViews()
    .Services
    .AddSingleton<IConfiguration>(configuration)
    .AddSingleton<MagicLinkThrottle>()
    .AddSingleton<IAuthenticationService, NoOpAuthenticationService>()
    .BuildServiceProvider();
var http = new DefaultHttpContext { RequestServices = services };
http.Request.Scheme = "http";
http.Request.Host = new HostString("localhost");
var actionContext = new ActionContext(http, new RouteData(), new ControllerActionDescriptor
{
    ControllerName = "Account",
    ActionName = "RequestMagicLink"
});
var controller = new AccountController(db, configuration, new NoHttpClientFactory(), new DevelopmentEnvironment(), mail, new TestFeatureGate())
{
    ControllerContext = new ControllerContext(actionContext),
    Url = new QueryUrlHelper(actionContext)
};

var uncheckedResult = await controller.RequestMagicLink("unchecked@fixture.test", returnView: "Login", acceptTerms: false) as ViewResult;
Check(uncheckedResult?.ViewName == "Login" && controller.ViewData["Error"] is string && mail.Calls == 0,
    "magic-link endpoint rejects missing agreement before attempting email delivery");

var socialUnchecked = controller.GoogleLogin(acceptTerms: false, returnView: "Login");
Check(socialUnchecked is ViewResult && mail.Calls == 0,
    "social-login endpoint rejects missing agreement before starting OAuth");
Check(controller.FacebookLogin(acceptTerms: false, returnView: "Register") is ViewResult && mail.Calls == 0,
    "Facebook login also rejects missing agreement before starting OAuth");

var googleChallenge = controller.GoogleLogin(acceptTerms: true, intent: "business", returnView: "Register") as ChallengeResult;
var googleProperties = googleChallenge?.Properties;
Check(googleProperties != null
      && googleProperties.Items.TryGetValue("aris:terms-accepted", out var googleTerms)
      && googleTerms == "true"
      && googleProperties.Items["aris:return-view"] == "Register"
      && googleProperties.Items["aris:intent"] == "business",
    "accepted Google login carries signed agreement and registration intent into OAuth state");
var facebookChallenge = controller.FacebookLogin(acceptTerms: true, intent: "candidate", returnView: "Login") as ChallengeResult;
var facebookProperties = facebookChallenge?.Properties;
Check(facebookProperties != null
      && facebookProperties.Items.TryGetValue("aris:terms-accepted", out var facebookTerms)
      && facebookTerms == "true",
    "accepted Facebook login carries agreement into OAuth state without calling an external provider");

var checkedResult = await controller.RequestMagicLink("checked@fixture.test", returnView: "Login", acceptTerms: true) as ViewResult;
Check(checkedResult?.ViewName == "Login" && controller.ViewData["Message"] is string && mail.Calls == 1,
    "checked agreement accepts a magic-link request through a non-delivering email stub");
var parsedConfirmUrl = mail.LastUrl == null ? null : new Uri(new Uri("http://localhost"), mail.LastUrl);
Check(parsedConfirmUrl?.AbsolutePath == "/Account/ConfirmMagicLink"
      && QueryHelpers.ParseQuery(parsedConfirmUrl.Query).ContainsKey("token"),
    "checked request creates its signed confirmation link for the local flow");
Check(db.Users.Count() == 0, "requesting a magic link alone does not create an account before link confirmation");

var token = QueryHelpers.ParseQuery(parsedConfirmUrl!.Query)["token"].ToString();
var confirmation = await controller.ConfirmMagicLink(token);
Check(confirmation is RedirectToActionResult { ActionName: "NewUserInfor" }, "a consented signed link completes confirmation for a new account");
var account = await db.Users.SingleAsync(user => user.Email == "checked@fixture.test");
Check(account.PrivacyAcceptedAt.HasValue, "confirming an accepted magic link records the privacy timestamp");
Check(account.CvAiConsentAt == null, "terms acceptance never grants optional CV-AI processing consent");

var legacyPayload = Encoding.UTF8.GetBytes($"legacy@fixture.test|{DateTimeOffset.UtcNow.AddMinutes(30).ToUnixTimeSeconds()}");
using var legacyHmac = new HMACSHA256(Encoding.UTF8.GetBytes(magicSecret));
var legacyToken = $"{WebEncoders.Base64UrlEncode(legacyPayload)}.{WebEncoders.Base64UrlEncode(legacyHmac.ComputeHash(legacyPayload))}";
var legacyConfirmation = await controller.ConfirmMagicLink(legacyToken) as ViewResult;
Check(legacyConfirmation?.ViewName == "Login" && !await db.Users.AnyAsync(user => user.Email == "legacy@fixture.test"),
    "a legacy link without signed agreement cannot bypass the updated consent requirement");

Console.WriteLine("Auth consent behavior checks passed. Email delivery was stubbed; no message was sent.");

static void Check(bool passed, string description)
{
    if (!passed) throw new InvalidOperationException(description);
    Console.WriteLine($"PASS {description}");
}

sealed class RecordingEmailService : IEmailService
{
    public int Calls { get; private set; }
    public string? LastUrl { get; private set; }

    public Task<bool> SendVerificationEmailAsync(string email, string confirmUrl)
    {
        Calls++;
        LastUrl = confirmUrl;
        return Task.FromResult(false);
    }
}

sealed class NoHttpClientFactory : IHttpClientFactory
{
    public HttpClient CreateClient(string name = "") => throw new InvalidOperationException("The test must not call external HTTP services.");
}

sealed class DevelopmentEnvironment : IWebHostEnvironment
{
    public string ApplicationName { get; set; } = "AuthConsentTests";
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public string WebRootPath { get; set; } = Path.GetTempPath();
    public string EnvironmentName { get; set; } = "Development";
    public string ContentRootPath { get; set; } = Path.GetTempPath();
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}

sealed class TestFeatureGate : IV7FeatureGate
{
    public bool Enabled => true;
    public bool Stories => true;
    public bool Polls => true;
    public bool SavedJobs => true;
}

sealed class QueryUrlHelper(ActionContext actionContext) : IUrlHelper
{
    public ActionContext ActionContext { get; } = actionContext;

    public string? Action(UrlActionContext context)
    {
        var path = $"/{context.Controller}/{context.Action}";
        var values = new RouteValueDictionary(context.Values)
            .ToDictionary(pair => pair.Key, pair => Convert.ToString(pair.Value, CultureInfo.InvariantCulture));
        var target = QueryHelpers.AddQueryString(path, values);
        return context.Protocol is null ? target : $"{context.Protocol}://{(string.IsNullOrWhiteSpace(context.Host) ? "localhost" : context.Host)}{target}";
    }

    public string? Content(string? contentPath) => contentPath;
    public bool IsLocalUrl(string? url) => url != null && url.StartsWith("/", StringComparison.Ordinal) && !url.StartsWith("//", StringComparison.Ordinal);
    public string? Link(string? routeName, object? values) => null;
    public string? RouteUrl(UrlRouteContext context) => null;
}

sealed class NoOpAuthenticationService : IAuthenticationService
{
    public Task<AuthenticateResult> AuthenticateAsync(HttpContext context, string? scheme) => Task.FromResult(AuthenticateResult.NoResult());
    public Task ChallengeAsync(HttpContext context, string? scheme, AuthenticationProperties? properties) => Task.CompletedTask;
    public Task ForbidAsync(HttpContext context, string? scheme, AuthenticationProperties? properties) => Task.CompletedTask;
    public Task SignInAsync(HttpContext context, string? scheme, System.Security.Claims.ClaimsPrincipal principal, AuthenticationProperties? properties) => Task.CompletedTask;
    public Task SignOutAsync(HttpContext context, string? scheme, AuthenticationProperties? properties) => Task.CompletedTask;
}
