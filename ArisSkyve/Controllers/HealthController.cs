using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Controllers;

// These endpoints intentionally expose only coarse status information. They are
// suitable for load balancers and deployment probes, not for application telemetry.
[AllowAnonymous]
[ApiController]
[Route("health")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class HealthController(ArisDBContext db, ILogger<HealthController> logger) : ControllerBase
{
    [HttpGet("live")]
    public IActionResult Live() => Ok(new { status = "live" });

    [HttpGet("ready")]
    public async Task<IActionResult> Ready(CancellationToken cancellationToken)
    {
        // A small query confirms both that the database is reachable and that the
        // application schema is usable. Unlike a migration inspection, it also works
        // for the explicitly isolated EF InMemory runtime used by local E2E tests.
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(5));

        try
        {
            await db.Users.AsNoTracking()
                .Select(user => user.Id)
                .Take(1)
                .AnyAsync(deadline.Token);

            return Ok(new { status = "ready" });
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // The caller has already gone away. Keep the response shape non-sensitive
            // in case the server is still able to write it.
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { status = "not_ready" });
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("Readiness database check timed out.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { status = "not_ready" });
        }
        catch (Exception exception)
        {
            // Do not log the exception instance: database exceptions can carry a
            // connection string or provider diagnostic. The type is enough to alert
            // operators while the probe response remains deliberately generic.
            logger.LogWarning("Readiness database check failed ({FailureType}).", exception.GetType().Name);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { status = "not_ready" });
        }
    }
}
