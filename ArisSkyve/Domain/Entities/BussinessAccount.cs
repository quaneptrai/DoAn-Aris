using System.ComponentModel.DataAnnotations;

namespace ArisSkyve.Domain.Entities
{
    public class BussinessAccount : EmployesAccount
    {
        [Required(ErrorMessage = "Tên công ty không được để trống")]
        public string CompanyName { get; set; } = string.Empty;

        public string? CompanyAddress { get; set; }

        public string? Industry { get; set; }

        public string? Description { get; set; }

        public string? WebsiteUrl { get; set; }

        public string? CompanySize { get; set; } 

        public string? TaxCode { get; set; } 

        public int? FoundedYear { get; set; }

        public bool IsVerified { get; set; } = false; // Tích xanh xác minh doanh nghiệp

        // Mẫu lý do từ chối ứng viên (JSON list) mà HR có thể chọn nhanh khi từ chối một
        // đơn ứng tuyển, thay vì phải gõ tay mỗi lần — quản lý trong Settings.
        public string RejectionTemplates { get; set; } = "[]";
    }
}
