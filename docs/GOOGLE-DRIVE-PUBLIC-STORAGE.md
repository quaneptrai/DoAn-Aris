# Google Drive public media storage

Aris stores newly uploaded public media (post attachments, stories, avatars,
cover photos, and chat media) in Google Drive. It does not write a fallback
copy to `wwwroot`, `App_Data`, or any other application-root folder.

The validation rules remain unchanged: the server verifies declared MIME type,
filename extension, file signature, and endpoint-specific size limits before it
contacts Google Drive.

## Personal Google Drive (`@gmail.com`)

Use this mode for a personal Drive such as `tohkadangyeu@gmail.com`. Do not use
a service account: it has no usable consumer My Drive storage quota. Personal
Drive uploads need OAuth for the owner; service accounts belong with a
Workspace Shared Drive.

1. Create or select a Google Cloud project, then enable the Google Drive API.
2. Configure its OAuth consent screen. While it is in Testing, add the Drive
   owner as a test user. Publish it before relying on a long-lived production
   refresh token; testing refresh tokens can expire after seven days.
3. In Google Cloud Console, open **Google Auth Platform** > **Clients** >
   **Create client**. Choose **Desktop app**, create it, then click
   **Download JSON**. The JSON contains `installed.client_id` and
   `installed.client_secret`. Keep this client separate from the app's ordinary
   Google sign-in configuration.
4. Run this one-time local helper from the repository. It opens a browser;
   sign in only as the Drive owner and approve the request:

   ```powershell
   dotnet run --project tools/GoogleDriveOAuthBootstrap/GoogleDriveOAuthBootstrap.csproj -- "C:\path\to\client_secret_desktop.json" --configure-user-secrets
   ```

   Prefer the downloaded JSON file: it avoids entering the client secret on a
   command line and works even when console input is redirected. Treat this
   JSON file and the refresh token saved by the helper as secrets. It uses
   PKCE, requests the narrower `drive.file` permission, creates a private
   `Aris public media` folder, and with `--configure-user-secrets` stores the
   credentials directly in the local ArisSkyve User Secrets store without
   printing them. It does not write a token file locally.
5. The helper always saves values to local User Secrets and never prints a
   refresh token or client secret. Use `--configure-production-settings` below
   to move the values into the git-ignored deployment settings file, or put
   them into an equivalent managed secret store. Never put them in
   `appsettings.json`, Git, or chat.

The server refreshes access tokens in memory; it does not write them below the
application root. Keep the parent folder created by the helper and keep using
the same OAuth client ID: the OAuth client has access to that app-created
folder and its children, rather than to every file in My Drive. Do not replace
`FolderId` with an arbitrary existing My Drive folder unless you re-bootstrap
or intentionally switch to a broader Drive permission.

After both folders exist, this read-only check verifies that the owner can read
and add children to each configured folder without printing IDs or credentials:

```powershell
dotnet run --project tools/GoogleDriveOAuthBootstrap/GoogleDriveOAuthBootstrap.csproj -- --verify-drive-access
```

### Deliberate storage smoke test

When a write/read/delete check is specifically needed, run the opt-in smoke
test with both flags shown below. It uploads one synthetic in-memory PNG to
the configured public-media folder and one synthetic in-memory PDF to the
distinct private-resume folder, validates only owner-scoped metadata, then
deletes every test file in `finally` before reporting success.

```powershell
dotnet run --project tools/GoogleDriveOAuthBootstrap/GoogleDriveOAuthBootstrap.csproj -- --smoke-storage --confirm-smoke-storage
```

It never starts ArisSkyve, connects to the production database, accesses user
accounts or CV records, grants public permissions, follows public URLs, or
prints file IDs, URLs, settings, credentials, or payload contents. The command
fails if cleanup cannot be confirmed. If the process is forcibly interrupted,
look only in the two configured folders for files whose names start with
`aris-storage-smoke-` and remove those synthetic files manually.

## Google Workspace Shared Drive

Use this alternative only when a Workspace Shared Drive is available. Enable
the Drive API, add the service account as an Organizer on the dedicated parent
folder (or another role with both create and permanent-delete capability), and
create a dedicated private folder there. This is required for the application's
cleanup operations and for the storage smoke test: Drive requires delete
authority for a shared-drive file, not merely permission to add children.

```text
GoogleDrive__Enabled=true
GoogleDrive__AuthMode=ServiceAccount
GoogleDrive__FolderId=your-private-parent-folder-id
GoogleDrive__UseSharedDrive=true
GoogleDrive__MakeFilesPublic=true
GoogleDrive__ServiceAccountJsonBase64=<base64-encoded-service-account-json>
```

`GoogleDrive__ServiceAccountJson` is also accepted if the platform can safely
store multiline JSON. Only one credential mode may be configured at a time.

## Shared behavior

Keep the parent folder private. The application grants each successfully
uploaded file `anyone:reader` link access only after its upload completes;
making the parent folder public can expose incomplete uploads and its file
listing.

The default public URL format is
`https://drive.google.com/uc?export=view&id={fileId}`. When Drive returns a
link-sharing resource key, the application adds it to the generated URL so a
first-time public visitor can open the media. Set
`GoogleDrive__PublicUrlTemplate` only when a compatible HTTPS proxy/CDN is in
front of Drive, and retain the `{fileId}` placeholder; a custom template may
also use `{resourceKey}`.

If this configuration is absent or Drive rejects an operation, the upload fails
with an error. It intentionally does not fall back to the local application
root.

Drive direct-view URLs do not retain a filename extension. Video URLs include a
client-only `#aris-media=video` fragment so the existing chat message schema
can render them as video; the fragment is never sent to Google Drive.

## Existing files and private CVs

The old `/media/...` and `/uploads/...` routes remain read-only compatibility
paths for media already stored on the server. They are not used for new uploads.
Migrate historical URLs separately after credentials are provisioned.

Imported CV originals never belong in the public-media folder: they may contain
personal data. New imported-layout PDFs use a separate private Drive folder and
are only downloaded through the authenticated owner endpoint; Drive file IDs
and Drive URLs never reach the browser. After the personal-Drive public-media
OAuth setup is in User Secrets, create that folder once:

```powershell
dotnet run --project tools/GoogleDriveOAuthBootstrap/GoogleDriveOAuthBootstrap.csproj -- --configure-private-resume-storage
```

The helper creates a private `Aris private resume originals` folder and stores
`GoogleDrive:PrivateResumeOriginalsFolderId` in local User Secrets. In
production, put that folder ID in the deployment secret store as
`GoogleDrive__PrivateResumeOriginalsFolderId`, alongside the same private
owner credentials, then apply migration
`20261004200951_AddPrivateDriveResumeOriginals` before enabling the release.

For the repository's existing `.local/production-settings.json` deployment
workflow, the helper can copy the already-configured local Drive values into
that git-ignored file without displaying them. It refuses to overwrite a
different non-empty production credential:

```powershell
dotnet run --project tools/GoogleDriveOAuthBootstrap/GoogleDriveOAuthBootstrap.csproj -- --configure-production-settings
```

For compatibility, an existing valid owner-scoped PDF under
`App_Data/resume-originals` is migrated lazily only when that owner opens or
saves its matching imported-layout CV. The server verifies the exact
owner/source path and PDF signature, uploads it privately, verifies the Drive
mapping, and retains the old local file as a rollback copy. It does not scan or
upload other users' files at startup. Do not delete old protected files until
the corresponding Drive mapping has been verified.

## Operational note

Google Drive public links are convenient file hosting, not a CDN. Large video
playback, byte-range requests, and high-traffic delivery can be throttled by
Drive. Use object storage plus a CDN if those workloads become important.
