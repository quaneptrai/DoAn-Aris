using System.Text.Json.Serialization;

namespace ArisSkyve.Application.DTOs
{
    public class AiMatchingDto
    {
        [JsonPropertyName("degraded")]
        public List<string>? Degraded { get; set; }

        [JsonPropertyName("precomputed")]
        public bool? Precomputed { get; set; }

        [JsonPropertyName("precomputed_at")]
        public string? PrecomputedAt { get; set; }
    }

    public class AiResponseWrapper
    {
        [JsonPropertyName("status")]
        public string? Status { get; set; }

        [JsonPropertyName("candidate")]
        public string? Candidate { get; set; }

        [JsonPropertyName("message")]
        public string? Message { get; set; }

        [JsonPropertyName("recommendations")]
        public List<JobRecommendationDTO>? Recommendations { get; set; }

        [JsonPropertyName("matching")]
        public AiMatchingDto? Matching { get; set; }
    }
}
