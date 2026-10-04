namespace ArisSkyve.Application.DTOs
{
    /// <summary>
    /// Thông tin phụ của một bài trên Bảng tin (thiết kế "Aris Kinetic", 26/09/2026).
    /// Mọi trường đều là dữ liệu thật; trường nào không có thì giao diện tự ẩn.
    /// </summary>
    public class FeedPostMeta
    {
        public bool IsCompany { get; set; }
        public int? CompanyId { get; set; }
        public string? CompanyName { get; set; }
        public string? Industry { get; set; }
        public string? CompanyAddress { get; set; }
        public bool Verified { get; set; }
        public int OpenJobs { get; set; }
        public bool Following { get; set; }

        /// <summary>"self" | "friend" | "pending" | "none"</summary>
        public string Relation { get; set; } = "none";
        public bool Saved { get; set; }
        public List<string> FriendLikers { get; set; } = new();
    }

    /// <summary>Lời mời kết bạn đang chờ mình trả lời (cột phải Bảng tin).</summary>
    public record FeedRequestItem(int RequestId, int UserId, string Name, string? AvatarUrl, string? Subtitle, int MutualCount);

    /// <summary>Một việc cần làm ở cột phải Bảng tin (ngoài lời mời phỏng vấn).</summary>
    public record FeedTodoItem(string Icon, string Title, string Sub, string Href, string Action);
}
