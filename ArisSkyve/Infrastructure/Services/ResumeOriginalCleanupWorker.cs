using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ArisSkyve.Infrastructure.Services;

// Orphans cannot be safely removed from a browser unload event: reloads, crashes,
// and network loss make that request unreliable. This bounded server-side worker
// makes cleanup eventual without risking a currently saved source.
public sealed class ResumeOriginalCleanupWorker(IServiceScopeFactory scopes, ILogger<ResumeOriginalCleanupWorker> logger) : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromHours(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var lifecycle = scope.ServiceProvider.GetRequiredService<ResumeOriginalLifecycle>();
                var removed = await lifecycle.CleanupAllExpiredUnreferencedAsync(stoppingToken);
                if (removed > 0)
                    logger.LogInformation("Removed {Count} expired unreferenced Resume Studio originals.", removed);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                // Cleanup is intentionally non-critical: a later pass can retry while
                // uploads and saved CVs continue to work.
                logger.LogDebug(exception, "Resume original cleanup pass skipped.");
            }

            try { await Task.Delay(SweepInterval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }
}
