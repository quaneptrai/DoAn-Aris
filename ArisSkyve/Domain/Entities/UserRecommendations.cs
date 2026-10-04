namespace ArisSkyve.Domain.Entities
{
    public class UserRecommendations
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int JobId { get; set; }
        public int? ResumeId { get; set; }
        public double MatchScore { get; set; }
        public double? Score { get; set; }
        public string Reason { get; set; } = string.Empty;
        public int? Rank { get; set; }
        public string? PayloadJson { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime ResumeVersion { get; set; }
    }
}
