using System.Net;
using Google;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Download;
using Google.Apis.Drive.v3;
using Google.Apis.Drive.v3.Data;
using Google.Apis.Upload;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using DriveFile = Google.Apis.Drive.v3.Data.File;

namespace ArisSkyve.Infrastructure.Services;

/// <summary>
/// Private original-PDF storage. Unlike <see cref="IPublicMediaStore"/>, this
/// contract never returns a Drive URL and never changes Drive permissions.
/// </summary>
public interface IPrivateResumeOriginalStore
{
    Task<bool> StoreAsync(int ownerUserId, string sourceId, IFormFile file, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(int ownerUserId, string sourceId, CancellationToken cancellationToken = default);

    Task<ResumeOriginalDownload?> OpenAsync(int ownerUserId, string sourceId, CancellationToken cancellationToken = default);

    Task<bool> MarkReferencedAsync(int ownerUserId, string sourceId, CancellationToken cancellationToken = default);

    Task MarkUnreferencedAsync(int ownerUserId, string sourceId, CancellationToken cancellationToken = default);

    Task<ResumeOriginalDeleteResult> DeleteAsync(int ownerUserId, string sourceId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ResumeOriginalCleanupCandidate>> ListExpiredUnreferencedAsync(DateTime cutoffUtc, CancellationToken cancellationToken = default);
}

public sealed record ResumeOriginalDownload(Stream Content, string ContentType, string DownloadName);

public sealed record ResumeOriginalCleanupCandidate(int OwnerUserId, string SourceId);

public sealed class PrivateResumeOriginalStorageException : Exception
{
    public PrivateResumeOriginalStorageException(string message) : base(message) { }

    public PrivateResumeOriginalStorageException(string message, Exception innerException) : base(message, innerException) { }
}

/// <summary>
/// Stores imported Resume Studio originals in a dedicated private Google Drive
/// folder. The SQL mapping is the sole server-side locator; Drive IDs never
/// enter a browser-visible CV document.
/// </summary>
public sealed class GoogleDrivePrivateResumeStore : IPrivateResumeOriginalStore, IDisposable
{
    private const int UploadChunkSize = 2 * 1024 * 1024;
    // The parse endpoint accepts a 10 MiB file plus bounded multipart overhead.
    // Keep the same upper bound when reading back from Drive, so a manually
    // replaced remote object cannot force an unbounded server allocation.
    private const long MaximumOriginalBytes = 10L * 1024 * 1024;
    private const string PdfContentType = "application/pdf";

    private readonly ArisDBContext _db;
    private readonly GoogleDrivePublicStorageOptions _options;
    private readonly ILogger<GoogleDrivePrivateResumeStore> _logger;
    private readonly Lazy<DriveService> _driveService;

    public GoogleDrivePrivateResumeStore(
        ArisDBContext db,
        IConfiguration configuration,
        ILogger<GoogleDrivePrivateResumeStore> logger)
    {
        _db = db;
        _options = configuration.GetSection("GoogleDrive").Get<GoogleDrivePublicStorageOptions>() ?? new GoogleDrivePublicStorageOptions();
        _logger = logger;
        _driveService = new Lazy<DriveService>(CreateDriveService, LazyThreadSafetyMode.ExecutionAndPublication);
    }

    public async Task<bool> StoreAsync(int ownerUserId, string sourceId, IFormFile file, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(file);
        if (ownerUserId <= 0 || !ResumeOriginalLifecycle.IsValidSourceId(sourceId) ||
            file.Length <= 0 || file.Length > MaximumOriginalBytes)
        {
            return false;
        }

        if (await _db.ResumeOriginals.AsNoTracking().AnyAsync(
                original => original.OwnerUserId == ownerUserId && original.SourceId == sourceId,
                cancellationToken).ConfigureAwait(false))
        {
            // A source ID is generated once by the server. Never overwrite a
            // pre-existing private object if a client retries a stale request.
            return false;
        }

        var service = _driveService.Value;
        string? fileId = null;
        try
        {
            var metadata = new DriveFile
            {
                Name = sourceId + ".pdf",
                MimeType = PdfContentType,
                Parents = new[] { _options.PrivateResumeOriginalsFolderId! },
                AppProperties = CreateAppProperties(ownerUserId, sourceId)
            };
            await using var source = file.OpenReadStream();
            var create = service.Files.Create(metadata, source, PdfContentType);
            create.Fields = "id,size,mimeType,parents,appProperties,trashed";
            create.SupportsAllDrives = _options.UseSharedDrive;
            create.ChunkSize = UploadChunkSize;
            var progress = await create.UploadAsync(cancellationToken).ConfigureAwait(false);
            fileId = create.ResponseBody?.Id;
            if (progress.Status != UploadStatus.Completed || !GoogleDriveOwnerServiceFactory.IsSafeDriveId(fileId))
                throw new PrivateResumeOriginalStorageException("Google Drive did not complete the private PDF upload.");

            // The successful safe-ID check above proves this is non-null; use
            // the null-forgiving operator only at that checked boundary so the
            // persisted mapping and verification receive the exact upload ID.
            var verifiedFileId = fileId!;
            await VerifyRemoteObjectAsync(service, verifiedFileId, ownerUserId, sourceId, file.Length, cancellationToken).ConfigureAwait(false);

            var record = new ResumeOriginal
            {
                OwnerUserId = ownerUserId,
                SourceId = sourceId,
                DriveFileId = verifiedFileId,
                CreatedAtUtc = DateTime.UtcNow,
                // An unsaved parsed document is deliberately eligible for the
                // existing bounded retention process. SaveDocument clears this.
                UnreferencedAtUtc = DateTime.UtcNow
            };
            try
            {
                _db.ResumeOriginals.Add(record);
                await _db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                return true;
            }
            catch (DbUpdateException exception)
            {
                _db.Entry(record).State = EntityState.Detached;
                await DeleteIncompleteUploadAsync(service, fileId).ConfigureAwait(false);
                _logger.LogWarning(exception, "Could not create a private original mapping for source {SourceId}.", sourceId);
                return false;
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            await DeleteIncompleteUploadAsync(service, fileId).ConfigureAwait(false);
            throw;
        }
        catch (PrivateResumeOriginalStorageException)
        {
            await DeleteIncompleteUploadAsync(service, fileId).ConfigureAwait(false);
            throw;
        }
        catch (TokenResponseException exception)
        {
            await DeleteIncompleteUploadAsync(service, fileId).ConfigureAwait(false);
            _logger.LogWarning(exception, "Google Drive owner authorization is no longer valid while storing a private original.");
            throw new PrivateResumeOriginalStorageException("Google Drive authorization has expired or was revoked. Re-authorize the Drive owner and update the refresh token.", exception);
        }
        catch (GoogleApiException exception)
        {
            await DeleteIncompleteUploadAsync(service, fileId).ConfigureAwait(false);
            _logger.LogWarning(exception, "Google Drive rejected a private resume original upload.");
            throw new PrivateResumeOriginalStorageException("Google Drive could not store the private PDF.", exception);
        }
        catch (Exception exception) when (exception is HttpRequestException or IOException or InvalidOperationException)
        {
            await DeleteIncompleteUploadAsync(service, fileId).ConfigureAwait(false);
            _logger.LogWarning(exception, "Google Drive was unavailable while storing a private resume original.");
            throw new PrivateResumeOriginalStorageException("Private original storage is temporarily unavailable.", exception);
        }
    }

    public Task<bool> ExistsAsync(int ownerUserId, string sourceId, CancellationToken cancellationToken = default)
    {
        if (ownerUserId <= 0 || !ResumeOriginalLifecycle.IsValidSourceId(sourceId))
            return Task.FromResult(false);

        return _db.ResumeOriginals.AsNoTracking().AnyAsync(
            original => original.OwnerUserId == ownerUserId && original.SourceId == sourceId,
            cancellationToken);
    }

    public async Task<ResumeOriginalDownload?> OpenAsync(int ownerUserId, string sourceId, CancellationToken cancellationToken = default)
    {
        if (ownerUserId <= 0 || !ResumeOriginalLifecycle.IsValidSourceId(sourceId)) return null;

        var record = await _db.ResumeOriginals.AsNoTracking().SingleOrDefaultAsync(
            original => original.OwnerUserId == ownerUserId && original.SourceId == sourceId,
            cancellationToken).ConfigureAwait(false);
        if (record is null) return null;

        try
        {
            var service = _driveService.Value;
            var metadata = service.Files.Get(record.DriveFileId);
            metadata.Fields = "id,size,mimeType,parents,appProperties,trashed";
            metadata.SupportsAllDrives = _options.UseSharedDrive;
            var remote = await metadata.ExecuteAsync(cancellationToken).ConfigureAwait(false);
            ValidateRemoteObject(remote, ownerUserId, sourceId, null);

            var length = remote.Size ?? throw new PrivateResumeOriginalStorageException("Google Drive did not report the private PDF size.");
            if (length <= 0 || length > MaximumOriginalBytes || length > int.MaxValue)
                throw new PrivateResumeOriginalStorageException("The private PDF has an unsupported size.");

            var buffer = new MemoryStream((int)length);
            try
            {
                var download = service.Files.Get(record.DriveFileId);
                download.SupportsAllDrives = _options.UseSharedDrive;
                var progress = await download.DownloadAsync(buffer, cancellationToken).ConfigureAwait(false);
                if (progress.Status != DownloadStatus.Completed || buffer.Length != length)
                    throw new PrivateResumeOriginalStorageException("Google Drive did not complete the private PDF download.");

                buffer.Position = 0;
                return new ResumeOriginalDownload(buffer, PdfContentType, "CV-original.pdf");
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
        catch (GoogleApiException exception) when (exception.HttpStatusCode == HttpStatusCode.NotFound)
        {
            _logger.LogWarning("Private resume original {SourceId} is mapped but missing in Google Drive.", sourceId);
            return null;
        }
        catch (PrivateResumeOriginalStorageException)
        {
            throw;
        }
        catch (TokenResponseException exception)
        {
            _logger.LogWarning(exception, "Google Drive owner authorization is no longer valid while opening a private original.");
            throw new PrivateResumeOriginalStorageException("Google Drive authorization has expired or was revoked. Re-authorize the Drive owner and update the refresh token.", exception);
        }
        catch (GoogleApiException exception)
        {
            _logger.LogWarning(exception, "Google Drive rejected access to a private resume original.");
            throw new PrivateResumeOriginalStorageException("Google Drive could not open the private PDF.", exception);
        }
        catch (Exception exception) when (exception is HttpRequestException or IOException or InvalidOperationException)
        {
            _logger.LogWarning(exception, "Google Drive was unavailable while opening a private resume original.");
            throw new PrivateResumeOriginalStorageException("Private original storage is temporarily unavailable.", exception);
        }
    }

    public async Task<bool> MarkReferencedAsync(int ownerUserId, string sourceId, CancellationToken cancellationToken = default)
    {
        var record = await FindRecordAsync(ownerUserId, sourceId, cancellationToken).ConfigureAwait(false);
        if (record is null) return false;
        if (record.UnreferencedAtUtc is null) return true;

        record.UnreferencedAtUtc = null;
        await _db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return true;
    }

    public async Task MarkUnreferencedAsync(int ownerUserId, string sourceId, CancellationToken cancellationToken = default)
    {
        var record = await FindRecordAsync(ownerUserId, sourceId, cancellationToken).ConfigureAwait(false);
        if (record is null) return;

        // Reset the retention window only after the lifecycle has proved no
        // persisted Studio document still references the source.
        record.UnreferencedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<ResumeOriginalDeleteResult> DeleteAsync(int ownerUserId, string sourceId, CancellationToken cancellationToken = default)
    {
        var record = await FindRecordAsync(ownerUserId, sourceId, cancellationToken).ConfigureAwait(false);
        if (record is null) return ResumeOriginalDeleteResult.Missing;

        var missing = false;
        try
        {
            var delete = _driveService.Value.Files.Delete(record.DriveFileId);
            delete.SupportsAllDrives = _options.UseSharedDrive;
            await delete.ExecuteAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (GoogleApiException exception) when (exception.HttpStatusCode == HttpStatusCode.NotFound)
        {
            // The desired durable state is no object and no locator. Treat an
            // already-removed Drive file as an idempotent deletion.
            missing = true;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (TokenResponseException exception)
        {
            _logger.LogWarning(exception, "Google Drive owner authorization is no longer valid while deleting a private original.");
            throw new PrivateResumeOriginalStorageException("Google Drive authorization has expired or was revoked. Re-authorize the Drive owner and update the refresh token.", exception);
        }
        catch (GoogleApiException exception)
        {
            _logger.LogWarning(exception, "Google Drive rejected private resume original deletion.");
            throw new PrivateResumeOriginalStorageException("Google Drive could not remove the private PDF.", exception);
        }
        catch (Exception exception) when (exception is HttpRequestException or IOException or InvalidOperationException)
        {
            _logger.LogWarning(exception, "Google Drive was unavailable while deleting a private resume original.");
            throw new PrivateResumeOriginalStorageException("Private original storage is temporarily unavailable.", exception);
        }

        _db.ResumeOriginals.Remove(record);
        await _db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return missing ? ResumeOriginalDeleteResult.Missing : ResumeOriginalDeleteResult.Deleted;
    }

    public async Task<IReadOnlyList<ResumeOriginalCleanupCandidate>> ListExpiredUnreferencedAsync(DateTime cutoffUtc, CancellationToken cancellationToken = default)
    {
        return await _db.ResumeOriginals.AsNoTracking()
            .Where(original => original.UnreferencedAtUtc != null && original.UnreferencedAtUtc <= cutoffUtc)
            .OrderBy(original => original.UnreferencedAtUtc)
            .ThenBy(original => original.Id)
            .Select(original => new ResumeOriginalCleanupCandidate(original.OwnerUserId, original.SourceId))
            .Take(500)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    public void Dispose()
    {
        if (_driveService.IsValueCreated)
            _driveService.Value.Dispose();
    }

    private DriveService CreateDriveService()
    {
        if (!_options.Enabled)
            throw new PrivateResumeOriginalStorageException("Google Drive private original storage is disabled.");
        if (!GoogleDriveOwnerServiceFactory.IsSafeDriveId(_options.PrivateResumeOriginalsFolderId))
            throw new PrivateResumeOriginalStorageException("Google Drive PrivateResumeOriginalsFolderId is missing or invalid.");

        try
        {
            return GoogleDriveOwnerServiceFactory.Create(_options, "ArisSkyve private resume storage");
        }
        catch (GoogleDriveOwnerConfigurationException exception)
        {
            throw new PrivateResumeOriginalStorageException(exception.Message, exception);
        }
    }

    private async Task<ResumeOriginal?> FindRecordAsync(int ownerUserId, string sourceId, CancellationToken cancellationToken)
    {
        if (ownerUserId <= 0 || !ResumeOriginalLifecycle.IsValidSourceId(sourceId)) return null;
        return await _db.ResumeOriginals.SingleOrDefaultAsync(
            original => original.OwnerUserId == ownerUserId && original.SourceId == sourceId,
            cancellationToken).ConfigureAwait(false);
    }

    private async Task VerifyRemoteObjectAsync(DriveService service, string fileId, int ownerUserId, string sourceId, long expectedLength, CancellationToken cancellationToken)
    {
        var get = service.Files.Get(fileId);
        get.Fields = "id,size,mimeType,parents,appProperties,trashed";
        get.SupportsAllDrives = _options.UseSharedDrive;
        var remote = await get.ExecuteAsync(cancellationToken).ConfigureAwait(false);
        ValidateRemoteObject(remote, ownerUserId, sourceId, expectedLength);
    }

    private void ValidateRemoteObject(DriveFile remote, int ownerUserId, string sourceId, long? expectedLength)
    {
        var expectedOwner = ownerUserId.ToString(System.Globalization.CultureInfo.InvariantCulture);
        if (!GoogleDriveOwnerServiceFactory.IsSafeDriveId(remote.Id) ||
            remote.Trashed == true ||
            !string.Equals(remote.MimeType, PdfContentType, StringComparison.OrdinalIgnoreCase) ||
            remote.Parents?.Contains(_options.PrivateResumeOriginalsFolderId!, StringComparer.Ordinal) != true ||
            remote.AppProperties is null ||
            !remote.AppProperties.TryGetValue("aris_private_resume_original", out var isPrivate) || !string.Equals(isPrivate, "true", StringComparison.Ordinal) ||
            !remote.AppProperties.TryGetValue("aris_owner_user_id", out var owner) || !string.Equals(owner, expectedOwner, StringComparison.Ordinal) ||
            !remote.AppProperties.TryGetValue("aris_source_id", out var storedSource) || !string.Equals(storedSource, sourceId, StringComparison.Ordinal) ||
            remote.Size is null || remote.Size <= 0 || remote.Size > MaximumOriginalBytes ||
            (expectedLength.HasValue && remote.Size != expectedLength.Value))
        {
            throw new PrivateResumeOriginalStorageException("Google Drive private PDF integrity verification failed.");
        }
    }

    private static Dictionary<string, string> CreateAppProperties(int ownerUserId, string sourceId) => new()
    {
        ["aris_private_resume_original"] = "true",
        ["aris_owner_user_id"] = ownerUserId.ToString(System.Globalization.CultureInfo.InvariantCulture),
        ["aris_source_id"] = sourceId
    };

    private async Task DeleteIncompleteUploadAsync(DriveService service, string? fileId)
    {
        if (!GoogleDriveOwnerServiceFactory.IsSafeDriveId(fileId)) return;
        try
        {
            var delete = service.Files.Delete(fileId);
            delete.SupportsAllDrives = _options.UseSharedDrive;
            await delete.ExecuteAsync(CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            // Never conceal the actual upload/mapping failure with best-effort
            // orphan cleanup. The parent and file ID are server-controlled.
            _logger.LogWarning(exception, "Could not remove incomplete private Drive original {FileId}.", fileId);
        }
    }
}
