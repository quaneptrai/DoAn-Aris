namespace ArisSkyve.Application.DTOs
{
    public class BecomeEmployerViewModel
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public string? Location { get; set; }
        // Dùng ở bước 3 để nói rõ điều gì xảy ra với CV và đơn đang chờ sau khi chuyển.
        public int ResumeCount { get; set; }
        public int OpenApplicationCount { get; set; }
    }
}
