using System.Text;
using System.Text.Json;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Drive.v3;
using Google.Apis.Services;
using Google.Apis.Util.Store;

namespace ArisSkyve.Infrastructure.Services;

/// <summary>
/// Creates the single configured Drive-owner client used by both public media
/// and private resume-original storage. Keeping this here avoids a second
/// credential implementation with subtly different scopes or token handling.
/// </summary>
internal static class GoogleDriveOwnerServiceFactory
{
    internal static DriveService Create(GoogleDrivePublicStorageOptions options, string applicationName)
    {
        ArgumentNullException.ThrowIfNull(options);
        if (string.IsNullOrWhiteSpace(applicationName))
            throw new GoogleDriveOwnerConfigurationException("Google Drive application name is missing.");

        try
        {
            GoogleCredential credential;
            if (string.Equals(options.AuthMode, "OAuthRefreshToken", StringComparison.OrdinalIgnoreCase))
            {
                credential = CreateOAuthRefreshTokenCredential(options);
            }
            else if (string.Equals(options.AuthMode, "ServiceAccount", StringComparison.OrdinalIgnoreCase))
            {
                credential = CreateServiceAccountCredential(options);
            }
            else
            {
                throw new GoogleDriveOwnerConfigurationException("Google Drive AuthMode must be ServiceAccount or OAuthRefreshToken.");
            }

            return new DriveService(new BaseClientService.Initializer
            {
                HttpClientInitializer = credential,
                ApplicationName = applicationName
            });
        }
        catch (GoogleDriveOwnerConfigurationException)
        {
            throw;
        }
        catch (Exception exception) when (exception is InvalidOperationException or ArgumentException or FormatException or JsonException or System.Security.Cryptography.CryptographicException)
        {
            throw new GoogleDriveOwnerConfigurationException("Google Drive credentials are invalid.", exception);
        }
    }

    internal static bool IsSafeDriveId(string? value) =>
        !string.IsNullOrWhiteSpace(value) && value.Length is >= 5 and <= 256 &&
        value.All(character => char.IsLetterOrDigit(character) || character is '-' or '_');

    private static GoogleCredential CreateServiceAccountCredential(GoogleDrivePublicStorageOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.OAuthClientId) ||
            !string.IsNullOrWhiteSpace(options.OAuthClientSecret) ||
            !string.IsNullOrWhiteSpace(options.OAuthRefreshToken))
        {
            throw new GoogleDriveOwnerConfigurationException("Configure either Google Drive service-account credentials or OAuth refresh-token credentials, not both.");
        }

        var credentialJson = ReadServiceAccountCredentialJson(options);
        if (string.IsNullOrWhiteSpace(credentialJson))
            throw new GoogleDriveOwnerConfigurationException("Google Drive service-account credentials are not configured.");

        ValidateServiceAccountCredentialJson(credentialJson);
        // Parse only a service-account credential rather than accepting any
        // arbitrary Google credential JSON from configuration.
        return CredentialFactory.FromJson<ServiceAccountCredential>(credentialJson)
            .ToGoogleCredential()
            .CreateScoped(DriveService.Scope.Drive);
    }

    private static GoogleCredential CreateOAuthRefreshTokenCredential(GoogleDrivePublicStorageOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.ServiceAccountJson) ||
            !string.IsNullOrWhiteSpace(options.ServiceAccountJsonBase64))
        {
            throw new GoogleDriveOwnerConfigurationException("Configure either Google Drive service-account credentials or OAuth refresh-token credentials, not both.");
        }
        if (string.IsNullOrWhiteSpace(options.OAuthClientId) ||
            string.IsNullOrWhiteSpace(options.OAuthClientSecret) ||
            string.IsNullOrWhiteSpace(options.OAuthRefreshToken))
        {
            throw new GoogleDriveOwnerConfigurationException("Google Drive OAuth client ID, client secret, and refresh token are required for personal My Drive storage.");
        }

        // The bootstrap creates the dedicated folders with this same OAuth
        // client. drive.file therefore grants access to application-created
        // files without granting the app access to all of the owner's My Drive.
        // NullDataStore keeps refresh/access tokens out of the app root.
        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = options.OAuthClientId.Trim(),
                ClientSecret = options.OAuthClientSecret.Trim()
            },
            Scopes = new[] { DriveService.Scope.DriveFile },
            DataStore = new NullDataStore()
        });
        return new UserCredential(
            flow,
            "aris-drive-owner",
            new TokenResponse { RefreshToken = options.OAuthRefreshToken.Trim() })
            .ToGoogleCredential();
    }

    private static string? ReadServiceAccountCredentialJson(GoogleDrivePublicStorageOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.ServiceAccountJson))
            return options.ServiceAccountJson.Trim();
        if (string.IsNullOrWhiteSpace(options.ServiceAccountJsonBase64))
            return null;

        try
        {
            return Encoding.UTF8.GetString(Convert.FromBase64String(options.ServiceAccountJsonBase64.Trim()));
        }
        catch (FormatException exception)
        {
            throw new GoogleDriveOwnerConfigurationException("Google Drive base64 credentials are invalid.", exception);
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
                throw new GoogleDriveOwnerConfigurationException("Google Drive credentials must be a complete service-account key.");
            }

            // Standard service-account keys use this token endpoint. Rejecting a
            // caller-controlled endpoint avoids turning a secret-store typo into
            // a credential-bearing outbound request to an arbitrary host.
            if (root.TryGetProperty("token_uri", out var tokenUri) &&
                (tokenUri.ValueKind != JsonValueKind.String ||
                 !string.Equals(tokenUri.GetString(), "https://oauth2.googleapis.com/token", StringComparison.Ordinal)))
            {
                throw new GoogleDriveOwnerConfigurationException("Google Drive credentials specify an unsupported token endpoint.");
            }
        }
        catch (JsonException exception)
        {
            throw new GoogleDriveOwnerConfigurationException("Google Drive service-account credentials are not valid JSON.", exception);
        }
    }
}

internal sealed class GoogleDriveOwnerConfigurationException : Exception
{
    public GoogleDriveOwnerConfigurationException(string message) : base(message) { }

    public GoogleDriveOwnerConfigurationException(string message, Exception innerException) : base(message, innerException) { }
}
