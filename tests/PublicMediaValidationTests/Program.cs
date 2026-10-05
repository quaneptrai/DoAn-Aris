using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
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
using Microsoft.Extensions.Logging.Abstractions;

namespace PublicMediaValidationTests;

internal sealed class TestWebHostEnvironment : IWebHostEnvironment
{
    public string EnvironmentName { get; set; } = "Development";
    public string ApplicationName { get; set; } = "PublicMediaValidationTests";
    public string WebRootPath { get; set; } = string.Empty;
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public string ContentRootPath { get; set; } = string.Empty;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}

internal static class Program
{
    private static readonly byte[] ValidJpeg =
    {
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01
    };

    private static readonly byte[] ValidPng =
    {
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D
    };

    private static readonly byte[] ValidMp4 =
    {
        0x00, 0x00, 0x00, 0x18, (byte)'f', (byte)'t', (byte)'y', (byte)'p',
        (byte)'i', (byte)'s', (byte)'o', (byte)'m', 0x00, 0x00, 0x02, 0x00,
        (byte)'i', (byte)'s', (byte)'o', (byte)'m', (byte)'m', (byte)'p', (byte)'4', (byte)'2'
    };

    public static async Task<int> Main()
    {
        try
        {
            Console.WriteLine("--- RUNNING PUBLIC MEDIA UPLOAD HARDENING ---");
            await AcceptsGenuineFormatsAndCanonicalizesNames();
            await RejectsSpoofedMimeExtensionAndPayload();
            await EnforcesImageOnlyAndBrowserMediaPolicies();
            await LegacyLocalMediaCanBeReadUntilMigrated();
            await VerifiesPublicUploadControllersUseTheSharedGuard();
            await GoogleDriveStoreFailsClosedWithoutConfiguration();
            await GoogleDriveOAuthModeFailsClosedWithoutOwnerCredentials();
            VerifiesUrlAndStoredNameAllowLists();
            Console.WriteLine("PASS: public media validation, storage, and serving hardening");
            return 0;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"FAIL: {exception.Message}");
            Console.Error.WriteLine(exception);
            return 1;
        }
    }

    private static async Task AcceptsGenuineFormatsAndCanonicalizesNames()
    {
        var jpeg = await PublicMediaValidator.ValidateAsync(CreateFile(ValidJpeg, "portrait.JPEG", "image/jpeg"));
        Require(jpeg.IsValid && jpeg.Media?.Kind == PublicMediaKind.Image, "A real JPEG must be accepted as an image.");
        Require(jpeg.Media!.ContentType == "image/jpeg" && jpeg.Media.Extension == ".jpg", "JPEG must receive the canonical .jpg extension.");

        var mp4 = await PublicMediaValidator.ValidateAsync(CreateFile(ValidMp4, "clip.m4v", "video/mp4"));
        Require(mp4.IsValid && mp4.Media?.Kind == PublicMediaKind.Video, "A real MP4/M4V must be accepted as a video.");
        Require(mp4.Media!.ContentType == "video/mp4" && mp4.Media.Extension == ".mp4", "MP4 must receive the canonical .mp4 extension.");
    }

    private static async Task RejectsSpoofedMimeExtensionAndPayload()
    {
        var mimeSpoof = await PublicMediaValidator.ValidateAsync(CreateFile(ValidPng, "looks-like.jpg", "image/jpeg"));
        Require(!mimeSpoof.IsValid, "A PNG declared as JPEG must be rejected.");

        var extensionSpoof = await PublicMediaValidator.ValidateAsync(CreateFile(ValidJpeg, "payload.html", "image/jpeg"));
        Require(!extensionSpoof.IsValid, "A JPEG with an HTML extension must be rejected.");

        var htmlPayload = await PublicMediaValidator.ValidateAsync(CreateFile(
            "<script>alert('xss')</script>"u8.ToArray(),
            "payload.png",
            "image/png"));
        Require(!htmlPayload.IsValid, "HTML masquerading as PNG must be rejected.");
    }

    private static async Task EnforcesImageOnlyAndBrowserMediaPolicies()
    {
        var avatarVideo = await PublicMediaValidator.ValidateImageAsync(
            CreateFile(ValidMp4, "not-an-avatar.mp4", "video/mp4"),
            5L * 1024 * 1024);
        Require(!avatarVideo.IsValid, "Avatar/cover policy must reject video even when the file is genuine.");

        var oversizedImage = new byte[(5 * 1024 * 1024) + 1];
        Array.Copy(ValidJpeg, oversizedImage, ValidJpeg.Length);
        var largeAvatar = await PublicMediaValidator.ValidateImageAsync(
            CreateFile(oversizedImage, "large.jpg", "image/jpeg"),
            5L * 1024 * 1024);
        Require(!largeAvatar.IsValid && largeAvatar.Error?.Contains("5 MB", StringComparison.Ordinal) == true, "Avatar/cover policy must retain its 5 MB limit.");

        var validMatroska = new byte[]
        {
            0x1A, 0x45, 0xDF, 0xA3, 0x42, 0x82, 0x88,
            (byte)'m', (byte)'a', (byte)'t', (byte)'r', (byte)'o', (byte)'s', (byte)'k', (byte)'a'
        };
        var postMkv = await PublicMediaValidator.ValidateAsync(CreateFile(validMatroska, "post.mkv", "video/x-matroska"));
        var chatMkv = await PublicMediaValidator.ValidateBrowserMediaAsync(CreateFile(validMatroska, "chat.mkv", "video/x-matroska"));
        Require(postMkv.IsValid && !chatMkv.IsValid, "MKV must stay available only for the post flow that previously supported it.");
    }

    private static async Task LegacyLocalMediaCanBeReadUntilMigrated()
    {
        var root = Path.Combine(Path.GetTempPath(), $"aris-public-media-test-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        try
        {
            var validation = await PublicMediaValidator.ValidateAsync(CreateFile(ValidPng, "image.png", "image/png"));
            Require(validation.Media is not null, "Test PNG must validate before storage.");
            Require(PublicMediaStorage.TryGetStorageDirectory(root, PublicMediaStorage.Posts, out var storageDirectory), "Posts storage directory must resolve.");

            var media = validation.Media ?? throw new InvalidOperationException("Validated PNG media metadata is required.");
            var storedName = await PublicMediaValidator.SaveAsync(CreateFile(ValidPng, "image.png", "image/png"), media, storageDirectory);
            Require(storedName.EndsWith(".png", StringComparison.Ordinal) && storedName.Length == 36, "Storage must create a GUID filename with a canonical extension.");

            var storedPath = Path.Combine(storageDirectory, storedName);
            Require(File.Exists(storedPath), "Validated upload must be stored.");
            Require(File.ReadAllBytes(storedPath).SequenceEqual(ValidPng), "Stored bytes must match the validated upload.");
            Require(!File.Exists(Path.Combine(root, "wwwroot", "uploads", "posts", storedName)), "New media must not be written to wwwroot/uploads.");

            var controller = new PublicMediaController(new TestWebHostEnvironment { ContentRootPath = root });
            controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
            var result = controller.Get(PublicMediaStorage.Posts, storedName);
            var physical = result as PhysicalFileResult ?? throw new InvalidOperationException("Expected a physical media result.");
            Require(physical.ContentType == "image/png" && physical.EnableRangeProcessing, "Media endpoint must use an explicit allowed MIME type and range processing.");
            Require(controller.Response.Headers["X-Content-Type-Options"] == "nosniff", "Media endpoint must return nosniff.");
            Require(controller.Get(PublicMediaStorage.Stories, storedName) is NotFoundResult, "A file cannot be read from a different collection.");
            Require(controller.Get(PublicMediaStorage.Posts, "../../payload.png") is NotFoundResult, "Path traversal must be rejected.");
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
        }
    }

    private static async Task VerifiesPublicUploadControllersUseTheSharedGuard()
    {
        await using var db = CreateContext();
        var store = new FakePublicMediaStore();
        var invalidPng = CreateFile("<script>alert('xss')</script>"u8.ToArray(), "payload.png", "image/png");

        var dashboard = new DashboardController(db, new EnabledFeatureGate(), null!, store)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        var dashboardResult = await dashboard.CreatePost("post", null, new List<IFormFile> { invalidPng });
        Require(!SuccessOf(dashboardResult), "Dashboard must reject an invalid media payload before creating a post.");

        var stories = new StoriesController(db, new EnabledFeatureGate(), store)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        var storyResult = await stories.Create(CreateFile("<script>x</script>"u8.ToArray(), "payload.png", "image/png"), null, null, null);
        Require(!SuccessOf(storyResult), "Stories must reject an invalid media payload before creating a story.");

        var chat = new ChatController(db, store)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        var chatResult = await chat.UploadChatMedia(CreateFile(ValidMp4, "chat.mp4", "video/mp4"));
        var chatPayload = JsonOf(chatResult);
        Require(chatPayload.GetProperty("success").GetBoolean(), "Chat must accept a genuine MP4 video.");
        Require(chatPayload.GetProperty("kind").GetString() == "video", "Chat must return the validated video kind.");
        Require(chatPayload.GetProperty("url").GetString()?.EndsWith("#aris-media=video", StringComparison.Ordinal) == true, "Chat video URLs must carry the Drive-safe video marker.");
        var remoteChatResult = await chat.UploadChatImage(CreateFile("<script>x</script>"u8.ToArray(), "payload.png", "image/png"));
        Require(!SuccessOf(remoteChatResult), "Remote chat image upload must reject invalid media before contacting storage.");

        db.Users.Add(new User { Id = 77, Username = "media-test", Email = "media-test@example.test", Role = "Candidate" });
        await db.SaveChangesAsync();
        var settings = new SettingsController(db, null!, store)
        {
            ControllerContext = new ControllerContext { HttpContext = AuthenticatedHttpContext(77) }
        };

        var avatarPayload = JsonOf(await settings.UpdateAvatar(CreateFile(ValidPng, "avatar.png", "image/png")));
        Require(avatarPayload.GetProperty("success").GetBoolean(), "Avatar endpoint must accept a genuine PNG.");
        Require(avatarPayload.GetProperty("avatarUrl").GetString()?.StartsWith("https://drive.google.com/", StringComparison.Ordinal) == true, "Avatar must return the remote Google Drive URL.");

        var coverPayload = JsonOf(await settings.UpdateCoverPhoto(CreateFile(ValidJpeg, "cover.jpg", "image/jpeg")));
        Require(coverPayload.GetProperty("success").GetBoolean(), "Cover endpoint must accept a genuine JPEG.");
        Require(coverPayload.GetProperty("coverUrl").GetString()?.StartsWith("https://drive.google.com/", StringComparison.Ordinal) == true, "Cover must return the remote Google Drive URL.");

        var authenticatedDashboard = new DashboardController(db, new EnabledFeatureGate(), null!, store)
        {
            ControllerContext = new ControllerContext { HttpContext = AuthenticatedHttpContext(77) }
        };
        Require(SuccessOf(await authenticatedDashboard.CreatePost("post", null, new List<IFormFile> { CreateFile(ValidMp4, "post.mp4", "video/mp4") })),
            "Post video must upload through the remote store before publishing the post.");
        var postMedia = db.PostMedias.Single();
        Require(postMedia.MediaType == "video" && postMedia.MediaUrl.EndsWith("#aris-media=video", StringComparison.Ordinal),
            "A post must persist both its video kind and remote Drive URL.");

        var authenticatedStories = new StoriesController(db, new EnabledFeatureGate(), store)
        {
            ControllerContext = new ControllerContext { HttpContext = AuthenticatedHttpContext(77) }
        };
        var storyPayload = JsonOf(await authenticatedStories.Create(CreateFile(ValidMp4, "story.mp4", "video/mp4"), null, null, null));
        Require(storyPayload.GetProperty("success").GetBoolean(), "Story video must upload through the remote store before publishing the story.");
        Require(storyPayload.GetProperty("story").GetProperty("mediaType").GetString() == "video", "Story API must retain the video kind.");

        Require(store.Uploads.Select(upload => upload.Collection).OrderBy(collection => collection).SequenceEqual(new[]
        {
            PublicMediaStorage.Avatars,
            PublicMediaStorage.Chat,
            PublicMediaStorage.Covers,
            PublicMediaStorage.Posts,
            PublicMediaStorage.Stories
        }), "Public upload controllers must use the injected remote store, not the local root.");
    }

    private static async Task GoogleDriveStoreFailsClosedWithoutConfiguration()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["GoogleDrive:Enabled"] = "false" })
            .Build();
        using var store = new GoogleDrivePublicMediaStore(configuration, NullLogger<GoogleDrivePublicMediaStore>.Instance);
        var validation = await PublicMediaValidator.ValidateImageAsync(CreateFile(ValidPng, "drive.png", "image/png"), 5L * 1024 * 1024);
        Require(validation.Media is not null, "A real image is required to exercise the configured media store.");

        try
        {
            await store.UploadAsync(PublicMediaStorage.Posts, CreateFile(ValidPng, "drive.png", "image/png"), validation.Media!);
            throw new InvalidOperationException("An unconfigured Drive store must not fall back to local disk.");
        }
        catch (PublicMediaStorageException)
        {
            // Expected: local disk is intentionally not a fallback.
        }
    }

    private static async Task GoogleDriveOAuthModeFailsClosedWithoutOwnerCredentials()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GoogleDrive:Enabled"] = "true",
                ["GoogleDrive:FolderId"] = "personal-drive-folder",
                ["GoogleDrive:AuthMode"] = "OAuthRefreshToken",
                ["GoogleDrive:MakeFilesPublic"] = "true"
            })
            .Build();
        using var store = new GoogleDrivePublicMediaStore(configuration, NullLogger<GoogleDrivePublicMediaStore>.Instance);
        var validation = await PublicMediaValidator.ValidateImageAsync(CreateFile(ValidPng, "drive.png", "image/png"), 5L * 1024 * 1024);
        Require(validation.Media is not null, "A real image is required to exercise OAuth Drive configuration.");

        try
        {
            await store.UploadAsync(PublicMediaStorage.Posts, CreateFile(ValidPng, "drive.png", "image/png"), validation.Media!);
            throw new InvalidOperationException("An incomplete OAuth Drive configuration must not fall back to local disk.");
        }
        catch (PublicMediaStorageException)
        {
            // Expected: owner OAuth credentials must be complete before any upload.
        }
    }

    private static void VerifiesUrlAndStoredNameAllowLists()
    {
        Require(PublicMediaValidator.IsSafeRemoteMediaUrl("https://cdn.example.test/media/image.jpg"), "HTTPS media URL must be accepted.");
        Require(PublicMediaValidator.IsSafeRemoteMediaUrl("/media/posts/file.jpg"), "App-relative media URL must be accepted.");
        Require(!PublicMediaValidator.IsSafeRemoteMediaUrl("javascript:alert(1)"), "javascript: URL must be rejected.");
        Require(!PublicMediaValidator.IsSafeRemoteMediaUrl("data:text/html,x"), "data: URL must be rejected.");
        Require(!PublicMediaValidator.IsSafeRemoteMediaUrl("//untrusted.example/media"), "Protocol-relative URL must be rejected.");
        Require(!PublicMediaValidator.TryGetStoredMedia("not-a-guid.png", out _), "Non-generated storage filename must be rejected.");
        Require(!PublicMediaValidator.TryGetStoredMedia("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.html", out _), "Disallowed storage extension must be rejected.");
        Require(PublicMediaValidator.IsAllowedMediaExtension(".webp"), "Known image extension must be allowed for legacy static guarding.");
        Require(PublicMediaValidator.IsAllowedMediaExtension("video.m4v"), "Known MP4 alias must be allowed for legacy static guarding.");
        Require(!PublicMediaValidator.IsAllowedMediaExtension(".html"), "HTML must not be allowed for legacy static guarding.");
        Require(PublicMediaStorage.TryGetStorageDirectory("C:\\content", PublicMediaStorage.Avatars, out _), "Avatar collection must resolve.");
        Require(PublicMediaStorage.TryGetStorageDirectory("C:\\content", PublicMediaStorage.Covers, out _), "Cover collection must resolve.");
        Require(PublicMediaStorage.TryGetStorageDirectory("C:\\content", PublicMediaStorage.Chat, out _), "Chat collection must resolve.");
    }

    private static IFormFile CreateFile(byte[] contents, string name, string contentType)
    {
        var stream = new MemoryStream(contents, writable: false);
        return new FormFile(stream, 0, contents.Length, "file", name)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    private static ArisDBContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ArisDBContext>()
            .UseInMemoryDatabase($"public-media-test-{Guid.NewGuid():N}")
            .Options;
        return new ArisDBContext(options);
    }

    private static DefaultHttpContext AuthenticatedHttpContext(int userId)
    {
        var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "test");
        return new DefaultHttpContext { User = new ClaimsPrincipal(identity) };
    }

    private static bool SuccessOf(IActionResult result) => JsonOf(result).GetProperty("success").GetBoolean();

    private static JsonElement JsonOf(IActionResult result)
    {
        var value = (result as JsonResult)?.Value ?? throw new InvalidOperationException($"Expected JsonResult, got {result.GetType().Name}.");
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(value));
        return document.RootElement.Clone();
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }

    private sealed class EnabledFeatureGate : IV7FeatureGate
    {
        public bool Enabled => true;
        public bool Stories => true;
        public bool Polls => true;
        public bool SavedJobs => true;
    }

    private sealed class FakePublicMediaStore : IPublicMediaStore
    {
        public List<(string Collection, string FileId)> Uploads { get; } = new();

        public Task<PublicMediaUpload> UploadAsync(string collection, IFormFile file, ValidatedPublicMedia media, CancellationToken cancellationToken = default)
        {
            var fileId = $"fake{Uploads.Count + 1:D8}";
            Uploads.Add((collection, fileId));
            var videoMarker = media.Kind == PublicMediaKind.Video ? "#aris-media=video" : string.Empty;
            return Task.FromResult(new PublicMediaUpload($"https://drive.google.com/uc?export=view&id={fileId}&resourcekey=fake-key{videoMarker}", fileId));
        }

        public Task DeleteAsync(string fileId, CancellationToken cancellationToken = default)
        {
            Uploads.RemoveAll(upload => upload.FileId == fileId);
            return Task.CompletedTask;
        }
    }
}
