using System.Text.Json;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;
namespace ArisSkyve.Infrastructure.Services;
// Employer rights need both the role and a business profile (EmployerController, CompanyController, JobsController and
// EmployerInterviewFlowController all check both). Accounts upgraded before the 09/10 discriminator fix kept
// Role=Business with a candidate profile; they count as candidates here so they can finish the upgrade.
// The owner's rule (11/10): a candidate becomes an employer only after an administrator approves the request
// (SupportRequest kind "employer", reviewed in AdminController.Review). Administrators switch their own profile directly.
public static class EmployerAccounts
{
    public const string RequestKind = "employer";

    public static bool IsEmployer(User? user) => user is { Role: "Business" or "Admin", Profile: BussinessAccount };

    public static bool IsOpen(SupportRequest request) => request.Status is "pending" or "processing";

    public sealed record CompanyDetails(string CompanyName, string? Industry, string? CompanySize, int? FoundedYear,
        string? TaxCode, string? WebsiteUrl, string? CompanyAddress, string? Description);

    public static string Payload(BussinessAccount company) => JsonSerializer.Serialize(new CompanyDetails(company.CompanyName.Trim(),
        company.Industry?.Trim(), company.CompanySize, company.FoundedYear, company.TaxCode?.Trim(), company.WebsiteUrl,
        company.CompanyAddress, company.Description));

    public static CompanyDetails? Details(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return null;
        try { return JsonSerializer.Deserialize<CompanyDetails>(payload); } catch (JsonException) { return null; }
    }

    public static BussinessAccount Company(CompanyDetails details) => new()
    {
        CompanyName = details.CompanyName, Industry = details.Industry, CompanySize = details.CompanySize, FoundedYear = details.FoundedYear,
        TaxCode = details.TaxCode, WebsiteUrl = details.WebsiteUrl, CompanyAddress = details.CompanyAddress, Description = details.Description
    };

    // An administrator moved the account back to Employee and kept its company profile (AdminController.AccountRole).
    // Only an administrator gives the rights back, so the self-service upgrade must not.
    public static bool IsRevoked(User? user) => user is { Role: "Employee", Profile: BussinessAccount };

    // Turns the candidate profile into a business profile in place and sets Role in the same save, so the account
    // never ends up with one but not the other. The row keeps its Id: resumes, education, contacts and applications
    // stay attached. Admins keep their role.
    public static async Task<BussinessAccount> UpgradeAsync(ArisDBContext db, User user, BussinessAccount company, CancellationToken token = default)
    {
        var old = user.Profile;
        var business = new BussinessAccount
        {
            Id = old?.Id ?? 0,
            UserId = user.Id,
            FullName = old?.FullName ?? user.Username,
            Location = old?.Location ?? "Chưa cập nhật",
            AvatarUrl = old?.AvatarUrl,
            JobTitle = old?.JobTitle,
            Bio = old?.Bio,
            CoverPhotoUrl = old?.CoverPhotoUrl,
            IsLookingForJob = old?.IsLookingForJob ?? true,
            ShareWithRecruiters = old?.ShareWithRecruiters ?? false,
            isStudent = old?.isStudent ?? false,
            IsRemoteJob = old?.IsRemoteJob ?? false,
            ResumeUrl = old?.ResumeUrl,
            CompanyName = company.CompanyName.Trim(),
            Industry = company.Industry?.Trim(),
            TaxCode = company.TaxCode?.Trim(),
            FoundedYear = company.FoundedYear,
            CompanySize = company.CompanySize,
            WebsiteUrl = company.WebsiteUrl,
            CompanyAddress = company.CompanyAddress,
            Description = company.Description,
            IsVerified = false
        };

        if (old == null)
        {
            db.Profiles.Add(business);
        }
        else if (db.Database.IsRelational())
        {
            // EF can't change the type of a tracked entity: swap in a BussinessAccount with the same key, marked
            // Modified. ArisDBContext lets the Discriminator be saved, so the UPDATE rewrites the row as a business.
            db.Entry(old).State = EntityState.Detached;
            db.Profiles.Attach(business);
            db.Entry(business).State = EntityState.Modified;
        }
        else
        {
            // The in-memory store (tests, previews) keeps each entity type apart and has no UPDATE that changes the
            // type: remove the candidate row, then add the business row under the same Id.
            db.Profiles.Remove(old);
            await db.SaveChangesAsync(token);
            db.Entry(old).State = EntityState.Detached;
            db.Profiles.Add(business);
        }

        if (user.Role != "Admin") user.Role = "Business";
        user.Profile = business;
        await db.SaveChangesAsync(token);
        return business;
    }
}
