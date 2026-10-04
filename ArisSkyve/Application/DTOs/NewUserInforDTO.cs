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
    }
}
