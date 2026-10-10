namespace ArisSkyve.Application.DTOs
{
    public class BecomeEmployerViewModel
    {
        // Quản trị viên đã hạ tài khoản về ứng viên: chỉ quản trị viên cấp lại được, nên không hiện form.
        public bool Revoked { get; set; }
        // Mọi tài khoản trừ quản trị viên phải chờ quản trị viên duyệt yêu cầu (quy định của chủ dự án 11/10).
        public bool NeedsApproval { get; set; } = true;
        // Yêu cầu đang chờ duyệt: tên công ty đã gửi và thời điểm gửi. Null khi không có yêu cầu đang mở.
        public string? PendingCompany { get; set; }
        public DateTime? PendingSince { get; set; }
        // Phản hồi của quản trị viên khi yêu cầu gần nhất bị từ chối.
        public string? RejectedReply { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public string? Location { get; set; }
        // Dùng ở bước 3 để nói rõ điều gì xảy ra với CV và đơn đang chờ sau khi chuyển.
        public int ResumeCount { get; set; }
        public int OpenApplicationCount { get; set; }
    }
}
