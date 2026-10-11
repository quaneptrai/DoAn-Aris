using System.Collections.Concurrent;
using ArisSkyve.Domain.Entities;

namespace ArisSkyve.Infrastructure.Services;

/// <summary>Reuses one silent master, or five expressions, and fits their video to the shared TTS voice.</summary>
public sealed class InterviewVideoProduction(IInterviewEngine engine, InterviewSpeech speech, IServiceScopeFactory scopes, ILogger<InterviewVideoProduction> logger)
{
    public static string Revision(InterviewKit kit) => Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(kit.ScriptJson + "\n" + kit.SettingsJson + "\n" + kit.Persona + "\n" + kit.Scene + "\n" + (kit.AvatarImage == null ? "" : Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(kit.AvatarImage))))));
    private sealed record LocalQuote(int KitId, string Kind, int? QuestionId, DateTime Expires);
    private readonly ConcurrentDictionary<string, LocalQuote> localQuotes = new();
    public static string BaseKind(InterviewProductionSettings settings, string kind) => settings.VisualMode == "shared" ? "base-master" : kind switch
    {
        "listening" => "base-listen", "thinking" => "base-think", "pass" => "base-happy", "fail" => "base-concerned", _ => "base-talk"
    };
    public static IReadOnlyList<InterviewScriptClip> Targets(InterviewKit kit, bool replace)
    {
        var settings = InterviewProductionSettings.Of(kit); var script = InterviewJson.Script(kit.ScriptJson);
        bool Missing(InterviewScriptClip clip) => replace || !kit.Videos.Any(v => v.Kind == clip.Kind && v.QuestionId == clip.QuestionId);
        if (settings.VisualMode == "independent") return script.Where(Missing).ToList();
        var bases = settings.VisualMode == "shared" ? new[] { "base-master" } : InterviewKitVideo.BaseKinds.Where(k => k != "base-master").ToArray();
        return bases.Select(kind => InterviewEngine.Clip(kit, kind, null, "")).Where(Missing).Concat(script.Where(Missing)).ToList();
    }
    public static InterviewScriptClip? Find(InterviewKit kit, string? kind, int? questionId) =>
        InterviewKitVideo.BaseKinds.Contains(kind) ? InterviewEngine.Clip(kit, kind!, null, "") : InterviewJson.Script(kit.ScriptJson).FirstOrDefault(c => c.Kind == kind && c.QuestionId == questionId);
    public async Task<InterviewVideoQuote> QuoteAsync(InterviewKit kit, InterviewScriptClip clip, CancellationToken token)
    {
        var settings = InterviewProductionSettings.Of(kit);
        if (settings.RequiresVoiceConversion) await speech.EnsureVoiceConversionAsync(settings.VoiceId, token);
        if (settings.RequiresSpeechFit && !speech.CanFitSpeech) throw new InterviewEngineException("Chế độ khớp môi + giọng đọc TTS chưa sẵn sàng. Vui lòng liên hệ quản trị viên.");
        if (settings.NarrationMode == "tts" || settings.VisualMode != "independent")
        {
            if (!speech.CanSpeak) throw new InterviewEngineException("Giọng đọc TTS chưa được bật trên hệ thống.");
            await speech.EnsureMixerAsync(token);
        }
        if (settings.VisualMode == "independent" || InterviewKitVideo.BaseKinds.Contains(clip.Kind)) return await engine.QuoteVideoAsync(kit, clip, token);
        foreach (var (id, old) in localQuotes) if (old.Expires < DateTime.UtcNow) localQuotes.TryRemove(id, out _);
        var quote = new InterviewVideoQuote("local-" + Guid.NewGuid().ToString("N"), 0);
        localQuotes[quote.Id] = new LocalQuote(kit.Id, clip.Kind, clip.QuestionId, DateTime.UtcNow.AddMinutes(5));
        return quote;
    }
    public async Task<byte[]> RenderAsync(InterviewKit kit, InterviewScriptClip clip, string quoteId, CancellationToken token)
    {
        var settings = InterviewProductionSettings.Of(kit); byte[] video;
        // Check again before consuming a paid quote: the local converter may have stopped since preview.
        if (settings.RequiresVoiceConversion) await speech.EnsureVoiceConversionAsync(settings.VoiceId, token);
        // Synthesize first: a TTS failure must not waste the paid video.
        var fittedVoice = settings.RequiresSpeechFit && !InterviewKitVideo.SilentKinds.Contains(clip.Kind) && !InterviewKitVideo.BaseKinds.Contains(clip.Kind)
            ? await speech.SpeakAsync(clip.Line, settings, token)
            : null;
        if (quoteId.StartsWith("local-"))
        {
            if (!localQuotes.TryRemove(quoteId, out var quote) || quote.Expires <= DateTime.UtcNow || quote.KitId != kit.Id || quote.Kind != clip.Kind || quote.QuestionId != clip.QuestionId)
                throw new InterviewEngineException("Báo giá không còn hiệu lực. Xem lại chi phí trước khi tạo.");
            var sourceKind = BaseKind(settings, clip.Kind);
            var source = kit.Videos.FirstOrDefault(v => v.Kind == sourceKind) ?? throw new InterviewEngineException("Chưa có video gốc/biểu cảm cho đoạn này. Tạo bộ video hoặc tải video gốc lên trước.");
            using var scope = scopes.CreateScope(); video = await scope.ServiceProvider.GetRequiredService<InterviewKitStore>().ReadVideoAsync(source, token);
        }
        else video = await engine.RenderVideoAsync(quoteId, token);
        if (InterviewKitVideo.BaseKinds.Contains(clip.Kind)) return await speech.MixAsync(video, null, token);
        if (settings.RequiresVoiceConversion)
            return InterviewKitVideo.SilentKinds.Contains(clip.Kind)
                ? await speech.MixAsync(video, null, token)
                : await speech.ConvertVoiceAsync(video, settings.VoiceId, token);
        if (settings.RequiresSpeechFit)
        {
            if (fittedVoice == null) return await speech.MixAsync(video, null, token);
            try { return await speech.FitSpeechAsync(video, fittedVoice, token); }
            catch (InterviewEngineException e)
            {
                // The render is already paid for. Keep it with the same TTS voice (plain voice-over, no
                // word-level lip sync) rather than discarding it or falling back to the model's own voice.
                logger.LogWarning("Interview speech fit refused for kit {KitId} {Kind}; kept the clip with a plain voice-over: {Reason}", kit.Id, clip.Kind, e.Message);
                return await speech.MixAsync(video, fittedVoice, token);
            }
        }
        if (settings.NarrationMode == "tts" && !InterviewKitVideo.SilentKinds.Contains(clip.Kind))
            return await speech.MixAsync(video, await speech.SpeakAsync(clip.Line, settings, token), token);
        if (settings.VisualMode != "independent") return await speech.MixAsync(video, null, token);
        return video;
    }
}
