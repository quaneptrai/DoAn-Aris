using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities;

/// <summary>
/// Server-only locator for an imported Resume Studio PDF. The Drive file ID is
/// intentionally never serialized into a Studio document or returned to a
/// browser; access always goes through the authenticated owner endpoint.
/// </summary>
public sealed class ResumeOriginal
{
    [Key]
    public int Id { get; set; }

    public int OwnerUserId { get; set; }

    [Required, StringLength(32)]
    public string SourceId { get; set; } = string.Empty;

    [Required, StringLength(256)]
    public string DriveFileId { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }

    /// <summary>
    /// Null while a persisted Studio document uses this original. A timestamp
    /// starts the bounded cleanup window for an abandoned or replaced source.
    /// </summary>
    public DateTime? UnreferencedAtUtc { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public User Owner { get; set; } = null!;
}
