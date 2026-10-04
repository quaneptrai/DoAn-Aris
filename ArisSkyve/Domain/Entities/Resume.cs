    using System.ComponentModel.DataAnnotations;
    using System.ComponentModel.DataAnnotations.Schema;

    namespace ArisSkyve.Domain.Entities
    {
        public class Resume
        {
            [Key]
            public int Id { get; set; }
            [Required]
            public int EmployeeId { get; set; }
            // Người dùng đặt tên riêng để phân biệt khi có nhiều CV (VD: "CV Backend",
            // "CV thực tập") — khác với Name bên dưới (tên người, trích từ nội dung CV).
            public string Label { get; set; } = "CV của tôi";
            public string Name { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string SearchVectorContent { get; set; } = string.Empty;
            public List<Skills> Skills { get; set; } = new List<Skills>();
            public List<Experiences> Experiences { get; set; } = new List<Experiences>();
            public List<Education> Educations { get; set; } = new List<Education>();
            public string? VectorId { get; set; }
            public string Category { get; set; } = string.Empty;
            public string Note { get; set; } = string.Empty;
            public string? BuilderDataJson { get; set; }
            // URL của file CV gốc (PDF/DOC/DOCX) đã upload lên bucket "cv-folder", và ảnh xem
            // trước (trang đầu) trong bucket "cv-preview" — do AiCore ghi trực tiếp bằng SQL
            // thô (MERGE theo EmployeeId), nên mỗi lần upload lại sẽ ghi đè đúng bản ghi Resume
            // này thay vì tạo bản ghi khác.
            public string? FileUrl { get; set; }
            public string? PreviewImageUrl { get; set; }
            // Toàn văn CV đã trích xuất (trước đây bị bỏ đi ngay sau khi AiCore parse xong bằng
            // LLM) — dùng làm nội dung tóm tắt thật trong CV Builder thay vì fallback rỗng.
            public string? ExtractedFullText { get; set; }
            [ForeignKey("EmployeeId")]
            public virtual EmployesAccount Account { get; set; } = null!;
            public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
            public DateTime LastUpdatedAt { get; set; }
        }
    }
