using System.Globalization;
using System.Text;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Controllers;

public sealed partial class EmployerInterviewFlowController
{
    [HttpGet("Credits")]
    public async Task<IActionResult> Credits(CancellationToken token)
    {
        var business = await BusinessAsync(token); if (business == null) return Forbid();
        try
        {
            var accounts = await engine.CreditAccountsAsync(token);
            var allowance = await engine.AllowanceAsync(business.UserId, token);
            return Json(new { ok = true, accounts, total = accounts.Sum(a => (long)a.Credits), allowance });
        }
        catch (InterviewEngineException e) { return Json(new { ok = false, error = e.Message }); }
    }
    [HttpGet("Voices")]
    public async Task<IActionResult> Voices(CancellationToken token)
    {
        if (await BusinessAsync(token) == null) return Forbid();
        try { return Json(new { ok = true, voices = await speech.VoicesAsync(token) }); }
        catch (InterviewEngineException e) { return Json(new { ok = false, error = e.Message }); }
    }
    public sealed class VoiceSampleRequest
    {
        public string VoiceId { get; set; } = "";
        public double Speed { get; set; } = 1;
        public double Pitch { get; set; } = 1;
        public string Text { get; set; } = "Xin chào, chúc bạn có một buổi phỏng vấn thật tự tin.";
        public string PronunciationOverrides { get; set; } = "";
    }
    [HttpPost("Voices/Sample")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> VoiceSample([FromBody] VoiceSampleRequest request, CancellationToken token)
    {
        if (await BusinessAsync(token) == null) return Forbid();
        var settings = new InterviewProductionSettings { NarrationMode = "tts", VoiceId = request.VoiceId, Speed = request.Speed, Pitch = request.Pitch, PronunciationOverrides = request.PronunciationOverrides };
        if (settings.Validate() is string error) return BadRequest(new { error });
        if (string.IsNullOrWhiteSpace(request.Text) || request.Text.Length > 2400) return BadRequest(new { error = "Lời nghe thử cần từ 1 đến 2.400 ký tự." });
        try
        {
            var audio = await speech.SpeakAsync(request.Text, settings, token);
            return File(audio, InterviewSpeech.AudioType(audio).Type);
        }
        catch (InterviewEngineException e) { return BadRequest(new { error = e.Message }); }
    }
    [HttpPost("Voices/Clone")]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(11_000_000)]
    public async Task<IActionResult> CloneVoice(string name, string? refText, IFormFile audio, CancellationToken token)
    {
        if (await BusinessAsync(token) == null) return Forbid();
        try { return Json(new { ok = true, voice = await speech.CloneAsync(name, refText, await InterviewRecordingStore.UploadAsync(audio, token), token) }); }
        catch (InterviewEngineException e) { return Json(new { ok = false, error = e.Message }); }
    }
    [HttpPost("{id:int}/Try/Recording")]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(11_000_000)]
    public async Task<IActionResult> TryRecording(int id, int sessionId, int questionId, bool transcribe, IFormFile audio, [FromServices] InterviewRecordingStore recordings, CancellationToken token)
    {
        var business = await BusinessAsync(token); if (business == null) return Forbid();
        var kit = await KitAsync(id, business.Id, token);
        var session = kit == null ? null : await sessions.FindAsync(id, sessionId, business.UserId, token);
        if (kit == null || session == null) return NotFound();
        try { return Json(await recordings.SaveAsync(kit, session, questionId, audio, transcribe, token)); }
        catch (InterviewEngineException e) { return BadRequest(new { error = e.Message }); }
    }
    [HttpGet("{id:int}/Recordings/{recordingId:int}")]
    public async Task<IActionResult> Recording(int id, int recordingId, CancellationToken token)
    {
        var business = await BusinessAsync(token); if (business == null) return Forbid();
        var recording = await context.InterviewKitRecordings.AsNoTracking().FirstOrDefaultAsync(r => r.Id == recordingId && r.Session.KitId == id && r.Session.Kit.BusinessAccountId == business.Id, token);
        return recording == null ? NotFound() : File(recording.Bytes, recording.ContentType, enableRangeProcessing: true);
    }
    [HttpPost("{id:int}/Results/Regrade")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Regrade(int id, [FromBody] AnswerRequest request, CancellationToken token)
    {
        var business = await BusinessAsync(token); if (business == null) return Forbid();
        var kit = await KitAsync(id, business.Id, token);
        var run = kit == null ? null : await context.InterviewKitSessions.FirstOrDefaultAsync(s => s.Id == request.SessionId && s.KitId == id, token);
        if (kit == null || run == null) return NotFound();
        if (run.CompletedAtUtc == null) return BadRequest(new { error = "Chờ buổi phỏng vấn kết thúc trước khi chấm lại." });
        var answers = InterviewJson.Answers(run.AnswersJson);
        var old = answers.FirstOrDefault(a => a.QuestionId == request.QuestionId); var question = kit.Questions.FirstOrDefault(q => q.Id == request.QuestionId);
        if (old == null || question == null) return NotFound();
        var result = await engine.GradeAsync(question, old.Transcript, kit.PassPercent, token);
        answers.Remove(old); answers.Add(result with { RecordingId = old.RecordingId, RecordingIds = old.RecordingIds, Attempts = old.Attempts, Supplements = old.Supplements });
        run.AnswersJson = InterviewJson.Write(answers); run.Score = InterviewProductionSettings.TotalScore(kit, answers); await context.SaveChangesAsync(token);
        return Json(new { ok = true });
    }
    [HttpGet("{id:int}/Results/Export")]
    public async Task<IActionResult> ExportResults(int id, string format, CancellationToken token)
    {
        var business = await BusinessAsync(token); if (business == null) return Forbid(); var kit = await KitAsync(id, business.Id, token); if (kit == null) return NotFound();
        var runs = await context.InterviewKitSessions.AsNoTracking().Where(s => s.KitId == id).Include(s => s.User).OrderBy(s => s.StartedAtUtc).ToListAsync(token);
        if (format == "json") return File(Encoding.UTF8.GetBytes(InterviewJson.Write(new { title = kit.Title, questions = kit.Questions.OrderBy(q => q.Position).Select(q => new { q.Code, q.Question, q.AnswerKey, q.KeyPoints, q.Weight, q.PointWeights }), sessions = runs.Select(s => new { s.Id, candidate = s.User.Email, s.IsEmployerTest, s.StartedAtUtc, s.CompletedAtUtc, s.Score, answers = InterviewJson.Answers(s.AnswersJson) }) })), "application/json", $"interview-{id}-results.json");
        if (format != "csv") return BadRequest();
        static string Cell(string? value) { value ??= ""; if (value.TrimStart().StartsWith('=') || value.TrimStart().StartsWith('+') || value.TrimStart().StartsWith('-') || value.TrimStart().StartsWith('@')) value = "'" + value; return "\"" + value.Replace("\"", "\"\"") + "\""; }
        var csv = new StringBuilder("\uFEFFsession,email,test,question_code,question,transcript,score,status,feedback,point_results\r\n");
        foreach (var run in runs) foreach (var answer in InterviewJson.Answers(run.AnswersJson))
        {
            var q = kit.Questions.FirstOrDefault(q => q.Id == answer.QuestionId);
            csv.AppendLine(string.Join(',', new[] { run.Id.ToString(), run.User.Email, run.IsEmployerTest.ToString(), q?.Code, q?.Question, answer.Transcript, answer.Score.ToString(CultureInfo.InvariantCulture), answer.Score >= 100 ? "Đúng" : answer.Score > 0 ? "Một phần" : "Sai", answer.Feedback, InterviewJson.Write(answer.Points) }.Select(Cell)));
        }
        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv; charset=utf-8", $"interview-{id}-results.csv");
    }
    [HttpPost("{id:int}/Videos/Demo")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Demo(int id, CancellationToken token)
    {
        var business = await BusinessAsync(token); if (business == null) return Forbid(); var kit = await KitAsync(id, business.Id, token); if (kit == null) return NotFound();
        try
        {
            await speech.EnsureMixerAsync(token); var clips = new List<byte[]>();
            foreach (var clip in InterviewJson.Script(kit.ScriptJson).Where(c => c.Kind is "intro" or "question" or "outro"))
            {
                var video = kit.Videos.FirstOrDefault(v => v.Kind == clip.Kind && v.QuestionId == clip.QuestionId) ?? throw new InterviewEngineException("Tạo hoặc tải đủ video mở đầu, câu hỏi và kết thúc trước khi xuất demo.");
                clips.Add(await store.ReadVideoAsync(video, token));
            }
            if (clips.Count == 0) throw new InterviewEngineException("Bộ này chưa có kịch bản/video để xuất demo.");
            return File(await speech.DemoAsync(clips, token), "video/mp4", $"interview-{id}-demo.mp4");
        }
        catch (InterviewEngineException e) { return BadRequest(new { error = e.Message }); }
    }
}
