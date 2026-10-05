using System;
using System.IO;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace ArisSkyve.Controllers;

/// <summary>
/// Serves validated public media. Historical local files remain readable while
/// Drive-backed media is delivered through this same origin; Chrome blocks
/// Drive's direct-view response when it is embedded cross-site.
/// </summary>
[AllowAnonymous]
[Route("media")]
public sealed class PublicMediaController : Controller
{
    private readonly IWebHostEnvironment _environment;
    private readonly IPublicMediaDelivery _delivery;

    public PublicMediaController(IWebHostEnvironment environment, IPublicMediaDelivery delivery)
    {
        _environment = environment;
        _delivery = delivery;
    }

    [HttpGet("{collection}/{fileName}")]
    public IActionResult Get(string collection, string fileName)
    {
        if (!PublicMediaStorage.TryGetStorageDirectory(_environment.ContentRootPath, collection, out var storageDirectory) ||
            !PublicMediaValidator.TryGetStoredMedia(fileName, out var media) ||
            media is null)
        {
            return NotFound();
        }

        var root = Path.GetFullPath(storageDirectory);
        var candidate = Path.GetFullPath(Path.Combine(root, fileName));
        var rootWithSeparator = root.EndsWith(Path.DirectorySeparatorChar.ToString(), StringComparison.Ordinal)
            ? root
            : root + Path.DirectorySeparatorChar;
        if (!candidate.StartsWith(rootWithSeparator, StringComparison.Ordinal) || !System.IO.File.Exists(candidate))
        {
            return NotFound();
        }

        // Do not let a browser MIME-sniff an uploaded payload as HTML or script.
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return PhysicalFile(candidate, media.ContentType, enableRangeProcessing: true);
    }

    /// <summary>
    /// Same-origin endpoint used by all newly generated media URLs. The
    /// collection segment is verified against Drive's application metadata.
    /// </summary>
    [HttpGet("drive/{collection}/{fileId}")]
    public Task<IActionResult> GetDrive(string collection, string fileId) =>
        GetDriveInternalAsync(collection, fileId);

    /// <summary>
    /// Compatibility endpoint for direct Drive URLs saved before same-origin
    /// delivery existed. The backing store still requires the file to be a
    /// tagged object under the configured public-media folder.
    /// </summary>
    [HttpGet("drive/{fileId}")]
    public Task<IActionResult> GetLegacyDrive(string fileId) =>
        GetDriveInternalAsync(null, fileId);

    private async Task<IActionResult> GetDriveInternalAsync(string? expectedCollection, string fileId)
    {
        if (!GoogleDriveOwnerServiceFactory.IsSafeDriveId(fileId) ||
            (expectedCollection is not null && !PublicMediaStorage.TryGetCanonicalCollection(expectedCollection, out _)))
        {
            return NotFound();
        }

        try
        {
            var download = await _delivery.OpenReadAsync(expectedCollection, fileId, HttpContext.RequestAborted);
            if (download is null) return NotFound();

            // The file ID is generated per upload, so its bytes are immutable
            // for normal application flows and safe to cache aggressively.
            Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
            Response.Headers["Cross-Origin-Resource-Policy"] = "same-origin";
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return File(download.Content, download.ContentType, enableRangeProcessing: true);
        }
        catch (PublicMediaStorageException)
        {
            // Never send Drive's error body, metadata, or credentials to a
            // browser. A transient upstream failure can be retried normally.
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
    }
}
