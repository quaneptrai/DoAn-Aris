using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Services;

/// <summary>
/// Stores finished interview clips. Clips go to the public media store (Google
/// Drive). With Drive disabled, Development keeps them under
/// App_Data/public-media/interviews so the flow can be tested locally; any other
/// environment refuses the upload instead of writing a silent local copy.
/// </summary>
public sealed class InterviewKitStore(
    ArisDBContext context,
    IPublicMediaStore media,
    IWebHostEnvironment environment,
    IConfiguration configuration,
    IPublicMediaDelivery delivery,
    ILogger<InterviewKitStore> logger)
{
    private const string LocalFilePrefix = "local:";

    public async Task<byte[]> ReadVideoAsync(InterviewKitVideo video, CancellationToken token)
    {
        Stream stream;
        if (video.StorageFileId.StartsWith(LocalFilePrefix))
        {
            var name = video.StorageFileId[LocalFilePrefix.Length..];
            if (!PublicMediaValidator.TryGetStoredMedia(name, out _) || !PublicMediaStorage.TryGetStorageDirectory(environment.ContentRootPath, PublicMediaStorage.Interviews, out var directory))
                throw new InterviewEngineException("Không đọc được video nguồn.");
            stream = File.OpenRead(Path.Combine(directory, name));
        }
        else stream = (await delivery.OpenReadAsync(PublicMediaStorage.Interviews, video.StorageFileId, token))?.Content ?? throw new InterviewEngineException("Không đọc được video nguồn.");
        using (stream)
        using (var buffer = new MemoryStream())
        {
            var bytes = new byte[8192]; int n;
            while ((n = await stream.ReadAsync(bytes, token)) > 0) { if (buffer.Length + n > PublicMediaValidator.MaximumVideoBytes) throw new InterviewEngineException("Video nguồn quá lớn."); buffer.Write(bytes, 0, n); }
            return buffer.ToArray();
        }
    }

    /// <summary>Validates a clip and stores it in its slot, replacing the previous clip there.</summary>
    /// <returns>The stored clip, or the validation error shown to the employer.</returns>
    public async Task<(InterviewKitVideo? Video, string? Error)> SaveVideoAsync(
        InterviewKit kit,
        int? questionId,
        string kind,
        IFormFile file,
        string source,
        CancellationToken cancellationToken)
    {
        var validation = await PublicMediaValidator.ValidateBrowserMediaAsync(file, cancellationToken);
        if (!validation.IsValid || validation.Media is not { Kind: PublicMediaKind.Video } validated)
            return (null, validation.Error ?? "Chỉ nhận video MP4, WEBM hoặc MOV.");

        string url, fileId;
        if (configuration.GetValue<bool>("GoogleDrive:Enabled"))
        {
            var upload = await media.UploadAsync(PublicMediaStorage.Interviews, file, validated, cancellationToken);
            (url, fileId) = (upload.Url, upload.FileId);
        }
        else if (environment.IsDevelopment()
            && PublicMediaStorage.TryGetStorageDirectory(environment.ContentRootPath, PublicMediaStorage.Interviews, out var directory))
        {
            var name = await PublicMediaValidator.SaveAsync(file, validated, directory, cancellationToken);
            (url, fileId) = ($"/media/{PublicMediaStorage.Interviews}/{name}", LocalFilePrefix + name);
        }
        else
        {
            throw new PublicMediaStorageException("Google Drive is not configured for interview videos.");
        }

        // One clip per slot (kit, question, kind): a re-render replaces the previous clip.
        var replaced = await context.InterviewKitVideos
            .Where(v => v.KitId == kit.Id && v.QuestionId == questionId && v.Kind == kind)
            .ToListAsync(cancellationToken);
        var video = new InterviewKitVideo
        {
            KitId = kit.Id,
            QuestionId = questionId,
            Kind = kind,
            Url = url,
            StorageFileId = fileId,
            ContentType = validated.ContentType,
            SizeBytes = file.Length,
            Source = source
        };
        context.InterviewKitVideos.RemoveRange(replaced);
        context.InterviewKitVideos.Add(video);
        kit.UpdatedAtUtc = DateTime.UtcNow;
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await DeleteFileAsync(fileId);
            throw;
        }

        foreach (var old in replaced) await DeleteFileAsync(old.StorageFileId);
        return (video, null);
    }

    /// <summary>Stores generated or packaged bytes; the container is read from the bytes, not from a file name.</summary>
    public Task<(InterviewKitVideo? Video, string? Error)> SaveVideoAsync(
        InterviewKit kit, int? questionId, string kind, byte[] bytes, string fileName, string source, CancellationToken cancellationToken)
    {
        var (contentType, extension) = Container(bytes);
        var name = Path.GetFileNameWithoutExtension(fileName) is { Length: > 0 } stem ? stem + extension : "clip" + extension;
        var stream = new MemoryStream(bytes, writable: false);
        var file = new FormFile(stream, 0, bytes.Length, "file", name) { Headers = new HeaderDictionary(), ContentType = contentType };
        return SaveVideoAsync(kit, questionId, kind, file, source, cancellationToken);
    }

    private static (string ContentType, string Extension) Container(byte[] bytes)
    {
        if (bytes.Length >= 12 && bytes[4] == 'f' && bytes[5] == 't' && bytes[6] == 'y' && bytes[7] == 'p')
            return bytes[8] == 'q' && bytes[9] == 't' ? ("video/quicktime", ".mov") : ("video/mp4", ".mp4");
        if (bytes.Length >= 4 && bytes[0] == 0x1A && bytes[1] == 0x45 && bytes[2] == 0xDF && bytes[3] == 0xA3)
            return ("video/webm", ".webm");
        // Unknown bytes: declared as MP4 so the validator's content check rejects them with its usual message.
        return ("video/mp4", ".mp4");
    }

    /// <summary>Removes clip rows and then their files. A file that cannot be deleted is only logged.</summary>
    public async Task DeleteVideosAsync(IReadOnlyCollection<InterviewKitVideo> videos, CancellationToken cancellationToken)
    {
        if (videos.Count == 0) return;
        context.InterviewKitVideos.RemoveRange(videos);
        await context.SaveChangesAsync(cancellationToken);
        foreach (var video in videos) await DeleteFileAsync(video.StorageFileId);
    }

    private async Task DeleteFileAsync(string fileId)
    {
        try
        {
            if (fileId.StartsWith(LocalFilePrefix, StringComparison.Ordinal))
            {
                var name = fileId[LocalFilePrefix.Length..];
                if (PublicMediaValidator.TryGetStoredMedia(name, out _)
                    && PublicMediaStorage.TryGetStorageDirectory(environment.ContentRootPath, PublicMediaStorage.Interviews, out var directory))
                    File.Delete(Path.Combine(directory, name));
            }
            else
            {
                await media.DeleteAsync(fileId);
            }
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Could not delete interview clip {FileId}; the row is already gone.", fileId);
        }
    }
}
