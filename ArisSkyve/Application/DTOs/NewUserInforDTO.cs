namespace ArisSkyve.Application.DTOs
{
    public class NewUserInforDTO
    {
        public int UserId { get; set; }
        
        // Step 1: Về bạn
        public string? Location { get; set; }

        // Học vấn / Nghề nghiệp
        public EducationDTO? Education { get; set; }
        public string? JobTitle { get; set; }
        public bool IsStudent { get; set; }

        // Step 2: Mục tiêu công việc
        public string? JobSearchingStatus { get; set; }
        public bool IsRemoteJob { get; set; }
        public string? DesiredJobTitle { get; set; }
        public string? DesiredCompany { get; set; }

        // Step 3: Quyền riêng tư & chia sẻ
        public bool ShareWithRecruiters { get; set; }

        // Bắt buộc: đồng ý Chính sách quyền riêng tư (/privacy). Tuỳ chọn: cho AI xử lý CV
        // (có thể bật/tắt lại bất cứ lúc nào ở /privacy).
        public bool AcceptPrivacy { get; set; }
        public bool AllowCvAi { get; set; }
    }
}
