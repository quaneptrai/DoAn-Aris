namespace ArisSkyve.Application.DTOs
{
    public class UpdateCompanyProfileDto
    {
        public string CompanyName { get; set; } = string.Empty;
        public string? CompanyAddress { get; set; }
        public string? Industry { get; set; }
        public string? Description { get; set; }
        public string? WebsiteUrl { get; set; }
        public string? CompanySize { get; set; }
        public string? TaxCode { get; set; }
        public int? FoundedYear { get; set; }
    }
}
