namespace ArisSkyve.Application.DTOs
{
    public class CvExtractionResultDTO
    {
        public bool is_student { get; set; }
        public string name { get; set; }
        public string email { get; set; }
        public string note { get; set; }
        public List<EducationDTO> education { get; set; }
        public List<string> skills { get; set; }
        public List<string> experiences { get; set; }
        public string search_vector_content { get; set; }
    }
}
