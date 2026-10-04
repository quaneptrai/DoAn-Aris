using System.Text.Json;
using Json.Schema;

namespace ArisSkyve.Infrastructure.Services;

public static class CanonicalResumeContract
{
    private static readonly Lazy<JsonSchema> Schema = new(() =>
    {
        using var stream = typeof(CanonicalResumeContract).Assembly.GetManifestResourceStream("ArisSkyve.CanonicalResumeSchema")
            ?? throw new InvalidOperationException("Canonical resume contract is missing from the build.");
        using var reader = new StreamReader(stream);
        return JsonSchema.FromText(reader.ReadToEnd());
    });

    public static bool IsValid(JsonElement data) => data.ValueKind == JsonValueKind.Object &&
        Schema.Value.Evaluate(data, new EvaluationOptions { OutputFormat = OutputFormat.Flag, RequireFormatValidation = true }).IsValid;

    // CV đã công khai thành trang /portfolio/{id} (cờ "published" của tài liệu Resume Studio).
    public static bool IsPublished(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || !value.Contains("\"published\"", StringComparison.OrdinalIgnoreCase)) return false;
        try
        {
            using var document = JsonDocument.Parse(value);
            return document.RootElement.ValueKind == JsonValueKind.Object &&
                   document.RootElement.TryGetProperty("published", out var p) && p.ValueKind == JsonValueKind.True;
        }
        catch (JsonException) { return false; }
    }

    public static bool IsStoredDocument(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        try
        {
            using var document = JsonDocument.Parse(value);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return false;
            if (root.TryGetProperty("engine", out var engine) && engine.ValueKind == JsonValueKind.String &&
                engine.GetString() == "aris-resume/v1" && root.TryGetProperty("data", out var data)) return IsValid(data);
            return root.TryGetProperty("meta", out _) && IsValid(root);
        }
        catch (JsonException) { return false; }
    }
}
