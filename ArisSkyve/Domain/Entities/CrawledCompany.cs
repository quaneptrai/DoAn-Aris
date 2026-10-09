using System;

namespace ArisSkyve.Domain.Entities
{
    /// <summary>
    /// A company profile assembled by the AiCore job crawler (vn_job_crawler) from the job boards it crawls and
    /// public sources. Read-only for Aris: dbo.Companies belongs to the crawler (its own
    /// migrations/001_create_companies.sql) and is excluded from EF migrations. Crawled JobPostings point to it by
    /// company name (Name / NameVariants), not by key. Emails, phones and the raw record are deliberately not mapped.
    /// </summary>
    public class CrawledCompany
    {
        public int Id { get; set; }
        public string MatchKey { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;

        /// <summary>JSON array of the names as written on job boards (what JobPostings.Company holds).</summary>
        public string? NameVariants { get; set; }

        public string? WebsiteUrl { get; set; }
        public string? AvatarUrl { get; set; }
        public string? AvatarFallbackUrl { get; set; }
        public DateTime? AvatarExpiresAt { get; set; }
        public string? Description { get; set; }
        public string? Industry { get; set; }
        public string? CompanySize { get; set; }
        public int? FoundedYear { get; set; }
        public string? TaxCode { get; set; }
        public string? Address { get; set; }
        public string? CareersUrl { get; set; }
        public string? FacebookUrl { get; set; }
        public string? LinkedInUrl { get; set; }
        public string? YoutubeUrl { get; set; }
        public string? TiktokUrl { get; set; }
        public string? InstagramUrl { get; set; }
        public string? ZaloUrl { get; set; }

        /// <summary>JSON array: the company's pages on job boards, tax registries, Wikipedia…</summary>
        public string? ProfileLinks { get; set; }

        /// <summary>JSON array of crawler source names (vietnamworks, glints…).</summary>
        public string? JobSources { get; set; }

        /// <summary>pending | found | not_found</summary>
        public string ResearchStatus { get; set; } = "pending";
        public DateTime UpdatedAt { get; set; }
    }
}
