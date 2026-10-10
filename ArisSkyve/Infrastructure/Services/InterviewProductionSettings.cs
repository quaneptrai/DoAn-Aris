using System.Globalization;
using System.Text.RegularExpressions;
using ArisSkyve.Domain.Entities;

namespace ArisSkyve.Infrastructure.Services;

public sealed class InterviewProductionSettings
{
    public string VisualMode { get; set; } = "independent";
    public string NarrationMode { get; set; } = "native";
    public string Quality { get; set; } = "fast";
    public string CreditMode { get; set; } = "auto";
    public int? CreditAccountId { get; set; }
    [System.ComponentModel.DataAnnotations.DisplayFormat(ConvertEmptyStringToNull = false)]
    public string VoiceId { get; set; } = "";
    [System.ComponentModel.DataAnnotations.DisplayFormat(ConvertEmptyStringToNull = false)]
    public string PronunciationOverrides { get; set; } = "";
    public double Speed { get; set; } = 1;
    public double Pitch { get; set; } = 1;
    public bool AutoApprove { get; set; }
    public int MaximumCredits { get; set; } = 10;
    public int MaximumTotalCredits { get; set; } = 100;
    public int MaxSupplements { get; set; } = 1;

    public static InterviewProductionSettings Of(InterviewKit kit) =>
        string.IsNullOrWhiteSpace(kit.SettingsJson) ? new() : System.Text.Json.JsonSerializer.Deserialize<InterviewProductionSettings>(kit.SettingsJson, InterviewJson.Options) ?? new();
    public string? Validate()
    {
        if (CreditMode is not ("auto" or "pool" or "single") || (CreditMode == "single" && CreditAccountId is not > 0)) return "Chọn tài khoản credit hợp lệ.";
        if (VisualMode is not ("independent" or "expressions" or "shared") || NarrationMode is not ("native" or "tts") || Quality is not ("fast" or "balanced" or "quality")) return "Tùy chọn video không hợp lệ.";
        if (VisualMode != "independent" && NarrationMode != "tts") return "Video dùng chung cần chọn giọng đọc TTS.";
        if (NarrationMode == "tts" && (string.IsNullOrWhiteSpace(VoiceId) || VoiceId.Length > 120)) return "Chọn giọng đọc TTS trước khi lưu.";
        var pronunciationError = Pronunciations(out _);
        if (pronunciationError != null) return pronunciationError;
        if (!double.IsFinite(Speed) || Speed < .25 || Speed > 4 || !double.IsFinite(Pitch) || Pitch < .8 || Pitch > 1.2) return "Tốc độ/cao độ giọng đọc ngoài phạm vi cho phép.";
        if (MaximumCredits < 0 || MaximumCredits > 10000 || MaximumTotalCredits < 0 || MaximumTotalCredits > 100000 || MaxSupplements < 0 || MaxSupplements > 3) return "Hạn mức credit hoặc số lần bổ sung không hợp lệ.";
        return null;
    }
    private string? Pronunciations(out Dictionary<string, string> entries)
    {
        entries = new(StringComparer.OrdinalIgnoreCase);
        var source = PronunciationOverrides ?? "";
        if (source.Length > 4000) return "Cách đọc thuật ngữ tối đa 4.000 ký tự.";
        foreach (var line in source.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            var separator = line.IndexOf('=');
            if (separator < 1 || separator == line.Length - 1) return "Mỗi cách đọc cần có dạng: thuật ngữ = lời đọc.";
            var term = line[..separator].Trim(); var reading = line[(separator + 1)..].Trim();
            if (term.Length == 0 || term.Length > 120 || reading.Length == 0 || reading.Length > 160 || term.Any(char.IsControl) || reading.Any(char.IsControl))
                return "Thuật ngữ tối đa 120 ký tự; lời đọc tối đa 160 ký tự và không để trống.";
            if (!entries.TryAdd(term, reading)) return "Mỗi thuật ngữ chỉ được đặt một cách đọc.";
            if (entries.Count > 50) return "Tối đa 50 cách đọc thuật ngữ cho mỗi bộ câu hỏi.";
        }
        return null;
    }
    /// <summary>Only changes synthesis input. Original questions, scripts and grading text remain intact.</summary>
    public string PrepareSpeechText(string text)
    {
        var error = Pronunciations(out var entries);
        if (error != null) throw new InterviewEngineException(error);
        if (entries.Count == 0) return text;
        var terms = entries.Keys.OrderByDescending(term => term.Length).Select(Regex.Escape);
        // Replace complete terms in one pass, so replacement text never triggers another dictionary entry.
        return Regex.Replace(text, @"(?<![\p{L}\p{N}_])(?:" + string.Join("|", terms) + @")(?![\p{L}\p{N}_])",
            match => entries[match.Value], RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(250));
    }
    public static double[] Weights(string? text, int count)
    {
        var values = (text ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return Enumerable.Range(0, count).Select(i => i < values.Length && double.TryParse(values[i], NumberStyles.Float, CultureInfo.InvariantCulture, out var value) && double.IsFinite(value) && value > 0 && value <= 1000 ? value : 1).ToArray();
    }
    public static double TotalScore(InterviewKit kit, IReadOnlyList<InterviewAnswerResult> answers)
    {
        var weights = kit.Questions.Sum(q => double.IsFinite(q.Weight) && q.Weight > 0 ? q.Weight : 1);
        return weights == 0 ? 0 : Math.Round(kit.Questions.Sum(q => (answers.FirstOrDefault(a => a.QuestionId == q.Id)?.Score ?? 0) * (double.IsFinite(q.Weight) && q.Weight > 0 ? q.Weight : 1)) / weights, 1);
    }
}
