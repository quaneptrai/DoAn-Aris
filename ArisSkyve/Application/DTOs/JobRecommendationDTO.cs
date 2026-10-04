using System.Text.Json.Serialization;

namespace ArisSkyve.Application.DTOs
{
    public class AiRecommendationEvidenceDto
    {
        [JsonPropertyName("cv_quote")]
        public string? CvQuote { get; set; }

        [JsonPropertyName("job_quote")]
        public string? JobQuote { get; set; }
    }

    public class JobRecommendationDTO
    {
        public int Id { get; set; }

        [JsonPropertyName("posting_id")]
        public int? PostingId { get; set; }

        [JsonPropertyName("job_id")]
        public string? JobVectorId { get; set; }

        [JsonPropertyName("job_title")]
        public string JobTitle { get; set; } = string.Empty;

        [JsonPropertyName("company")]
        public string Company { get; set; } = string.Empty;

        // Not part of AiCore's response — filled in server-side from the matched
        // local JobPosting.Category once we resolve rec.Id, so the Jobs page can
        // suggest/highlight a category filter pill without a separate taxonomy.
        public string? Category { get; set; }

        [JsonPropertyName("final_score")]
        public double? Score { get; set; }

        [JsonPropertyName("reason")]
        public string Reason { get; set; } = string.Empty;

        [JsonPropertyName("advice")]
        public string Advice { get; set; } = string.Empty;

        // Khóa tin cậy để đối chiếu lại JobPosting trong SQL khi posting_id chưa có
        [JsonPropertyName("original_url")]
        public string? OriginalUrl { get; set; }

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
    }
}
