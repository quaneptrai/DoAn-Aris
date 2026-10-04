using System.Text.Json;
using System.Text.Json.Serialization;

namespace ArisSkyve.Infrastructure.Services.Recruitment
{
    public class MatchEvidence
    {
        [JsonPropertyName("cv")] public string? Cv { get; set; }
        [JsonPropertyName("job")] public string? Job { get; set; }
    }

    // Bản chấm đã lưu trong JobApplication.MatchDetailJson (dạng camelCase, đọc thẳng ở JS).
    public class MatchDetail
    {
        [JsonPropertyName("score")] public double? Score { get; set; }
        [JsonPropertyName("reason")] public string? Reason { get; set; }
        [JsonPropertyName("advice")] public string? Advice { get; set; }
        [JsonPropertyName("matched")] public List<string> Matched { get; set; } = new();
        [JsonPropertyName("missing")] public List<string> Missing { get; set; } = new();
        [JsonPropertyName("evidence")] public List<MatchEvidence> Evidence { get; set; } = new();
        [JsonPropertyName("explanationStatus")] public string? ExplanationStatus { get; set; }
        [JsonPropertyName("semanticScore")] public double? SemanticScore { get; set; }
        [JsonPropertyName("llmScore")] public double? LlmScore { get; set; }
        [JsonPropertyName("llmAdjustment")] public double? LlmAdjustment { get; set; }
        [JsonPropertyName("model")] public string? Model { get; set; }
        [JsonPropertyName("resumeId")] public int? ResumeId { get; set; }

        private static readonly JsonSerializerOptions Opts = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

        public string ToJson() => JsonSerializer.Serialize(this, Opts);

        public static MatchDetail? FromJson(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try { return JsonSerializer.Deserialize<MatchDetail>(json); }
            catch (JsonException) { return null; }
        }
    }

    // Diễn giải điểm AiCore thành chữ cho người dùng. Mọi câu ở đây dựng từ dữ liệu chấm thật
    // (kỹ năng khớp/thiếu, trích dẫn) — không bịa nhận xét khi AiCore không trả giải thích.
    public static class MatchInsight
    {
        public static (string Key, string Label) Tier(double? score) => score switch
        {
            null => ("none", "Chưa chấm"),
            >= 75 => ("high", "Rất phù hợp"),
            >= 60 => ("good", "Phù hợp"),
            >= 45 => ("mid", "Cần cân nhắc"),
            _ => ("low", "Ít phù hợp")
        };

        private static string JoinVi(IEnumerable<string> items)
        {
            var list = items.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToList();
            return list.Count switch
            {
                0 => string.Empty,
                1 => list[0],
                _ => string.Join(", ", list.Take(list.Count - 1)) + " và " + list[^1]
            };
        }

        private static string FirstSentence(string? text, int max)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;
            var t = text.Trim().Replace('\n', ' ');
            var cut = t.IndexOfAny(new[] { '.', '!', '?', ';' });
            if (cut > 20 && cut < max) t = t[..(cut + 1)];
            if (t.Length > max) t = t[..(max - 1)].TrimEnd() + "…";
            return t;
        }

        // Một dòng cho thẻ ngoài: ưu tiên kỹ năng (đúng, ngắn), rồi mới đến câu đầu của lý do.
        public static string BuildSummary(IReadOnlyList<string>? matched, IReadOnlyList<string>? missing, string? reason)
        {
            matched ??= Array.Empty<string>();
            missing ??= Array.Empty<string>();
            string summary;
            if (matched.Count > 0 && missing.Count > 0)
                summary = $"Khớp {JoinVi(matched.Take(3))}; CV chưa nhắc {JoinVi(missing.Take(2))}.";
            else if (matched.Count > 0)
                summary = $"Khớp {JoinVi(matched.Take(3))}" + (matched.Count > 3 ? $" và {matched.Count - 3} kỹ năng khác." : ".");
            else if (missing.Count > 0)
                summary = $"CV chưa nhắc {JoinVi(missing.Take(3))} mà tin này yêu cầu.";
            else
                summary = FirstSentence(reason, 160);
            return summary.Length > 380 ? summary[..379] + "…" : summary;
        }

        // Gợi ý sửa CV — ứng viên đọc. "missing" của AiCore nghĩa là "chưa thấy trong CV đã lưu",
        // nên câu gợi ý phải là "nếu bạn có thì ghi rõ", không khẳng định họ thiếu.
        public static List<string> CvSuggestions(MatchDetail d, string? jobTitle)
        {
            var tips = new List<string>();
            if (d.Missing.Count > 0)
            {
                tips.Add($"Nếu bạn đã dùng {JoinVi(d.Missing.Take(4))}, ghi rõ vào mục Kinh nghiệm hoặc Dự án: làm gì, trong bao lâu, kết quả ra sao. AI chưa thấy các từ này trong CV đã lưu.");
            }
            if (d.Matched.Count > 0)
            {
                tips.Add($"Đưa {JoinVi(d.Matched.Take(3))} lên phần tóm tắt đầu CV — đây là các điểm khớp mạnh nhất với tin{(string.IsNullOrWhiteSpace(jobTitle) ? "" : $" \"{jobTitle}\"")}.");
            }
            if (d.Evidence.Count == 0 && d.Matched.Count > 0)
            {
                tips.Add("Thêm số liệu cụ thể (quy mô dự án, số người dùng, thời gian giảm được) cạnh các kỹ năng — hiện CV có tên kỹ năng nhưng ít đoạn mô tả để đối chiếu.");
            }
            if (d.Score is < 45 && d.Matched.Count <= 1)
            {
                tips.Add("Nội dung CV đang lệch khá xa yêu cầu của tin. Nếu thật sự muốn ứng tuyển, nên làm một bản CV riêng cho vị trí này (Aris cho phép giữ nhiều CV).");
            }
            return tips;
        }

        // Câu hỏi gợi ý cho nhà tuyển dụng — biến "CV chưa nhắc X" thành điều cần hỏi trực tiếp.
        public static List<string> InterviewProbes(MatchDetail d)
        {
            var probes = d.Missing.Take(4)
                .Select(s => $"Bạn đã làm việc với {s} chưa? Kể một tình huống cụ thể.")
                .ToList();
            foreach (var e in d.Evidence.Where(e => !string.IsNullOrWhiteSpace(e.Cv)).Take(2))
            {
                var quote = e.Cv!.Length > 80 ? e.Cv[..79] + "…" : e.Cv;
                probes.Add($"CV ghi \"{quote}\" — vai trò của bạn trong phần này là gì?");
            }
            return probes;
        }
    }
}
