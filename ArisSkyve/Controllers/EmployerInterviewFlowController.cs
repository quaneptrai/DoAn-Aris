using System.Security.Claims;
using System.Security.Cryptography;
using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Controllers;

/// <summary>
/// Employer side of the video interview, entirely on Aris: interview parameters,
/// the script, the clips (made automatically, uploaded, or imported from a studio
/// package), the candidate link and the results. Work that needs outside services
/// goes through <see cref="IInterviewEngine"/>; nothing here names those services.
/// </summary>
// The auth cookie carries no role claim; BusinessAsync checks Users.Role in the DB instead.
[Authorize]
[Route("Employer/InterviewFlow")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed partial class EmployerInterviewFlowController(
    ArisDBContext context,
    InterviewKitStore store,
    IInterviewEngine engine,
    InterviewAvatarEngine avatars,
    InterviewVideoProduction production,
    InterviewSpeech speech,
    InterviewVideoJobs jobs,
    InterviewSessions sessions) : Controller
{
    public const int MaxQuestions = 200;
    private const long MaxAvatarBytes = 4 * 1024 * 1024;

    private async Task<BussinessAccount?> BusinessAsync(CancellationToken cancellationToken)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return null;
        return await context.BussinessAccounts.AsNoTracking().Include(b => b.User)
            .FirstOrDefaultAsync(b => b.UserId == id && (b.User.Role == "Business" || b.User.Role == "Admin"), cancellationToken);
    }

    private Task<InterviewKit?> KitAsync(int id, int businessId, CancellationToken cancellationToken) =>
        context.InterviewKits
            .AsSplitQuery()
            .Include(k => k.BusinessAccount).ThenInclude(b => b.User)
            .Include(k => k.Questions)
            .Include(k => k.Videos)
            .FirstOrDefaultAsync(k => k.Id == id && k.BusinessAccountId == businessId, cancellationToken);

    // ---------- kits ----------

    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return RedirectToAction("BecomeEmployer", "Account");
        return View("~/Views/Employer/InterviewFlow.cshtml", new InterviewFlowIndexViewModel
        {
            CompanyName = business.CompanyName,
            Error = TempData["InterviewFlowError"] as string,
            Kits = await context.InterviewKits.AsNoTracking()
                .Where(k => k.BusinessAccountId == business.Id)
                .OrderByDescending(k => k.UpdatedAtUtc)
                .Select(k => new InterviewKitSummary
                {
                    Id = k.Id,
                    Title = k.Title,
                    QuestionCount = k.Questions.Count,
                    VideoCount = k.Videos.Count,
                    SessionCount = k.Sessions.Count(s => !s.IsEmployerTest),
                    InviteOpen = k.InviteCode != null,
                    UpdatedAtUtc = k.UpdatedAtUtc
                })
                .ToListAsync(cancellationToken)
        });
    }

    [HttpGet("New")]
    public async Task<IActionResult> New(CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return RedirectToAction("BecomeEmployer", "Account");
        var form = new InterviewKitForm
        {
            Persona = $"Nhân vật hoạt hình trong ảnh đại diện {business.CompanyName}: giữ nguyên khuôn mặt, trang phục và phong cách minh họa của ảnh, thân thiện, chuyên nghiệp, nói tiếng Việt rõ ràng.",
            UseDefaultAvatar = true,
            Production = new InterviewProductionSettings { CreditMode = "pool" },
            Questions = { new InterviewQuestionForm() }
        };
        return View("~/Views/Employer/InterviewKit.cshtml", new InterviewKitEditViewModel
        {
            CompanyName = business.CompanyName,
            Form = form,
            CanRenderVideo = engine.CanRenderVideo,
            CanRenderAvatar = avatars.CanRender,
            CanSpeak = speech.CanSpeak,
            AvatarDataUrl = InterviewAvatarEngine.DefaultUrl
        });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Edit(int id, string? batch, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return RedirectToAction("BecomeEmployer", "Account");
        var kit = await KitAsync(id, business.Id, cancellationToken);
        if (kit == null) return NotFound();
        var error = TempData["InterviewFlowError"] as string;
        // A finished batch reports how it ended once the page reloads.
        if (batch != null && jobs.GetBatch(batch, business.Id) is { KitId: var batchKit } finished && batchKit == kit.Id && finished.State != "running" && finished.State != "pending")
        {
            if (finished.State is "succeeded" or "stopped") TempData["InterviewFlowSaved"] = finished.Message;
            else error ??= finished.Message;
        }
        return await EditViewAsync(business, kit, FormOf(kit), error, cancellationToken);
    }

    [HttpPost("Save")]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(8_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 8_000_000, ValueCountLimit = 6000)]
    public async Task<IActionResult> Save(InterviewKitForm form, IFormFile? avatar, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();

        form.Questions = form.Questions.Where(q => !string.IsNullOrWhiteSpace(q.Question)).ToList();
        InterviewKit? kit = null;
        if (form.Id is int existingId)
        {
            kit = await KitAsync(existingId, business.Id, cancellationToken);
            if (kit == null) return NotFound();
            if (jobs.IsBusy(kit.Id))
                return await EditViewAsync(business, kit, form, "Đang tạo ảnh hoặc video. Chờ tạo xong rồi lưu tham số.", cancellationToken);
        }

        var error = string.IsNullOrWhiteSpace(form.Title) ? "Vui lòng đặt tên cho bộ phỏng vấn."
            : form.Questions.Count == 0 ? "Thêm ít nhất một câu hỏi."
            : form.Questions.Count > MaxQuestions ? $"Tối đa {MaxQuestions} câu hỏi cho một bộ."
            : form.Questions.Any(q => string.IsNullOrWhiteSpace(q.AnswerKey)) ? "Mỗi câu hỏi cần đáp án đúng để chấm điểm."
            : null;
        error ??= ModelState.IsValid ? form.Production.Validate() : "Một số tham số không hợp lệ. Kiểm tra giá trị đã nhập.";
        if (error == null && form.Production.NarrationMode == "tts" && !speech.CanSpeak) error = "Giọng đọc TTS chưa được bật trên hệ thống.";
        if (error == null && form.Questions.Any(q => !double.IsFinite(q.Weight) || q.Weight <= 0 || q.Weight > 1000)) error = "Trọng số câu phải lớn hơn 0 và không quá 1.000.";
        if (error == null && form.Questions.Select(q => q.Code?.Trim()).Where(c => !string.IsNullOrEmpty(c)).GroupBy(c => c).Any(g => g.Count() > 1)) error = "Mã câu hỏi bị trùng.";
        if (error == null && form.Questions.Any(q => (q.Code?.Length ?? 0) > 80 || (q.PointWeights?.Length ?? 0) > 2000 || (q.Question?.Length ?? 0) > 2000 || (q.AnswerKey?.Length ?? 0) > 4000 || (q.KeyPoints?.Length ?? 0) > 2000)) error = "Nội dung câu hỏi/đáp án hoặc trọng số quá dài.";
        if (error == null && form.Questions.Any(q => !ValidPointWeights(q.PointWeights, q.KeyPoints))) error = "Trọng số từng ý cần cùng số lượng với ý chính, ngăn cách bằng ; và mỗi số lớn hơn 0, không quá 1.000.";
        byte[]? avatarBytes = null;
        string? avatarType = null;
        if (error == null && avatar is { Length: > 0 })
        {
            var validation = await PublicMediaValidator.ValidateImageAsync(avatar, MaxAvatarBytes, cancellationToken);
            if (!validation.IsValid || validation.Media == null) error = validation.Error ?? "Ảnh nhân vật phải là JPEG, PNG hoặc WEBP, tối đa 4 MB.";
            else
            {
                using var buffer = new MemoryStream();
                await avatar.CopyToAsync(buffer, cancellationToken);
                (avatarBytes, avatarType) = (buffer.ToArray(), validation.Media.ContentType);
            }
        }
        if (error != null)
        {
            if (kit == null)
                return View("~/Views/Employer/InterviewKit.cshtml", new InterviewKitEditViewModel { CompanyName = business.CompanyName, Form = form, CanRenderVideo = engine.CanRenderVideo, CanRenderAvatar = avatars.CanRender, CanSpeak = speech.CanSpeak, AvatarDataUrl = form.RemoveAvatar ? null : InterviewAvatarEngine.DefaultUrl, Error = error });
            return await EditViewAsync(business, kit, form, error, cancellationToken);
        }

        var isNew = kit == null;
        if (kit == null)
        {
            kit = new InterviewKit { BusinessAccountId = business.Id };
            context.InterviewKits.Add(kit);
        }
        kit.Title = Clip(form.Title, 200)!;
        if (avatarBytes == null && (form.UseDefaultAvatar || (isNew && !form.RemoveAvatar)))
        {
            var image = await avatars.DefaultAsync(cancellationToken);
            (avatarBytes, avatarType) = (image.Bytes, image.ContentType);
        }
        var avatarChanged = avatarBytes != null
            ? kit.AvatarImage == null || !kit.AvatarImage.AsSpan().SequenceEqual(avatarBytes)
            : form.RemoveAvatar && kit.AvatarImage != null;
        var visualChanged = kit.Persona != Clip(form.Persona, 2000) || kit.Scene != Clip(form.Scene, 1000) || avatarChanged;
        var oldProduction = InterviewProductionSettings.Of(kit);
        var settingsJson = InterviewJson.Write(form.Production);
        if (kit.SettingsJson != settingsJson) kit.ScriptApprovedAtUtc = null;
        if (visualChanged || oldProduction.VisualMode != form.Production.VisualMode || oldProduction.Quality != form.Production.Quality)
        {
            var bases = kit.Videos.Where(v => InterviewKitVideo.BaseKinds.Contains(v.Kind)).ToList();
            await store.DeleteVideosAsync(bases, cancellationToken);
            foreach (var item in bases) kit.Videos.Remove(item);
        }
        kit.SettingsJson = settingsJson;
        kit.Persona = Clip(form.Persona, 2000);
        kit.Scene = Clip(form.Scene, 1000);
        kit.PassPercent = Math.Clamp(form.PassPercent, 10, 100);
        if (avatarBytes != null) (kit.AvatarImage, kit.AvatarContentType) = (avatarBytes, avatarType);
        else if (form.RemoveAvatar) (kit.AvatarImage, kit.AvatarContentType) = (null, null);
        if (visualChanged) kit.ScriptApprovedAtUtc = null;
        kit.UpdatedAtUtc = DateTime.UtcNow;

        var keptIds = form.Questions.Where(q => q.Id.HasValue).Select(q => q.Id!.Value).ToHashSet();
        var removed = kit.Questions.Where(q => !keptIds.Contains(q.Id)).ToList();
        if (removed.Count > 0)
        {
            var removedIds = removed.Select(q => q.Id).ToList();
            await store.DeleteVideosAsync(kit.Videos.Where(v => v.QuestionId != null && removedIds.Contains(v.QuestionId.Value)).ToList(), cancellationToken);
            context.InterviewKitQuestions.RemoveRange(removed);
            foreach (var question in removed) kit.Questions.Remove(question);
        }
        for (var index = 0; index < form.Questions.Count; index++)
        {
            var input = form.Questions[index];
            var question = input.Id is int questionId ? kit.Questions.FirstOrDefault(q => q.Id == questionId) : null;
            if (question == null)
            {
                question = new InterviewKitQuestion();
                kit.Questions.Add(question);
            }
            question.Position = index + 1;
            question.Question = Clip(input.Question, 2000)!;
            question.AnswerKey = Clip(input.AnswerKey, 4000);
            question.KeyPoints = Clip(input.KeyPoints, 2000);
            question.Code = Clip(input.Code, 80) ?? $"q{index + 1}";
            question.Weight = input.Weight;
            question.PointWeights = Clip(input.PointWeights, 2000);
            question.PrepSeconds = Math.Clamp(input.PrepSeconds, 0, 120);
            question.AnswerSeconds = Math.Clamp(input.AnswerSeconds, 15, 600);
            question.Retakes = Math.Clamp(input.Retakes, 0, 3);
        }

        await context.SaveChangesAsync(cancellationToken);
        SyncScript(kit);
        await context.SaveChangesAsync(cancellationToken);
        TempData["InterviewFlowSaved"] = "Đã lưu bộ phỏng vấn.";
        return RedirectToAction(nameof(Edit), new { id = kit.Id });
    }

    [HttpPost("{id:int}/Delete")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var kit = await KitAsync(id, business.Id, cancellationToken);
        if (kit == null) return NotFound();
        await store.DeleteVideosAsync(kit.Videos.ToList(), cancellationToken);
        context.InterviewKits.Remove(kit);
        await context.SaveChangesAsync(cancellationToken);
        return RedirectToAction(nameof(Index));
    }

    // ---------- script ----------

    [HttpPost("{id:int}/Script/Write")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> WriteScript(int id, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var kit = await KitAsync(id, business.Id, cancellationToken);
        if (kit == null) return NotFound();
        if (jobs.IsBusy(id)) return Conflict(new { error = "Đang tạo ảnh hoặc video. Chờ tạo xong rồi sửa kịch bản." });
        try
        {
            var script = await engine.WriteScriptAsync(kit, business.CompanyName, cancellationToken);
            kit.ScriptJson = InterviewJson.Write(script);
            kit.ScriptApprovedAtUtc = null;
            kit.UpdatedAtUtc = DateTime.UtcNow;
            await context.SaveChangesAsync(cancellationToken);
            return Json(new { ok = true });
        }
        catch (InterviewEngineException exception)
        {
            return Json(new { ok = false, error = exception.Message });
        }
    }

    public sealed class ScriptLineForm
    {
        public string? Kind { get; set; }
        public int? QuestionId { get; set; }
        public string? Line { get; set; }
    }

    [HttpPost("{id:int}/Script/Save")]
    [ValidateAntiForgeryToken]
    [RequestFormLimits(ValueCountLimit = 2000)]
    public async Task<IActionResult> SaveScript(int id, List<ScriptLineForm> lines, bool approve, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var kit = await KitAsync(id, business.Id, cancellationToken);
        if (kit == null) return NotFound();
        if (jobs.IsBusy(id)) return Conflict(new { error = "Đang tạo ảnh hoặc video. Chờ tạo xong rồi sửa kịch bản." });

        var current = InterviewJson.Script(kit.ScriptJson);
        // The employer can author the first script without requesting an AI rewrite.
        if (current.Count == 0)
        {
            current.Add(InterviewEngine.Clip(kit, "intro", null, ""));
            current.AddRange(kit.Questions.OrderBy(q => q.Position).Select(q => InterviewEngine.Clip(kit, "question", q.Id, q.Question)));
            current.Add(InterviewEngine.Clip(kit, "transition", null, ""));
            current.AddRange(InterviewKitVideo.SilentKinds.Select(kind => InterviewEngine.Clip(kit, kind, null, "")));
            current.Add(InterviewEngine.Clip(kit, "outro", null, ""));
        }
        var updated = current.Select(clip =>
        {
            var input = lines.FirstOrDefault(l => l.Kind == clip.Kind && l.QuestionId == clip.QuestionId);
            return InterviewEngine.Clip(kit, clip.Kind, clip.QuestionId, Clip(input?.Line, 2400) ?? clip.Line);
        }).ToList();
        if (approve && updated.Any(c => !InterviewKitVideo.SilentKinds.Contains(c.Kind) && string.IsNullOrWhiteSpace(c.Line)))
        {
            TempData["InterviewFlowError"] = "Mỗi đoạn có lời thoại cần nội dung trước khi duyệt.";
            return Redirect(Url.Action(nameof(Edit), new { id }) + "#script");
        }
        kit.ScriptJson = InterviewJson.Write(updated);
        kit.ScriptApprovedAtUtc = approve ? DateTime.UtcNow : null;
        kit.UpdatedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        TempData["InterviewFlowSaved"] = approve ? "Đã duyệt kịch bản." : "Đã lưu kịch bản (chưa duyệt).";
        return Redirect(Url.Action(nameof(Edit), new { id }) + "#script");
    }

    // ---------- clips ----------

    [HttpPost("{id:int}/Videos/Upload")]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(60_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 60_000_000)]
    public async Task<IActionResult> UploadVideo(int id, string? kind, int? questionId, IFormFile? file, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var kit = await KitAsync(id, business.Id, cancellationToken);
        if (kit == null) return NotFound();
        if (jobs.IsBusy(id)) return Conflict(new { error = "Đang tạo ảnh hoặc video. Chờ tạo xong rồi tải video lên." });
        var slotError = SlotError(kit, ref kind, ref questionId);
        if (slotError == null && file is not { Length: > 0 }) slotError = "Chọn một file video.";
        if (slotError == null)
        {
            try
            {
                var (_, error) = await store.SaveVideoAsync(kit, questionId, kind!, file!, "upload", cancellationToken);
                slotError = error;
            }
            catch (PublicMediaStorageException) { slotError = "Không lưu được video vào kho. Thử lại sau."; }
        }
        if (slotError != null) TempData["InterviewFlowError"] = slotError;
        else TempData["InterviewFlowSaved"] = "Đã tải video lên.";
        return Redirect(Url.Action(nameof(Edit), new { id }) + "#videos");
    }

    public sealed class SlotRequest
    {
        public string? Kind { get; set; }
        public int? QuestionId { get; set; }
        public string? QuoteId { get; set; }
    }

    [HttpPost("{id:int}/Videos/Quote")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> QuoteVideo(int id, [FromBody] SlotRequest request, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var kit = await KitAsync(id, business.Id, cancellationToken);
        if (kit == null) return NotFound();
        var kind = request.Kind;
        var questionId = request.QuestionId;
        var error = SlotError(kit, ref kind, ref questionId);
        if (error != null) return Json(new { ok = false, error });
        if (kit.ScriptApprovedAtUtc == null) return Json(new { ok = false, error = "Duyệt kịch bản trước khi tạo video." });
        var clip = InterviewVideoProduction.Find(kit, kind, questionId);
        if (clip == null) return Json(new { ok = false, error = "Kịch bản chưa có đoạn này. Viết lại kịch bản rồi duyệt." });
        try
        {
            var quote = await production.QuoteAsync(kit, clip, cancellationToken);
            jobs.RememberQuote(quote.Id, new InterviewVideoJobs.Approval(business.Id, kit.Id, kind!, questionId, kit.UpdatedAtUtc.Ticks));
            return Json(new { ok = true, quoteId = quote.Id, cost = quote.Cost });
        }
        catch (InterviewEngineException exception)
        {
            return Json(new { ok = false, error = exception.Message });
        }
    }

    [HttpPost("{id:int}/Videos/Render")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RenderVideo(int id, [FromBody] SlotRequest request, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        if (string.IsNullOrWhiteSpace(request.QuoteId)) return Json(new { ok = false, error = "Thiếu báo giá." });
        var job = jobs.Start(business.Id, request.QuoteId, id);
        return job == null
            ? Json(new { ok = false, error = "Báo giá không còn hiệu lực, hoặc đang có video khác được tạo." })
            : Json(new { ok = true, jobId = job.Id });
    }

    public sealed class BatchRequest
    {
        public bool ReplaceExisting { get; set; }
        public string? BatchId { get; set; }
    }

    /// <summary>Prices every clip still missing (or all of them) for one approval.</summary>
    [HttpPost("{id:int}/Videos/QuoteAll")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> QuoteAllVideos(int id, [FromBody] BatchRequest request, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var kit = await KitAsync(id, business.Id, cancellationToken);
        if (kit == null) return NotFound();
        if (!engine.CanRenderVideo) return Json(new { ok = false, error = "Tạo video tự động chưa được bật trên hệ thống." });
        if (kit.ScriptApprovedAtUtc == null) return Json(new { ok = false, error = "Duyệt kịch bản trước khi tạo video." });
        if (jobs.IsBusy(kit.Id)) return Json(new { ok = false, error = "Đang có video được tạo. Chờ xong rồi thử lại." });

        var filled = kit.Videos.Select(v => (v.Kind, v.QuestionId)).ToHashSet();
        var targets = InterviewVideoProduction.Targets(kit, request.ReplaceExisting).ToList();
        if (targets.Count == 0) return Json(new { ok = false, error = "Mọi ô đã có video." });

        var ordered = kit.Questions.OrderBy(q => q.Position).ToList();
        var costs = new int?[targets.Count];
        using var gate = new SemaphoreSlim(3);
        try
        {
            await Task.WhenAll(targets.Select(async (clip, index) =>
            {
                await gate.WaitAsync(cancellationToken);
                try { costs[index] = (await production.QuoteAsync(kit, clip, cancellationToken)).Cost; }
                finally { gate.Release(); }
            }));
        }
        catch (InterviewEngineException exception)
        {
            return Json(new { ok = false, error = exception.Message });
        }
        var slots = targets.Select((clip, index) => new InterviewVideoJobs.BatchSlot(clip.Kind, clip.QuestionId, SlotLabel(clip.Kind, clip.QuestionId, ordered), costs[index])).ToList();
        var batch = jobs.CreateBatch(business.Id, kit.Id, slots, InterviewVideoProduction.Revision(kit));
        return Json(new
        {
            ok = true,
            batchId = batch.Id,
            count = slots.Count,
            total = batch.TotalCost,
            items = slots.Select(s => new { label = s.Label, cost = s.Cost })
        });
    }

    [HttpPost("{id:int}/Videos/RenderAll")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RenderAllVideos(int id, [FromBody] BatchRequest request, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        if (string.IsNullOrWhiteSpace(request.BatchId) || jobs.GetBatch(request.BatchId, business.Id)?.KitId != id)
            return Json(new { ok = false, error = "Không tìm thấy báo giá." });
        var batch = jobs.StartBatch(business.Id, request.BatchId);
        return batch == null
            ? Json(new { ok = false, error = "Báo giá đã hết hạn hoặc đang có video được tạo. Bấm tạo lại để xem chi phí mới." })
            : Json(new { ok = true, batchId = batch.Id });
    }

    [HttpGet("Batches/{batchId}")]
    public async Task<IActionResult> BatchStatus(string batchId, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var batch = jobs.GetBatch(batchId, business.Id);
        if (batch == null) return NotFound();
        return Json(new
        {
            state = batch.State,
            done = batch.Done,
            total = batch.Slots.Count,
            current = batch.Current,
            message = batch.Message,
            stopRequested = batch.StopRequested,
            completed = batch.Completed.Select(c => new { kind = c.Kind, questionId = c.QuestionId, url = c.Url })
        });
    }

    [HttpPost("Batches/{batchId}/Stop")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> StopBatch(string batchId, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var batch = jobs.GetBatch(batchId, business.Id);
        if (batch == null) return NotFound();
        jobs.StopBatch(batch);
        return Json(new { ok = true, stopRequested = batch.StopRequested });
    }

    [HttpGet("{id:int}/Videos/Status")]
    public async Task<IActionResult> VideoStatus(int id, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        if (await KitAsync(id, business.Id, cancellationToken) == null) return NotFound();
        var batch = jobs.RunningBatch(id);
        var job = jobs.RunningVideo(id);
        return Json(new { ok = true, busy = batch != null || job != null, batchId = batch?.Id, jobId = job?.Id, stopRequested = batch?.StopRequested == true || job?.StopRequested == true });
    }

    [HttpPost("{id:int}/Videos/Stop")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> StopVideos(int id, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        if (await KitAsync(id, business.Id, cancellationToken) == null) return NotFound();
        jobs.StopVideos(id, business.Id);
        return Json(new { ok = true, busy = jobs.RunningBatch(id) != null || jobs.RunningVideo(id) != null, stopRequested = true });
    }

    [HttpPost("Jobs/{jobId}/Stop")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> StopVideoJob(string jobId, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var job = jobs.Get(jobId, business.Id);
        if (job == null || job.Kind == InterviewVideoJobs.AvatarKind) return NotFound();
        jobs.StopVideos(job.KitId, business.Id);
        return Json(new { ok = true });
    }

    [HttpGet("Jobs/{jobId}")]
    public async Task<IActionResult> JobStatus(string jobId, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var job = jobs.Get(jobId, business.Id);
        return job == null ? NotFound() : Json(new { state = job.State, message = job.Message, stopRequested = job.StopRequested });
    }

    [HttpPost("Videos/{videoId:int}/Delete")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteVideo(int videoId, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var video = await context.InterviewKitVideos
            .FirstOrDefaultAsync(v => v.Id == videoId && v.Kit.BusinessAccountId == business.Id, cancellationToken);
        if (video == null) return NotFound();
        if (jobs.IsBusy(video.KitId)) return Conflict(new { error = "Đang tạo ảnh hoặc video. Chờ tạo xong rồi xóa video." });
        await store.DeleteVideosAsync(new[] { video }, cancellationToken);
        return Redirect(Url.Action(nameof(Edit), new { id = video.KitId }) + "#videos");
    }

    /// <summary>
    /// Clears the kit's clips so they can be made again from scratch (e.g. after changing the voice).
    /// keepBase keeps the shared base videos: talking clips are then re-voiced over them without new render credits.
    /// </summary>
    [HttpPost("{id:int}/Videos/DeleteAll")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteAllVideos(int id, bool keepBase, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        if (!await context.InterviewKits.AnyAsync(k => k.Id == id && k.BusinessAccountId == business.Id, cancellationToken)) return NotFound();
        var back = Url.Action(nameof(Edit), new { id }) + "#videos";
        if (jobs.IsBusy(id))
        {
            TempData["InterviewFlowError"] = "Đang tạo ảnh hoặc video. Dừng hoặc chờ tạo xong rồi xóa video.";
            return Redirect(back);
        }
        var videos = await context.InterviewKitVideos
            .Where(v => v.KitId == id && !(keepBase && InterviewKitVideo.BaseKinds.Contains(v.Kind)))
            .ToListAsync(cancellationToken);
        await store.DeleteVideosAsync(videos, cancellationToken);
        TempData["InterviewFlowSaved"] = videos.Count == 0
            ? "Không có video nào để xóa."
            : $"Đã xóa {videos.Count} video{(keepBase ? ", giữ video gốc" : "")}. Bấm \"Tạo tất cả video\" để tạo lại từ đầu.";
        return Redirect(back);
    }

    /// <summary>A studio package: a new kit, or clips for an existing kit whose questions match the package.</summary>
    [HttpPost("Import")]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(420_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 420_000_000)]
    public async Task<IActionResult> Import(IFormFile? package, int? kitId, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        IActionResult Fail(string message)
        {
            TempData["InterviewFlowError"] = message;
            return kitId is int target ? Redirect(Url.Action(nameof(Edit), new { id = target }) + "#videos") : RedirectToAction(nameof(Index));
        }
        if (package is not { Length: > 0 }) return Fail("Chọn file gói video (.zip).");

        InterviewPackage.Contents contents;
        try
        {
            await using var stream = package.OpenReadStream();
            contents = await InterviewPackage.ReadAsync(stream, cancellationToken);
        }
        catch (InterviewPackage.InvalidPackageException exception) { return Fail(exception.Message); }

        InterviewKit? kit;
        if (kitId is int existing)
        {
            kit = await KitAsync(existing, business.Id, cancellationToken);
            if (kit == null) return NotFound();
            var ordered = kit.Questions.OrderBy(q => q.Position).ToList();
            if (ordered.Count != contents.Questions.Count
                || ordered.Zip(contents.Questions).Any(pair => InterviewEngine.Fold(pair.First.Question) != InterviewEngine.Fold(pair.Second.Text)))
                return Fail("Câu hỏi trong gói không khớp với bộ này. Nhập gói thành bộ mới ở trang danh sách.");
        }
        else
        {
            kit = new InterviewKit
            {
                BusinessAccountId = business.Id,
                Title = Clip(contents.Title, 200)!,
                Persona = Clip(contents.Persona, 2000),
                Scene = Clip(contents.Scene, 1000)
            };
            var position = 0;
            foreach (var question in contents.Questions)
                kit.Questions.Add(new InterviewKitQuestion
                {
                    Position = ++position,
                    Question = Clip(question.Text, 2000)!,
                    AnswerKey = Clip(question.Answer, 4000),
                    KeyPoints = Clip(string.Join(';', question.KeyPoints), 2000),
                    PrepSeconds = Math.Clamp(question.PrepSeconds, 0, 120),
                    AnswerSeconds = Math.Clamp(question.AnswerSeconds, 15, 600),
                    Retakes = Math.Clamp(question.Retakes, 0, 3)
                });
            context.InterviewKits.Add(kit);
            await context.SaveChangesAsync(cancellationToken);
            SyncScript(kit);
            await context.SaveChangesAsync(cancellationToken);
        }

        var byPackageId = kit.Questions.OrderBy(q => q.Position).Zip(contents.Questions).ToDictionary(pair => pair.Second.Id, pair => pair.First.Id);
        var saved = 0;
        var problems = new List<string>();
        foreach (var clip in contents.Clips)
        {
            int? questionId = clip.QuestionId == null ? null : byPackageId[clip.QuestionId];
            try
            {
                var (_, error) = await store.SaveVideoAsync(kit, questionId, clip.Kind, clip.Bytes, clip.FileName, "package", cancellationToken);
                if (error == null) saved++; else problems.Add($"{clip.FileName}: {error}");
            }
            catch (PublicMediaStorageException) { problems.Add($"{clip.FileName}: không lưu được vào kho."); }
        }
        TempData["InterviewFlowSaved"] = $"Đã nhập gói: {saved} video.";
        if (problems.Count > 0) TempData["InterviewFlowError"] = "Một số video không nhập được: " + string.Join("; ", problems.Take(5));
        return Redirect(Url.Action(nameof(Edit), new { id = kit.Id }) + "#videos");
    }

    // ---------- candidates ----------

    [HttpPost("{id:int}/Invite")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Invite(int id, bool open, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var kit = await context.InterviewKits.FirstOrDefaultAsync(k => k.Id == id && k.BusinessAccountId == business.Id, cancellationToken);
        if (kit == null) return NotFound();
        kit.InviteCode = open ? Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant() : null;
        await context.SaveChangesAsync(cancellationToken);
        return Redirect(Url.Action(nameof(Edit), new { id }) + "#candidates");
    }

    [HttpGet("{id:int}/Try")]
    public async Task<IActionResult> Try(int id, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return RedirectToAction("BecomeEmployer", "Account");
        var kit = await KitAsync(id, business.Id, cancellationToken);
        if (kit == null) return NotFound();
        return View("~/Views/Employer/InterviewPlayer.cshtml", new InterviewPlayerViewModel
        {
            Title = kit.Title,
            CompanyName = business.CompanyName,
            QuestionCount = kit.Questions.Count,
            Endpoint = $"/Employer/InterviewFlow/{kit.Id}/Try",
            IsEmployerTest = true,
            BackUrl = $"/Employer/InterviewFlow/{kit.Id}#candidates"
        });
    }

    public sealed class AnswerRequest
    {
        public int SessionId { get; set; }
        public int QuestionId { get; set; }
        public string? Transcript { get; set; }
        public int? RecordingId { get; set; }
        public bool Supplement { get; set; }
    }

    [HttpPost("{id:int}/Try/Start")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> TryStart(int id, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var kit = await KitAsync(id, business.Id, cancellationToken);
        if (kit == null) return NotFound();
        var session = await sessions.StartAsync(kit, business.UserId, isEmployerTest: true, cancellationToken);
        return Json(InterviewSessions.Plan(kit, business.CompanyName, session.Id));
    }

    [HttpPost("{id:int}/Try/Answer")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> TryAnswer(int id, [FromBody] AnswerRequest request, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var kit = await KitAsync(id, business.Id, cancellationToken);
        var session = kit == null ? null : await sessions.FindAsync(kit.Id, request.SessionId, business.UserId, cancellationToken);
        if (kit == null || session == null) return NotFound();
        var result = await sessions.AnswerAsync(kit, session, request.QuestionId, request.Transcript, cancellationToken, request.RecordingId, request.Supplement);
        // The employer's own test run shows the grading; a candidate only gets the reaction.
        return result == null ? BadRequest(new { error = "Không thể gửi câu này hoặc đã hết số lần bổ sung/làm lại." }) : Json(new { passed = result.Passed, score = result.Score, feedback = result.Feedback, points = result.Points, action = sessions.Action(kit, result) });
    }

    [HttpPost("{id:int}/Try/Finish")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> TryFinish(int id, [FromBody] AnswerRequest request, CancellationToken cancellationToken)
    {
        var business = await BusinessAsync(cancellationToken);
        if (business == null) return Forbid();
        var kit = await KitAsync(id, business.Id, cancellationToken);
        var session = kit == null ? null : await sessions.FindAsync(kit.Id, request.SessionId, business.UserId, cancellationToken);
        if (kit == null || session == null) return NotFound();
        await sessions.FinishAsync(kit, session, cancellationToken);
        return Json(new { score = session.Score, passed = session.Score >= kit.PassPercent });
    }

    // ---------- helpers ----------

    private async Task<IActionResult> EditViewAsync(BussinessAccount business, InterviewKit kit, InterviewKitForm form, string? error, CancellationToken cancellationToken)
    {
        if (error == null && kit.AvatarImage != null)
        {
            var defaultAvatar = await avatars.DefaultAsync(cancellationToken);
            form.UseDefaultAvatar = kit.AvatarImage.AsSpan().SequenceEqual(defaultAvatar.Bytes);
        }
        var questionText = kit.Questions.ToDictionary(q => q.Id, q => q.Question);
        var runs = await context.InterviewKitSessions.AsNoTracking()
            .Where(s => s.KitId == kit.Id)
            .OrderByDescending(s => s.StartedAtUtc)
            .Take(200)
            .Select(s => new { s.Id, s.IsEmployerTest, s.StartedAtUtc, s.CompletedAtUtc, s.Score, s.AnswersJson, s.User.Email, Name = s.User.Profile != null ? s.User.Profile.FullName : s.User.Username })
            .ToListAsync(cancellationToken);
        return View("~/Views/Employer/InterviewKit.cshtml", new InterviewKitEditViewModel
        {
            CompanyName = business.CompanyName,
            Form = form,
            AvatarDataUrl = kit.AvatarImage is { Length: > 0 } ? $"data:{kit.AvatarContentType};base64,{Convert.ToBase64String(kit.AvatarImage)}" : null,
            Videos = kit.Videos.ToList(),
            Script = InterviewJson.Script(kit.ScriptJson),
            ScriptApproved = kit.ScriptApprovedAtUtc != null,
            CanRenderVideo = engine.CanRenderVideo,
            CanRenderAvatar = avatars.CanRender,
            CanSpeak = speech.CanSpeak,
            RunningAvatarJobId = jobs.RunningAvatar(kit.Id)?.Id,
            RunningBatchId = jobs.RunningBatch(kit.Id)?.Id,
            RunningVideoJobId = jobs.RunningVideo(kit.Id)?.Id,
            SlotCount = InterviewKitVideo.Kinds.Length - 1 + kit.Questions.Count,
            InviteUrl = kit.InviteCode == null ? null : $"{Request.Scheme}://{Request.Host}/InterviewKit/{kit.InviteCode}",
            Sessions = runs.Select(s => new InterviewSessionSummary
            {
                Id = s.Id,
                CandidateName = s.Name ?? "",
                CandidateEmail = s.Email,
                IsEmployerTest = s.IsEmployerTest,
                StartedAtUtc = s.StartedAtUtc,
                CompletedAtUtc = s.CompletedAtUtc,
                Score = s.Score,
                Answers = InterviewJson.Answers(s.AnswersJson).OrderBy(a => kit.Questions.FirstOrDefault(q => q.Id == a.QuestionId)?.Position ?? int.MaxValue).ToList()
            }).ToList(),
            Error = error
        });
    }

    private static InterviewKitForm FormOf(InterviewKit kit) => new()
    {
        Id = kit.Id,
        Title = kit.Title,
        Persona = kit.Persona,
        Scene = kit.Scene,
        PassPercent = kit.PassPercent,
        Production = InterviewProductionSettings.Of(kit),
        Questions = kit.Questions.OrderBy(q => q.Position).Select(q => new InterviewQuestionForm
        {
            Id = q.Id,
            Question = q.Question,
            AnswerKey = q.AnswerKey,
            KeyPoints = q.KeyPoints,
            Code = q.Code,
            Weight = q.Weight,
            PointWeights = q.PointWeights,
            PrepSeconds = q.PrepSeconds,
            AnswerSeconds = q.AnswerSeconds,
            Retakes = q.Retakes
        }).ToList()
    };

    /// <summary>
    /// Keeps the script in step with the questions: new questions get a plain line, removed ones go,
    /// a changed question resets its line, and every prompt is rebuilt from the current persona/scene/avatar.
    /// A changed line set needs a new approval.
    /// </summary>
    internal static void SyncScript(InterviewKit kit)
    {
        if (kit.ScriptJson == null) return;
        var current = InterviewJson.Script(kit.ScriptJson);
        var questions = kit.Questions.OrderBy(q => q.Position).ToList();
        var changed = current.Count(c => c.Kind == InterviewKitVideo.KindQuestion) != questions.Count;
        string Line(string kind) => current.FirstOrDefault(c => c.Kind == kind)?.Line ?? "";
        var result = new List<InterviewScriptClip> { InterviewEngine.Clip(kit, InterviewKitVideo.KindIntro, null, Line(InterviewKitVideo.KindIntro)) };
        for (var index = 0; index < questions.Count; index++)
        {
            var question = questions[index];
            var line = current.FirstOrDefault(c => c.Kind == InterviewKitVideo.KindQuestion && c.QuestionId == question.Id)?.Line;
            if (line == null || !InterviewEngine.Fold(line).Contains(InterviewEngine.Fold(question.Question)))
            {
                line = $"Câu hỏi {index + 1}: {question.Question}";
                changed = true;
            }
            result.Add(InterviewEngine.Clip(kit, InterviewKitVideo.KindQuestion, question.Id, line));
        }
        result.Add(InterviewEngine.Clip(kit, InterviewKitVideo.KindTransition, null, Line(InterviewKitVideo.KindTransition)));
        foreach (var kind in InterviewKitVideo.SilentKinds) result.Add(InterviewEngine.Clip(kit, kind, null, ""));
        result.Add(InterviewEngine.Clip(kit, InterviewKitVideo.KindOutro, null, Line(InterviewKitVideo.KindOutro)));
        kit.ScriptJson = InterviewJson.Write(result);
        if (changed) kit.ScriptApprovedAtUtc = null;
    }

    private static string SlotLabel(string kind, int? questionId, List<InterviewKitQuestion> ordered) => kind switch
    {
        InterviewKitVideo.KindIntro => "Mở đầu",
        InterviewKitVideo.KindQuestion => $"Câu {ordered.FindIndex(q => q.Id == questionId) + 1}",
        InterviewKitVideo.KindListening => "Đang lắng nghe",
        InterviewKitVideo.KindThinking => "Đang suy nghĩ",
        InterviewKitVideo.KindTransition => "Chuyển câu",
        InterviewKitVideo.KindPass => "Phản ứng · trả lời tốt",
        InterviewKitVideo.KindFail => "Phản ứng · cần cố gắng",
        InterviewKitVideo.KindOutro => "Kết thúc",
        "base-talk" => "Biểu cảm · Nói",
        "base-listen" => "Biểu cảm · Nghe",
        "base-think" => "Biểu cảm · Suy nghĩ",
        "base-happy" => "Biểu cảm · Cười",
        "base-concerned" => "Biểu cảm · Nhíu mày",
        "base-master" => "Một video gốc",
        _ => kind
    };

    /// <summary>Normalises a slot; returns an error message when it does not exist in this kit.</summary>
    private static string? SlotError(InterviewKit kit, ref string? kind, ref int? questionId)
    {
        kind = kind?.Trim().ToLowerInvariant();
        if (kind == null || (!InterviewKitVideo.Kinds.Contains(kind) && !InterviewKitVideo.BaseKinds.Contains(kind))) return "Ô video không hợp lệ.";
        if (kind != InterviewKitVideo.KindQuestion) { questionId = null; return null; }
        var id = questionId;
        return kit.Questions.Any(q => q.Id == id) ? null : "Câu hỏi không thuộc bộ này.";
    }

    private static string? Clip(string? value, int max)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
    private static bool ValidPointWeights(string? text, string? points)
    {
        if (string.IsNullOrWhiteSpace(text)) return true;
        var values = text.Split(';', StringSplitOptions.TrimEntries);
        var count = (points ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Length;
        return values.Length == Math.Max(1, count) && values.All(v => double.TryParse(v, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var n) && double.IsFinite(n) && n > 0 && n <= 1000);
    }
}
