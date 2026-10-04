using System.Text.Json.Serialization;

namespace ArisSkyve.Application.DTOs
{
    public class AiRecommendationPayload
    {
        [JsonPropertyName("version")]
        public int Version { get; set; } = 1;

        [JsonPropertyName("score")]
        public double? Score { get; set; }

        [JsonPropertyName("reason")]
        public string? Reason { get; set; }

        [JsonPropertyName("advice")]
        public string? Advice { get; set; }

        [JsonPropertyName("matched_skills")]
        public List<string>? MatchedSkills { get; set; }

        [JsonPropertyName("missing_skills")]
        public List<string>? MissingSkills { get; set; }

        [JsonPropertyName("evidence")]
        public List<AiRecommendationEvidenceDto>? Evidence { get; set; }

        [JsonPropertyName("explanation_status")]
        public string? ExplanationStatus { get; set; }

        [JsonPropertyName("llm_model")]
        public string? LlmModel { get; set; }

        [JsonPropertyName("rank")]
        public int? Rank { get; set; }

        [JsonPropertyName("requested_top_k")]
        public int? RequestedTopK { get; set; }

        [JsonPropertyName("degraded")]
        public List<string>? Degraded { get; set; }
    }
}
