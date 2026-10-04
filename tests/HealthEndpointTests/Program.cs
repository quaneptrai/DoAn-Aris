using System.Text.Json;
using ArisSkyve.Controllers;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

var checks = 0;

void Check(bool condition, string label)
{
    if (!condition) throw new Exception(label);
    checks++;
    Console.WriteLine($"PASS {label}");
}

JsonElement Payload(IActionResult result) =>
    JsonSerializer.SerializeToElement(((ObjectResult)result).Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));

HealthController Controller(ArisDBContext context) => new(context, NullLogger<HealthController>.Instance)
{
    ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
};

var options = new DbContextOptionsBuilder<ArisDBContext>()
    .UseInMemoryDatabase($"health-endpoint-{Guid.NewGuid():N}")
    .Options;

await using var readyDb = new ArisDBContext(options);
readyDb.Users.Add(new User { Id = 1, Email = "health@example.test", Username = "health" });
await readyDb.SaveChangesAsync();

var readyController = Controller(readyDb);
var live = readyController.Live();
Check(live is OkObjectResult && Payload(live).GetProperty("status").GetString() == "live",
    "liveness never requires a database query");

var ready = await readyController.Ready(CancellationToken.None);
Check(ready is OkObjectResult && Payload(ready).GetProperty("status").GetString() == "ready",
    "readiness succeeds after a bounded usable-schema query");

var disposedDb = new ArisDBContext(options);
await disposedDb.DisposeAsync();
var unavailable = await Controller(disposedDb).Ready(CancellationToken.None);
Check(unavailable is ObjectResult { StatusCode: StatusCodes.Status503ServiceUnavailable }
      && Payload(unavailable).GetProperty("status").GetString() == "not_ready",
    "readiness returns a generic 503 when database access fails");

using var canceled = new CancellationTokenSource();
canceled.Cancel();
var canceledResult = await readyController.Ready(canceled.Token);
Check(canceledResult is ObjectResult { StatusCode: StatusCodes.Status503ServiceUnavailable }
      && Payload(canceledResult).GetProperty("status").GetString() == "not_ready",
    "caller cancellation is handled without exposing diagnostics");

Console.WriteLine($"ALL HEALTH ENDPOINT TESTS PASSED ({checks} checks)");
