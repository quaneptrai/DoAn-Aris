# Google Drive public media storage

Aris stores newly uploaded public media (post attachments, stories, avatars,
cover photos, and chat media) in Google Drive. It does not write a fallback
copy to `wwwroot`, `App_Data`, or any other application-root folder.

The validation rules remain unchanged: the server verifies declared MIME type,
filename extension, file signature, and endpoint-specific size limits before it
contacts Google Drive.

## Provisioning

1. Enable the Google Drive API in the Google Cloud project that owns the
   service account.
2. Prefer a Google Workspace Shared Drive. Add the service account as a
   Content manager (or another role that can create/delete files) and create a
   dedicated folder for Aris public media. Service accounts do not have normal
   personal Drive storage quota, so a Shared Drive is the reliable production
   option.
3. Keep that parent folder private. The application grants each successfully
   uploaded file `anyone:reader` link access only after its upload completes;
   making the parent folder public can expose incomplete uploads and its file
   listing.
4. Copy the folder ID from its Drive URL and supply service-account credentials
   through the deployment secret store or environment variables. Never commit a
   service-account JSON key to this repository.

Example environment configuration:

```text
GoogleDrive__Enabled=true
GoogleDrive__FolderId=your-private-parent-folder-id
GoogleDrive__UseSharedDrive=true
GoogleDrive__MakeFilesPublic=true
GoogleDrive__ServiceAccountJsonBase64=<base64-encoded-service-account-json>
```

`GoogleDrive__ServiceAccountJson` is also accepted if the platform can safely
store multiline JSON. `GoogleDrive__ServiceAccountJsonBase64` is usually less
error-prone for environment variables. The default public URL format is
`https://drive.google.com/uc?export=view&id={fileId}`; set
`GoogleDrive__PublicUrlTemplate` only when a compatible HTTPS proxy/CDN is in
front of Drive, and retain the `{fileId}` placeholder.

For local development, use User Secrets instead of `appsettings.json`:

```powershell
dotnet user-secrets set "GoogleDrive:Enabled" "true" --project ArisSkyve/ArisSkyve.csproj
dotnet user-secrets set "GoogleDrive:FolderId" "your-folder-id" --project ArisSkyve/ArisSkyve.csproj
dotnet user-secrets set "GoogleDrive:UseSharedDrive" "true" --project ArisSkyve/ArisSkyve.csproj
dotnet user-secrets set "GoogleDrive:ServiceAccountJsonBase64" "<base64-json>" --project ArisSkyve/ArisSkyve.csproj
```

If this configuration is absent or Drive rejects an operation, the upload fails
with an error. It intentionally does not fall back to the local application
root.

## Existing files and private CVs

The old `/media/...` and `/uploads/...` routes remain read-only compatibility
paths for media already stored on the server. They are not used for new uploads.
Migrate historical URLs separately after credentials are provisioned.

Imported CV originals remain private in the existing protected lifecycle store.
They must not be put in this public Drive folder because they can contain
personal data. Moving those PDFs off local disk requires a separate private
Drive store plus an authenticated streaming/proxy design.

## Operational note

Google Drive public links are convenient file hosting, not a CDN. Large video
playback, byte-range requests, and high-traffic delivery can be throttled by
Drive. Use object storage plus a CDN if those workloads become important.
