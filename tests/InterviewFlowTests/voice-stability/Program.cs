// Runs the real speech service against an in-process HTTP handler. No network, paid API or live state.
using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.DependencyInjection;

var checks = 0;
void Check(string description, bool condition)
{
    if (!condition) throw new InvalidOperationException(description);
    Console.WriteLine("PASS " + description);
    checks++;
}

async Task Reject(string description, Func<Task> action)
{
    try { await action(); }
    catch (InterviewEngineException) { Check(description, true); return; }
    throw new InvalidOperationException(description);
}

var recording = new RecordingHandler();
var config = new InterviewEngineOptions
{
    Tts = new() { BaseUrl = "https://speech.invalid/v1", Model = "fixed-multilingual-model" }
};
var monitor = new FixedOptions(config);
var service = new InterviewSpeech(new RecordingFactory(recording), monitor, NullLogger<InterviewSpeech>.Instance);
var settings = new InterviewProductionSettings
{
    NarrationMode = "tts", VoiceId = "same-selected-voice", Speed = 1.3, Pitch = .96
};
Check("fixed TTS settings pass validation", settings.Validate() is null);

var kit = new InterviewKit { SettingsJson = InterviewJson.Write(settings) };
var saved = InterviewProductionSettings.Of(kit);
var original = InterviewJson.Write(saved);
foreach (var line in new[] { "Welcome to the interview.", "Explain volatile and interrupts.", "Thank you for your answer." })
    await service.SpeakAsync(line, saved, CancellationToken.None);
Check("three clips send the same selected voice, speed, pitch and model", recording.Requests.Count == 3 && recording.Requests.All(r =>
    r.GetProperty("voice").GetString() == "same-selected-voice" &&
    r.GetProperty("speed").GetDouble() == 1.3 &&
    r.GetProperty("pitch").GetDouble() == .96 &&
    r.GetProperty("model").GetString() == "fixed-multilingual-model"));
Check("clip texts stay distinct while narration settings stay unchanged", recording.Requests.Select(r => r.GetProperty("input").GetString()).Distinct().Count() == 3 && InterviewJson.Write(saved) == original);
Check("TTS uses the absolute speech endpoint even when base URL includes v1", recording.Paths.All(p => p == "/v1/audio/speech"));

var count = recording.Requests.Count;
config.Tts = new();
Check("missing TTS configuration is reported unavailable", !service.CanSpeak);
await Reject("missing TTS fails before an HTTP request", () => service.SpeakAsync("Question", saved, CancellationToken.None));
Check("unavailable TTS makes no provider request", recording.Requests.Count == count);
config.Tts = new() { BaseUrl = "https://speech.invalid", Model = "fixed-multilingual-model" };
var missingVoice = new InterviewProductionSettings { NarrationMode = "tts", VoiceId = "" };
Check("fixed narration requires a selected voice", missingVoice.Validate() is not null);
await Reject("missing selected voice fails before an HTTP request", () => service.SpeakAsync("Question", missingVoice, CancellationToken.None));
Check("voice omission does not fall back to a provider default", recording.Requests.Count == count);

settings.PronunciationOverrides = "volatile = chosen reading\nUART = U A R T";
kit.SettingsJson = InterviewJson.Write(settings);
kit.Questions = [new() { Id = 1, Question = "Explain volatile and UART.", AnswerKey = "volatile controls compiler access", KeyPoints = "volatile;UART" }];
kit.ScriptJson = InterviewJson.Write(new[] { new InterviewScriptClip("question", 1, kit.Questions[0].Question, "Fixed scene") });
var questionBefore = InterviewJson.Write(kit.Questions);
var scriptBefore = kit.ScriptJson;
var spokenSettings = InterviewProductionSettings.Of(kit);
Check("pronunciation dictionary survives settings storage", spokenSettings.PronunciationOverrides == settings.PronunciationOverrides);
Check("pronunciation matches whole terms case insensitively", spokenSettings.PrepareSpeechText("VOLATILE, Volatile: UART.") == "chosen reading, chosen reading: U A R T.");
Check("pronunciation avoids substrings and identifiers", spokenSettings.PrepareSpeechText("prevolatile volatiles volatile2 volatile_name évolatile volatileé") == "prevolatile volatiles volatile2 volatile_name évolatile volatileé");
await service.SpeakAsync(kit.Questions[0].Question, spokenSettings, CancellationToken.None);
Check("only synthesis input uses selected pronunciations", recording.Requests[^1].GetProperty("input").GetString() == "Explain chosen reading and U A R T.");
Check("pronunciation keeps questions, answers, rubric and script intact", questionBefore == InterviewJson.Write(kit.Questions) && scriptBefore == kit.ScriptJson);

var phrases = new InterviewProductionSettings { PronunciationOverrides = "interrupt = single\ninterrupt latency = longer\nC++ = C plus plus\nI/O = input output" };
Check("longer dictionary phrases take priority", phrases.PrepareSpeechText("interrupt latency and interrupt.") == "longer and single.");
Check("dictionary escapes regex metacharacters", phrases.PrepareSpeechText("C++ and I/O.") == "C plus plus and input output.");
var cascade = new InterviewProductionSettings { PronunciationOverrides = "alpha = beta\nbeta = gamma" };
Check("replacement text cannot trigger another dictionary entry", cascade.PrepareSpeechText("alpha beta") == "beta gamma");
var whitespace = new InterviewProductionSettings { PronunciationOverrides = "\r\n  volatile = reading  \r\n\n" };
Check("dictionary permits blank lines and surrounding whitespace", whitespace.Validate() is null && whitespace.PrepareSpeechText("volatile") == "reading");

var malformed = new[]
{
    "volatile", "=reading", "volatile=", "volatile=   ", "volatile=one\nVOLATILE=two",
    new string('t', 121) + "=reading", "volatile=" + new string('r', 161), "volatile=bad\treading",
    new string(' ', 4001), string.Join('\n', Enumerable.Range(1, 51).Select(i => $"term{i}=reading"))
};
foreach (var dictionary in malformed)
{
    var invalid = new InterviewProductionSettings { PronunciationOverrides = dictionary };
    Check("malformed or oversized pronunciation dictionary rejected", invalid.Validate() is not null);
}
count = recording.Requests.Count;
await Reject("invalid dictionary never reaches synthesis provider", () => service.SpeakAsync("volatile", new() { VoiceId = "fixed", PronunciationOverrides = "volatile" }, CancellationToken.None));
var expanded = new InterviewProductionSettings { VoiceId = "fixed", PronunciationOverrides = "volatile=" + new string('r', 160) };
await Reject("expanded pronunciation obeys speech input length limit", () => service.SpeakAsync(string.Join(' ', Enumerable.Repeat("volatile", 16)), expanded, CancellationToken.None));
Check("invalid or expanded dictionary makes no provider request", recording.Requests.Count == count);

// A speech service behind a gateway path keeps that path; a trailing /v1 is still ignored.
config.Tts = new() { BaseUrl = "https://gateway.invalid/gw/tts", Model = "fixed-multilingual-model" };
await service.SpeakAsync("Question", saved, CancellationToken.None);
Check("TTS behind a gateway path keeps the path prefix", recording.Paths[^1] == "/gw/tts/v1/audio/speech");
Check("speech endpoints under a prefix and with /v1 resolve as expected",
    InterviewSpeech.Endpoint("https://gateway.invalid/gw/tts/", "/api/v1/voices").AbsolutePath == "/gw/tts/api/v1/voices" &&
    InterviewSpeech.Endpoint("https://speech.invalid/v1", "/api/v1/voices").AbsolutePath == "/api/v1/voices");

// With a media machine configured, mixing and the demo go there; the server needs no FFmpeg.
var media = new MediaHandler();
var mediaConfig = new InterviewEngineOptions { Media = new() { BaseUrl = "https://gateway.invalid/gw/media/", ApiKey = "Bearer media-key" }, FfmpegPath = "ffmpeg-not-installed" };
var remote = new InterviewSpeech(new MediaFactory(media), new FixedOptions(mediaConfig), NullLogger<InterviewSpeech>.Instance);
await remote.EnsureMixerAsync(CancellationToken.None);
var remoteMix = await remote.MixAsync([1, 2, 3], Encoding.ASCII.GetBytes("RIFF0000WAVEvoice"), CancellationToken.None);
var remoteSilent = await remote.MixAsync([4, 5], null, CancellationToken.None);
var remoteDemo = await remote.DemoAsync([[1], [2], [3]], CancellationToken.None);
Check("remote media: health, mix with and without voice, demo, each with the media key", media.Calls.Select(c => c.Path).SequenceEqual(["/gw/media/health", "/gw/media/mix", "/gw/media/mix", "/gw/media/concat"]) && media.Calls.All(c => c.Auth == "Bearer media-key"));
Check("remote mix sends the video and the voice as parts, silent mix only the video", media.Calls[1].Parts.SequenceEqual(["video", "audio"]) && media.Calls[2].Parts.SequenceEqual(["video"]) && media.Calls[3].Parts.SequenceEqual(["clip", "clip", "clip"]));
Check("remote results come back as returned", Encoding.ASCII.GetString(remoteMix) == "mixed:/gw/media/mix" && remoteSilent.Length > 0 && Encoding.ASCII.GetString(remoteDemo) == "mixed:/gw/media/concat");
media.Status = HttpStatusCode.UnprocessableEntity;
try { await remote.MixAsync([1], null, CancellationToken.None); throw new InvalidOperationException("remote failure not reported"); }
catch (InterviewEngineException e) { Check("a file the media machine cannot process is reported as such", e.Message.StartsWith("Không xử lý được âm thanh/video")); }
media.Status = HttpStatusCode.BadGateway;
try { await remote.EnsureMixerAsync(CancellationToken.None); throw new InvalidOperationException("remote outage not reported"); }
catch (InterviewEngineException e) { Check("an unreachable media machine is reported without its address", e.Message.Contains("tạm thời không phản hồi") && !e.Message.Contains("gateway.invalid")); }

// Native speech conversion replaces only timbre, never the saved question or a TTS voice-over.
var converted = new InterviewProductionSettings { NarrationMode = "native-converted", VoiceId = "ruby_wav_clean", PronunciationOverrides = "volatile = vola-tile\nC = see" };
Check("native conversion requires independent visuals and an explicit target voice", converted.Validate() is null && converted.UsesNativeSpeech && converted.UsesSelectedVoice);
Check("native conversion rejects reusable video, missing voice and altered timing",
    new InterviewProductionSettings { NarrationMode = "native-converted", VisualMode = "shared", VoiceId = "ruby_wav_clean" }.Validate() is not null &&
    new InterviewProductionSettings { NarrationMode = "native-converted" }.Validate() is not null &&
    new InterviewProductionSettings { NarrationMode = "native-converted", VoiceId = "ruby_wav_clean", Speed = 1.2 }.Validate() is not null);
kit.SettingsJson = InterviewJson.Write(converted);
var originalLine = "Từ khóa volatile trong C dùng để làm gì trong lập trình nhúng?";
var questionClip = InterviewEngine.Clip(kit, "question", 1, originalLine);
Check("native prompt changes pronunciation input while preserving the original script line",
    questionClip.Line == originalLine && questionClip.Prompt.Contains("vola-tile trong see") && questionClip.Prompt.Contains("môi và hàm khớp") &&
    questionBefore == InterviewJson.Write(kit.Questions) && scriptBefore == kit.ScriptJson);
var silentClips = InterviewKitVideo.SilentKinds.Select(kind => InterviewEngine.Clip(kit, kind, null, "must not be spoken")).ToArray();
Check("listening, thinking, pass and fail have separate silent expressions", silentClips.Length == 4 && silentClips.Select(c => c.Prompt).Distinct().Count() == 4 && silentClips.All(c => c.Line == "" && c.Prompt.Contains("miệng khép")));
kit.ScriptJson = InterviewJson.Write(new[] { questionClip }.Concat(silentClips));
Check("native conversion targets only independent public slots", InterviewVideoProduction.Targets(kit, true).Count == 5 && InterviewVideoProduction.Targets(kit, true).All(c => !InterviewKitVideo.BaseKinds.Contains(c.Kind)));

media.Status = HttpStatusCode.OK;
media.ConversionReady = true;
var conversionVoices = await remote.ConversionVoicesAsync(CancellationToken.None);
Check("conversion catalog comes from the authenticated media machine", conversionVoices.Count == 1 && conversionVoices[0].Id == "ruby_wav_clean" && media.Calls[^1].Path == "/gw/media/voice-conversion/health" && media.Calls[^1].Auth == "Bearer media-key");
var beforeConversions = media.Calls.Count;
foreach (var bytes in new byte[][] { [1, 2], [3, 4], [5, 6] }) await remote.ConvertVoiceAsync(bytes, "ruby_wav_clean", CancellationToken.None);
var conversions = media.Calls.Skip(beforeConversions).Where(c => c.Path.EndsWith("/convert-voice")).ToList();
Check("all native clips select the same conversion voice without synthesizing TTS", conversions.Count == 3 && conversions.All(c => c.VoiceId == "ruby_wav_clean" && c.Parts.SequenceEqual(["video", "voice"])) && !media.Calls.Skip(beforeConversions).Any(c => c.Path.Contains("audio/speech")));
beforeConversions = media.Calls.Count;
await Reject("unknown conversion voice is rejected before uploading video", () => remote.ConvertVoiceAsync([1], "unknown", CancellationToken.None));
Check("unknown voice submits no conversion request", media.Calls.Skip(beforeConversions).All(c => !c.Path.EndsWith("/convert-voice")));
media.ConversionReady = false;
var generationRecorder = new RecordingHandler();
var generationOptions = new InterviewEngineOptions { Video = new() { BaseUrl = "https://generation.invalid/v1" } };
var generationEngine = new InterviewEngine(new RecordingFactory(generationRecorder), new FixedOptions(generationOptions), NullLogger<InterviewEngine>.Instance);
using var scopes = new ServiceCollection().BuildServiceProvider();
var production = new InterviewVideoProduction(generationEngine, remote, scopes.GetRequiredService<IServiceScopeFactory>(), NullLogger<InterviewVideoProduction>.Instance);
await Reject("unavailable converter blocks quote before any video provider request", () => production.QuoteAsync(kit, questionClip, CancellationToken.None));
await Reject("unavailable converter blocks render before consuming a paid quote", () => production.RenderAsync(kit, questionClip, "unused", CancellationToken.None));
Check("failed conversion preflight leaves generation untouched", generationRecorder.Requests.Count == 0);
Check("unconfigured conversion is unavailable without sending an HTTP request", (await service.ConversionVoicesAsync(CancellationToken.None)).Count == 0);
var longClip = InterviewEngine.Clip(kit, "question", 1, string.Join(' ', Enumerable.Repeat("word", 34)));
await Reject("native-converted rejects speech longer than the model before requesting a quote", () => generationEngine.QuoteVideoAsync(kit, longClip, CancellationToken.None));
Check("overlong native speech makes no video provider request", generationRecorder.Requests.Count == 0);
var videoQuotes = new VideoQuoteHandler();
var nativeOptions = new InterviewEngineOptions { Video = new() { BaseUrl = "https://generation.invalid/v1", Model = "omni-1.1-flash-8s-landscape", ModelWithImage = "omni-1.1-flash-8s-landscape", NativeModelWithImage = "veo-3.1-fast-i2v-6s-landscape" } };
var nativeEngine = new InterviewEngine(new QuoteFactory(videoQuotes), new FixedOptions(nativeOptions), NullLogger<InterviewEngine>.Instance);
converted.Quality = "balanced"; kit.SettingsJson = InterviewJson.Write(converted); kit.AvatarImage = [1];
var eightSeconds = InterviewEngine.Clip(kit, "question", 1, string.Join(' ', Enumerable.Repeat("word", 20)));
await nativeEngine.QuoteVideoAsync(kit, eightSeconds, CancellationToken.None);
// The renderer has no 8-second Lite/Fast image model; only Quality offers 8 seconds with an image.
Check("longer native speech with an image uses the existing eight-second Quality model", videoQuotes.Requests.Single().GetProperty("model").GetString() == "veo-3.1-quality-i2v-8s-landscape");
converted.PronunciationOverrides = "short=" + string.Join(' ', Enumerable.Repeat("word", 30)); kit.SettingsJson = InterviewJson.Write(converted);
var expandedNative = InterviewEngine.Clip(kit, "question", 1, "short");
await Reject("native duration checks use pronunciation-expanded text", () => nativeEngine.QuoteVideoAsync(kit, expandedNative, CancellationToken.None));
Check("expanded overlong pronunciation makes no additional video provider request", videoQuotes.Requests.Count == 1);

// native-tts: the video speaks for lip timing; the kit's TTS voice replaces it on the media machine.
var fittedSettings = new InterviewProductionSettings { NarrationMode = "native-tts", VoiceId = "ruby_wav_clean", Pitch = 1.1, PronunciationOverrides = "volatile = vola-tile" };
Check("native-tts uses native speech timing with the selected TTS voice; pitch stays adjustable",
    fittedSettings.Validate() is null && fittedSettings.UsesNativeSpeech && fittedSettings.UsesSelectedVoice && fittedSettings.RequiresSpeechFit && !fittedSettings.RequiresVoiceConversion);
Check("native-tts rejects reusable video, a missing voice and a speed the video timing would override",
    new InterviewProductionSettings { NarrationMode = "native-tts", VisualMode = "expressions", VoiceId = "ruby_wav_clean" }.Validate() is not null &&
    new InterviewProductionSettings { NarrationMode = "native-tts" }.Validate() is not null &&
    new InterviewProductionSettings { NarrationMode = "native-tts", VoiceId = "ruby_wav_clean", Speed = 1.3 }.Validate() is not null);
var fitMedia = new MediaHandler();
var fitConfig = new InterviewEngineOptions { Tts = new() { BaseUrl = "https://speech.invalid/v1", Model = "fixed-multilingual-model" }, Media = new() { BaseUrl = "https://gateway.invalid/gw/media", ApiKey = "media-key" } };
var fitSpeech = new InterviewSpeech(new MediaFactory(fitMedia), new FixedOptions(fitConfig), NullLogger<InterviewSpeech>.Instance);
Check("fitting needs both a TTS voice and the media machine", fitSpeech.CanFitSpeech && !remote.CanFitSpeech && !service.CanFitSpeech);
var fittedBytes = await fitSpeech.FitSpeechAsync([1, 2], Encoding.ASCII.GetBytes("RIFF0000WAVEvoice"), CancellationToken.None);
Check("fit-voice sends the paid video and the TTS line to the authenticated media machine",
    fitMedia.Calls[^1].Path == "/gw/media/fit-voice" && fitMedia.Calls[^1].Parts.SequenceEqual(["video", "audio"]) && fitMedia.Calls[^1].Auth == "Bearer media-key" && Encoding.ASCII.GetString(fittedBytes) == "mixed:/gw/media/fit-voice");
kit.SettingsJson = InterviewJson.Write(fittedSettings);
var fitClip = InterviewEngine.Clip(kit, "question", 1, originalLine);
Check("native-tts prompt asks the video to speak the line (with pronunciations) for lip timing", fitClip.Line == originalLine && fitClip.Prompt.Contains("vola-tile") && fitClip.Prompt.Contains("môi và hàm khớp"));
var unfittable = new InterviewVideoProduction(generationEngine, remote, scopes.GetRequiredService<IServiceScopeFactory>(), NullLogger<InterviewVideoProduction>.Instance);
var generationBefore = generationRecorder.Requests.Count;
await Reject("native-tts without a TTS voice blocks the quote before any video provider request", () => unfittable.QuoteAsync(kit, fitClip, CancellationToken.None));
Check("unavailable fitting leaves generation untouched", generationRecorder.Requests.Count == generationBefore);
var fitProduction = new InterviewVideoProduction(nativeEngine, fitSpeech, scopes.GetRequiredService<IServiceScopeFactory>(), NullLogger<InterviewVideoProduction>.Instance);
var fitQuote = await fitProduction.QuoteAsync(kit, fitClip, CancellationToken.None);
var providerCalls = videoQuotes.Requests.Count;
fitMedia.SpeechStatus = HttpStatusCode.InternalServerError;
await Reject("a TTS failure stops native-tts before the paid render", () => fitProduction.RenderAsync(kit, fitClip, fitQuote.Id, CancellationToken.None));
Check("the voice is synthesized first, so the paid video is never requested when TTS fails", videoQuotes.Requests.Count == providerCalls && fitMedia.Calls[^1].Path.EndsWith("/audio/speech"));
fitMedia.SpeechStatus = HttpStatusCode.OK;
var paidRender = new InterviewVideoProduction(new PaidRenderEngine(), fitSpeech, scopes.GetRequiredService<IServiceScopeFactory>(), NullLogger<InterviewVideoProduction>.Instance);
var fittedClip = await paidRender.RenderAsync(kit, fitClip, "paid-quote", CancellationToken.None);
Check("a successful fit returns the fitted clip", Encoding.ASCII.GetString(fittedClip) == "mixed:/gw/media/fit-voice");
fitMedia.FitStatus = HttpStatusCode.UnprocessableEntity;
var keptClip = await paidRender.RenderAsync(kit, fitClip, "paid-quote", CancellationToken.None);
Check("a refused fit keeps the paid clip with the same TTS voice as a plain voice-over",
    Encoding.ASCII.GetString(keptClip) == "mixed:/gw/media/mix" && fitMedia.Calls[^2].Path.EndsWith("/fit-voice") && fitMedia.Calls[^1].Parts.SequenceEqual(["video", "audio"]));
fitMedia.FitStatus = HttpStatusCode.OK;

// Mixing runs the local FFmpeg only. A short line with sharp peaks used to keep its quiet level (loudnorm under 3 s).
var ffmpeg = Environment.GetEnvironmentVariable("INTERVIEW_FFMPEG") ?? Path.GetFullPath(".local/interview-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe");
if (File.Exists(ffmpeg))
{
    config.FfmpegPath = ffmpeg;
    var work = Directory.CreateTempSubdirectory("voice-mix-");
    string Run(params string[] arguments)
    {
        var start = new ProcessStartInfo(ffmpeg) { RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
        foreach (var argument in arguments) start.ArgumentList.Add(argument);
        using var process = Process.Start(start)!;
        var log = process.StandardError.ReadToEnd();
        process.WaitForExit();
        if (process.ExitCode != 0) throw new InvalidOperationException("ffmpeg failed: " + log);
        return log;
    }
    try
    {
        var clip = Path.Combine(work.FullName, "clip.mp4");
        Run("-y", "-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=15:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", clip);
        foreach (var (name, seconds) in new[] { ("short", "1.8"), ("long", "5") })
        {
            var voice = Path.Combine(work.FullName, name + ".wav");
            Run("-y", "-v", "error", "-f", "lavfi", "-i", $"aevalsrc=0.05*sin(2*PI*220*t)+0.75*lt(mod(t\\,0.6)\\,0.003)*sin(2*PI*2500*t):d={seconds}:s=24000", voice);
            var mixed = Path.Combine(work.FullName, name + ".mp4");
            await File.WriteAllBytesAsync(mixed, await service.MixAsync(await File.ReadAllBytesAsync(clip), await File.ReadAllBytesAsync(voice), CancellationToken.None));
            var loudness = double.Parse(Regex.Matches(Run("-hide_banner", "-i", mixed, "-af", "ebur128", "-f", "null", "-"), @"I:\s*(-?[\d.]+) LUFS")[^1].Groups[1].Value, CultureInfo.InvariantCulture);
            Check($"{name} line with sharp peaks is mixed at -14 LUFS ({loudness})", Math.Abs(loudness + 14) <= 1);
        }
    }
    finally { work.Delete(true); }
}
else Console.WriteLine("SKIP mixing loudness: set INTERVIEW_FFMPEG to an ffmpeg binary");

Console.WriteLine($"VOICE STABILITY CHECKS PASSED ({checks})");

sealed class RecordingHandler : HttpMessageHandler
{
    public List<JsonElement> Requests { get; } = [];
    public List<string> Paths { get; } = [];
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
    {
        using var parsed = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(token));
        Requests.Add(parsed.RootElement.Clone());
        Paths.Add(request.RequestUri!.AbsolutePath);
        // A minimal WAV signature is enough here; mixing/playback has its own integration checks.
        return new(HttpStatusCode.OK) { Content = new ByteArrayContent(Encoding.ASCII.GetBytes("RIFF0000WAVEtest-audio")) };
    }
}

sealed class MediaHandler : HttpMessageHandler
{
    public sealed record Call(string Path, string? Auth, List<string> Parts, string? VoiceId);
    public List<Call> Calls { get; } = [];
    public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;
    public bool ConversionReady { get; set; }
    public HttpStatusCode SpeechStatus { get; set; } = HttpStatusCode.OK;
    public HttpStatusCode FitStatus { get; set; } = HttpStatusCode.OK;
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
    {
        var parts = request.Content is MultipartFormDataContent form ? form.Select(p => p.Headers.ContentDisposition?.Name?.Trim('"') ?? "").ToList() : [];
        if (request.Content != null) await request.Content.ReadAsByteArrayAsync(token);
        var voicePart = request.Content is MultipartFormDataContent multipart ? multipart.FirstOrDefault(p => p.Headers.ContentDisposition?.Name?.Trim('"') == "voice") : null;
        Calls.Add(new(request.RequestUri!.AbsolutePath, request.Headers.Authorization?.ToString(), parts, voicePart == null ? null : await voicePart.ReadAsStringAsync(token)));
        if (request.RequestUri.AbsolutePath.EndsWith("/fit-voice") && FitStatus != HttpStatusCode.OK)
            return new(FitStatus) { Content = new StringContent("{}") };
        if (request.RequestUri.AbsolutePath.EndsWith("/audio/speech"))
            return new(SpeechStatus) { Content = new ByteArrayContent(Encoding.ASCII.GetBytes("RIFF0000WAVEtts-line")) };
        if (request.RequestUri.AbsolutePath.EndsWith("/voice-conversion/health"))
            return new(Status) { Content = new StringContent(JsonSerializer.Serialize(new { ready = ConversionReady, voices = new[] { new { id = "ruby_wav_clean", name = "Ruby" } } }), Encoding.UTF8, "application/json") };
        return new(Status) { Content = new ByteArrayContent(Encoding.ASCII.GetBytes("mixed:" + request.RequestUri.AbsolutePath)) };
    }
}

/// <summary>Stands in for a renderer whose quote was already approved and paid.</summary>
sealed class PaidRenderEngine : IInterviewEngine
{
    public bool CanRenderVideo => true;
    public Task<byte[]> RenderVideoAsync(string quoteId, CancellationToken cancellationToken) => Task.FromResult(Encoding.ASCII.GetBytes("paid-video"));
    public Task<IReadOnlyList<InterviewCreditAccount>> CreditAccountsAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
    public Task<InterviewCreditAllowance?> AllowanceAsync(int userId, CancellationToken token) => throw new NotSupportedException();
    public Task<List<InterviewScriptClip>> WriteScriptAsync(InterviewKit kit, string companyName, CancellationToken cancellationToken) => throw new NotSupportedException();
    public Task<InterviewAnswerResult> GradeAsync(InterviewKitQuestion question, string transcript, int passPercent, CancellationToken cancellationToken) => throw new NotSupportedException();
    public Task<InterviewVideoQuote> QuoteVideoAsync(InterviewKit kit, InterviewScriptClip clip, CancellationToken cancellationToken) => throw new NotSupportedException();
}

sealed class VideoQuoteHandler : HttpMessageHandler
{
    public List<JsonElement> Requests { get; } = [];
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
    {
        using var json = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(token));
        Requests.Add(json.RootElement.Clone());
        return new(HttpStatusCode.OK) { Content = new StringContent("{\"approval_token\":\"fake-provider-quote\",\"estimated_credits\":20}", Encoding.UTF8, "application/json") };
    }
}
sealed class QuoteFactory(VideoQuoteHandler handler) : IHttpClientFactory
{
    private readonly HttpClient client = new(handler, disposeHandler: false);
    public HttpClient CreateClient(string name) => client;
}

sealed class MediaFactory(MediaHandler handler) : IHttpClientFactory
{
    private readonly HttpClient client = new(handler, disposeHandler: false);
    public HttpClient CreateClient(string name) => client;
}

sealed class RecordingFactory(RecordingHandler handler) : IHttpClientFactory
{
    private readonly HttpClient client = new(handler, disposeHandler: false);
    public HttpClient CreateClient(string name) => client;
}

sealed class FixedOptions(InterviewEngineOptions value) : IOptionsMonitor<InterviewEngineOptions>
{
    public InterviewEngineOptions CurrentValue => value;
    public InterviewEngineOptions Get(string? name) => value;
    public IDisposable? OnChange(Action<InterviewEngineOptions, string?> listener) => null;
}
