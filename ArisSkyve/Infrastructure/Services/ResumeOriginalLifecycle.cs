using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Services;

// The private PDF used by an imported-layout document intentionally lives outside
// wwwroot.  Keep all file-system operations in one place so every caller applies
// the same owner, source-id, containment, and reference checks.
public enum ResumeOriginalDeleteResult
{
    Deleted,
    Missing,
    Referenced,
    Failed,
    Invalid
}

public sealed class ResumeOriginalLifecycle
{
    public const int DefaultRetentionHours = 7 * 24;
    public const int MinimumRetentionHours = 24;
    private const string EngineVersion = "aris-resume/v1";
    private static readonly Regex SourceIdPattern = new(@"\A[a-f0-9]{32}\z", RegexOptions.CultureInvariant);
    private static readonly Regex TemporaryFilePattern = new(@"\A[a-f0-9]{32}\.pdf\.[a-f0-9]{32}\.uploading\z", RegexOptions.CultureInvariant);

    private readonly ArisDBContext _db;
    private readonly IWebHostEnvironment _environment;

    public ResumeOriginalLifecycle(ArisDBContext db, IWebHostEnvironment environment, IConfiguration configuration)
    {
        _db = db;
        _environment = environment;
        var configured = configuration.GetValue<int?>("ResumeEngine:OriginalRetentionHours") ?? DefaultRetentionHours;
        // An accidental zero/negative setting must never turn an abandoned upload
        // into an immediate deletion. Larger values only retain data for longer.
        RetentionHours = Math.Max(MinimumRetentionHours, configured);
    }

    public int RetentionHours { get; }

    public static bool IsValidSourceId(string? sourceId) => sourceId is not null && SourceIdPattern.IsMatch(sourceId);

    // Extract only a source ID from a schema-valid stored Studio document. A malformed
    // blob never grants authority to remove a file.
    public static string? TryGetStoredSourceId(string? builderDataJson)
    {
        if (string.IsNullOrWhiteSpace(builderDataJson)) return null;

        try
        {
            using var document = JsonDocument.Parse(builderDataJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return null;

            JsonElement data;
            if (root.TryGetProperty("engine", out var engine))
            {
                if (engine.ValueKind != JsonValueKind.String ||
                    !string.Equals(engine.GetString(), EngineVersion, StringComparison.Ordinal) ||
                    !root.TryGetProperty("data", out data) ||
                    !CanonicalResumeContract.IsValid(data))
                    return null;
            }
            else
            {
                // Historical canonical records are still accepted by Studio, so they
                // need the same safe lifecycle behavior as wrapped engine records.
                if (!CanonicalResumeContract.IsValid(root)) return null;
                data = root;
            }

            return TryGetSourceId(data);
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException or ArgumentException)
        {
            return null;
        }
    }

    public static string? TryGetSourceId(JsonElement data)
    {
        if (data.ValueKind != JsonValueKind.Object ||
            !data.TryGetProperty("importedLayout", out var layout) || layout.ValueKind != JsonValueKind.Object ||
            !layout.TryGetProperty("sourceId", out var sourceId) || sourceId.ValueKind != JsonValueKind.String)
            return null;

        var value = sourceId.GetString();
        return IsValidSourceId(value) ? value : null;
    }

    public bool TryGetPath(int userId, string? sourceId, out string path)
    {
        path = string.Empty;
        if (userId <= 0 || !IsValidSourceId(sourceId) || string.IsNullOrWhiteSpace(_environment.ContentRootPath)) return false;

        try
        {
            var contentRoot = Path.GetFullPath(_environment.ContentRootPath);
            var appData = Path.GetFullPath(Path.Combine(contentRoot, "App_Data"));
            var originalsRoot = Path.GetFullPath(Path.Combine(appData, "resume-originals"));
            var ownerFolderName = userId.ToString(CultureInfo.InvariantCulture);
            var ownerFolder = Path.GetFullPath(Path.Combine(originalsRoot, ownerFolderName));
            var fileName = sourceId + ".pdf";
            var candidate = Path.GetFullPath(Path.Combine(ownerFolder, fileName));

            if (!IsDirectChild(contentRoot, appData, "App_Data") ||
                !IsDirectChild(appData, originalsRoot, "resume-originals") ||
                !IsDirectChild(originalsRoot, ownerFolder, ownerFolderName) ||
                !IsDirectChild(ownerFolder, candidate, fileName) ||
                HasReparsePoint(appData) || HasReparsePoint(originalsRoot) || HasReparsePoint(ownerFolder) || HasReparsePoint(candidate))
                return false;

            path = candidate;
            return true;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return false;
        }
    }

    // A caller may use this while parsing an upload. It creates only the exact
    // owner-scoped file path and cleans a partial file if copying fails.
    public async Task<bool> StoreAsync(int userId, string sourceId, IFormFile file, CancellationToken cancellationToken)
    {
        if (!TryGetPath(userId, sourceId, out var path)) return false;
        var folder = Path.GetDirectoryName(path);
        if (string.IsNullOrWhiteSpace(folder)) return false;
        var temporaryName = Path.GetFileName(path) + "." + Guid.NewGuid().ToString("N") + ".uploading";
        var temporaryPath = Path.GetFullPath(Path.Combine(folder, temporaryName));
        if (!IsDirectChild(folder, temporaryPath, temporaryName)) return false;

        try
        {
            Directory.CreateDirectory(folder);
            if (HasReparsePoint(folder)) return false;

            // Copy to an unservable sibling first. The final path appears only after
            // a successful close + same-directory move, so a failed upload cannot be
            // returned from the original route as a partial PDF.
            await using (var original = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            {
                await file.CopyToAsync(original, cancellationToken);
                await original.FlushAsync(cancellationToken);
            }

            // A freshly generated ID should never exist. overwrite:false ensures a
            // collision cannot overwrite another private upload even if the RNG/filesystem fails.
            System.IO.File.Move(temporaryPath, path, overwrite: false);
            return true;
        }
        catch (OperationCanceledException)
        {
            TryDeleteTemporary(temporaryPath, folder, temporaryName);
            throw;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            TryDeleteTemporary(temporaryPath, folder, temporaryName);
            return false;
        }
    }

    // Explicit discard is allowed only for an unsaved candidate. The reference query
    // runs immediately before the exact-file removal.
    public async Task<ResumeOriginalDeleteResult> DeleteIfUnreferencedAsync(int userId, string? sourceId, CancellationToken cancellationToken)
    {
        if (!TryGetPath(userId, sourceId, out var path)) return ResumeOriginalDeleteResult.Invalid;
        if (await IsReferencedAsync(userId, sourceId!, cancellationToken)) return ResumeOriginalDeleteResult.Referenced;
        return TryDeleteExact(path);
    }

    // Replacing a saved layout never removes the former original eagerly: a stale tab
    // can still contain a valid document that references it. Resetting its timestamp
    // begins a fresh retention window only after the DB commit proved it is unreferenced.
    public async Task DeferUnreferencedCleanupAsync(int userId, string? sourceId, CancellationToken cancellationToken)
    {
        if (!TryGetPath(userId, sourceId, out var path)) return;
        if (await IsReferencedAsync(userId, sourceId!, cancellationToken)) return;

        try
        {
            if (!System.IO.File.Exists(path) || HasReparsePoint(path)) return;
            System.IO.File.SetLastWriteTimeUtc(path, DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            // The persisted CV save is authoritative; retention maintenance is best effort.
        }
    }

    // Files become eligible only after the retention window. The scan is owner-scoped,
    // non-recursive, and rechecks references for each file immediately before deletion.
    public async Task<int> CleanupExpiredUnreferencedAsync(int userId, CancellationToken cancellationToken)
    {
        if (!TryGetOwnerFolder(userId, out var folder) || !Directory.Exists(folder) || HasReparsePoint(folder)) return 0;
        var cutoff = DateTime.UtcNow.AddHours(-RetentionHours);
        var removed = 0;

        try
        {
            foreach (var candidate in Directory.EnumerateFiles(folder, "*.pdf", SearchOption.TopDirectoryOnly))
            {
                cancellationToken.ThrowIfCancellationRequested();
                var fileName = Path.GetFileName(candidate);
                if (!TryGetSourceIdFromFileName(fileName, out var sourceId) ||
                    !TryGetPath(userId, sourceId, out var safePath) ||
                    !PathsEqual(candidate, safePath) ||
                    HasReparsePoint(candidate))
                    continue;

                DateTime lastWrite;
                try { lastWrite = System.IO.File.GetLastWriteTimeUtc(candidate); }
                catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { continue; }
                if (lastWrite > cutoff) continue;

                if (await DeleteIfUnreferencedAsync(userId, sourceId, cancellationToken) == ResumeOriginalDeleteResult.Deleted)
                    removed++;
            }
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            // A transient directory/file lock is retried by a later worker pass.
        }

        CleanupExpiredTemporaryFiles(folder, cutoff);

        return removed;
    }

    // The hosted worker only visits existing user folders whose names exactly match a
    // real user ID. It never recursively sweeps arbitrary content-root paths.
    public async Task<int> CleanupAllExpiredUnreferencedAsync(CancellationToken cancellationToken)
    {
        if (!TryGetOriginalsRoot(out var originalsRoot) || !Directory.Exists(originalsRoot) || HasReparsePoint(originalsRoot)) return 0;

        List<int> userIds;
        try
        {
            userIds = await _db.Users.AsNoTracking().Select(user => user.Id).ToListAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is InvalidOperationException or IOException)
        {
            return 0;
        }

        var removed = 0;
        foreach (var userId in userIds.Where(id => id > 0))
        {
            cancellationToken.ThrowIfCancellationRequested();
            removed += await CleanupExpiredUnreferencedAsync(userId, cancellationToken);
        }
        return removed;
    }

    private async Task<bool> IsReferencedAsync(int userId, string sourceId, CancellationToken cancellationToken)
    {
        var documents = await _db.Resumes.AsNoTracking()
            .Where(resume => resume.Account.UserId == userId && resume.BuilderDataJson != null)
            .Select(resume => resume.BuilderDataJson!)
            .ToListAsync(cancellationToken);
        return documents.Any(document => string.Equals(TryGetStoredSourceId(document), sourceId, StringComparison.Ordinal));
    }

    private bool TryGetOwnerFolder(int userId, out string folder)
    {
        folder = string.Empty;
        // A syntactically valid dummy source ID makes TryGetPath perform the same
        // containment/reparse checks used for every real file.
        if (!TryGetPath(userId, new string('a', 32), out var samplePath)) return false;
        folder = Path.GetDirectoryName(samplePath)!;
        return true;
    }

    private bool TryGetOriginalsRoot(out string originalsRoot)
    {
        originalsRoot = string.Empty;
        if (string.IsNullOrWhiteSpace(_environment.ContentRootPath)) return false;
        try
        {
            var contentRoot = Path.GetFullPath(_environment.ContentRootPath);
            var appData = Path.GetFullPath(Path.Combine(contentRoot, "App_Data"));
            var candidate = Path.GetFullPath(Path.Combine(appData, "resume-originals"));
            if (!IsDirectChild(contentRoot, appData, "App_Data") ||
                !IsDirectChild(appData, candidate, "resume-originals") ||
                HasReparsePoint(appData) || HasReparsePoint(candidate))
                return false;
            originalsRoot = candidate;
            return true;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return false;
        }
    }

    private static ResumeOriginalDeleteResult TryDeleteExact(string path)
    {
        try
        {
            if (!System.IO.File.Exists(path)) return ResumeOriginalDeleteResult.Missing;
            if (HasReparsePoint(path)) return ResumeOriginalDeleteResult.Failed;
            System.IO.File.Delete(path);
            return ResumeOriginalDeleteResult.Deleted;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return ResumeOriginalDeleteResult.Failed;
        }
    }

    private static void TryDeleteTemporary(string path, string folder, string fileName)
    {
        try
        {
            if (!IsDirectChild(folder, path, fileName) || HasReparsePoint(path)) return;
            System.IO.File.Delete(path);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            // A stale unservable temporary file cannot be routed to a user. Leave it
            // for normal filesystem administration rather than risking a broad delete.
        }
    }

    private static void CleanupExpiredTemporaryFiles(string folder, DateTime cutoff)
    {
        try
        {
            foreach (var candidate in Directory.EnumerateFiles(folder, "*.uploading", SearchOption.TopDirectoryOnly))
            {
                var fileName = Path.GetFileName(candidate);
                if (!TemporaryFilePattern.IsMatch(fileName) || !IsDirectChild(folder, candidate, fileName) || HasReparsePoint(candidate))
                    continue;

                DateTime lastWrite;
                try { lastWrite = System.IO.File.GetLastWriteTimeUtc(candidate); }
                catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { continue; }
                if (lastWrite > cutoff) continue;

                TryDeleteTemporary(candidate, folder, fileName);
            }
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            // A failed temporary-file sweep cannot affect persisted CVs and will retry later.
        }
    }

    private static bool TryGetSourceIdFromFileName(string fileName, out string sourceId)
    {
        sourceId = string.Empty;
        if (!fileName.EndsWith(".pdf", StringComparison.Ordinal) || fileName.Length != 36) return false;
        var candidate = fileName[..^4];
        if (!IsValidSourceId(candidate)) return false;
        sourceId = candidate;
        return true;
    }

    private static bool IsDirectChild(string parent, string child, string expectedName) =>
        string.Equals(Path.GetRelativePath(parent, child), expectedName, PathComparison);

    private static bool PathsEqual(string left, string right) => string.Equals(Path.GetFullPath(left), Path.GetFullPath(right), PathComparison);

    private static StringComparison PathComparison => OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    private static bool HasReparsePoint(string path)
    {
        try
        {
            return (System.IO.File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0;
        }
        catch (FileNotFoundException) { return false; }
        catch (DirectoryNotFoundException) { return false; }
        catch (IOException) { return true; }
        catch (UnauthorizedAccessException) { return true; }
    }
}
