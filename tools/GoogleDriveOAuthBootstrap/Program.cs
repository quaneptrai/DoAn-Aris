using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Drive.v3;
using Google.Apis.Services;
using Google.Apis.Upload;
using Google.Apis.Util.Store;
using DriveFile = Google.Apis.Drive.v3.Data.File;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Xml.Linq;

const string ConfigureUserSecretsFlag = "--configure-user-secrets";
const string ConfigurePrivateResumeStorageFlag = "--configure-private-resume-storage";
const string ConfigureProductionSettingsFlag = "--configure-production-settings";
const string VerifyDriveAccessFlag = "--verify-drive-access";
const string SmokeStorageFlag = "--smoke-storage";
const string ConfirmSmokeStorageFlag = "--confirm-smoke-storage";
const string StorageSmokeMarkerProperty = "aris_storage_smoke";
const string StorageSmokeRunProperty = "aris_storage_smoke_run";

if (args.Length == 1 && string.Equals(args[0], ConfigurePrivateResumeStorageFlag, StringComparison.Ordinal))
{
    try
    {
        await ConfigurePrivateResumeStorageAsync();
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Private resume Drive setup failed: {exception.Message}");
        return 1;
    }
}

if (args.Length == 1 && string.Equals(args[0], ConfigureProductionSettingsFlag, StringComparison.Ordinal))
{
    try
    {
        await ConfigureProductionSettingsAsync();
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Production Google Drive setup failed: {exception.Message}");
        return 1;
    }
}

if (args.Length == 1 && string.Equals(args[0], VerifyDriveAccessFlag, StringComparison.Ordinal))
{
    try
    {
        await VerifyDriveAccessAsync();
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Google Drive verification failed: {exception.Message}");
        return 1;
    }
}

if (args.Length == 2 &&
    string.Equals(args[0], SmokeStorageFlag, StringComparison.Ordinal) &&
    string.Equals(args[1], ConfirmSmokeStorageFlag, StringComparison.Ordinal))
{
    try
    {
        await SmokeStorageAsync();
        Console.WriteLine("Google Drive storage smoke test completed and removed its synthetic test files.");
        return 0;
    }
    catch (StorageSmokeException exception) when (exception.CleanupFailed)
    {
        // The test never writes identifiers, URLs, configuration values, or
        // payload data to the console. A cleanup failure must remain visible
        // as a failed command, without disclosing the temporary file IDs.
        Console.Error.WriteLine("Google Drive storage smoke test failed and cleanup could not be confirmed. No sensitive details were displayed.");
        return 1;
    }
    catch
    {
        Console.Error.WriteLine("Google Drive storage smoke test failed. No sensitive details were displayed.");
        return 1;
    }
}

if (args.Any(argument =>
        string.Equals(argument, SmokeStorageFlag, StringComparison.Ordinal) ||
        string.Equals(argument, ConfirmSmokeStorageFlag, StringComparison.Ordinal)))
{
    Console.Error.WriteLine("Usage: dotnet run --project tools/GoogleDriveOAuthBootstrap -- --smoke-storage --confirm-smoke-storage");
    Console.Error.WriteLine("This creates and removes only synthetic in-memory test files; both flags are required.");
    return 2;
}

if (args.Length != 2 || string.IsNullOrWhiteSpace(args[0]) ||
    !string.Equals(args[1], ConfigureUserSecretsFlag, StringComparison.Ordinal))
{
    Console.Error.WriteLine("Usage: dotnet run --project tools/GoogleDriveOAuthBootstrap -- <desktop-oauth-client-json-path> --configure-user-secrets");
    Console.Error.WriteLine("   or: dotnet run --project tools/GoogleDriveOAuthBootstrap -- --configure-private-resume-storage");
    Console.Error.WriteLine("   or: dotnet run --project tools/GoogleDriveOAuthBootstrap -- --configure-production-settings");
    Console.Error.WriteLine("   or: dotnet run --project tools/GoogleDriveOAuthBootstrap -- --verify-drive-access");
    Console.Error.WriteLine("   or: dotnet run --project tools/GoogleDriveOAuthBootstrap -- --smoke-storage --confirm-smoke-storage");
    Console.Error.WriteLine("Download the Desktop OAuth client JSON from Google Cloud, then pass its path. A client ID is also accepted in an interactive console.");
    return 2;
}

var clientArgument = args[0].Trim();
Console.WriteLine("A browser window will open. Sign in only as the Drive owner and approve access.");
Console.WriteLine("Credentials will be saved in local User Secrets and will not be printed.");

try
{
    var client = ReadOAuthClient(clientArgument);

    // PKCE + a loopback callback is a one-time local consent flow for the
    // account that owns Aris public media. NullDataStore ensures the helper
    // itself never writes a token file to the machine.
    var flow = new PkceGoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
    {
        ClientSecrets = new ClientSecrets
        {
            ClientId = client.ClientId,
            ClientSecret = client.ClientSecret
        },
        Scopes = new[] { DriveService.Scope.DriveFile },
        Prompt = "consent",
        DataStore = new NullDataStore()
    });
    var installedApp = new AuthorizationCodeInstalledApp(flow, new LocalServerCodeReceiver());
    var credential = await installedApp.AuthorizeAsync("aris-public-media-owner", CancellationToken.None);
    var refreshToken = credential.Token.RefreshToken;
    if (string.IsNullOrWhiteSpace(refreshToken))
    {
        Console.Error.WriteLine("Google did not return a refresh token. Revoke this app's access in Google Account settings and run the command again.");
        return 1;
    }

    // The server uses the same OAuth client and drive.file scope, so this
    // app-created folder is visible to it without granting broad My Drive
    // access. It remains private; the web app publishes individual children.
    using var drive = new DriveService(new BaseClientService.Initializer
    {
        HttpClientInitializer = credential,
        ApplicationName = "ArisSkyve Google Drive bootstrap"
    });
    var createFolder = drive.Files.Create(new DriveFile
    {
        Name = "Aris public media",
        MimeType = "application/vnd.google-apps.folder",
        AppProperties = new Dictionary<string, string>
        {
            ["aris_public_media_folder"] = "true"
        }
    });
    createFolder.Fields = "id";
    var folder = await createFolder.ExecuteAsync();
    if (string.IsNullOrWhiteSpace(folder.Id))
    {
        Console.Error.WriteLine("Google authorized the app but did not create the private media folder.");
        return 1;
    }

    await ConfigureArisUserSecretsAsync(client, folder.Id, refreshToken);
    Console.WriteLine("Google Drive credentials were saved to ArisSkyve User Secrets.");
    Console.WriteLine("No credential values were printed. Run --configure-production-settings when the deployment settings should be updated.");
    return 0;
}
catch (Exception exception)
{
    Console.Error.WriteLine($"OAuth authorization failed: {exception.Message}");
    return 1;
}

static OAuthClient ReadOAuthClient(string argument)
{
    if (File.Exists(argument))
    {
        using var document = JsonDocument.Parse(File.ReadAllText(argument));
        if (!document.RootElement.TryGetProperty("installed", out var installed) || installed.ValueKind != JsonValueKind.Object)
            throw new InvalidOperationException("The JSON file must be the downloaded Desktop OAuth client configuration (it needs an 'installed' section).");

        return new OAuthClient(
            ReadRequiredJsonString(installed, "client_id"),
            ReadRequiredJsonString(installed, "client_secret"));
    }

    if (argument.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
        throw new FileNotFoundException("The Desktop OAuth client JSON file was not found.", argument);

    if (Console.IsInputRedirected)
    {
        throw new InvalidOperationException(
            "Console input is redirected. Download the Desktop OAuth client JSON in Google Cloud and pass its file path instead of a client ID.");
    }

    return new OAuthClient(argument, ReadRequiredSecret("OAuth client secret"));
}

static async Task ConfigureArisUserSecretsAsync(OAuthClient client, string folderId, string refreshToken)
{
    var projectPath = FindArisProjectPath();
    var userSecretsId = ReadUserSecretsId(projectPath);
    var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
    if (string.IsNullOrWhiteSpace(appData))
        throw new InvalidOperationException("The current Windows user does not have an AppData directory for User Secrets.");

    var secretDirectory = Path.Combine(appData, "Microsoft", "UserSecrets", userSecretsId);
    var secretsPath = Path.Combine(secretDirectory, "secrets.json");
    Directory.CreateDirectory(secretDirectory);

    JsonObject secrets;
    if (File.Exists(secretsPath))
    {
        secrets = JsonNode.Parse(await File.ReadAllTextAsync(secretsPath))?.AsObject()
            ?? throw new InvalidOperationException("Existing ArisSkyve User Secrets are not a JSON object.");
    }
    else
    {
        secrets = new JsonObject();
    }

    secrets["GoogleDrive:Enabled"] = "true";
    secrets["GoogleDrive:AuthMode"] = "OAuthRefreshToken";
    secrets["GoogleDrive:FolderId"] = folderId;
    secrets["GoogleDrive:OAuthClientId"] = client.ClientId;
    secrets["GoogleDrive:OAuthClientSecret"] = client.ClientSecret;
    secrets["GoogleDrive:OAuthRefreshToken"] = refreshToken;
    secrets["GoogleDrive:UseSharedDrive"] = "false";
    secrets["GoogleDrive:MakeFilesPublic"] = "true";
    // A previous Shared Drive setup must not remain alongside owner OAuth.
    secrets.Remove("GoogleDrive:ServiceAccountJson");
    secrets.Remove("GoogleDrive:ServiceAccountJsonBase64");

    var temporaryPath = Path.Combine(secretDirectory, $".secrets-{Guid.NewGuid():N}.tmp");
    try
    {
        await File.WriteAllTextAsync(temporaryPath, secrets.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temporaryPath, secretsPath, overwrite: true);
    }
    finally
    {
        if (File.Exists(temporaryPath))
            File.Delete(temporaryPath);
    }
}

static async Task ConfigurePrivateResumeStorageAsync()
{
    var secrets = await LoadArisUserSecretsAsync();
    var existingFolderId = ReadOptionalSecret(secrets.Values, "GoogleDrive:PrivateResumeOriginalsFolderId");
    if (!string.IsNullOrWhiteSpace(existingFolderId))
    {
        if (!IsSafeDriveId(existingFolderId))
            throw new InvalidOperationException("GoogleDrive:PrivateResumeOriginalsFolderId in User Secrets is invalid.");

        Console.WriteLine("Private Resume Drive folder is already configured in ArisSkyve User Secrets.");
        return;
    }

    var authMode = ReadRequiredStoredSecret(secrets.Values, "GoogleDrive:AuthMode");
    if (!string.Equals(authMode, "OAuthRefreshToken", StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException("Private resume setup requires the existing personal-Drive OAuthRefreshToken configuration.");

    var clientId = ReadRequiredStoredSecret(secrets.Values, "GoogleDrive:OAuthClientId");
    var clientSecret = ReadRequiredStoredSecret(secrets.Values, "GoogleDrive:OAuthClientSecret");
    var refreshToken = ReadRequiredStoredSecret(secrets.Values, "GoogleDrive:OAuthRefreshToken");

    // Reuse the existing owner grant without opening a browser or printing any
    // credential. The folder is created by the same OAuth client using drive.file.
    var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
    {
        ClientSecrets = new ClientSecrets { ClientId = clientId, ClientSecret = clientSecret },
        Scopes = new[] { DriveService.Scope.DriveFile },
        DataStore = new NullDataStore()
    });
    var credential = new UserCredential(flow, "aris-drive-owner", new TokenResponse { RefreshToken = refreshToken });
    using var drive = new DriveService(new BaseClientService.Initializer
    {
        HttpClientInitializer = credential,
        ApplicationName = "ArisSkyve private resume bootstrap"
    });
    var createFolder = drive.Files.Create(new DriveFile
    {
        Name = "Aris private resume originals",
        MimeType = "application/vnd.google-apps.folder",
        AppProperties = new Dictionary<string, string>
        {
            ["aris_private_resume_originals_folder"] = "true"
        }
    });
    createFolder.Fields = "id";
    var folder = await createFolder.ExecuteAsync();
    if (!IsSafeDriveId(folder.Id))
        throw new InvalidOperationException("Google authorized the app but did not create the private resume folder.");

    secrets.Values["GoogleDrive:PrivateResumeOriginalsFolderId"] = folder.Id;
    await SaveArisUserSecretsAsync(secrets);
    Console.WriteLine("Private Resume Drive folder was created and saved in ArisSkyve User Secrets.");
    Console.WriteLine("The folder is private; the web app will proxy owner-authorized PDF downloads.");
}

static async Task ConfigureProductionSettingsAsync()
{
    var secrets = await LoadArisUserSecretsAsync();
    var enabled = ReadRequiredStoredSecret(secrets.Values, "GoogleDrive:Enabled");
    if (!bool.TryParse(enabled, out var isEnabled) || !isEnabled)
        throw new InvalidOperationException("GoogleDrive:Enabled must be true in User Secrets before production settings can be configured.");

    var authMode = ReadRequiredStoredSecret(secrets.Values, "GoogleDrive:AuthMode");
    var values = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["GoogleDrive__Enabled"] = "true",
        ["GoogleDrive__AuthMode"] = authMode,
        ["GoogleDrive__FolderId"] = ReadRequiredDriveId(secrets.Values, "GoogleDrive:FolderId"),
        ["GoogleDrive__PrivateResumeOriginalsFolderId"] = ReadRequiredDriveId(secrets.Values, "GoogleDrive:PrivateResumeOriginalsFolderId"),
        ["GoogleDrive__UseSharedDrive"] = ReadOptionalBoolean(secrets.Values, "GoogleDrive:UseSharedDrive", false).ToString().ToLowerInvariant(),
        ["GoogleDrive__MakeFilesPublic"] = ReadOptionalBoolean(secrets.Values, "GoogleDrive:MakeFilesPublic", true).ToString().ToLowerInvariant()
    };

    if (string.Equals(authMode, "OAuthRefreshToken", StringComparison.OrdinalIgnoreCase))
    {
        values["GoogleDrive__OAuthClientId"] = ReadRequiredStoredSecret(secrets.Values, "GoogleDrive:OAuthClientId");
        values["GoogleDrive__OAuthClientSecret"] = ReadRequiredStoredSecret(secrets.Values, "GoogleDrive:OAuthClientSecret");
        values["GoogleDrive__OAuthRefreshToken"] = ReadRequiredStoredSecret(secrets.Values, "GoogleDrive:OAuthRefreshToken");
    }
    else if (string.Equals(authMode, "ServiceAccount", StringComparison.OrdinalIgnoreCase))
    {
        var json = ReadOptionalSecret(secrets.Values, "GoogleDrive:ServiceAccountJson");
        var base64 = ReadOptionalSecret(secrets.Values, "GoogleDrive:ServiceAccountJsonBase64");
        if (string.IsNullOrWhiteSpace(json) == string.IsNullOrWhiteSpace(base64))
            throw new InvalidOperationException("ServiceAccount mode requires exactly one of GoogleDrive:ServiceAccountJson or GoogleDrive:ServiceAccountJsonBase64 in User Secrets.");

        values[string.IsNullOrWhiteSpace(json) ? "GoogleDrive__ServiceAccountJsonBase64" : "GoogleDrive__ServiceAccountJson"] = json ?? base64!;
    }
    else
    {
        throw new InvalidOperationException("GoogleDrive:AuthMode in User Secrets must be OAuthRefreshToken or ServiceAccount.");
    }

    var projectPath = FindArisProjectPath();
    var repositoryRoot = Directory.GetParent(Path.GetDirectoryName(projectPath)!)?.FullName
        ?? throw new InvalidOperationException("Could not locate the Aris repository root.");
    var settingsPath = Path.Combine(repositoryRoot, ".local", "production-settings.json");
    if (!File.Exists(settingsPath))
        throw new InvalidOperationException(".local/production-settings.json was not found. Create the production settings file first.");

    var settings = JsonNode.Parse(await File.ReadAllTextAsync(settingsPath))?.AsObject()
        ?? throw new InvalidOperationException("Production settings are not a JSON object.");
    var allDriveKeys = new[]
    {
        "GoogleDrive__Enabled", "GoogleDrive__AuthMode", "GoogleDrive__FolderId", "GoogleDrive__PrivateResumeOriginalsFolderId",
        "GoogleDrive__UseSharedDrive", "GoogleDrive__MakeFilesPublic", "GoogleDrive__OAuthClientId", "GoogleDrive__OAuthClientSecret",
        "GoogleDrive__OAuthRefreshToken", "GoogleDrive__ServiceAccountJson", "GoogleDrive__ServiceAccountJsonBase64"
    };

    // Never silently replace a non-empty deployment credential. A deliberate
    // credential rotation must be performed by the owner in the secret store.
    foreach (var pair in values)
    {
        var existing = ReadOptionalSecret(settings, pair.Key);
        if (!string.IsNullOrWhiteSpace(existing) && !string.Equals(existing, pair.Value, StringComparison.Ordinal))
            throw new InvalidOperationException($"Production setting {pair.Key} already has a different value; refusing to overwrite it.");
    }
    foreach (var key in allDriveKeys.Except(values.Keys, StringComparer.Ordinal))
    {
        if (!string.IsNullOrWhiteSpace(ReadOptionalSecret(settings, key)))
            throw new InvalidOperationException($"Production setting {key} conflicts with the configured {authMode} credential mode; remove or rotate it deliberately first.");
    }

    foreach (var pair in values) settings[pair.Key] = pair.Value;
    var temporaryPath = Path.Combine(Path.GetDirectoryName(settingsPath)!, $".production-settings-{Guid.NewGuid():N}.tmp");
    try
    {
        await File.WriteAllTextAsync(temporaryPath, settings.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temporaryPath, settingsPath, overwrite: true);
    }
    finally
    {
        if (File.Exists(temporaryPath)) File.Delete(temporaryPath);
    }

    Console.WriteLine("Google Drive production settings were merged without printing credential values.");
}

static async Task VerifyDriveAccessAsync()
{
    var secrets = await LoadArisUserSecretsAsync();
    var publicFolderId = ReadRequiredDriveId(secrets.Values, "GoogleDrive:FolderId");
    var privateFolderId = ReadRequiredDriveId(secrets.Values, "GoogleDrive:PrivateResumeOriginalsFolderId");
    var useSharedDrive = ReadOptionalBoolean(secrets.Values, "GoogleDrive:UseSharedDrive", false);

    using var drive = CreateConfiguredDriveService(secrets.Values);
    await VerifyFolderAsync(drive, publicFolderId, useSharedDrive, "public media");
    await VerifyFolderAsync(drive, privateFolderId, useSharedDrive, "private resume originals");
    Console.WriteLine("Google Drive access verified for the public-media and private-resume folders. No files were created or changed.");
}

static async Task SmokeStorageAsync()
{
    var secrets = await LoadArisUserSecretsAsync();
    var publicFolderId = ReadRequiredDriveId(secrets.Values, "GoogleDrive:FolderId");
    var privateFolderId = ReadRequiredDriveId(secrets.Values, "GoogleDrive:PrivateResumeOriginalsFolderId");
    if (string.Equals(publicFolderId, privateFolderId, StringComparison.Ordinal))
        throw new InvalidOperationException("The public-media and private-resume folders must be different before storage smoke testing.");

    var useSharedDrive = ReadOptionalBoolean(secrets.Values, "GoogleDrive:UseSharedDrive", false);
    using var drive = CreateConfiguredDriveService(secrets.Values);

    // Verify the parent folders before writing anything. This intentionally
    // performs only Drive operations: it does not load the application,
    // production settings, database, accounts, or CV records.
    await VerifyFolderAsync(drive, publicFolderId, useSharedDrive, "public media", requireDeleteChildren: true);
    await VerifyFolderAsync(drive, privateFolderId, useSharedDrive, "private resume originals", requireDeleteChildren: true);

    var runToken = Guid.NewGuid().ToString("N");
    var artifacts = new[]
    {
        new StorageSmokeArtifact(
            publicFolderId,
            $"aris-storage-smoke-{runToken}.png",
            "image/png",
            "public-png",
            runToken,
            CreateSyntheticPng()),
        new StorageSmokeArtifact(
            privateFolderId,
            $"aris-storage-smoke-{runToken}.pdf",
            "application/pdf",
            "private-pdf",
            runToken,
            CreateSyntheticPdf())
    };

    // Reserve Drive IDs before the first upload. This keeps cleanup
    // unambiguous even when Drive commits an upload but the response is lost.
    await AssignSmokeArtifactIdsAsync(drive, artifacts);

    Exception? testFailure = null;
    Exception? cleanupFailure = null;
    try
    {
        foreach (var artifact in artifacts)
            await UploadAndVerifySmokeArtifactAsync(drive, artifact, useSharedDrive);
    }
    catch (Exception exception)
    {
        // Do not write exception details here: API exceptions can include
        // opaque Drive identifiers. Cleanup still runs for every planned file.
        testFailure = exception;
    }
    finally
    {
        try
        {
            cleanupFailure = await CleanupSmokeArtifactsAsync(drive, artifacts, useSharedDrive);
        }
        catch (Exception exception)
        {
            cleanupFailure = exception;
        }
    }

    if (cleanupFailure is not null)
        throw new StorageSmokeException(cleanupFailed: true, cleanupFailure);
    if (testFailure is not null)
        throw new StorageSmokeException(cleanupFailed: false, testFailure);
}

static async Task AssignSmokeArtifactIdsAsync(
    DriveService drive,
    IReadOnlyList<StorageSmokeArtifact> artifacts)
{
    var generate = drive.Files.GenerateIds();
    generate.Count = artifacts.Count;
    generate.Space = "drive";
    generate.Type = "files";
    generate.Fields = "ids";
    var generated = await generate.ExecuteAsync();
    var ids = generated.Ids;
    if (ids is null ||
        ids.Count != artifacts.Count ||
        ids.Any(id => !IsSafeDriveId(id)) ||
        ids.Distinct(StringComparer.Ordinal).Count() != ids.Count)
    {
        throw new InvalidOperationException("Google Drive did not return valid unique IDs for the synthetic smoke-test files.");
    }

    for (var index = 0; index < artifacts.Count; index++)
        artifacts[index].FileId = ids[index];
}

static async Task UploadAndVerifySmokeArtifactAsync(
    DriveService drive,
    StorageSmokeArtifact artifact,
    bool useSharedDrive)
{
    if (!IsSafeDriveId(artifact.FileId))
        throw new InvalidOperationException("A synthetic Drive smoke-test file does not have a reserved ID.");

    var fileId = artifact.FileId!;
    var metadata = new DriveFile
    {
        Id = fileId,
        Name = artifact.Name,
        MimeType = artifact.ContentType,
        Parents = new List<string> { artifact.ParentId },
        AppProperties = new Dictionary<string, string>
        {
            [StorageSmokeMarkerProperty] = "true",
            [StorageSmokeRunProperty] = artifact.RunToken,
            ["aris_storage_smoke_kind"] = artifact.Kind
        }
    };

    using var source = new MemoryStream(artifact.Content, writable: false);
    var create = drive.Files.Create(metadata, source, artifact.ContentType);
    create.Fields = "id";
    create.SupportsAllDrives = useSharedDrive;
    var progress = await create.UploadAsync();
    var responseFileId = create.ResponseBody?.Id;
    if (progress.Status != UploadStatus.Completed ||
        !string.Equals(responseFileId, fileId, StringComparison.Ordinal))
        throw new InvalidOperationException("A synthetic Drive smoke-test file was not uploaded successfully.");

    var get = drive.Files.Get(fileId);
    get.Fields = "id,name,mimeType,size,parents,trashed,appProperties";
    get.SupportsAllDrives = useSharedDrive;
    var uploaded = await get.ExecuteAsync();
    if (!MatchesSmokeArtifact(uploaded, artifact) ||
        uploaded.Size is null ||
        uploaded.Size.Value != artifact.Content.LongLength)
    {
        throw new InvalidOperationException("A synthetic Drive smoke-test file did not have the expected private metadata.");
    }
}

static async Task<Exception?> CleanupSmokeArtifactsAsync(
    DriveService drive,
    IReadOnlyList<StorageSmokeArtifact> artifacts,
    bool useSharedDrive)
{
    List<Exception>? failures = null;
    for (var index = artifacts.Count - 1; index >= 0; index--)
    {
        var artifact = artifacts[index];
        try
        {
            await DeleteAndConfirmSmokeArtifactAbsentAsync(drive, artifact, useSharedDrive);
        }
        catch (Exception exception)
        {
            (failures ??= new List<Exception>()).Add(exception);
        }
    }

    return failures is null ? null : new AggregateException(failures);
}

static async Task DeleteAndConfirmSmokeArtifactAbsentAsync(
    DriveService drive,
    StorageSmokeArtifact artifact,
    bool useSharedDrive)
{
    if (!IsSafeDriveId(artifact.FileId))
        throw new InvalidOperationException("A synthetic Drive smoke-test file does not have a reserved ID for cleanup.");

    var fileId = artifact.FileId!;
    Exception? deleteFailure = null;
    try
    {
        var delete = drive.Files.Delete(fileId);
        delete.SupportsAllDrives = useSharedDrive;
        await delete.ExecuteAsync();
    }
    catch (Google.GoogleApiException exception) when (exception.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
    {
        // A pre-generated ID that was never committed is already in the
        // desired state; Drive's 404 is the absence confirmation.
        return;
    }
    catch (Exception exception)
    {
        // A dropped delete response can still mean the object was removed.
        // Verify by its pre-generated ID before declaring cleanup failed.
        deleteFailure = exception;
    }

    if (await IsSmokeArtifactAbsentAsync(drive, fileId, useSharedDrive))
        return;

    throw deleteFailure is null
        ? new InvalidOperationException("A synthetic Drive smoke-test file remains after cleanup.")
        : new InvalidOperationException("Google Drive could not confirm removal of a synthetic smoke-test file.", deleteFailure);
}

static async Task<bool> IsSmokeArtifactAbsentAsync(
    DriveService drive,
    string fileId,
    bool useSharedDrive)
{
    var get = drive.Files.Get(fileId);
    get.Fields = "id";
    get.SupportsAllDrives = useSharedDrive;
    try
    {
        await get.ExecuteAsync();
        return false;
    }
    catch (Google.GoogleApiException exception) when (exception.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
    {
        return true;
    }
}

static bool MatchesSmokeArtifact(DriveFile file, StorageSmokeArtifact artifact) =>
    file.Trashed != true &&
    string.Equals(file.Name, artifact.Name, StringComparison.Ordinal) &&
    string.Equals(file.MimeType, artifact.ContentType, StringComparison.Ordinal) &&
    file.Parents?.Any(parent => string.Equals(parent, artifact.ParentId, StringComparison.Ordinal)) == true &&
    file.AppProperties is not null &&
    file.AppProperties.TryGetValue(StorageSmokeMarkerProperty, out var marker) &&
    string.Equals(marker, "true", StringComparison.Ordinal) &&
    file.AppProperties.TryGetValue(StorageSmokeRunProperty, out var runToken) &&
    string.Equals(runToken, artifact.RunToken, StringComparison.Ordinal) &&
    file.AppProperties.TryGetValue("aris_storage_smoke_kind", out var kind) &&
    string.Equals(kind, artifact.Kind, StringComparison.Ordinal);

static byte[] CreateSyntheticPng() => Convert.FromBase64String(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9J+xYAAAAASUVORK5CYII=");

static byte[] CreateSyntheticPdf() => Encoding.ASCII.GetBytes("""
    %PDF-1.4
    % Aris storage smoke test: synthetic content only
    1 0 obj
    << /Type /Catalog /Pages 2 0 R >>
    endobj
    2 0 obj
    << /Type /Pages /Count 0 /Kids [] >>
    endobj
    trailer
    << /Root 1 0 R >>
    %%EOF
    """);

static DriveService CreateConfiguredDriveService(JsonObject secrets)
{
    var authMode = ReadRequiredStoredSecret(secrets, "GoogleDrive:AuthMode");
    GoogleCredential credential;
    if (string.Equals(authMode, "OAuthRefreshToken", StringComparison.OrdinalIgnoreCase))
    {
        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = ReadRequiredStoredSecret(secrets, "GoogleDrive:OAuthClientId"),
                ClientSecret = ReadRequiredStoredSecret(secrets, "GoogleDrive:OAuthClientSecret")
            },
            Scopes = new[] { DriveService.Scope.DriveFile },
            DataStore = new NullDataStore()
        });
        credential = new UserCredential(
            flow,
            "aris-drive-owner",
            new TokenResponse { RefreshToken = ReadRequiredStoredSecret(secrets, "GoogleDrive:OAuthRefreshToken") })
            .ToGoogleCredential();
    }
    else if (string.Equals(authMode, "ServiceAccount", StringComparison.OrdinalIgnoreCase))
    {
        var json = ReadOptionalSecret(secrets, "GoogleDrive:ServiceAccountJson");
        var base64 = ReadOptionalSecret(secrets, "GoogleDrive:ServiceAccountJsonBase64");
        if (string.IsNullOrWhiteSpace(json) == string.IsNullOrWhiteSpace(base64))
            throw new InvalidOperationException("ServiceAccount mode requires exactly one configured service-account JSON value.");
        var credentialJson = json ?? Encoding.UTF8.GetString(Convert.FromBase64String(base64!));
        credential = CredentialFactory.FromJson<ServiceAccountCredential>(credentialJson)
            .ToGoogleCredential()
            .CreateScoped(DriveService.Scope.Drive);
    }
    else
    {
        throw new InvalidOperationException("GoogleDrive:AuthMode must be OAuthRefreshToken or ServiceAccount.");
    }

    return new DriveService(new BaseClientService.Initializer
    {
        HttpClientInitializer = credential,
        ApplicationName = "ArisSkyve Google Drive verification"
    });
}

static async Task VerifyFolderAsync(
    DriveService drive,
    string folderId,
    bool useSharedDrive,
    string label,
    bool requireDeleteChildren = false)
{
    var request = drive.Files.Get(folderId);
    request.Fields = "id,mimeType,trashed,capabilities(canAddChildren,canDeleteChildren)";
    request.SupportsAllDrives = useSharedDrive;
    var folder = await request.ExecuteAsync();
    if (folder.Trashed == true ||
        !string.Equals(folder.MimeType, "application/vnd.google-apps.folder", StringComparison.Ordinal) ||
        folder.Capabilities?.CanAddChildren != true ||
        (requireDeleteChildren && useSharedDrive && folder.Capabilities?.CanDeleteChildren != true))
    {
        throw new InvalidOperationException(
            $"The configured {label} folder is not an active Google Drive folder with the required create/delete capabilities.");
    }
}

static async Task<ArisUserSecrets> LoadArisUserSecretsAsync()
{
    var projectPath = FindArisProjectPath();
    var userSecretsId = ReadUserSecretsId(projectPath);
    var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
    if (string.IsNullOrWhiteSpace(appData))
        throw new InvalidOperationException("The current Windows user does not have an AppData directory for User Secrets.");

    var secretDirectory = Path.Combine(appData, "Microsoft", "UserSecrets", userSecretsId);
    var secretsPath = Path.Combine(secretDirectory, "secrets.json");
    if (!File.Exists(secretsPath))
        throw new InvalidOperationException("ArisSkyve User Secrets do not exist. Run the public media OAuth bootstrap first.");

    var values = JsonNode.Parse(await File.ReadAllTextAsync(secretsPath))?.AsObject()
        ?? throw new InvalidOperationException("Existing ArisSkyve User Secrets are not a JSON object.");
    return new ArisUserSecrets(secretDirectory, secretsPath, values);
}

static async Task SaveArisUserSecretsAsync(ArisUserSecrets secrets)
{
    Directory.CreateDirectory(secrets.Directory);
    var temporaryPath = Path.Combine(secrets.Directory, $".secrets-{Guid.NewGuid():N}.tmp");
    try
    {
        await File.WriteAllTextAsync(temporaryPath, secrets.Values.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temporaryPath, secrets.Path, overwrite: true);
    }
    finally
    {
        if (File.Exists(temporaryPath))
            File.Delete(temporaryPath);
    }
}

static string ReadRequiredStoredSecret(JsonObject secrets, string key)
{
    var value = ReadOptionalSecret(secrets, key);
    return !string.IsNullOrWhiteSpace(value)
        ? value
        : throw new InvalidOperationException($"User Secrets does not contain a non-empty {key} value.");
}

static string ReadRequiredDriveId(JsonObject secrets, string key)
{
    var value = ReadRequiredStoredSecret(secrets, key);
    return IsSafeDriveId(value)
        ? value
        : throw new InvalidOperationException($"User Secrets contains an invalid {key} value.");
}

static bool ReadOptionalBoolean(JsonObject secrets, string key, bool defaultValue)
{
    var value = ReadOptionalSecret(secrets, key);
    if (string.IsNullOrWhiteSpace(value)) return defaultValue;
    return bool.TryParse(value, out var result)
        ? result
        : throw new InvalidOperationException($"User Secrets contains an invalid boolean {key} value.");
}

static string? ReadOptionalSecret(JsonObject secrets, string key) =>
    secrets[key] is JsonValue value && value.TryGetValue<string>(out var text)
        ? text?.Trim()
        : null;

static bool IsSafeDriveId(string? value) =>
    !string.IsNullOrWhiteSpace(value) && value.Length is >= 5 and <= 256 &&
    value.All(character => char.IsLetterOrDigit(character) || character is '-' or '_');

static string FindArisProjectPath()
{
    for (var directory = new DirectoryInfo(Directory.GetCurrentDirectory()); directory is not null; directory = directory.Parent)
    {
        var candidate = Path.Combine(directory.FullName, "ArisSkyve", "ArisSkyve.csproj");
        if (File.Exists(candidate))
            return candidate;
    }

    throw new InvalidOperationException("Run this helper from the Aris repository so it can configure ArisSkyve User Secrets.");
}

static string ReadUserSecretsId(string projectPath)
{
    var project = XDocument.Load(projectPath);
    var userSecretsId = project.Descendants("UserSecretsId").Select(element => element.Value.Trim()).FirstOrDefault();
    if (string.IsNullOrWhiteSpace(userSecretsId))
        throw new InvalidOperationException("ArisSkyve.csproj does not declare a UserSecretsId.");

    return userSecretsId;
}

static string ReadRequiredJsonString(JsonElement container, string propertyName)
{
    if (!container.TryGetProperty(propertyName, out var property) || property.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(property.GetString()))
        throw new InvalidOperationException($"The Desktop OAuth client JSON does not contain a valid '{propertyName}'.");

    return property.GetString()!.Trim();
}

static string ReadRequiredSecret(string label)
{
    Console.Write($"{label}: ");
    var value = new StringBuilder();

    while (true)
    {
        var key = Console.ReadKey(intercept: true);
        if (key.Key == ConsoleKey.Enter)
        {
            Console.WriteLine();
            break;
        }

        if (key.Key == ConsoleKey.Backspace)
        {
            if (value.Length > 0)
                value.Length--;
            continue;
        }

        if (!char.IsControl(key.KeyChar))
            value.Append(key.KeyChar);
    }

    if (string.IsNullOrWhiteSpace(value.ToString()))
        throw new InvalidOperationException($"{label} is required.");

    return value.ToString();
}

internal sealed record OAuthClient(string ClientId, string ClientSecret);

internal sealed record ArisUserSecrets(string Directory, string Path, JsonObject Values);

internal sealed class StorageSmokeArtifact
{
    public StorageSmokeArtifact(
        string parentId,
        string name,
        string contentType,
        string kind,
        string runToken,
        byte[] content)
    {
        ParentId = parentId;
        Name = name;
        ContentType = contentType;
        Kind = kind;
        RunToken = runToken;
        Content = content;
    }

    public string ParentId { get; }
    public string Name { get; }
    public string ContentType { get; }
    public string Kind { get; }
    public string RunToken { get; }
    public byte[] Content { get; }
    public string? FileId { get; set; }
}

internal sealed class StorageSmokeException : Exception
{
    public StorageSmokeException(bool cleanupFailed, Exception innerException)
        : base("Google Drive storage smoke test failed.", innerException)
    {
        CleanupFailed = cleanupFailed;
    }

    public bool CleanupFailed { get; }
}
