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
    public sealed record Call(string Path, string? Auth, List<string> Parts);
    public List<Call> Calls { get; } = [];
    public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
    {
        var parts = request.Content is MultipartFormDataContent form ? form.Select(p => p.Headers.ContentDisposition?.Name?.Trim('"') ?? "").ToList() : [];
        if (request.Content != null) await request.Content.ReadAsByteArrayAsync(token);
        Calls.Add(new(request.RequestUri!.AbsolutePath, request.Headers.Authorization?.ToString(), parts));
        return new(Status) { Content = new ByteArrayContent(Encoding.ASCII.GetBytes("mixed:" + request.RequestUri.AbsolutePath)) };
    }
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
