using ArisSkyve.Domain.Entities;

namespace ArisSkyve.Application.DTOs
{
    public class CompanyListItemViewModel
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public string? Industry { get; set; }
        public string? CompanyAddress { get; set; }
        public string? AvatarUrl { get; set; }
        public string? CoverPhotoUrl { get; set; }
        public string? CompanySize { get; set; }
        public string? Description { get; set; }
        public bool IsVerified { get; set; }
        public int OpenJobCount { get; set; }
        public int? FoundedYear { get; set; }

        /// <summary>Tin đang mở mới nhất của công ty (thẻ "Đang tuyển: …" trên trang Khám phá).</summary>
        public int? LatestJobId { get; set; }
        public string? LatestJobTitle { get; set; }
        public string? LatestJobSalary { get; set; }

        /// <summary>Số người theo dõi thật (bảng CompanyFollows); 0 khi tính năng chưa bật.</summary>
        public int FollowerCount { get; set; }
        public bool IsFollowing { get; set; }
    }

    /// <summary>Trang Khám phá công ty (thiết kế "Aris Kinetic" theo mẫu Stitch, 26/09/2026).</summary>
    public class CompanyDiscoverViewModel
    {
        public List<CompanyListItemViewModel> Companies { get; set; } = new();
        public List<CultureStoryItem> Culture { get; set; } = new();
        public List<CompanySuggestionItem> Suggestions { get; set; } = new();

        /// <summary>true khi gợi ý khớp với chức danh của người xem (ngược lại là "đang tuyển nhiều").</summary>
        public bool SuggestionsMatched { get; set; }
        public int ViewerId { get; set; }
        public string? ViewerName { get; set; }
        public string? ViewerTitle { get; set; }
        public string? ViewerAvatar { get; set; }
        public bool ViewerIsBusiness { get; set; }
        public int? ViewerCompanyId { get; set; }
        public bool FollowEnabled { get; set; }
        public List<string> TopIndustries { get; set; } = new();
    }

    /// <summary>Bài viết có ảnh do doanh nghiệp đăng — "câu chuyện văn hoá".</summary>
    public class CultureStoryItem
    {
        public int PostId { get; set; }
        public CompanyListItemViewModel Company { get; set; } = default!;
        public string? Title { get; set; }
        public string Text { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public List<(string Url, bool IsVideo)> Media { get; set; } = new();
        public int LikeCount { get; set; }
        public int CommentCount { get; set; }
        public bool Saved { get; set; }
    }

    public class CompanySuggestionItem
    {
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public bool IsVerified { get; set; }
        public int JobId { get; set; }
        public string JobTitle { get; set; } = string.Empty;
        public string? Salary { get; set; }
    }

    public class CompanyDetailsViewModel
    {
        public BussinessAccount Company { get; set; } = default!;
        public List<JobPosting> Jobs { get; set; } = new();
        public int OpenJobCount { get; set; }
        public bool IsOwner { get; set; }

        /// <summary>Theo dõi (bảng CompanyFollows — chỉ khi tính năng V7 đã bật).</summary>
        public bool FollowEnabled { get; set; }
        public int FollowerCount { get; set; }
        public bool IsFollowing { get; set; }

        /// <summary>Ảnh/video từ bài công khai của chính công ty — mục "Khoảnh khắc".</summary>
        public List<CompanyMomentItem> Moments { get; set; } = new();
        public int PostCount { get; set; }
    }

    public sealed class CompanyRankingRowViewModel
    {
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public string? Industry { get; set; }
        public string? AvatarUrl { get; set; }
        public bool IsVerified { get; set; }
        public int ProfileViewCount { get; set; }
        public int FollowerCount { get; set; }
        public int ApplicationCount { get; set; }
    }

    public sealed class CompanyRankingViewModel
    {
        public string SortBy { get; set; } = "overall";
        public string? Industry { get; set; }
        public bool FollowerMetricAvailable { get; set; }
        public List<string> Industries { get; set; } = new();
        public List<CompanyRankingRowViewModel> Companies { get; set; } = new();
    }

    public class CompanyMomentItem
    {
        public int PostId { get; set; }
        public string Url { get; set; } = string.Empty;
        public bool IsVideo { get; set; }
        public string? Caption { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
