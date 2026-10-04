using System.Text;
using System.Text.Json;
using Google;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Drive.v3.Data;
using Google.Apis.Services;
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
    public string? ServiceAccountJson { get; init; }
    public string? ServiceAccountJsonBase64 { get; init; }
    public bool UseSharedDrive { get; init; }
    public bool MakeFilesPublic { get; init; } = true;
    public string? PublicUrlTemplate { get; init; }
}

/// <summary>
/// Stores validated public media in a Google Drive folder.  The configured
/// folder must be writable by the service account and should remain private;
/// each completed file receives its own link-only <c>anyone:reader</c>
/// permission.  This prevents an incomplete upload from being publicly listed
/// through a shared parent folder.
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

            return new PublicMediaUpload(BuildPublicUrl(fileId), fileId);
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
        if (!IsSafeDriveId(fileId))
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
        if (!IsSafeDriveId(_options.FolderId))
            throw new PublicMediaStorageException("Google Drive FolderId is missing or invalid.");
        if (!_options.MakeFilesPublic)
            throw new PublicMediaStorageException("Google Drive public media storage must grant public read access.");

        var credentialJson = ReadCredentialJson();
        if (string.IsNullOrWhiteSpace(credentialJson))
            throw new PublicMediaStorageException("Google Drive service-account credentials are not configured.");

        try
        {
            ValidateServiceAccountCredentialJson(credentialJson);
            // Parse only a service-account credential rather than accepting any
            // arbitrary Google credential JSON from configuration.
            var credential = CredentialFactory.FromJson<ServiceAccountCredential>(credentialJson)
                .ToGoogleCredential()
                .CreateScoped(DriveService.Scope.Drive);
            return new DriveService(new BaseClientService.Initializer
            {
                HttpClientInitializer = credential,
                ApplicationName = "ArisSkyve public media storage"
            });
        }
        catch (PublicMediaStorageException)
        {
            throw;
        }
        catch (Exception exception) when (exception is InvalidOperationException or ArgumentException or FormatException or JsonException or System.Security.Cryptography.CryptographicException)
        {
            throw new PublicMediaStorageException("Google Drive service-account credentials are invalid.", exception);
        }
    }

    private string? ReadCredentialJson()
    {
        if (!string.IsNullOrWhiteSpace(_options.ServiceAccountJson))
            return _options.ServiceAccountJson.Trim();
        if (string.IsNullOrWhiteSpace(_options.ServiceAccountJsonBase64))
            return null;

        try
        {
            return Encoding.UTF8.GetString(Convert.FromBase64String(_options.ServiceAccountJsonBase64.Trim()));
        }
        catch (FormatException exception)
        {
            throw new PublicMediaStorageException("Google Drive base64 credentials are invalid.", exception);
        }
    }

    private static void ValidateServiceAccountCredentialJson(string credentialJson)
    {
        try
        {
            using var document = JsonDocument.Parse(credentialJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("type", out var type) || type.GetString() != "service_account" ||
                !root.TryGetProperty("client_email", out var email) || string.IsNullOrWhiteSpace(email.GetString()) ||
                !root.TryGetProperty("private_key", out var privateKey) || string.IsNullOrWhiteSpace(privateKey.GetString()))
            {
                throw new PublicMediaStorageException("Google Drive credentials must be a complete service-account key.");
            }

            // Standard service-account keys use this token endpoint. Rejecting a
            // caller-controlled endpoint avoids turning a secret-store typo into
            // a credential-bearing outbound request to an arbitrary host.
            if (root.TryGetProperty("token_uri", out var tokenUri) &&
                (tokenUri.ValueKind != JsonValueKind.String ||
                 !string.Equals(tokenUri.GetString(), "https://oauth2.googleapis.com/token", StringComparison.Ordinal)))
            {
                throw new PublicMediaStorageException("Google Drive credentials specify an unsupported token endpoint.");
            }
        }
        catch (JsonException exception)
        {
            throw new PublicMediaStorageException("Google Drive service-account credentials are not valid JSON.", exception);
        }
    }

    private string BuildPublicUrl(string fileId)
    {
        var template = string.IsNullOrWhiteSpace(_options.PublicUrlTemplate)
            ? DefaultPublicUrlTemplate
            : _options.PublicUrlTemplate.Trim();
        if (!template.Contains("{fileId}", StringComparison.Ordinal))
            throw new PublicMediaStorageException("Google Drive PublicUrlTemplate must contain {fileId}.");

        var url = template.Replace("{fileId}", Uri.EscapeDataString(fileId), StringComparison.Ordinal);
        if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed) || !string.Equals(parsed.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
            throw new PublicMediaStorageException("Google Drive PublicUrlTemplate must produce an HTTPS URL.");
        return url;
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

    private static bool IsSafeDriveId(string? value) =>
        !string.IsNullOrWhiteSpace(value) && value.Length is >= 5 and <= 256 &&
        value.All(character => char.IsLetterOrDigit(character) || character is '-' or '_');
}
