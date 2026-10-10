using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Controllers;

public sealed partial class InterviewKitController
{
    [HttpPost("{code}/Recording")]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(11_000_000)]
    public async Task<IActionResult> Recording(string code, int sessionId, int questionId, bool transcribe, IFormFile audio, [FromServices] InterviewRecordingStore recordings, CancellationToken token)
    {
        if (UserId is not int userId) return Challenge(); var kit = await KitAsync(code, token);
        var session = kit == null ? null : await sessions.FindAsync(kit.Id, sessionId, userId, token);
        if (kit == null || session == null) return NotFound();
        try { return Json(await recordings.SaveAsync(kit, session, questionId, audio, transcribe, token)); }
        catch (InterviewEngineException e) { return BadRequest(new { error = e.Message }); }
    }
}
