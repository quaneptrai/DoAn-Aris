using System.Text.Json.Serialization;

namespace ArisSkyve.Application.DTOs
{
    public class ScoreCvRequestDto
    {
        [JsonPropertyName("jobId")]
        public int JobId { get; set; }

        [JsonPropertyName("resumeId")]
        public int? ResumeId { get; set; }
    }
}
