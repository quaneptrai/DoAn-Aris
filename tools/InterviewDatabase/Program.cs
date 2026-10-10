using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Text.Json;

// Read-only schema and migration inspection. Never applies migrations or changes data.
AppContext.SetSwitch("Switch.Microsoft.Data.SqlClient.UseManagedNetworkingOnWindows", true);
const string target = "20261010072933_ExtendInterviewFlow";
var root = Path.GetFullPath(args.SkipWhile(a => a != "--root").Skip(1).FirstOrDefault() ?? Environment.CurrentDirectory);
var configuration = new ConfigurationBuilder().AddUserSecrets(typeof(ArisDBContext).Assembly, optional: true).AddEnvironmentVariables().Build();
var connection = configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connection))
{
    var file = Path.Combine(root, ".local", "production-settings.json");
    if (File.Exists(file))
    {
        using var json = JsonDocument.Parse(await File.ReadAllTextAsync(file));
        if (json.RootElement.TryGetProperty("ConnectionStrings__DefaultConnection", out var value)) connection = value.GetString();
    }
}
if (string.IsNullOrWhiteSpace(connection)) { Console.WriteLine("No database configured."); return 2; }
try
{
    await using var db = new ArisDBContext(new DbContextOptionsBuilder<ArisDBContext>().UseSqlServer(connection, sql => sql.CommandTimeout(30)).Options);
    var pending = (await db.Database.GetPendingMigrationsAsync()).ToArray();
    var tables = await db.Database.SqlQueryRaw<string>("SELECT [name] AS [Value] FROM sys.tables WHERE [name] LIKE 'Interview%' ORDER BY [name]").ToListAsync();
    var columns = await db.Database.SqlQueryRaw<string>("SELECT t.[name] + '.' + c.[name] AS [Value] FROM sys.tables t INNER JOIN sys.columns c ON t.object_id=c.object_id WHERE t.[name] LIKE 'Interview%' ORDER BY t.[name],c.column_id").ToListAsync();
    var ownerEmail = args.SkipWhile(a => a != "--owner-email").Skip(1).FirstOrDefault();
    var owner = string.IsNullOrWhiteSpace(ownerEmail) ? null : await db.Users.AsNoTracking().Where(u => u.Email == ownerEmail).Select(u => new { u.Id, u.Role }).SingleOrDefaultAsync();
    Console.WriteLine(JsonSerializer.Serialize(new { owner, database = db.Database.GetDbConnection().Database, pending, tables, columns, target }));
    return 0;
}
catch (Exception e) { Console.WriteLine("Database operation failed: " + e.GetType().Name + (e is Microsoft.Data.SqlClient.SqlException sql ? "; SQL error " + sql.Number : "") + ". Credentials are not printed."); return 1; }
