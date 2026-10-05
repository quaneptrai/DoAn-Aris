using System.Net;
using Google;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Download;
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
/// Reads a verified public-media object through the application instead of
/// exposing a browser to a Google Drive response. Drive's direct-view response
/// is cross-origin isolated by Chrome, so it cannot reliably be used as an
/// image or video source on this site.
/// </summary>
public interface IPublicMediaDelivery
{
    /// <param name="expectedCollection">
    /// The collection encoded in newly generated URLs. A null value is only
    /// used by the legacy compatibility route for existing Drive URLs; the
    /// stored Drive metadata must still identify a supported collection.
    /// </param>
    Task<PublicMediaDownload?> OpenReadAsync(
        string? expectedCollection,
        string fileId,
        CancellationToken cancellationToken = default);
}

public sealed record PublicMediaDownload(Stream Content, string ContentType);

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
    /// <summary>
    /// Retained only so existing deployment settings remain harmless. Browser
    /// URLs are intentionally delivered by this application, never directly
    /// from a configurable Drive URL template.
    /// </summary>
    public string? PublicUrlTemplate { get; init; }
}

/// <summary>
/// Stores validated public media in a Google Drive folder.  The configured
/// folder must be writable by the configured Drive owner and should remain
/// private. Existing deployment settings retain a link-only <c>anyone:reader</c>
/// permission per completed file, while browsers now receive only an
/// application-owned same-origin URL.
/// </summary>
public sealed class GoogleDrivePublicMediaStore : IPublicMediaStore, IPublicMediaDelivery, IDisposable
{
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
        if (!PublicMediaStorage.TryGetCanonicalCollection(collection, out var canonicalCollection))
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
                    ["aris_collection"] = canonicalCollection,
                    ["aris_public_media"] = "true"
                }
            };

            await using var source = file.OpenReadStream();
            var create = service.Files.Create(metadata, source, media.ContentType);
            create.Fields = "id";
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

            // The browser receives an application URL rather than Drive's
            // cross-site /uc endpoint. This avoids Chrome's CORP/ORB block and
            // keeps every media kind on the same delivery path.
            return new PublicMediaUpload(PublicMediaDeliveryUrl.Build(canonicalCollection, fileId, media.Kind), fileId);
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

    public async Task<PublicMediaDownload?> OpenReadAsync(
        string? expectedCollection,
        string fileId,
        CancellationToken cancellationToken = default)
    {
        if (!GoogleDriveOwnerServiceFactory.IsSafeDriveId(fileId) ||
            (expectedCollection is not null && !PublicMediaStorage.TryGetCanonicalCollection(expectedCollection, out _)))
        {
            return null;
        }

        string? canonicalCollection = null;
        if (expectedCollection is not null &&
            !PublicMediaStorage.TryGetCanonicalCollection(expectedCollection, out canonicalCollection))
        {
            return null;
        }

        try
        {
            var service = _driveService.Value;
            var metadata = service.Files.Get(fileId);
            metadata.Fields = "id,size,mimeType,parents,appProperties,trashed,capabilities/canDownload";
            metadata.SupportsAllDrives = _options.UseSharedDrive;
            var remote = await metadata.ExecuteAsync(cancellationToken).ConfigureAwait(false);
            if (!TryValidateRemotePublicMedia(remote, fileId, canonicalCollection, out var media) || media is null ||
                remote.Size is not long length)
            {
                return null;
            }

            var buffer = new MemoryStream((int)length);
            try
            {
                var download = service.Files.Get(fileId);
                download.SupportsAllDrives = _options.UseSharedDrive;
                var progress = await download.DownloadAsync(buffer, cancellationToken).ConfigureAwait(false);
                if (progress.Status != DownloadStatus.Completed || buffer.Length != length)
                {
                    throw new PublicMediaStorageException("Google Drive did not complete the public media download.");
                }

                buffer.Position = 0;
                return new PublicMediaDownload(buffer, media.ContentType);
            }
            catch
            {
                await buffer.DisposeAsync().ConfigureAwait(false);
                throw;
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (GoogleApiException exception) when (exception.HttpStatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden)
        {
            // Do not reveal whether a guessed Drive ID exists outside the
            // application's tagged public-media collection.
            _logger.LogWarning("Public media object {FileId} is no longer available in Google Drive.", fileId);
            return null;
        }
        catch (PublicMediaStorageException)
        {
            throw;
        }
        catch (TokenResponseException exception)
        {
            _logger.LogWarning(exception, "Google Drive owner authorization is no longer valid while reading public media object {FileId}.", fileId);
            throw new PublicMediaStorageException("Google Drive authorization has expired or was revoked.", exception);
        }
        catch (GoogleApiException exception)
        {
            _logger.LogWarning(exception, "Google Drive rejected access to public media object {FileId}.", fileId);
            throw new PublicMediaStorageException("Google Drive could not open the media.", exception);
        }
        catch (Exception exception) when (exception is HttpRequestException or IOException or InvalidOperationException)
        {
            _logger.LogWarning(exception, "Google Drive was unavailable while reading public media object {FileId}.", fileId);
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

    private bool TryValidateRemotePublicMedia(
        DriveFile remote,
        string requestedFileId,
        string? expectedCollection,
        out ValidatedPublicMedia? media)
    {
        media = null;
        if (!GoogleDriveOwnerServiceFactory.IsSafeDriveId(remote.Id) ||
            !string.Equals(remote.Id, requestedFileId, StringComparison.Ordinal) ||
            remote.Trashed == true ||
            remote.Capabilities?.CanDownload != true ||
            remote.Parents?.Contains(_options.FolderId!, StringComparer.Ordinal) != true ||
            remote.AppProperties is null ||
            !remote.AppProperties.TryGetValue("aris_public_media", out var publicMarker) ||
            !string.Equals(publicMarker, "true", StringComparison.Ordinal) ||
            !remote.AppProperties.TryGetValue("aris_collection", out var storedCollection) ||
            !PublicMediaStorage.TryGetCanonicalCollection(storedCollection, out var canonicalStoredCollection) ||
            (expectedCollection is not null && !string.Equals(expectedCollection, canonicalStoredCollection, StringComparison.Ordinal)) ||
            !PublicMediaValidator.TryGetMediaForContentType(remote.MimeType, out media) ||
            media is null ||
            remote.Size is not long length || length <= 0 || length > media.MaximumBytes || length > int.MaxValue)
        {
            media = null;
            return false;
        }

        return true;
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
