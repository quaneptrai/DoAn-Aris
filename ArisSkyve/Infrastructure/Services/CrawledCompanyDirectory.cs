using System.Globalization;
using System.Text.Json;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Presentation;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Services
{
    /// <summary>A crawled company as Aris shows it (only public company facts; no emails or phones).</summary>
    public sealed record CrawledCompanyCard(
        int Id,
        string Name,
        string? Logo,
        string? Website,
        string? Industry,
        string? Size,
        string? Address,
        string? Description,
        int? FoundedYear,
        string? TaxCode,
        string? CareersUrl,
        IReadOnlyList<(string Network, string Url)> Socials,
        IReadOnlyList<string> ReferencePages,
        IReadOnlyList<string> Sources,
        IReadOnlyList<string> Names,
        DateTime UpdatedAt);

    /// <summary>
    /// The crawler's company profiles (dbo.Companies), cached in memory and matched to crawled jobs by name.
    /// </summary>
    public interface ICrawledCompanyDirectory
    {
        IReadOnlyList<CrawledCompanyCard> All { get; }
        CrawledCompanyCard? Find(int id);

        /// <summary>Profile for a JobPostings.Company name (case/space-insensitive), or null.</summary>
        CrawledCompanyCard? Match(string? companyName);

        /// <summary>Reloads when the cache is older than its lifetime (or was never loaded).</summary>
        Task EnsureFreshAsync(CancellationToken ct = default);
    }

    public sealed class CrawledCompanyDirectory : BackgroundService, ICrawledCompanyDirectory
    {
        private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

        private sealed record Snapshot(
            IReadOnlyList<CrawledCompanyCard> All,
            IReadOnlyDictionary<int, CrawledCompanyCard> ById,
            IReadOnlyDictionary<string, CrawledCompanyCard> ByName,
            DateTime LoadedAt);

        private static readonly Snapshot Empty = new(
            Array.Empty<CrawledCompanyCard>(), new Dictionary<int, CrawledCompanyCard>(),
            new Dictionary<string, CrawledCompanyCard>(), DateTime.MinValue);

        private static readonly Dictionary<string, string> SourceNames = new(StringComparer.OrdinalIgnoreCase)
        {
            ["vietnamworks"] = "VietnamWorks", ["glints"] = "Glints", ["itviec"] = "ITviec", ["topcv"] = "TopCV",
            ["topcv_http"] = "TopCV", ["careerlink"] = "CareerLink", ["vieclam24h"] = "Việc Làm 24h",
            ["linkedin"] = "LinkedIn",
        };

        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<CrawledCompanyDirectory> _logger;
        private readonly SemaphoreSlim _refresh = new(1, 1);
        private volatile Snapshot _snapshot = Empty;

        public CrawledCompanyDirectory(IServiceScopeFactory scopes, ILogger<CrawledCompanyDirectory> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        public IReadOnlyList<CrawledCompanyCard> All => _snapshot.All;

        public CrawledCompanyCard? Find(int id) => _snapshot.ById.TryGetValue(id, out var c) ? c : null;

        public CrawledCompanyCard? Match(string? companyName)
        {
            var key = NormalizeName(companyName);
            return key.Length > 0 && _snapshot.ByName.TryGetValue(key, out var c) ? c : null;
        }

        /// <summary>Lower-case, single-spaced name used to compare job and company names.</summary>
        public static string NormalizeName(string? name) =>
            string.Join(' ', (name ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
                .ToLower(CultureInfo.InvariantCulture);

        public async Task EnsureFreshAsync(CancellationToken ct = default)
        {
            if (DateTime.UtcNow - _snapshot.LoadedAt < Lifetime) return;
            if (!await _refresh.WaitAsync(0, ct))
            {
                // Someone else is loading: wait for it only when there is nothing to show yet.
                if (_snapshot.LoadedAt != DateTime.MinValue) return;
                await _refresh.WaitAsync(ct);
                _refresh.Release();
                return;
            }
            try
            {
                if (DateTime.UtcNow - _snapshot.LoadedAt < Lifetime) return;
                await LoadAsync(ct);
            }
            finally
            {
                _refresh.Release();
            }
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await EnsureFreshAsync(stoppingToken);
                    await Task.Delay(Lifetime, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        private async Task LoadAsync(CancellationToken ct)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ArisDBContext>();
                var rows = await db.CrawledCompanies.AsNoTracking().ToListAsync(ct);
                var now = DateTime.UtcNow;
                var all = new List<CrawledCompanyCard>(rows.Count);
                var byName = new Dictionary<string, CrawledCompanyCard>();
                foreach (var r in rows)
                {
                    var names = new[] { r.Name }.Concat(JsonList(r.NameVariants))
                        .Select(n => n.Trim()).Where(n => n.Length > 0)
                        .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                    var logo = r.AvatarExpiresAt is DateTime exp && exp <= now ? null : AvatarPresentation.ResolveCompanyAvatar(r.AvatarUrl);
                    var card = new CrawledCompanyCard(
                        r.Id,
                        r.Name.Trim(),
                        logo ?? AvatarPresentation.ResolveCompanyAvatar(r.AvatarFallbackUrl),
                        Http(r.WebsiteUrl),
                        Clean(r.Industry),
                        NormalizeSize(r.CompanySize),
                        Clean(r.Address),
                        Clean(r.Description),
                        r.FoundedYear is > 1800 and < 2100 ? r.FoundedYear : null,
                        Clean(r.TaxCode),
                        Http(r.CareersUrl),
                        Socials(r),
                        JsonList(r.ProfileLinks).Select(Http).OfType<string>().Distinct().Take(8).ToList(),
                        JsonList(r.JobSources).Select(s => SourceNames.TryGetValue(s, out var n) ? n : s).Distinct().ToList(),
                        names,
                        r.UpdatedAt);
                    all.Add(card);
                    foreach (var n in names)
                        byName.TryAdd(NormalizeName(n), card);
                }
                _snapshot = new Snapshot(all, all.ToDictionary(c => c.Id), byName, now);
                _logger.LogInformation("Crawled companies loaded: {Count}", all.Count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // No dbo.Companies in this database, or SQL unreachable: keep what we have and retry later.
                _snapshot = _snapshot with { LoadedAt = DateTime.UtcNow - Lifetime + TimeSpan.FromMinutes(1) };
                _logger.LogDebug("Crawled companies not loaded: {Message}", ex.Message);
            }
        }

        private static IEnumerable<string> JsonList(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return Array.Empty<string>();
            try
            {
                using var doc = JsonDocument.Parse(json);
                return doc.RootElement.ValueKind == JsonValueKind.Array
                    ? doc.RootElement.EnumerateArray().Where(e => e.ValueKind == JsonValueKind.String)
                        .Select(e => e.GetString()!).ToList()
                    : Array.Empty<string>();
            }
            catch (JsonException)
            {
                return Array.Empty<string>();
            }
        }

        private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

        /// <summary>
        /// Job boards write company size many ways ("BETWEEN_51_AND_200", "1-50 employees", "100+\nCán bộ"):
        /// one readable Vietnamese form that always names its unit ("51–200 nhân sự").
        /// </summary>
        public static string? NormalizeSize(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            var s = string.Join(' ', raw.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
            var m = System.Text.RegularExpressions.Regex.Match(s, @"^BETWEEN_(\d+)_AND_(\d+)$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (m.Success) return $"{m.Groups[1].Value}–{m.Groups[2].Value} nhân sự";
            m = System.Text.RegularExpressions.Regex.Match(s, @"^(?:LESS_THAN|UNDER)_(\d+)$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (m.Success) return $"Dưới {m.Groups[1].Value} nhân sự";
            m = System.Text.RegularExpressions.Regex.Match(s, @"^(?:MORE_THAN|OVER|ABOVE)_(\d+)$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (m.Success) return $"Trên {m.Groups[1].Value} nhân sự";
            s = System.Text.RegularExpressions.Regex.Replace(s, @"\b(employees|people|staff|cán bộ|người)\b", "nhân sự", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            return s.Contains("nhân", StringComparison.OrdinalIgnoreCase) ? s : s + " nhân sự";
        }

        private static string? Http(string? url) =>
            url != null && Uri.TryCreate(url.Trim(), UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttps || u.Scheme == Uri.UriSchemeHttp)
                ? u.ToString() : null;

        private static List<(string Network, string Url)> Socials(Domain.Entities.CrawledCompany r)
        {
            var list = new List<(string, string)>();
            void Add(string network, string? url)
            {
                if (Http(url) is string u) list.Add((network, u));
            }
            Add("Facebook", r.FacebookUrl);
            Add("LinkedIn", r.LinkedInUrl);
            Add("YouTube", r.YoutubeUrl);
            Add("TikTok", r.TiktokUrl);
            Add("Instagram", r.InstagramUrl);
            Add("Zalo", r.ZaloUrl);
            return list;
        }
    }
}
