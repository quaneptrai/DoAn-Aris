namespace ArisSkyve.Application.DTOs
{
    public class ScheduleInterviewDto
    {
        public DateTime ScheduledAt { get; set; }
        public string? Location { get; set; }
        public string? Note { get; set; }
        public bool IsVideoCall { get; set; }
        // 15–240 phút; null giữ 45 phút mặc định (hoặc thời lượng của lần hẹn trước).
        public int? DurationMinutes { get; set; }
        // true = vòng tiếp theo (sau phiếu đánh giá "Vòng sau"); false = hẹn/đổi lịch vòng hiện tại.
        public bool NextRound { get; set; }
        // Bỏ qua cảnh báo trùng lịch với buổi phỏng vấn khác của công ty.
        public bool Force { get; set; }
        // Có giá trị = phỏng vấn AI bằng bộ phỏng vấn này thay cho gặp người thật; ScheduledAt là hạn hoàn thành.
        public int? InterviewKitId { get; set; }
    }
}
