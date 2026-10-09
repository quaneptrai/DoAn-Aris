using ArisSkyve.Domain.Entities;

namespace ArisSkyve.Infrastructure.Presentation;

/// <summary>
/// Jobs aggregated from other job boards have no employer on Aris: nobody here receives an application,
/// so candidates apply on the original posting instead.
/// </summary>
public static class JobSourcePresentation
{
    private static readonly (string Host, string Name)[] Known =
    {
        ("vietnamworks.com", "VietnamWorks"), ("glints.com", "Glints"), ("itviec.com", "ITviec"),
        ("topcv.vn", "TopCV"), ("careerlink.vn", "CareerLink"), ("vieclam24h.vn", "Việc Làm 24h"),
        ("linkedin.com", "LinkedIn"),
    };

    /// <summary>True when no Aris employer owns the job (applications cannot be handled inside Aris).</summary>
    public static bool HasNoEmployer(JobPosting job) => job.BusinessAccountId == null;

    /// <summary>The original posting to apply on, or null when the job has an Aris employer or no valid link.</summary>
    public static string? ApplyUrl(JobPosting job) => HasNoEmployer(job) ? HttpUrl(job.OriginalUrl) : null;

    public static string? HttpUrl(string? url) =>
        Uri.TryCreate(url?.Trim(), UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttps || u.Scheme == Uri.UriSchemeHttp)
            ? u.ToString() : null;

    /// <summary>"VietnamWorks", "Glints"… from the posting URL; the bare host for other boards.</summary>
    public static string SourceName(string? url)
    {
        if (!Uri.TryCreate(url?.Trim(), UriKind.Absolute, out var u)) return "trang gốc";
        var host = u.Host.ToLowerInvariant();
        foreach (var (h, name) in Known)
            if (host == h || host.EndsWith("." + h, StringComparison.Ordinal)) return name;
        return host.StartsWith("www.", StringComparison.Ordinal) ? host[4..] : host;
    }

    /// <summary>Why Aris does not take the application, for API responses and toasts.</summary>
    public static string NoEmployerMessage(JobPosting job) => ApplyUrl(job) is null
        ? "Tin này chưa có nhà tuyển dụng trên Aris nên chưa nhận hồ sơ trực tuyến."
        : $"Tin này được tổng hợp từ {SourceName(job.OriginalUrl)}. Hãy nộp hồ sơ trên trang gốc của tin.";
}
