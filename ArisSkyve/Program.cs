using ArisSkyve.Infrastructure.Data;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using ArisSkyve.Hubs;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.Facebook;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.FileProviders;
using ArisSkyve.Infrastructure.Services.Recruitment;
using System.Net;

var builder = WebApplication.CreateBuilder(args);
var useEphemeralE2E = builder.Configuration.GetValue<bool>("E2E:UseInMemoryDatabase");
if (useEphemeralE2E && !builder.Environment.IsDevelopment())
{
    throw new InvalidOperationException("E2E:UseInMemoryDatabase is allowed only when ASPNETCORE_ENVIRONMENT is Development.");
}

var disableE2EBackgroundServices = useEphemeralE2E && builder.Configuration.GetValue("E2E:DisableBackgroundServices", true);
var e2eDatabaseName = builder.Configuration["E2E:DatabaseName"]?.Trim();
if (useEphemeralE2E && string.IsNullOrWhiteSpace(e2eDatabaseName))
{
    e2eDatabaseName = $"aris-e2e-{Guid.NewGuid():N}";
}

var google = builder.Configuration.GetSection("Authentication:Google");
var facebook = builder.Configuration.GetSection("Authentication:Facebook");
// Add services to the container.
// Protect every unsafe MVC action by default.  Individual actions should only
// opt out when they authenticate a non-browser caller by another verified means
// (for example, the Zalo webhook's configured secret header).
builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(new Microsoft.AspNetCore.Mvc.AutoValidateAntiforgeryTokenAttribute());
});
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "RequestVerificationToken";
});
// Persist data-protection keys (auth cookies, antiforgery tokens, TempData) under App_Data. Shared IIS
// hosting often has no user profile, so keys would otherwise be ephemeral: every app-pool recycle or
// redeploy would sign everyone out and reject open forms. App_Data is git-ignored and never published.
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "App_Data", "dataprotection-keys")))
    .SetApplicationName("ArisSkyve");
builder.Services.AddHttpClient();
builder.Services.AddHttpClient("resume-original-fetch")
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
// Public user-generated media is stored only in the configured Google Drive folder.
// If Drive is unavailable/misconfigured, uploads fail instead of falling back to the
// application's local content root.
builder.Services.AddSingleton<IPublicMediaStore, GoogleDrivePublicMediaStore>();
// Every IHttpClientFactory client sends the AiCore service key (AiCore:ApiKey) to AiCore:BaseUrl only,
// and the resume parser key (ResumeEngine:ParserApiKey) to ResumeEngine:ParserUrl only.
builder.Services.AddTransient<AiCoreKeyHandler>();
builder.Services.AddTransient<ResumeParserKeyHandler>();
builder.Services.ConfigureHttpClientDefaults(http => http
    .AddHttpMessageHandler<AiCoreKeyHandler>()
    .AddHttpMessageHandler<ResumeParserKeyHandler>());
builder.Services.AddScoped<IEmailService, EmailService>();
// Passwordless sign-in: limit login-email requests per IP (rate limiter) and per recipient address.
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<MagicLinkThrottle>();
builder.Services.AddRateLimiter(AuthRateLimits.Configure);
// Private imported-PDF originals are retained only by the bounded lifecycle service;
// the worker handles browser-abandoned uploads without relying on an unload request.
builder.Services.AddScoped<ResumeOriginalLifecycle>();
if (!disableE2EBackgroundServices)
{
    builder.Services.AddHostedService<ResumeOriginalCleanupWorker>();
}
builder.Services.AddSingleton<V7FeatureGate>();
builder.Services.AddSingleton<IV7FeatureGate>(sp => sp.GetRequiredService<V7FeatureGate>());
if (!disableE2EBackgroundServices)
{
    builder.Services.AddHostedService(sp => sp.GetRequiredService<V7FeatureGate>());
}
// Tuyển dụng: chấm CV đã nộp bằng AiCore ở nền + nhắc lịch phỏng vấn / phiếu đánh giá.
builder.Services.AddScoped<ApplicationMatchService>();
builder.Services.AddScoped<SkillGapService>();
builder.Services.AddSingleton<ApplicationScoringQueue>();
if (!disableE2EBackgroundServices)
{
    builder.Services.AddHostedService<ApplicationScoringWorker>();
    builder.Services.AddHostedService<RecruitmentReminderWorker>();
}
builder.Services.AddSignalR();
builder.Services.AddDbContextPool<ArisDBContext>(options =>
{
    if (useEphemeralE2E)
    {
        options.UseInMemoryDatabase(e2eDatabaseName!);
        return;
    }

    var connection = builder.Configuration.GetConnectionString("DefaultConnection");
    if (string.IsNullOrWhiteSpace(connection))
    {
        throw new InvalidOperationException("ConnectionStrings:DefaultConnection must be supplied through an environment variable or a development User Secrets store.");
    }

    options.UseSqlServer(connection);
});
var authentication = builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
})
.AddCookie(options =>
{
    options.LoginPath = "/Account/Login";
    options.ExpireTimeSpan = TimeSpan.FromDays(7);
    options.SlidingExpiration = true;
});

if (!string.IsNullOrWhiteSpace(google["ClientId"]) && !string.IsNullOrWhiteSpace(google["ClientSecret"]))
{
    authentication.AddGoogle(options =>
    {
        options.ClientId = google["ClientId"]!;
        options.ClientSecret = google["ClientSecret"]!;
        options.CallbackPath = "/signin-google";
    });
}

if (!string.IsNullOrWhiteSpace(facebook["ClientId"]) && !string.IsNullOrWhiteSpace(facebook["ClientSecret"]))
{
    authentication.AddFacebook(options =>
    {
        options.AppId = facebook["ClientId"]!;
        options.AppSecret = facebook["ClientSecret"]!;
        options.CallbackPath = "/signin-facebook";
    });
}
builder.Services.AddAuthorization();
var app = builder.Build();

var connection = builder.Configuration.GetConnectionString("DefaultConnection");
string serverName = "unknown";
string dbName = "unknown";
if (useEphemeralE2E)
{
    serverName = "in-memory";
    dbName = e2eDatabaseName!;
}
else if (!string.IsNullOrEmpty(connection))
{
    try
    {
        var csb = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(connection);
        serverName = csb.DataSource;
        dbName = csb.InitialCatalog;
    }
    catch
    {
        // Safe fallback
    }
}
app.Logger.LogInformation("Aris khởi động — Môi trường: {Environment} | Server: {Server} | Database: {Database}",
    app.Environment.EnvironmentName, serverName, dbName);

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
var seedCompanies = !useEphemeralE2E && app.Configuration.GetValue<bool>("DemoData:SeedCompaniesAndJobs", false);
var seedSocial = !useEphemeralE2E && app.Configuration.GetValue<bool>("DemoData:SeedSocial", false);

if (seedCompanies || seedSocial)
{
    using var seedScope = app.Services.CreateScope();
    var seedContext = seedScope.ServiceProvider.GetRequiredService<ArisDBContext>();
    if (seedCompanies)
    {
        app.Logger.LogInformation("DemoData: Đang chạy DbSeeder.SeedCompaniesAndJobsAsync...");
        await DbSeeder.SeedCompaniesAndJobsAsync(seedContext);
        app.Logger.LogInformation("DemoData: Hoàn thành DbSeeder.SeedCompaniesAndJobsAsync.");
    }
    else
    {
        app.Logger.LogInformation("DemoData: SeedCompaniesAndJobs đã tắt.");
    }

    if (seedSocial)
    {
        app.Logger.LogInformation("DemoData: Đang chạy DemoSocialSeeder.SeedAsync...");
        await DemoSocialSeeder.SeedAsync(seedContext, app.Logger);
        app.Logger.LogInformation("DemoData: Hoàn thành DemoSocialSeeder.SeedAsync.");
    }
    else
    {
        app.Logger.LogInformation("DemoData: SeedSocial đã tắt.");
    }
}
else
{
    app.Logger.LogInformation("DemoData: SeedCompaniesAndJobs đã tắt | SeedSocial đã tắt.");
}

app.UseStatusCodePagesWithReExecute("/Home/Error", "?statusCode={0}");

app.UseHttpsRedirection();

// Served via the classic (non-fingerprinted, non-precompressed) static file middleware
// instead of MapStaticAssets below: under `dotnet watch`, its hot-reload script injector
// assumes gzip and crashes ("unsupported compression method") on the Brotli-precompressed
// plain .html files MapStaticAssets serves in dev. These are pre-built static pages with
// no Razor/hot-reload need, so skipping that pipeline entirely sidesteps the bug.
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.Combine(app.Environment.WebRootPath, "cv-builder")),
    RequestPath = "/cv-builder"
});

// General wwwroot static files. MapStaticAssets() below only serves the build-time
// fingerprinted asset manifest, so it never picks up files written at runtime (avatars,
// cover photos, post media under wwwroot/uploads) — those 404 without this.
// Older records can still point at wwwroot/uploads. Never let a legacy upload
// resolve as HTML, SVG, script, or another active/document format: new uploads
// are now stored in Google Drive by IPublicMediaStore, while this gate keeps old
// URLs backwards-compatible only for the binary media formats we recognize.
app.Use(async (context, next) =>
{
    var requestPath = context.Request.Path.Value;
    if (requestPath?.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase) == true &&
        !PublicMediaValidator.IsAllowedMediaExtension(Path.GetExtension(requestPath)))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    await next();
});

// General wwwroot static files retain support for legacy binary media. Apply
// nosniff even to that allowlist so browsers never reinterpret a media response
// as active content. New uploads use Google Drive, not this local route.
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        var requestPath = context.Context.Request.Path.Value;
        if (requestPath?.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase) == true)
        {
            context.Context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        }
    }
});

app.UseRouting();
if (useEphemeralE2E)
{
    app.Use(async (context, next) =>
    {
        var remoteIp = context.Connection.RemoteIpAddress;
        if (remoteIp is null || !IPAddress.IsLoopback(remoteIp))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        await next();
    });
}
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapStaticAssets();

app.MapHub<ChatHub>("/hubs/chat");
app.MapHub<VideoCallHub>("/hubs/videocall");

app.MapGet("/", (HttpContext context) =>
{
    if (context.User.Identity?.IsAuthenticated == true)
        return Results.Redirect("/Dashboard");
    return Results.Redirect("/Account/Login");
});

app.MapControllerRoute(
    name: "default",
    pattern: "{controller}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
