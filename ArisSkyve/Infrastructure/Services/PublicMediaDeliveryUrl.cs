namespace ArisSkyve.Infrastructure.Services;

/// <summary>
/// Owns the browser-facing public-media URL shape. New media includes its
/// collection so the delivery endpoint can verify the Drive metadata; a
/// collection-less form remains only for direct Drive URLs persisted before
/// same-origin delivery was introduced.
/// </summary>
public static class PublicMediaDeliveryUrl
{
    private const string DriveHost = "drive.google.com";
    private const string DriveContentHost = "drive.usercontent.google.com";

    public static string Build(string collection, string fileId, PublicMediaKind kind)
    {
        if (!PublicMediaStorage.TryGetCanonicalCollection(collection, out var canonicalCollection))
            throw new ArgumentException("Unknown public media collection.", nameof(collection));
        if (!GoogleDriveOwnerServiceFactory.IsSafeDriveId(fileId))
            throw new ArgumentException("Invalid Google Drive file ID.", nameof(fileId));

        var url = $"/media/drive/{canonicalCollection}/{fileId}";
        // Chat's legacy Message model stores one URL only. Keep this client-only
        // marker so all chat surfaces can still select a <video> element.
        return kind == PublicMediaKind.Video ? url + "#aris-media=video" : url;
    }

    public static string BuildLegacy(string fileId)
    {
        if (!GoogleDriveOwnerServiceFactory.IsSafeDriveId(fileId))
            throw new ArgumentException("Invalid Google Drive file ID.", nameof(fileId));

        return $"/media/drive/{fileId}";
    }

    /// <summary>
    /// Converts only known Google Drive direct-view/download URLs. Other media
    /// URLs are left untouched, so this is safe to apply while rendering old
    /// records and API payloads.
    /// </summary>
    public static string? ToDeliveryUrl(string? value)
    {
        if (!TryGetDriveFileId(value, out var fileId)) return value;
        var videoMarker = value!.Contains("aris-media=video", StringComparison.OrdinalIgnoreCase)
            ? "#aris-media=video"
            : string.Empty;
        return BuildLegacy(fileId) + videoMarker;
    }

    public static bool TryGetDriveFileId(string? value, out string fileId)
    {
        fileId = string.Empty;
        if (string.IsNullOrWhiteSpace(value) || value.Any(char.IsControl) ||
            !Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            (!string.Equals(uri.Host, DriveHost, StringComparison.OrdinalIgnoreCase) &&
             !string.Equals(uri.Host, DriveContentHost, StringComparison.OrdinalIgnoreCase)))
        {
            return false;
        }

        // The app has historically persisted Drive's /uc direct-view URL. The
        // content host can appear after Drive redirects it, so permit both forms
        // only when they contain an explicit safe file ID query parameter.
        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var separator = pair.IndexOf('=');
            var encodedName = separator >= 0 ? pair[..separator] : pair;
            if (!string.Equals(Uri.UnescapeDataString(encodedName), "id", StringComparison.OrdinalIgnoreCase)) continue;

            var encodedValue = separator >= 0 ? pair[(separator + 1)..] : string.Empty;
            var candidate = Uri.UnescapeDataString(encodedValue.Replace('+', ' '));
            if (!GoogleDriveOwnerServiceFactory.IsSafeDriveId(candidate)) return false;

            fileId = candidate;
            return true;
        }

        return false;
    }
}
