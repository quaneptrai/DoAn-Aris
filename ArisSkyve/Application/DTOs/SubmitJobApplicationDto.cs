namespace ArisSkyve.Application.DTOs
{
    public class SubmitJobApplicationDto
    {
        public int ResumeId { get; set; }
        public string? CoverLetter { get; set; }
        public List<string> ScreeningAnswers { get; set; } = new();
    }
}
