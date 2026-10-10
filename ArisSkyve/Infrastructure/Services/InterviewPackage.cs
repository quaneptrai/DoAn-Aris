using System.IO.Compression;
using System.Text.Json;
using ArisSkyve.Domain.Entities;

namespace ArisSkyve.Infrastructure.Services;

/// <summary>
/// Reads an interview package (.zip) that an employer exports from a local video
/// studio and uploads here. It is the only way studio output reaches Aris: the two
/// never call each other. Layout: <c>manifest.json</c> plus the clip files it lists.
/// <code>
/// { "format": "aris-interview-package", "version": 1, "title": "…", "persona": "…", "scene": "…",
///   "questions": [ { "id": "q1", "question": "…", "answer": "…", "keyPoints": ["…"],
///                    "prepSeconds": 10, "answerSeconds": 60, "retakes": 1 } ],
///   "clips": [ { "kind": "intro|question|listening|thinking|transition|pass|fail|outro",
///                "questionId": "q1" (kind=question only), "file": "clips/intro.mp4" } ] }
/// </code>
/// </summary>
public static class InterviewPackage
{
    public const string Format = "aris-interview-package";
    public const long MaxClipBytes = 50L * 1024 * 1024;
    public const long MaxTotalBytes = 400L * 1024 * 1024;

    public sealed record Question(string Id, string Text, string? Answer, IReadOnlyList<string> KeyPoints, int PrepSeconds, int AnswerSeconds, int Retakes);

    public sealed record Clip(string Kind, string? QuestionId, string FileName, byte[] Bytes);

    public sealed record Contents(string Title, string? Persona, string? Scene, IReadOnlyList<Question> Questions, IReadOnlyList<Clip> Clips);

    public sealed class InvalidPackageException(string message) : Exception(message);

    public static async Task<Contents> ReadAsync(Stream zip, CancellationToken cancellationToken)
    {
        try
        {
            return await ReadArchiveAsync(zip, cancellationToken);
        }
        catch (Exception exception) when (exception is InvalidDataException or IOException or ArgumentOutOfRangeException or NotSupportedException)
        {
            // Truncated, encrypted or otherwise corrupt archives.
            throw new InvalidPackageException("File không phải gói .zip hợp lệ.");
        }
    }

    private static async Task<Contents> ReadArchiveAsync(Stream zip, CancellationToken cancellationToken)
    {
        using var archive = new ZipArchive(zip, ZipArchiveMode.Read, leaveOpen: true);
        var manifestEntry = archive.GetEntry("manifest.json") ?? throw new InvalidPackageException("Gói thiếu manifest.json.");
        if (manifestEntry.Length > 1024 * 1024) throw new InvalidPackageException("manifest.json quá lớn.");
        JsonDocument manifest;
        try
        {
            await using var stream = manifestEntry.Open();
            manifest = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        }
        catch (JsonException) { throw new InvalidPackageException("manifest.json không phải JSON hợp lệ."); }

        using (manifest)
        {
            var root = manifest.RootElement;
            if (Text(root, "format") != Format) throw new InvalidPackageException("Gói không đúng định dạng gói phỏng vấn.");
            if (!root.TryGetProperty("version", out var version) || !version.TryInt(out var number) || number != 1)
                throw new InvalidPackageException("Phiên bản gói chưa được hỗ trợ.");

            var questions = new List<Question>();
            if (root.TryGetProperty("questions", out var items) && items.ValueKind == JsonValueKind.Array)
                foreach (var item in items.EnumerateArray())
                {
                    var id = Text(item, "id");
                    var text = Text(item, "question");
                    if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(text)) throw new InvalidPackageException("Có câu hỏi thiếu id hoặc nội dung.");
                    if (questions.Any(q => q.Id == id)) throw new InvalidPackageException($"Mã câu hỏi bị trùng: {id}.");
                    var points = item.TryGetProperty("keyPoints", out var list) && list.ValueKind == JsonValueKind.Array
                        ? list.EnumerateArray().Where(p => p.ValueKind == JsonValueKind.String).Select(p => p.GetString()!.Trim()).Where(p => p.Length > 0).ToList()
                        : new List<string>();
                    questions.Add(new Question(id, text.Trim(), Text(item, "answer")?.Trim(), points,
                        Int(item, "prepSeconds", 10), Int(item, "answerSeconds", 90), Int(item, "retakes", 1)));
                }
            if (questions.Count == 0) throw new InvalidPackageException("Gói chưa có câu hỏi.");
            if (questions.Count > 200) throw new InvalidPackageException("Gói có hơn 200 câu hỏi.");

            var clips = new List<Clip>();
            long total = 0;
            if (root.TryGetProperty("clips", out var clipItems) && clipItems.ValueKind == JsonValueKind.Array)
                foreach (var item in clipItems.EnumerateArray())
                {
                    var kind = Text(item, "kind")?.Trim().ToLowerInvariant() ?? "";
                    if (!InterviewKitVideo.Kinds.Contains(kind)) throw new InvalidPackageException($"Loại video không hợp lệ: {kind}.");
                    var questionId = kind == InterviewKitVideo.KindQuestion ? Text(item, "questionId") : null;
                    if (kind == InterviewKitVideo.KindQuestion && !questions.Any(q => q.Id == questionId))
                        throw new InvalidPackageException($"Video câu hỏi trỏ tới câu không có trong gói: {questionId}.");
                    if (clips.Any(c => c.Kind == kind && c.QuestionId == questionId)) continue;
                    var path = Text(item, "file") ?? "";
                    var entry = archive.GetEntry(path) ?? throw new InvalidPackageException($"Gói thiếu file {path}.");
                    if (entry.Length > MaxClipBytes) throw new InvalidPackageException($"{path} lớn hơn 50 MB.");
                    total += entry.Length;
                    if (total > MaxTotalBytes) throw new InvalidPackageException("Tổng dung lượng video trong gói quá lớn.");
                    await using var stream = entry.Open();
                    using var buffer = new MemoryStream();
                    // Read at most the declared size + 1 byte, so a lying header cannot inflate memory.
                    var chunk = new byte[81920];
                    int read;
                    while ((read = await stream.ReadAsync(chunk, cancellationToken)) > 0)
                    {
                        if (buffer.Length + read > MaxClipBytes) throw new InvalidPackageException($"{path} lớn hơn 50 MB.");
                        buffer.Write(chunk, 0, read);
                    }
                    clips.Add(new Clip(kind, questionId, Path.GetFileName(path), buffer.ToArray()));
                }

            var title = Text(root, "title")?.Trim();
            return new Contents(string.IsNullOrWhiteSpace(title) ? "Bộ phỏng vấn nhập từ gói" : title,
                Text(root, "persona")?.Trim(), Text(root, "scene")?.Trim(), questions, clips);
        }
    }

    private static string? Text(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static int Int(JsonElement element, string name, int fallback) =>
        element.TryGetProperty(name, out var value) && value.TryInt(out var number) ? number : fallback;
}
