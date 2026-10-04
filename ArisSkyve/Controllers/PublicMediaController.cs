using System;
using System.IO;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace ArisSkyve.Controllers;

/// <summary>
/// Serves newly uploaded public media from non-static storage. The allowlist
/// here is deliberately narrower than wwwroot so uploaded .html/.svg/etc.
/// can never be resolved as a public document.
/// </summary>
[AllowAnonymous]
[Route("media")]
public sealed class PublicMediaController : Controller
{
    private readonly IWebHostEnvironment _environment;

    public PublicMediaController(IWebHostEnvironment environment)
    {
        _environment = environment;
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
}
