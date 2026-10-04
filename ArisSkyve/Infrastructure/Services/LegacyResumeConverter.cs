using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using ArisSkyve.Domain.Entities;

namespace ArisSkyve.Infrastructure.Services;

// Chuyển một CV chưa từng mở trong Resume Studio — CV tải lên (AiCore trích Skills/Experiences/
// Education + toàn văn) hoặc CV của trình dựng cũ (/cv-builder, BuilderDataJson dạng sections) —
// sang CanonicalResumeSchema để Studio mở được. `structure` là kết quả AiCore /api/v2/cv/structure
// (đọc lại toàn văn CV bằng LLM): có thì dùng làm nguồn chính vì đủ mô tả công việc, dự án.
// Chỉ dùng dữ liệu có thật của CV; trường bắt buộc mà CV không có để chuỗi rỗng.
public static class LegacyResumeConverter
{
    private static readonly Regex EmailPattern = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$");

    public static JsonObject ToCanonical(Resume resume, EmployesAccount? profile, string? accountEmail,
        JsonElement? structure = null, JsonElement? links = null, string? siteOrigin = null)
    {
        var old = ReadOldBuilder(resume.BuilderDataJson);
        var personal = old?["personal"] as JsonObject;
        var s = structure is { ValueKind: JsonValueKind.Object } st ? st : (JsonElement?)null;

        var name = First(Str(personal, "name"), resume.Name, profile?.FullName, "Ứng viên");
        var email = new[] { Str(personal, "email"), resume.Email, accountEmail }
            .FirstOrDefault(e => !string.IsNullOrWhiteSpace(e) && EmailPattern.IsMatch(e!.Trim()))?.Trim()
            ?? "ban@example.com";
        var headline = First(S(s, "headline"), Str(personal, "title"), profile?.JobTitle, "");
        // Trình dựng cũ từng điền nguyên toàn văn CV vào "tóm tắt" — không đưa khối đó vào Studio.
        var oldSummary = OldText(old, "summary");
        var full = (resume.ExtractedFullText ?? "").Trim();
        if (oldSummary.Length > 1200 || (full.Length > 0 && oldSummary.Length > 80 && full.StartsWith(oldSummary[..80], StringComparison.Ordinal)))
            oldSummary = "";
        var summary = First(S(s, "summary"), oldSummary, "");

        var basics = new JsonObject
        {
            ["name"] = name,
            ["headline"] = headline,
            ["email"] = email,
            ["phone"] = First(Str(personal, "phone"), ""),
            ["location"] = new JsonObject
            {
                ["city"] = First(Str(personal, "location"), profile?.Location, ""),
                ["country"] = "Việt Nam",
                ["remoteStatus"] = "onsite"
            },
            ["summary"] = summary,
            ["links"] = BuildLinks(personal, links)
        };
        var avatar = AbsoluteUrl(First(Str(personal, "photo"), profile?.AvatarUrl, ""), siteOrigin);
        if (avatar != null) basics["avatarUrl"] = avatar;

        var data = new JsonObject
        {
            ["meta"] = new JsonObject
            {
                ["slug"] = Slug(name),
                ["version"] = "1.0.0",
                ["theme"] = new JsonObject
                {
                    ["primaryColor"] = "#123c32", ["accentColor"] = "#b5efce",
                    ["fontHeading"] = "auto", ["fontBody"] = "auto", ["radius"] = "md"
                },
                ["atsOptimized"] = true
            },
            ["basics"] = basics,
            ["work"] = BuildWork(s, old, resume),
            ["projects"] = BuildProjects(s, old),
            ["skills"] = BuildSkills(s, old, resume),
            ["education"] = BuildEducation(s, old, resume)
        };
        var custom = BuildCustom(s, old);
        if (custom.Count > 0) data["customSections"] = custom;
        return data;
    }

    // Văn bản phẳng của một CanonicalResume — để AiCore chấm/embedding và trợ lý CV đọc kỹ năng.
    public static string ToPlainText(JsonElement data)
    {
        if (data.TryGetProperty("importedLayout", out var layout))
            return string.Join("\n", layout.GetProperty("pages").EnumerateArray()
                .SelectMany(page => page.GetProperty("elements").EnumerateArray())
                .Select(element => element.GetProperty("text").GetString()));
        var sb = new StringBuilder();
        void Line(string? value) { if (!string.IsNullOrWhiteSpace(value)) sb.AppendLine(value.Trim()); }
        if (data.TryGetProperty("basics", out var b))
        {
            Line(Get(b, "name")); Line(Get(b, "headline")); Line(Get(b, "summary"));
        }
        foreach (var w in Arr(data, "work"))
        {
            Line($"{Get(w, "role")} — {Get(w, "company")} ({Get(w, "startDate")} – {(w.TryGetProperty("isCurrent", out var c) && c.ValueKind == JsonValueKind.True ? "nay" : Get(w, "endDate"))})");
            foreach (var h in Arr(w, "highlights")) Line("- " + h.GetString());
            var stack = string.Join(", ", Arr(w, "techStack").Select(x => x.GetString()));
            if (stack.Length > 0) Line("Công nghệ: " + stack);
        }
        foreach (var p in Arr(data, "projects"))
        {
            Line($"Dự án: {Get(p, "title")} — {Get(p, "tagline")}"); Line(Get(p, "description"));
            var stack = string.Join(", ", Arr(p, "stack").Select(x => x.GetString()));
            if (stack.Length > 0) Line("Công nghệ: " + stack);
        }
        foreach (var g in Arr(data, "skills"))
            Line($"{Get(g, "category")}: {string.Join(", ", Arr(g, "items").Select(i => Get(i, "name")))}");
        foreach (var e in Arr(data, "education"))
            Line($"{Get(e, "degree")} {Get(e, "field")} — {Get(e, "institution")} ({Get(e, "startDate")} – {Get(e, "endDate")})");
        foreach (var c in Arr(data, "customSections"))
        {
            Line(Get(c, "heading"));
            if (c.TryGetProperty("content", out var content))
                Line(content.ValueKind == JsonValueKind.String ? content.GetString() : content.ToString());
        }
        return sb.ToString().Trim();
    }

    // ---------------------------------------------------------------- sections
    private static JsonArray BuildWork(JsonElement? s, JsonObject? old, Resume resume)
    {
        var list = new JsonArray();
        var i = 0;
        foreach (var w in Arr(s, "work"))
        {
            var current = w.TryGetProperty("current", out var c) && c.ValueKind == JsonValueKind.True;
            list.Add(new JsonObject
            {
                ["id"] = $"w{++i}", ["company"] = Get(w, "company"), ["role"] = Get(w, "role"),
                ["startDate"] = Get(w, "start"), ["endDate"] = current || string.IsNullOrEmpty(Get(w, "end")) ? null : Get(w, "end"),
                ["isCurrent"] = current,
                ["highlights"] = Strings(Arr(w, "highlights")), ["techStack"] = Strings(Arr(w, "tech"))
            });
        }
        if (list.Count > 0) return list;
        foreach (var e in OldEntries(old, "experience"))
        {
            var end = Entry(e, "end");
            list.Add(new JsonObject
            {
                ["id"] = $"w{++i}", ["company"] = Entry(e, "company"), ["role"] = Entry(e, "role"),
                ["startDate"] = MonthOf(Entry(e, "start")), ["endDate"] = string.IsNullOrEmpty(end) ? null : MonthOf(end),
                ["isCurrent"] = string.IsNullOrEmpty(end) && !string.IsNullOrEmpty(Entry(e, "start")),
                ["highlights"] = SplitLines(Entry(e, "description")), ["techStack"] = new JsonArray()
            });
        }
        if (list.Count > 0) return list;
        foreach (var x in resume.Experiences ?? new List<Experiences>())
        {
            if (string.IsNullOrWhiteSpace(x.Role) && string.IsNullOrWhiteSpace(x.Company)) continue;
            list.Add(new JsonObject
            {
                ["id"] = $"w{++i}", ["company"] = x.Company ?? "", ["role"] = x.Role ?? "",
                ["startDate"] = "", ["endDate"] = null, ["isCurrent"] = false,
                ["highlights"] = string.IsNullOrWhiteSpace(x.Duration) ? new JsonArray() : new JsonArray($"Thời gian: {x.Duration.Trim()}"),
                ["techStack"] = new JsonArray()
            });
        }
        return list;
    }

    private static JsonArray BuildProjects(JsonElement? s, JsonObject? old)
    {
        var list = new JsonArray();
        var i = 0;
        IEnumerable<(string title, string desc, string url, JsonArray stack)> items =
            Arr(s, "projects").Select(p => (Get(p, "title"), Get(p, "description"), Get(p, "url"), Strings(Arr(p, "stack"))));
        if (!items.Any())
            items = OldEntries(old, "projects").Select(e => (Entry(e, "name"), Entry(e, "description"), Entry(e, "link"), new JsonArray()));
        foreach (var (title, desc, url, stack) in items)
        {
            if (string.IsNullOrWhiteSpace(title) && string.IsNullOrWhiteSpace(desc)) continue;
            var item = new JsonObject
            {
                ["id"] = $"p{++i}", ["title"] = string.IsNullOrWhiteSpace(title) ? "Dự án" : title,
                ["tagline"] = "", ["description"] = desc, ["featured"] = i == 1, ["stack"] = stack
            };
            var link = AbsoluteUrl(url, null);
            if (link != null)
            {
                if (link.Contains("github.com", StringComparison.OrdinalIgnoreCase)) item["repoUrl"] = link;
                else item["liveUrl"] = link;
            }
            list.Add(item);
        }
        return list;
    }

    private static JsonArray BuildSkills(JsonElement? s, JsonObject? old, Resume resume)
    {
        var groups = new List<(string category, List<string> items)>();
        foreach (var g in Arr(s, "skills"))
            groups.Add((Get(g, "category"), Arr(g, "items").Select(x => x.GetString() ?? "").ToList()));
        if (groups.Count == 0)
        {
            var tags = OldItems(old, "skills");
            if (tags.Count == 0) tags = (resume.Skills ?? new List<Skills>()).Select(x => x.SkillName).ToList();
            if (tags.Count > 0) groups.Add(("Kỹ năng", tags));
        }
        var list = new JsonArray();
        foreach (var (category, items) in groups)
        {
            var clean = items.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase).Take(30).ToList();
            if (clean.Count == 0) continue;
            list.Add(new JsonObject
            {
                ["category"] = string.IsNullOrWhiteSpace(category) ? "Kỹ năng" : category,
                ["items"] = new JsonArray(clean.Select(n => (JsonNode)new JsonObject { ["name"] = n }).ToArray())
            });
        }
        return list;
    }

    private static JsonArray BuildEducation(JsonElement? s, JsonObject? old, Resume resume)
    {
        var list = new JsonArray();
        foreach (var e in Arr(s, "education"))
        {
            var item = new JsonObject
            {
                ["institution"] = Get(e, "institution"), ["degree"] = Get(e, "degree"), ["field"] = Get(e, "field"),
                ["startDate"] = Get(e, "start"), ["endDate"] = Get(e, "end")
            };
            if (!string.IsNullOrWhiteSpace(Get(e, "gpa"))) item["gpa"] = Get(e, "gpa");
            list.Add(item);
        }
        if (list.Count > 0) return list;
        foreach (var e in OldEntries(old, "education"))
            list.Add(new JsonObject
            {
                ["institution"] = Entry(e, "school"), ["degree"] = Entry(e, "degree"), ["field"] = "",
                ["startDate"] = MonthOf(Entry(e, "start")), ["endDate"] = MonthOf(Entry(e, "end"))
            });
        if (list.Count > 0) return list;
        foreach (var e in resume.Educations ?? new List<Education>())
        {
            if (string.IsNullOrWhiteSpace(e.School)) continue;
            var item = new JsonObject
            {
                ["institution"] = e.School, ["degree"] = e.Degree ?? "", ["field"] = e.FieldOfStudy ?? "",
                ["startDate"] = e.StartYear > 0 ? e.StartYear.ToString(CultureInfo.InvariantCulture) : "", ["endDate"] = ""
            };
            if (e.GPA > 0) item["gpa"] = e.GPA.ToString("0.##", CultureInfo.InvariantCulture);
            list.Add(item);
        }
        return list;
    }

    private static JsonArray BuildCustom(JsonElement? s, JsonObject? old)
    {
        var list = new JsonArray();
        void Badge(string id, string heading, IEnumerable<string> items)
        {
            var clean = items.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct().ToList();
            if (clean.Count == 0) return;
            list.Add(new JsonObject
            {
                ["id"] = id, ["heading"] = heading, ["type"] = "badge-grid",
                ["content"] = new JsonArray(clean.Select(x => (JsonNode)JsonValue.Create(x)!).ToArray())
            });
        }
        if (s.HasValue)
        {
            Badge("certificates", "Chứng chỉ", Arr(s, "certificates").Select(x => x.GetString() ?? ""));
            Badge("languages", "Ngoại ngữ", Arr(s, "languages").Select(x => x.GetString() ?? ""));
            Badge("awards", "Giải thưởng & hoạt động", Arr(s, "awards").Select(x => x.GetString() ?? ""));
            return list;
        }
        string Join(Dictionary<string, string> e, params string[] keys) =>
            string.Join(" — ", keys.Select(k => e.GetValueOrDefault(k, "")).Where(v => !string.IsNullOrWhiteSpace(v)));
        Badge("languages", "Ngoại ngữ", OldEntries(old, "languages").Select(e => Join(e, "name", "level")));
        Badge("certificates", "Chứng chỉ", OldEntries(old, "certificates").Select(e => Join(e, "name", "issuer", "date")));
        Badge("awards", "Giải thưởng", OldEntries(old, "awards").Select(e => Join(e, "name", "issuer", "date")));
        Badge("courses", "Khoá học", OldEntries(old, "courses").Select(e => Join(e, "name", "provider", "date")));
        Badge("organisations", "Hoạt động", OldEntries(old, "organisations").Select(e => Join(e, "name", "role")));
        Badge("interests", "Sở thích", OldItems(old, "interests"));
        return list;
    }

    private static JsonArray BuildLinks(JsonObject? personal, JsonElement? links)
    {
        var list = new JsonArray();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        void Add(string platform, string label, string? url)
        {
            var abs = AbsoluteUrl(url, null);
            if (abs == null || !seen.Add(abs.TrimEnd('/'))) return;
            list.Add(new JsonObject { ["platform"] = platform, ["label"] = label, ["url"] = abs });
        }
        if (links is { ValueKind: JsonValueKind.Array } arr)
            foreach (var l in arr.EnumerateArray())
            {
                var platform = Get(l, "platform") is "github" or "linkedin" ? Get(l, "platform") : "custom";
                Add(platform, platform == "github" ? "GitHub" : platform == "linkedin" ? "LinkedIn" : "Liên kết", Get(l, "url"));
            }
        Add("portfolio", "Website", Str(personal, "website"));
        return list;
    }

    // ---------------------------------------------------------------- old builder document
    private static JsonObject? ReadOldBuilder(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var node = JsonNode.Parse(json) as JsonObject;
            if (node == null || node.ContainsKey("engine") || node.ContainsKey("meta")) return null;
            // Trình dựng cũ lưu camelCase; một số bản lưu PascalCase.
            return Lower(node);
        }
        catch (JsonException) { return null; }
    }

    private static JsonObject Lower(JsonObject o)
    {
        var copy = new JsonObject();
        foreach (var (k, v) in o)
        {
            var key = k.Length > 0 ? char.ToLowerInvariant(k[0]) + k[1..] : k;
            copy[key] = v switch
            {
                JsonObject child => Lower(child),
                JsonArray a => new JsonArray(a.Select(x => x is JsonObject jo ? (JsonNode)Lower(jo) : x?.DeepClone()).ToArray()),
                _ => v?.DeepClone()
            };
        }
        return copy;
    }

    private static IEnumerable<JsonObject> Sections(JsonObject? old, string catalog) =>
        (old?["sections"] as JsonArray ?? new JsonArray()).OfType<JsonObject>()
            .Where(x => string.Equals(x["catalogId"]?.GetValue<string>(), catalog, StringComparison.OrdinalIgnoreCase));

    private static string OldText(JsonObject? old, string catalog) =>
        Sections(old, catalog).Select(x => x["content"]?.GetValue<string>()).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? "";

    private static List<string> OldItems(JsonObject? old, string catalog) =>
        Sections(old, catalog).SelectMany(x => (x["items"] as JsonArray ?? new JsonArray()).Select(i => i?.ToString() ?? "")).ToList();

    private static IEnumerable<Dictionary<string, string>> OldEntries(JsonObject? old, string catalog) =>
        Sections(old, catalog).SelectMany(x => (x["entries"] as JsonArray ?? new JsonArray()).OfType<JsonObject>())
            .Select(e => e.ToDictionary(p => p.Key, p => p.Value?.ToString() ?? ""));

    private static string Entry(Dictionary<string, string> e, string key) => e.GetValueOrDefault(key, "").Trim();

    // ---------------------------------------------------------------- helpers
    private static IEnumerable<JsonElement> Arr(JsonElement? e, string name) =>
        e is { ValueKind: JsonValueKind.Object } o && o.TryGetProperty(name, out var a) && a.ValueKind == JsonValueKind.Array
            ? a.EnumerateArray() : Enumerable.Empty<JsonElement>();
    private static IEnumerable<JsonElement> Arr(JsonElement e, string name) => Arr((JsonElement?)e, name);

    private static string Get(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v)
            ? v.ValueKind switch { JsonValueKind.String => v.GetString()!.Trim(), JsonValueKind.Number => v.ToString(), _ => "" }
            : "";
    private static string S(JsonElement? e, string name) => e.HasValue ? Get(e.Value, name) : "";
    private static string Str(JsonObject? o, string name) => o?[name] is JsonValue v && v.TryGetValue<string>(out var s) ? s.Trim() : "";

    private static JsonArray Strings(IEnumerable<JsonElement> items) =>
        new(items.Select(x => x.GetString()).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => (JsonNode)JsonValue.Create(x!.Trim())!).ToArray());

    private static JsonArray SplitLines(string text) =>
        new(Regex.Split(text ?? "", @"\r?\n|•").Select(x => x.Trim().TrimStart('-', '*', '·').Trim())
            .Where(x => x.Length > 0).Take(12).Select(x => (JsonNode)JsonValue.Create(x)!).ToArray());

    private static string MonthOf(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var m = Regex.Match(value, @"^(\d{4})-(\d{2})");
        return m.Success ? $"{m.Groups[1].Value}-{m.Groups[2].Value}" : value.Trim();
    }

    private static string First(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim() ?? "";

    private static string? AbsoluteUrl(string? value, string? origin)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim();
        if (v.StartsWith('/') && !string.IsNullOrEmpty(origin)) v = origin.TrimEnd('/') + v;
        else if (!v.StartsWith("http", StringComparison.OrdinalIgnoreCase) && Regex.IsMatch(v, @"^[\w-]+(\.[\w-]+)+(/\S*)?$")) v = "https://" + v;
        return Uri.TryCreate(v, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https" ? uri.ToString() : null;
    }

    private static string Slug(string name)
    {
        var normalized = name.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        var ascii = sb.ToString().ToLowerInvariant().Replace('đ', 'd');
        var slug = Regex.Replace(ascii, "[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrEmpty(slug) ? "my-resume" : slug;
    }
}
