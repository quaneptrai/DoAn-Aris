using System;
using System.Buffers;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace ArisSkyve.Infrastructure.Services;

/// <summary>
/// The only accepted formats for media which is eventually publicly visible.
/// The browser supplied MIME type and file name are both untrusted, so callers
/// must use this validator before either forwarding a file to another service
/// or writing it to storage.
/// </summary>
public enum PublicMediaKind
{
    Image,
    Video
}

public sealed record ValidatedPublicMedia(
    PublicMediaKind Kind,
    string ContentType,
    string Extension,
    long MaximumBytes)
{
    public string MediaType => Kind == PublicMediaKind.Video ? "video" : "image";

    public string CreateStorageFileName() => $"{Guid.NewGuid():N}{Extension}";
}

public sealed record PublicMediaValidationResult(ValidatedPublicMedia? Media, string? Error)
{
    public bool IsValid => Media is not null;

    public static PublicMediaValidationResult Success(ValidatedPublicMedia media) => new(media, null);

    public static PublicMediaValidationResult Failure(string error) => new(null, error);
}

public static class PublicMediaValidator
{
    public const long MaximumImageBytes = 10L * 1024 * 1024;
    public const long MaximumVideoBytes = 50L * 1024 * 1024;

    // A 4 KiB probe is enough to check the magic bytes and EBML DocType without
    // loading a user controlled upload into memory.
    private const int HeaderProbeLength = 4096;

    private sealed record MediaDefinition(PublicMediaKind Kind, string ContentType, string Extension, long MaximumBytes);

    private static readonly MediaDefinition Jpeg = new(PublicMediaKind.Image, "image/jpeg", ".jpg", MaximumImageBytes);
    private static readonly MediaDefinition Png = new(PublicMediaKind.Image, "image/png", ".png", MaximumImageBytes);
    private static readonly MediaDefinition Gif = new(PublicMediaKind.Image, "image/gif", ".gif", MaximumImageBytes);
    private static readonly MediaDefinition Webp = new(PublicMediaKind.Image, "image/webp", ".webp", MaximumImageBytes);
    private static readonly MediaDefinition Mp4 = new(PublicMediaKind.Video, "video/mp4", ".mp4", MaximumVideoBytes);
    private static readonly MediaDefinition Webm = new(PublicMediaKind.Video, "video/webm", ".webm", MaximumVideoBytes);
    private static readonly MediaDefinition QuickTime = new(PublicMediaKind.Video, "video/quicktime", ".mov", MaximumVideoBytes);
    private static readonly MediaDefinition Matroska = new(PublicMediaKind.Video, "video/x-matroska", ".mkv", MaximumVideoBytes);

    private static readonly IReadOnlyDictionary<string, MediaDefinition> DefinitionsByContentType =
        new Dictionary<string, MediaDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            [Jpeg.ContentType] = Jpeg,
            [Png.ContentType] = Png,
            [Gif.ContentType] = Gif,
            [Webp.ContentType] = Webp,
            [Mp4.ContentType] = Mp4,
            [Webm.ContentType] = Webm,
            [QuickTime.ContentType] = QuickTime,
            [Matroska.ContentType] = Matroska
        };

    // Aliases are accepted only when they describe the same actual container.
    // The server always writes the canonical extension from MediaDefinition.
    private static readonly IReadOnlyDictionary<string, MediaDefinition> DefinitionsByExtension =
        new Dictionary<string, MediaDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            [".jpg"] = Jpeg,
            [".jpeg"] = Jpeg,
            [".png"] = Png,
            [".gif"] = Gif,
            [".webp"] = Webp,
            [".mp4"] = Mp4,
            [".m4v"] = Mp4,
            [".webm"] = Webm,
            [".mov"] = QuickTime,
            [".mkv"] = Matroska
        };

    /// <summary>
    /// Checks a public media upload using all three independently controlled
    /// signals: browser MIME type, filename extension, and file signature.
    /// </summary>
    public static async Task<PublicMediaValidationResult> ValidateAsync(
        IFormFile? file,
        CancellationToken cancellationToken = default)
    {
        return await ValidateInternalAsync(
            file,
            allowVideos: true,
            maximumImageBytes: MaximumImageBytes,
            maximumVideoBytes: MaximumVideoBytes,
            allowMatroska: true,
            cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Validates browser-facing social/chat media. It keeps the pre-existing
    /// image/MP4/WEBM/MOV set and deliberately excludes MKV, which is only
    /// supported by the post composer.
    /// </summary>
    public static async Task<PublicMediaValidationResult> ValidateBrowserMediaAsync(
        IFormFile? file,
        CancellationToken cancellationToken = default)
    {
        return await ValidateInternalAsync(
            file,
            allowVideos: true,
            maximumImageBytes: MaximumImageBytes,
            maximumVideoBytes: MaximumVideoBytes,
            allowMatroska: false,
            cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Validates image-only uploads such as avatars and cover photos. Callers
    /// can retain a smaller endpoint-specific size limit without duplicating
    /// MIME/signature/extension validation.
    /// </summary>
    public static async Task<PublicMediaValidationResult> ValidateImageAsync(
        IFormFile? file,
        long maximumImageBytes,
        CancellationToken cancellationToken = default)
    {
        return await ValidateInternalAsync(
            file,
            allowVideos: false,
            maximumImageBytes,
            maximumVideoBytes: 0,
            allowMatroska: false,
            cancellationToken: cancellationToken);
    }

    private static async Task<PublicMediaValidationResult> ValidateInternalAsync(
        IFormFile? file,
        bool allowVideos,
        long maximumImageBytes,
        long maximumVideoBytes,
        bool allowMatroska,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length <= 0)
        {
            return PublicMediaValidationResult.Failure("Vui lòng chọn một tệp ảnh hoặc video.");
        }

        var declaredContentType = NormalizeContentType(file.ContentType);
        if (!DefinitionsByContentType.TryGetValue(declaredContentType, out var declared))
        {
            return PublicMediaValidationResult.Failure("Chỉ hỗ trợ ảnh JPEG, PNG, WEBP, GIF hoặc video MP4, WEBM, MOV, MKV.");
        }

        if ((declared.Kind == PublicMediaKind.Video && !allowVideos) ||
            (ReferenceEquals(declared, Matroska) && !allowMatroska))
        {
            return PublicMediaValidationResult.Failure("Định dạng tệp không được hỗ trợ cho mục này.");
        }

        var maximumBytes = declared.Kind == PublicMediaKind.Image ? maximumImageBytes : maximumVideoBytes;
        if (maximumBytes <= 0)
        {
            return PublicMediaValidationResult.Failure("Định dạng tệp không được hỗ trợ cho mục này.");
        }

        var originalExtension = Path.GetExtension(Path.GetFileName(file.FileName));
        if (!DefinitionsByExtension.TryGetValue(originalExtension, out var extensionDefinition) ||
            !SameFormat(declared, extensionDefinition))
        {
            return PublicMediaValidationResult.Failure("Phần mở rộng tệp không khớp với định dạng ảnh hoặc video đã chọn.");
        }

        if (file.Length > maximumBytes)
        {
            var maximumMegabytes = maximumBytes / (1024 * 1024);
            var sizeLabel = declared.Kind == PublicMediaKind.Image
                ? $"Ảnh tối đa {maximumMegabytes} MB."
                : $"Video tối đa {maximumMegabytes} MB.";
            return PublicMediaValidationResult.Failure(sizeLabel);
        }

        var buffer = ArrayPool<byte>.Shared.Rent(HeaderProbeLength);
        try
        {
            int bytesRead;
            try
            {
                await using var stream = file.OpenReadStream();
                bytesRead = await ReadHeaderAsync(stream, buffer, cancellationToken);
            }
            catch (Exception ex) when (ex is IOException or InvalidDataException)
            {
                return PublicMediaValidationResult.Failure("Không thể đọc nội dung tệp tải lên.");
            }

            var actual = DetectFormat(buffer.AsSpan(0, bytesRead));
            if (actual is null)
            {
                return PublicMediaValidationResult.Failure("Nội dung tệp không phải là ảnh hoặc video được hỗ trợ.");
            }

            if (!SameFormat(declared, actual) || !SameFormat(extensionDefinition, actual) ||
                (ReferenceEquals(actual, Matroska) && !allowMatroska))
            {
                return PublicMediaValidationResult.Failure("Nội dung tệp không khớp với kiểu tệp được khai báo.");
            }

            return PublicMediaValidationResult.Success(new ValidatedPublicMedia(
                actual.Kind,
                actual.ContentType,
                actual.Extension,
                maximumBytes));
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    /// <summary>
    /// Writes a validated upload using a server-generated name. This remains for
    /// controlled legacy-media migration/serving only; new public uploads use
    /// <see cref="IPublicMediaStore"/> and do not write under the app root.
    /// </summary>
    public static async Task<string> SaveAsync(
        IFormFile file,
        ValidatedPublicMedia media,
        string storageDirectory,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(file);
        ArgumentNullException.ThrowIfNull(media);
        ArgumentException.ThrowIfNullOrWhiteSpace(storageDirectory);

        Directory.CreateDirectory(storageDirectory);
        var fileName = media.CreateStorageFileName();
        var filePath = Path.Combine(storageDirectory, fileName);
        var createdByThisCall = false;

        try
        {
            await using var source = file.OpenReadStream();
            await using var destination = new FileStream(
                filePath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                FileOptions.Asynchronous | FileOptions.SequentialScan);
            createdByThisCall = true;
            await CopyWithMaximumAsync(source, destination, media.MaximumBytes, cancellationToken);
            return fileName;
        }
        catch
        {
            // A failed copy must not leave a partial, publicly addressable file.
            // Do not delete a file that lost a FileMode.CreateNew race to another request.
            if (createdByThisCall && File.Exists(filePath))
            {
                File.Delete(filePath);
            }

            throw;
        }
    }

    /// <summary>
    /// Verifies that a generated storage filename maps to an allowed media type.
    /// Used by the public media endpoint so it never guesses a MIME type.
    /// </summary>
    public static bool TryGetStoredMedia(string? fileName, out ValidatedPublicMedia? media)
    {
        media = null;
        if (string.IsNullOrWhiteSpace(fileName) ||
            !string.Equals(fileName, Path.GetFileName(fileName), StringComparison.Ordinal))
        {
            return false;
        }

        var extension = Path.GetExtension(fileName);
        var nameWithoutExtension = Path.GetFileNameWithoutExtension(fileName);
        if (!Guid.TryParseExact(nameWithoutExtension, "N", out _) ||
            !DefinitionsByExtension.TryGetValue(extension, out var definition))
        {
            return false;
        }

        media = new ValidatedPublicMedia(
            definition.Kind,
            definition.ContentType,
            definition.Extension,
            definition.MaximumBytes);
        return true;
    }

    /// <summary>
    /// Safe for legacy static-file gates: returns true only for an image/video
    /// extension this validator recognizes. It intentionally does not approve
    /// executable/document formats.
    /// </summary>
    public static bool IsAllowedMediaExtension(string? extension)
    {
        if (string.IsNullOrWhiteSpace(extension)) return false;
        var normalized = extension.StartsWith(".", StringComparison.Ordinal)
            ? extension
            : Path.GetExtension(extension);
        return DefinitionsByExtension.ContainsKey(normalized);
    }

    /// <summary>
    /// AiCore URLs are displayed back in browser media elements. Do not persist a
    /// scheme such as javascript: or data: supplied by a compromised response.
    /// </summary>
    public static bool IsSafeRemoteMediaUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Any(char.IsControl))
        {
            return false;
        }

        if (Uri.TryCreate(value, UriKind.Absolute, out var absolute))
        {
            return absolute.Scheme.Equals(Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) ||
                   absolute.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);
        }

        return value.StartsWith("/", StringComparison.Ordinal) &&
               !value.StartsWith("//", StringComparison.Ordinal) &&
               !value.Contains('\\');
    }

    private static string NormalizeContentType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var separator = value.IndexOf(';');
        return (separator >= 0 ? value[..separator] : value).Trim();
    }

    private static bool SameFormat(MediaDefinition left, MediaDefinition right) =>
        string.Equals(left.ContentType, right.ContentType, StringComparison.OrdinalIgnoreCase);

    private static async Task<int> ReadHeaderAsync(Stream stream, byte[] buffer, CancellationToken cancellationToken)
    {
        var total = 0;
        while (total < HeaderProbeLength)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(total, HeaderProbeLength - total), cancellationToken);
            if (read == 0) break;
            total += read;
        }

        return total;
    }

    private static async Task CopyWithMaximumAsync(
        Stream source,
        Stream destination,
        long maximumBytes,
        CancellationToken cancellationToken)
    {
        var buffer = ArrayPool<byte>.Shared.Rent(81920);
        try
        {
            long total = 0;
            while (true)
            {
                var read = await source.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken);
                if (read == 0) return;

                if (total > maximumBytes - read)
                {
                    throw new InvalidDataException("The uploaded media exceeded its maximum allowed size.");
                }

                await destination.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
                total += read;
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    private static MediaDefinition? DetectFormat(ReadOnlySpan<byte> header)
    {
        if (IsJpeg(header)) return Jpeg;
        if (IsPng(header)) return Png;
        if (IsGif(header)) return Gif;
        if (IsWebp(header)) return Webp;
        if (TryDetectIsoBaseMedia(header, out var isoMedia)) return isoMedia;
        if (TryDetectEbml(header, out var ebmlMedia)) return ebmlMedia;
        return null;
    }

    private static bool IsJpeg(ReadOnlySpan<byte> header) =>
        header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;

    private static bool IsPng(ReadOnlySpan<byte> header) =>
        header.Length >= 8 &&
        header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47 &&
        header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A;

    private static bool IsGif(ReadOnlySpan<byte> header) =>
        HasAscii(header, 0, "GIF87a") || HasAscii(header, 0, "GIF89a");

    private static bool IsWebp(ReadOnlySpan<byte> header) =>
        HasAscii(header, 0, "RIFF") && HasAscii(header, 8, "WEBP");

    private static bool TryDetectIsoBaseMedia(ReadOnlySpan<byte> header, out MediaDefinition? media)
    {
        media = null;
        if (header.Length < 12) return false;

        if (HasAscii(header, 4, "ftyp"))
        {
            if (HasAscii(header, 8, "qt  "))
            {
                media = QuickTime;
                return true;
            }

            if (ContainsKnownMp4Brand(header))
            {
                media = Mp4;
                return true;
            }
        }

        // Older MOV files may begin with a moov atom instead of ftyp. Requiring
        // an atom name still rejects ordinary text/HTML uploads.
        if (HasAscii(header, 4, "moov") || HasAscii(header, 4, "wide"))
        {
            media = QuickTime;
            return true;
        }

        return false;
    }

    private static bool ContainsKnownMp4Brand(ReadOnlySpan<byte> header)
    {
        // Major brand at byte 8 and compatible brands after byte 16. Inspect the
        // initial ftyp box only; this is a format sanity check, not a transcoder.
        var limit = Math.Min(header.Length - 3, 80);
        for (var offset = 8; offset < limit; offset += 4)
        {
            if (HasAscii(header, offset, "isom") ||
                HasAscii(header, offset, "iso2") ||
                HasAscii(header, offset, "iso3") ||
                HasAscii(header, offset, "iso4") ||
                HasAscii(header, offset, "iso5") ||
                HasAscii(header, offset, "iso6") ||
                HasAscii(header, offset, "mp41") ||
                HasAscii(header, offset, "mp42") ||
                HasAscii(header, offset, "avc1") ||
                HasAscii(header, offset, "dash") ||
                HasAscii(header, offset, "M4V ") ||
                HasAscii(header, offset, "f4v ") ||
                HasAscii(header, offset, "3gp4") ||
                HasAscii(header, offset, "3gp5") ||
                HasAscii(header, offset, "MSNV"))
            {
                return true;
            }
        }

        return false;
    }

    private static bool TryDetectEbml(ReadOnlySpan<byte> header, out MediaDefinition? media)
    {
        media = null;
        if (header.Length < 8 || header[0] != 0x1A || header[1] != 0x45 || header[2] != 0xDF || header[3] != 0xA3)
        {
            return false;
        }

        // The EBML DocType element is 0x42, 0x82. Its value must explicitly be
        // webm or matroska; the generic EBML signature alone is not enough.
        for (var offset = 4; offset < Math.Min(header.Length - 3, 1024); offset++)
        {
            if (header[offset] != 0x42 || header[offset + 1] != 0x82) continue;
            if (!TryReadEbmlSize(header, offset + 2, out var valueOffset, out var valueLength)) continue;
            if (valueLength <= 0 || valueOffset + valueLength > header.Length) continue;

            var value = header.Slice(valueOffset, valueLength);
            if (AsciiEquals(value, "webm"))
            {
                media = Webm;
                return true;
            }

            if (AsciiEquals(value, "matroska"))
            {
                media = Matroska;
                return true;
            }
        }

        return false;
    }

    private static bool TryReadEbmlSize(ReadOnlySpan<byte> data, int offset, out int valueOffset, out int valueLength)
    {
        valueOffset = 0;
        valueLength = 0;
        if (offset >= data.Length || data[offset] == 0) return false;

        var first = data[offset];
        var width = 1;
        var marker = 0x80;
        while ((first & marker) == 0)
        {
            width++;
            marker >>= 1;
            if (width > 8 || marker == 0) return false;
        }

        if (offset + width > data.Length) return false;

        var length = first & (marker - 1);
        for (var index = 1; index < width; index++)
        {
            length = (length << 8) | data[offset + index];
        }

        valueOffset = offset + width;
        valueLength = length;
        return true;
    }

    private static bool HasAscii(ReadOnlySpan<byte> data, int offset, string value)
    {
        if (offset < 0 || offset + value.Length > data.Length) return false;
        for (var index = 0; index < value.Length; index++)
        {
            if (data[offset + index] != (byte)value[index]) return false;
        }

        return true;
    }

    private static bool AsciiEquals(ReadOnlySpan<byte> data, string value) =>
        data.Length == value.Length && HasAscii(data, 0, value);
}

/// <summary>
/// Resolves the old local public-media layout for read-only compatibility and
/// migration. New uploads are stored by <see cref="IPublicMediaStore"/> in
/// Google Drive rather than under the application root.
/// </summary>
public static class PublicMediaStorage
{
    public const string Posts = "posts";
    public const string Stories = "stories";
    public const string Avatars = "avatars";
    public const string Covers = "covers";
    public const string Chat = "chat";

    public static bool IsSupportedCollection(string? collection) =>
        string.Equals(collection, Posts, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(collection, Stories, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(collection, Avatars, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(collection, Covers, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(collection, Chat, StringComparison.OrdinalIgnoreCase);

    public static bool TryGetStorageDirectory(string? contentRootPath, string? collection, out string storageDirectory)
    {
        storageDirectory = string.Empty;
        if (string.IsNullOrWhiteSpace(contentRootPath)) return false;

        string? safeCollection = null;
        if (string.Equals(collection, Posts, StringComparison.OrdinalIgnoreCase)) safeCollection = Posts;
        if (string.Equals(collection, Stories, StringComparison.OrdinalIgnoreCase)) safeCollection = Stories;
        if (string.Equals(collection, Avatars, StringComparison.OrdinalIgnoreCase)) safeCollection = Avatars;
        if (string.Equals(collection, Covers, StringComparison.OrdinalIgnoreCase)) safeCollection = Covers;
        if (string.Equals(collection, Chat, StringComparison.OrdinalIgnoreCase)) safeCollection = Chat;
        if (safeCollection is null) return false;

        storageDirectory = Path.Combine(contentRootPath, "App_Data", "public-media", safeCollection);
        return true;
    }
}
