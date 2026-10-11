using System.Threading.Channels;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Services.Recruitment
{
    // Bật/tắt toàn bộ tính năng tuyển dụng mới theo việc migration RecruitmentFlowV2 đã chạy
    // trên DB hay chưa (cùng cách V7FeatureGate làm). Worker nền chỉ quét DB khi đã có cột mới,
    // để DB chưa migrate không bị dội lỗi SQL mỗi vài phút.
    public static class RecruitmentSchema
    {
        public const string MigrationMarker = "RecruitmentFlowV2";
        private static volatile bool _ready;
        private static DateTime _checkedAt = DateTime.MinValue;

        public static async Task<bool> IsReadyAsync(ArisDBContext db, CancellationToken ct = default)
        {
            if (_ready) return true;
            if (DateTime.UtcNow - _checkedAt < TimeSpan.FromMinutes(2)) return false;
            _checkedAt = DateTime.UtcNow;
            try
            {
                var applied = await db.Database.GetAppliedMigrationsAsync(ct);
                _ready = applied.Any(m => m.Contains(MigrationMarker, StringComparison.OrdinalIgnoreCase));
            }
            catch
            {
                _ready = false;
            }
            return _ready;
        }
    }

    // Hàng đợi chấm điểm trong tiến trình (dự án không có queue ngoài). Mất khi app tắt cũng
    // không sao: ApplicationScoringWorker quét lại đơn chưa có điểm định kỳ.
    public class ApplicationScoringQueue
    {
        private readonly Channel<int> _channel = Channel.CreateBounded<int>(new BoundedChannelOptions(500)
        {
            FullMode = BoundedChannelFullMode.DropWrite
        });
        private readonly HashSet<int> _queued = new();
        private readonly object _lock = new();

        public bool Enqueue(int applicationId)
        {
            lock (_lock)
            {
                if (!_queued.Add(applicationId)) return false;
            }
            if (_channel.Writer.TryWrite(applicationId)) return true;
            lock (_lock) _queued.Remove(applicationId);
            return false;
        }

        public bool IsQueued(int applicationId)
        {
            lock (_lock) return _queued.Contains(applicationId);
        }

        public async IAsyncEnumerable<int> ReadAllAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
        {
            await foreach (var id in _channel.Reader.ReadAllAsync(ct))
            {
                yield return id;
                lock (_lock) _queued.Remove(id);
            }
        }
    }

    public class ApplicationScoringWorker : BackgroundService
    {
        private readonly ApplicationScoringQueue _queue;
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<ApplicationScoringWorker> _logger;

        public ApplicationScoringWorker(ApplicationScoringQueue queue, IServiceScopeFactory scopes, ILogger<ApplicationScoringWorker> logger)
        {
            _queue = queue;
            _scopes = scopes;
            _logger = logger;
        }

        protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
            Task.WhenAll(ConsumeAsync(stoppingToken), SweepAsync(stoppingToken));

        // Chấm lần lượt từng đơn — AiCore mất 5–35 giây/lần, chạy song song chỉ làm nó quá tải.
        private async Task ConsumeAsync(CancellationToken ct)
        {
            try
            {
                await foreach (var id in _queue.ReadAllAsync(ct))
                {
                    try
                    {
                        using var scope = _scopes.CreateScope();
                        var svc = scope.ServiceProvider.GetRequiredService<ApplicationMatchService>();
                        await svc.ScoreAsync(id, ct);
                    }
                    catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Scoring application {Id} failed: {Msg}", id, ex.Message);
                    }
                }
            }
            catch (OperationCanceledException) { }
        }

        // Nhặt đơn chưa có điểm (app vừa khởi động lại, AiCore từng tắt...) — tối đa 3 lần/đơn.
        private async Task SweepAsync(CancellationToken ct)
        {
            try { await Task.Delay(TimeSpan.FromSeconds(30), ct); } catch (OperationCanceledException) { return; }
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<ArisDBContext>();
                    if (await RecruitmentSchema.IsReadyAsync(db, ct))
                    {
                        var since = DateTime.UtcNow.AddDays(-60);
                        var ids = await db.JobApplications
                            .Where(a => a.MatchScoredAt == null
                                        && a.MatchAttempts < ApplicationMatchService.MaxAttempts
                                        && a.Status != JobApplicationStatus.Withdrawn
                                        && a.AppliedAt >= since)
                            .OrderByDescending(a => a.AppliedAt)
                            .Select(a => a.Id)
                            .Take(20)
                            .ToListAsync(ct);
                        foreach (var id in ids) _queue.Enqueue(id);
                    }
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
                catch (Exception ex)
                {
                    _logger.LogDebug("Scoring sweep skipped: {Msg}", ex.Message);
                }

                try { await Task.Delay(TimeSpan.FromMinutes(15), ct); } catch (OperationCanceledException) { break; }
            }
        }
    }

    // Nhắc phỏng vấn trước 24 giờ và 1 giờ (cả hai phía), và nhắc nhà tuyển dụng chấm phiếu
    // đánh giá khi buổi phỏng vấn đã qua 2 giờ mà chưa có phiếu.
    public class RecruitmentReminderWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<RecruitmentReminderWorker> _logger;

        public RecruitmentReminderWorker(IServiceScopeFactory scopes, ILogger<RecruitmentReminderWorker> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try { await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken); } catch (OperationCanceledException) { return; }
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<ArisDBContext>();
                    if (await RecruitmentSchema.IsReadyAsync(db, stoppingToken))
                        await RunOnceAsync(db, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
                catch (Exception ex)
                {
                    _logger.LogDebug("Reminder pass skipped: {Msg}", ex.Message);
                }

                try { await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); } catch (OperationCanceledException) { break; }
            }
        }

        public static async Task RunOnceAsync(ArisDBContext db, CancellationToken ct)
        {
            var now = DateTime.UtcNow;
            var horizon = now.AddHours(24);
            var upcoming = await db.JobApplications
                .Include(a => a.JobPosting).ThenInclude(j => j.BusinessAccount)
                .Include(a => a.Applicant)
                .Where(a => a.Status == JobApplicationStatus.InterviewScheduled
                            && a.InterviewAt != null && a.InterviewAt > now && a.InterviewAt <= horizon
                            && a.InterviewResponse != InterviewResponses.Declined
                            && (a.Reminder24hSentAt == null || (a.Reminder1hSentAt == null && a.InterviewAt <= now.AddHours(1)))
                            // An AI interview already taken from this application needs no reminder.
                            && (a.InterviewKitId == null || !db.InterviewKitSessions.Any(s => s.JobApplicationId == a.Id && s.KitId == a.InterviewKitId && s.CompletedAtUtc != null)))
                .Take(100)
                .ToListAsync(ct);

            foreach (var a in upcoming)
            {
                var within1h = a.InterviewAt <= now.AddHours(1);
                var when = VnTime.Format(a.InterviewAt!.Value, "HH:mm dd/MM");
                if (a.InterviewKitId != null)
                {
                    // AI interview: InterviewAt is the deadline to take it, only the candidate has something to do.
                    db.Notifications.Add(new Notification
                    {
                        UserId = a.Applicant.UserId,
                        Type = "InterviewReminder",
                        Content = $"{(within1h ? "Còn chưa đầy 1 giờ" : "Còn chưa đầy 24 giờ")} để làm phỏng vấn AI \"{a.JobPosting.Title}\" (hạn {when}).",
                        Link = $"/JobApplications/MyApplications?app={a.Id}",
                        CreatedAt = now
                    });
                    if (within1h) a.Reminder1hSentAt = now;
                    a.Reminder24hSentAt ??= now;
                    continue;
                }
                var where = a.IsVideoCall ? "phòng video Aris" : (a.InterviewLocation ?? "địa điểm đã hẹn");
                var lead = within1h ? "Còn chưa đầy 1 giờ" : "Ngày mai";
                var confirmHint = a.InterviewResponse == InterviewResponses.Pending ? " Bạn chưa xác nhận lịch này." : "";

                db.Notifications.Add(new Notification
                {
                    UserId = a.Applicant.UserId,
                    Type = "InterviewReminder",
                    Content = $"{lead}: phỏng vấn \"{a.JobPosting.Title}\" lúc {when} tại {where}.{confirmHint}",
                    Link = $"/JobApplications/MyApplications?app={a.Id}",
                    CreatedAt = now
                });
                if (a.JobPosting.BusinessAccount != null)
                {
                    db.Notifications.Add(new Notification
                    {
                        UserId = a.JobPosting.BusinessAccount.UserId,
                        Type = "InterviewReminder",
                        Content = $"{lead}: phỏng vấn {a.FullName} ({a.JobPosting.Title}) lúc {when}."
                                  + (a.InterviewResponse == InterviewResponses.Pending ? " Ứng viên chưa xác nhận." : ""),
                        Link = $"/Employer/Index?jobId={a.JobPostingId}&app={a.Id}",
                        CreatedAt = now
                    });
                }

                if (within1h) a.Reminder1hSentAt = now;
                a.Reminder24hSentAt ??= now;
            }

            // Buổi phỏng vấn đã kết thúc 2 giờ mà chưa có phiếu đánh giá cho vòng đó.
            var cutoff = now.AddHours(-2);
            var finished = await db.JobApplications
                .Include(a => a.JobPosting).ThenInclude(j => j.BusinessAccount)
                .Where(a => a.Status == JobApplicationStatus.InterviewScheduled
                            && a.InterviewAt != null && a.InterviewAt <= cutoff
                            && a.InterviewAt >= now.AddDays(-14)
                            && a.InterviewResponse != InterviewResponses.Declined
                            && a.FollowUpNudgedAt == null
                            // AI rounds notify the employer when the candidate finishes, not by the clock.
                            && a.InterviewKitId == null
                            && !a.Evaluations.Any(e => e.Round == a.InterviewRound))
                .Take(100)
                .ToListAsync(ct);

            foreach (var a in finished)
            {
                if (a.JobPosting.BusinessAccount != null)
                {
                    db.Notifications.Add(new Notification
                    {
                        UserId = a.JobPosting.BusinessAccount.UserId,
                        Type = "EvaluationDue",
                        Content = $"Buổi phỏng vấn {a.FullName} ({a.JobPosting.Title}) đã xong. Ghi phiếu đánh giá để chọn bước tiếp: offer, vòng sau hoặc từ chối.",
                        Link = $"/Employer/Index?jobId={a.JobPostingId}&app={a.Id}&tab=interview",
                        CreatedAt = now
                    });
                }
                a.FollowUpNudgedAt = now;
            }

            if (upcoming.Count > 0 || finished.Count > 0)
                await db.SaveChangesAsync(ct);
        }
    }
}
