using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        public string Username { get; set; }
        public string Email { get; set; }

        public string Role { get; set; } = "Employee";

        public bool ShowActiveStatus { get; set; } = true;

        public bool IsSuspended { get; set; } = false;

        // Thời điểm người dùng đồng ý Chính sách quyền riêng tư (bước NewUserInfor). Null = chưa ghi nhận.
        public DateTime? PrivacyAcceptedAt { get; set; }

        // Thời điểm đồng ý cho AI xử lý CV (đọc/chấm/chuyển mẫu/lập chỉ mục gợi ý việc làm).
        // Null = chưa đồng ý hoặc đã rút lại; các API AI trên CV trả 428 cv_ai_consent_required.
        public DateTime? CvAiConsentAt { get; set; }

        public EmployesAccount? Profile { get; set; }
        public List<Post> Posts { get; set; } = new();
        public List<Like> Likes { get; set; } = new();
        public List<Comment> Comments { get; set; } = new();
    }
}
