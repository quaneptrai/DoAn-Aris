using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;

namespace ArisSkyve.Controllers;

public sealed partial class EmployerInterviewFlowController
{
    public sealed class AvatarQuoteRequest
    {
        public string? Prompt { get; set; }
        public bool UseCurrentAvatar { get; set; }
    }

    [HttpPost("{id:int}/Avatar/Quote")]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(5_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 5_000_000)]
    public async Task<IActionResult> QuoteAvatar(int id, [FromForm] AvatarQuoteRequest request, IFormFile? reference, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var kit = await KitAsync(id, business.Id, cancellationToken);
        if (kit == null) return NotFound();
        if (jobs.IsBusy(id)) return Json(new { ok = false, error = "Đang tạo ảnh hoặc video. Chờ tạo xong rồi thử lại." });
        try
        {
            InterviewAvatarEngine.Image? image = null;
            if (reference is { Length: > 0 })
            {
                var validation = await PublicMediaValidator.ValidateImageAsync(reference, InterviewAvatarEngine.MaximumBytes, cancellationToken);
                if (!validation.IsValid) return Json(new { ok = false, error = validation.Error });
                using var buffer = new MemoryStream();
                await reference.CopyToAsync(buffer, cancellationToken);
                image = await InterviewAvatarEngine.ValidateAsync(buffer.ToArray(), cancellationToken);
            }
            else if (request.UseCurrentAvatar && kit.AvatarImage is { Length: > 0 })
                image = await InterviewAvatarEngine.ValidateAsync(kit.AvatarImage, cancellationToken);
            else if (request.UseCurrentAvatar)
                return Json(new { ok = false, error = "Bộ này chưa có ảnh nhân vật. Lưu avatar mặc định hoặc tải ảnh lên trước." });
            var quote = await avatars.QuoteAsync(request.Prompt ?? "", image, cancellationToken, business.UserId);
            jobs.RememberQuote(quote.Id, new InterviewVideoJobs.Approval(business.Id, id, InterviewVideoJobs.AvatarKind, null, kit.UpdatedAtUtc.Ticks));
            return Json(new { ok = true, quoteId = quote.Id, cost = quote.Cost });
        }
        catch (InterviewEngineException exception) { return Json(new { ok = false, error = exception.Message }); }
    }

    [HttpPost("{id:int}/Avatar/Render")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RenderAvatar(int id, [FromBody] SlotRequest request, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        if (string.IsNullOrWhiteSpace(request.QuoteId)) return Json(new { ok = false, error = "Thiếu báo giá avatar." });
        var job = jobs.Start(business.Id, request.QuoteId, id, InterviewVideoJobs.AvatarKind);
        return job == null ? Json(new { ok = false, error = "Báo giá avatar không còn hiệu lực hoặc đang có ảnh/video được tạo. Xem lại chi phí trước khi tạo." })
            : Json(new { ok = true, jobId = job.Id });
    }
}
