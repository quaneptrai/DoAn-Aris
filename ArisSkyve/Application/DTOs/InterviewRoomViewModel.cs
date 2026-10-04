namespace ArisSkyve.Application.DTOs
{
    public class InterviewRoomViewModel
    {
        public int ApplicationId { get; set; }
        public string JobTitle { get; set; } = string.Empty;
        public DateTime? ScheduledAt { get; set; }
        public bool IsEmployer { get; set; }
        public string SelfName { get; set; } = string.Empty;
        public string OtherPartyName { get; set; } = string.Empty;

        // Used purely as a deterministic tie-breaker for WebRTC "perfect negotiation" (the
        // lower user id is always the "polite" peer) — not displayed anywhere.
        public int SelfUserId { get; set; }
        public int OtherPartyUserId { get; set; }
    }
}
