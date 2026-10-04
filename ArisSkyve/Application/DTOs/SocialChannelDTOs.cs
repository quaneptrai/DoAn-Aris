namespace ArisSkyve.Application.DTOs
{
    public class ShareJobRequestDto
    {
        public int JobId { get; set; }
        public List<ShareJobChannelDto> Channels { get; set; } = new();
    }

    public class ShareJobChannelDto
    {
        public int ChannelId { get; set; }
        // Employer-edited caption for this specific channel; falls back to the
        // auto-generated caption on the server if left blank.
        public string? Message { get; set; }
    }

    public class GenerateZaloGroupLinkCodeResultDto
    {
        public bool Success { get; set; }
        public string? Code { get; set; }
        public string? BotDeepLink { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public string? Message { get; set; }
    }
}
