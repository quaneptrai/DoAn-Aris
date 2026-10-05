using Google;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Drive.v3;
using Google.Apis.Drive.v3.Data;
using Google.Apis.Upload;
using Microsoft.AspNetCore.Http;
using DriveFile = Google.Apis.Drive.v3.Data.File;

namespace ArisSkyve.Infrastructure.Services;

/// <summary>
/// Contract for user-generated media that is deliberately public.  The caller
/// validates the file before calling this service; the store supplies the
/// durable public URL that is persisted in the application's existing URL
/// fields.
/// </summary>
public interface IPublicMediaStore
{
    Task<PublicMediaUpload> UploadAsync(
        string collection,
        IFormFile file,
        ValidatedPublicMedia media,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(string fileId, CancellationToken cancellationToken = default);
}

public sealed record PublicMediaUpload(string Url, string FileId);

/// <summary>
/// A configuration or upstream-storage failure. Controllers deliberately turn
/// this into an upload error instead of silently writing a fallback copy under
/// the application's local content root.
/// </summary>
public sealed class PublicMediaStorageException : Exception
{
    public PublicMediaStorageException(string message) : base(message) { }

    public PublicMediaStorageException(string message, Exception innerException) : base(message, innerException) { }
}

public sealed class GoogleDrivePublicStorageOptions
{
    public bool Enabled { get; init; }
    public string? FolderId { get; init; }
    /// <summary>Private parent used only for imported Resume Studio PDFs.</summary>
    public string? PrivateResumeOriginalsFolderId { get; init; }
    /// <summary>ServiceAccount for Workspace Shared Drives; OAuthRefreshToken for a personal My Drive owner.</summary>
    public string AuthMode { get; init; } = "ServiceAccount";
    public string? ServiceAccountJson { get; init; }
    public string? ServiceAccountJsonBase64 { get; init; }
    public string? OAuthClientId { get; init; }
    public string? OAuthClientSecret { get; init; }
    public string? OAuthRefreshToken { get; init; }
    public bool UseSharedDrive { get; init; }
    public bool MakeFilesPublic { get; init; } = true;
    public string? PublicUrlTemplate { get; init; }
}

/// <summary>
/// Stores validated public media in a Google Drive folder.  The configured
/// folder must be writable by the configured Drive owner and should remain
/// private; each completed file receives its own link-only
/// <c>anyone:reader</c> permission. This prevents an incomplete upload from
/// being publicly listed through a shared parent folder.
/// </summary>
public sealed class GoogleDrivePublicMediaStore : IPublicMediaStore, IDisposable
{
    private const string DefaultPublicUrlTemplate = "https://drive.google.com/uc?export=view&id={fileId}";
    private const int UploadChunkSize = 2 * 1024 * 1024;

    private readonly GoogleDrivePublicStorageOptions _options;
    private readonly ILogger<GoogleDrivePublicMediaStore> _logger;
    private readonly Lazy<DriveService> _driveService;

    public GoogleDrivePublicMediaStore(IConfiguration configuration, ILogger<GoogleDrivePublicMediaStore> logger)
    {
        _options = configuration.GetSection("GoogleDrive").Get<GoogleDrivePublicStorageOptions>() ?? new GoogleDrivePublicStorageOptions();
        _logger = logger;
        _driveService = new Lazy<DriveService>(CreateDriveService, LazyThreadSafetyMode.ExecutionAndPublication);
    }

    public async Task<PublicMediaUpload> UploadAsync(
        string collection,
        IFormFile file,
        ValidatedPublicMedia media,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(file);
        ArgumentNullException.ThrowIfNull(media);
        if (!PublicMediaStorage.IsSupportedCollection(collection))
            throw new ArgumentException("Unknown public media collection.", nameof(collection));

        var service = _driveService.Value;
        var fileName = media.CreateStorageFileName();
        string? fileId = null;

        try
        {
            var metadata = new DriveFile
            {
                Name = fileName,
                MimeType = media.ContentType,
                Parents = new[] { _options.FolderId! },
                AppProperties = new Dictionary<string, string>
                {
                    ["aris_collection"] = collection,
                    ["aris_public_media"] = "true"
                }
            };

            await using var source = file.OpenReadStream();
            var create = service.Files.Create(metadata, source, media.ContentType);
            create.Fields = "id,resourceKey";
            create.SupportsAllDrives = _options.UseSharedDrive;
            create.ChunkSize = UploadChunkSize;
            var progress = await create.UploadAsync(cancellationToken).ConfigureAwait(false);
            fileId = create.ResponseBody?.Id;
            if (progress.Status != UploadStatus.Completed || string.IsNullOrWhiteSpace(fileId))
                throw new PublicMediaStorageException("Google Drive did not complete the upload.");

            var permission = service.Permissions.Create(new Permission
            {
                Type = "anyone",
                Role = "reader",
                AllowFileDiscovery = false
            }, fileId);
            permission.Fields = "id";
            permission.SupportsAllDrives = _options.UseSharedDrive;
            await permission.ExecuteAsync(cancellationToken).ConfigureAwait(false);

            // Link-shared Drive files can require a resource key for visitors who
            // have never opened the file. Fetch it after creating the public
            // permission so every generated public URL can carry it when Drive
            // supplies one.
            var resourceKey = create.ResponseBody?.ResourceKey;
            var readMetadata = service.Files.Get(fileId);
            readMetadata.Fields = "resourceKey";
            readMetadata.SupportsAllDrives = _options.UseSharedDrive;
            resourceKey = (await readMetadata.ExecuteAsync(cancellationToken).ConfigureAwait(false)).ResourceKey ?? resourceKey;

            return new PublicMediaUpload(BuildPublicUrl(fileId, resourceKey, media.Kind), fileId);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            await DeleteIncompleteUploadAsync(service, fileId).ConfigureAwait(false);
            throw;
        }
        catch (PublicMediaStorageException)
        {
            await DeleteIncompleteUploadAsync(service, fileId).ConfigureAwait(false);
            throw;
        }
        catch (TokenResponseException exception)
        {
            await DeleteIncompleteUploadAsync(service, fileId).ConfigureAwait(false);
            _logger.LogWarning(exception, "Google Drive owner authorization is no longer valid for public media collection {Collection}.", collection);
            throw new PublicMediaStorageException("Google Drive authorization has expired or was revoked. Re-authorize the Drive owner and update the refresh token.", exception);
        }
        catch (GoogleApiException exception)
        {
            await DeleteIncompleteUploadAsync(service, fileId).ConfigureAwait(false);
            _logger.LogWarning(exception, "Google Drive rejected a public media upload for collection {Collection}.", collection);
            throw new PublicMediaStorageException("Google Drive could not store the upload.", exception);
        }
        catch (Exception exception) when (exception is HttpRequestException or IOException or InvalidOperationException)
        {
            await DeleteIncompleteUploadAsync(service, fileId).ConfigureAwait(false);
            _logger.LogWarning(exception, "Google Drive was unavailable for public media collection {Collection}.", collection);
            throw new PublicMediaStorageException("Public media storage is temporarily unavailable.", exception);
        }
    }

    public void Dispose()
    {
        if (_driveService.IsValueCreated)
            _driveService.Value.Dispose();
    }

    public async Task DeleteAsync(string fileId, CancellationToken cancellationToken = default)
    {
        if (!GoogleDriveOwnerServiceFactory.IsSafeDriveId(fileId))
            throw new ArgumentException("Invalid Google Drive file ID.", nameof(fileId));

        try
        {
            var delete = _driveService.Value.Files.Delete(fileId);
            delete.SupportsAllDrives = _options.UseSharedDrive;
            await delete.ExecuteAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (TokenResponseException exception)
        {
            _logger.LogWarning(exception, "Google Drive owner authorization is no longer valid while deleting public media object {FileId}.", fileId);
            throw new PublicMediaStorageException("Google Drive authorization has expired or was revoked. Re-authorize the Drive owner and update the refresh token.", exception);
        }
        catch (GoogleApiException exception)
        {
            _logger.LogWarning(exception, "Google Drive rejected deletion of public media object {FileId}.", fileId);
            throw new PublicMediaStorageException("Google Drive could not remove the uploaded media.", exception);
        }
        catch (Exception exception) when (exception is HttpRequestException or IOException or InvalidOperationException)
        {
            _logger.LogWarning(exception, "Google Drive was unavailable while deleting public media object {FileId}.", fileId);
            throw new PublicMediaStorageException("Public media storage is temporarily unavailable.", exception);
        }
    }

    private DriveService CreateDriveService()
    {
        if (!_options.Enabled)
            throw new PublicMediaStorageException("Google Drive public media storage is disabled.");
        if (!GoogleDriveOwnerServiceFactory.IsSafeDriveId(_options.FolderId))
            throw new PublicMediaStorageException("Google Drive FolderId is missing or invalid.");
        if (!_options.MakeFilesPublic)
            throw new PublicMediaStorageException("Google Drive public media storage must grant public read access.");

        try
        {
            return GoogleDriveOwnerServiceFactory.Create(_options, "ArisSkyve public media storage");
        }
        catch (GoogleDriveOwnerConfigurationException exception)
        {
            throw new PublicMediaStorageException(exception.Message, exception);
        }
    }

    private string BuildPublicUrl(string fileId, string? resourceKey, PublicMediaKind kind)
    {
        var template = string.IsNullOrWhiteSpace(_options.PublicUrlTemplate)
            ? DefaultPublicUrlTemplate
            : _options.PublicUrlTemplate.Trim();
        if (!template.Contains("{fileId}", StringComparison.Ordinal))
            throw new PublicMediaStorageException("Google Drive PublicUrlTemplate must contain {fileId}.");

        var url = template.Replace("{fileId}", Uri.EscapeDataString(fileId), StringComparison.Ordinal);
        if (template.Contains("{resourceKey}", StringComparison.Ordinal))
        {
            url = url.Replace("{resourceKey}", Uri.EscapeDataString(resourceKey ?? string.Empty), StringComparison.Ordinal);
        }
        if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed) || !string.Equals(parsed.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
            throw new PublicMediaStorageException("Google Drive PublicUrlTemplate must produce an HTTPS URL.");

        // Drive's link-sharing security update can require this key for visitors
        // who have no prior access. Preserve custom URL templates as-is unless
        // they explicitly opt into the {resourceKey} placeholder.
        if (!string.IsNullOrWhiteSpace(resourceKey) &&
            !template.Contains("{resourceKey}", StringComparison.Ordinal) &&
            string.Equals(parsed.Host, "drive.google.com", StringComparison.OrdinalIgnoreCase) &&
            !parsed.Query.Contains("resourcekey=", StringComparison.OrdinalIgnoreCase))
        {
            url = AppendQueryParameter(url, "resourcekey", resourceKey);
        }

        // Google Drive's direct-view URL does not retain a file extension. Chat's
        // legacy Message model stores only one URL, so preserve the validated
        // media kind in a client-only URI fragment. It is never sent to Drive and
        // lets all chat surfaces render an uploaded video as <video>, not <img>.
        return kind == PublicMediaKind.Video
            ? $"{url}{(url.Contains("#", StringComparison.Ordinal) ? "&" : "#")}aris-media=video"
            : url;
    }

    private static string AppendQueryParameter(string url, string name, string value)
    {
        var fragmentIndex = url.IndexOf('#');
        var fragment = fragmentIndex >= 0 ? url[fragmentIndex..] : string.Empty;
        var withoutFragment = fragmentIndex >= 0 ? url[..fragmentIndex] : url;
        var separator = withoutFragment.Contains("?", StringComparison.Ordinal) ? "&" : "?";
        return $"{withoutFragment}{separator}{Uri.EscapeDataString(name)}={Uri.EscapeDataString(value)}{fragment}";
    }

    private async Task DeleteIncompleteUploadAsync(DriveService service, string? fileId)
    {
        if (string.IsNullOrWhiteSpace(fileId)) return;
        try
        {
            var delete = service.Files.Delete(fileId);
            delete.SupportsAllDrives = _options.UseSharedDrive;
            await delete.ExecuteAsync(CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            // Do not replace the upload error with best-effort orphan cleanup. The
            // file's generated name and inaccessible parent prevent path injection.
            _logger.LogWarning(exception, "Could not remove incomplete Google Drive media object {FileId}.", fileId);
        }
    }

}
