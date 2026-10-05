using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities;

/// <summary>
/// Aggregate-only visit event for a company profile. We deliberately do not
/// retain the visitor identity or network address.
/// </summary>
public sealed class CompanyProfileView
{
    [Key]
    public long Id { get; set; }

    public int BusinessAccountId { get; set; }

    public DateTime ViewedAtUtc { get; set; } = DateTime.UtcNow;

    public BussinessAccount BusinessAccount { get; set; } = null!;
}
