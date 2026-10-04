using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public enum SocialPlatform
    {
        FacebookPage = 0,
        ZaloOa = 1,
        ZaloGroup = 2
    }

    // A social destination a business account has connected and can auto-post job
    // listings to (Facebook Page feed, Zalo OA feed, or a Zalo Group via the Zalo Bot
    // Platform). One row per connected destination; the actual post is fired by the n8n
    // workflow, which receives the token/chat id needed for that platform's API call.
    public class SocialChannelConnection
    {
        [Key]
        public int Id { get; set; }

        public int BusinessAccountId { get; set; }
        public BussinessAccount? BusinessAccount { get; set; }

        public SocialPlatform Platform { get; set; }

        // Facebook: Page ID. Zalo OA: OA ID. Zalo Group: chat_id from the Bot Platform.
        [MaxLength(200)]
        public string ExternalId { get; set; } = string.Empty;

        [MaxLength(300)]
        public string DisplayName { get; set; } = string.Empty;

        // Facebook: long-lived Page access token. Zalo OA: OA access token.
        // Zalo Group: unused — the bot token is shared app config, not per-connection.
        public string? AccessToken { get; set; }

        // Zalo OA issues a refresh token alongside its (short-lived) access token.
        public string? RefreshToken { get; set; }

        public DateTime? TokenExpiresAt { get; set; }

        public bool IsActive { get; set; } = true;
        public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;

        // Opt-in per-channel: when true, newly created job postings are sent to this
        // channel automatically (JobsController.CreateJobPosting), on top of the existing
        // manual "Chia sẻ" flow which always stays available regardless of this flag.
        public bool AutoShareEnabled { get; set; } = false;
    }

    // A short-lived, employer-generated code used to prove ownership of a Zalo Group:
    // the employer pastes it as a message in the group where the shared Aris bot has
    // already been added; ZaloBotWebhookController matches the code to this row and
    // promotes it into a SocialChannelConnection (Platform = ZaloGroup).
    public class ZaloGroupLinkCode
    {
        [Key]
        public int Id { get; set; }

        public int BusinessAccountId { get; set; }
        public BussinessAccount? BusinessAccount { get; set; }

        [MaxLength(20)]
        public string Code { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }
        public DateTime? ConsumedAt { get; set; }
    }
}
