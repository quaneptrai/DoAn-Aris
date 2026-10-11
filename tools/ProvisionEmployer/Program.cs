using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Text.Json;

const string email = "xuanthangmuoi@gmail.com";
const string company = "Công ty TNHH Công nghệ Xuân Thắng";
AppContext.SetSwitch("Switch.Microsoft.Data.SqlClient.UseManagedNetworkingOnWindows", true);
var configuration = new ConfigurationBuilder()
    .AddUserSecrets(typeof(ArisDBContext).Assembly, optional: true)
    .AddEnvironmentVariables().Build();
var connection = configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connection))
{
    Console.WriteLine("No database connection configured; account has not been created.");
    return 2;
}
try
{
    await using var context = new ArisDBContext(new DbContextOptionsBuilder<ArisDBContext>()
        .UseSqlServer(connection, sql => sql.CommandTimeout(20)).Options);
    var existing = await context.Users.Include(u => u.Profile).SingleOrDefaultAsync(u => u.Email == email);
    if (existing != null)
    {
        Console.WriteLine(JsonSerializer.Serialize(new { status = "exists", email, role = existing.Role,
            company = (existing.Profile as BussinessAccount)?.CompanyName, userId = existing.Id, profileId = existing.Profile?.Id }));
        return existing.Role == "Business" && existing.Profile is BussinessAccount ? 0 : 3;
    }
    if (args.Contains("--inspect"))
    {
        Console.WriteLine(JsonSerializer.Serialize(new { status = "absent", email }));
        return 0;
    }
    var username = "xuanthangmuoi";
    for (var suffix = 2; await context.Users.AnyAsync(u => u.Username == username); suffix++) username = "xuanthangmuoi" + suffix;
    var user = new User
    {
        Email = email, Username = username, Role = "Business", ShowActiveStatus = true,
        Profile = new BussinessAccount
        {
            FullName = "Xuân Thắng", CompanyName = company, Location = "TP. Hồ Chí Minh",
            CompanyAddress = "TP. Hồ Chí Minh", Industry = "Công nghệ thông tin",
            CompanySize = "11-50", Description = "Doanh nghiệp mẫu để quản lý tuyển dụng và phỏng vấn video trên Aris.",
            JobTitle = "Nhà tuyển dụng", AvatarUrl = "/images/default-avatar.png", IsVerified = false
        }
    };
    context.Users.Add(user);
    await context.SaveChangesAsync();
    // Read the committed row back. No migrations, seeders, fake verification,
    // privacy acceptance or CV-AI consent are performed by this utility.
    var saved = await context.Users.AsNoTracking().Include(u => u.Profile).SingleAsync(u => u.Email == email);
    Console.WriteLine(JsonSerializer.Serialize(new { status = "created", email, role = saved.Role,
        company = ((BussinessAccount)saved.Profile!).CompanyName, userId = saved.Id, profileId = saved.Profile.Id }));
    return 0;
}
catch (Exception exception)
{
    Console.WriteLine("Account provisioning failed: " + exception.GetType().Name
        + "; inner=" + (exception.InnerException?.GetType().Name ?? "none")
        + (exception.InnerException is Microsoft.Data.SqlClient.SqlException sql ? "; SQL error number=" + sql.Number
            + "; SSL=" + sql.Message.Contains("SSL", StringComparison.OrdinalIgnoreCase)
            + "; handshake=" + sql.Message.Contains("handshake", StringComparison.OrdinalIgnoreCase)
            + "; authority=" + sql.Message.Contains("authority", StringComparison.OrdinalIgnoreCase)
            + "; native=" + (sql.InnerException is System.ComponentModel.Win32Exception native ? native.NativeErrorCode : 0) : "")
        + ". No connection details are printed.");
    return 1;
}
