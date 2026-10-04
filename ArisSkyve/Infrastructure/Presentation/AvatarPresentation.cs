namespace ArisSkyve.Infrastructure.Presentation;

/// <summary>
/// Keeps the visual identity used for people and organisations consistent across
/// server-rendered views. A missing or generated placeholder is represented by
/// initials instead of a repeated stock portrait.
/// </summary>
public static class AvatarPresentation
{
    public const string LegacyDefaultAvatar = "/images/default-avatar.png";

    public static bool HasImage(string? avatarUrl) =>
        !string.IsNullOrWhiteSpace(avatarUrl)
        && !avatarUrl.Contains("default-avatar", StringComparison.OrdinalIgnoreCase)
        && !avatarUrl.Contains("ui-avatars.com", StringComparison.OrdinalIgnoreCase);

    public static string Initials(string? name, string fallback = "A")
    {
        var parts = (name ?? string.Empty).Trim()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries);

        return parts.Length switch
        {
            0 => fallback,
            1 => parts[0][..Math.Min(2, parts[0].Length)].ToUpperInvariant(),
            _ => string.Concat(parts[^2][0], parts[^1][0]).ToUpperInvariant()
        };
    }

    public static int Tone(string? name)
    {
        uint hash = 0;
        foreach (var character in name ?? string.Empty)
            hash = unchecked(hash * 31 + character);
        return (int)(hash % 6) + 1;
    }
}
