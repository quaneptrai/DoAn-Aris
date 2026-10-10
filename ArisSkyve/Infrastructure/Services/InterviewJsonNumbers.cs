using System.Globalization;
using System.Text.Json;

namespace ArisSkyve.Infrastructure.Services;

/// <summary>
/// Number reads that never throw. <see cref="JsonElement.TryGetInt32(out int)"/> throws on null or
/// text, and services and language models do send <c>null</c> (an image with no price estimate, an
/// account whose balance could not be read) or numbers as strings.
/// </summary>
public static class InterviewJsonNumbers
{
    public static bool TryInt(this JsonElement element, out int value)
    {
        value = 0;
        return element.ValueKind switch
        {
            JsonValueKind.Number => element.TryGetInt32(out value),
            JsonValueKind.String => int.TryParse(element.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out value),
            _ => false
        };
    }

    public static bool TryDecimal(this JsonElement element, out decimal value)
    {
        value = 0;
        return element.ValueKind switch
        {
            JsonValueKind.Number => element.TryGetDecimal(out value),
            JsonValueKind.String => decimal.TryParse(element.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out value),
            _ => false
        };
    }

    /// <summary>The named integer property, or null when it is missing, null or not a whole number.</summary>
    public static int? IntOrNull(this JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.TryInt(out var number) ? number : null;
}
