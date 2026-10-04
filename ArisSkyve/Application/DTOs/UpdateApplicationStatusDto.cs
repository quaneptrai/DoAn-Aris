namespace ArisSkyve.Application.DTOs
{
    public class UpdateApplicationStatusDto
    {
        public string Status { get; set; } = string.Empty;
        public string? Note { get; set; }
        // RejectionCategories — chỉ dùng khi Status = Rejected.
        public string? RejectionCategory { get; set; }
    }
}
