using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Services;

public sealed class InterviewRecordingStore(ArisDBContext context, InterviewSpeech speech)
{
    public static async Task<byte[]> UploadAsync(IFormFile? file, CancellationToken token)
    {
        if (file == null || file.Length <= 0 || file.Length > 10 * 1024 * 1024) throw new InterviewEngineException("Âm thanh cần có dữ liệu và tối đa 10 MB.");
        using var buffer = new MemoryStream(); await file.CopyToAsync(buffer, token); var bytes = buffer.ToArray(); InterviewSpeech.AudioType(bytes); return bytes;
    }
    public async Task<object> SaveAsync(InterviewKit kit, InterviewKitSession session, int questionId, IFormFile file, bool transcribe, CancellationToken token)
    {
        if (session.CompletedAtUtc != null || !kit.Questions.Any(q => q.Id == questionId)) throw new InterviewEngineException("Buổi phỏng vấn đã kết thúc hoặc câu hỏi không hợp lệ.");
        var recording = await context.InterviewKitRecordings.Where(r => r.SessionId == session.Id && r.QuestionId == questionId).OrderByDescending(r => r.Id).FirstOrDefaultAsync(token);
        var bytes = await UploadAsync(file, token);
        if (recording == null || !recording.Bytes.AsSpan().SequenceEqual(bytes)) { recording = new InterviewKitRecording { SessionId = session.Id, QuestionId = questionId }; context.InterviewKitRecordings.Add(recording); }
        (recording.Bytes, recording.ContentType) = (bytes, InterviewSpeech.AudioType(bytes).Type);
        await context.SaveChangesAsync(token);
        var text = ""; string? error = null;
        if (transcribe) try { text = await speech.TranscribeAsync(bytes, token); } catch (InterviewEngineException e) { error = e.Message; }
        return new { ok = true, recordingId = recording.Id, transcript = text, transcriptionError = error };
    }
}
