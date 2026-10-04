namespace ArisSkyve.Infrastructure.Services.Recruitment
{
    // Lịch phỏng vấn lưu UTC (trình duyệt gửi toISOString()). Mọi chỗ in giờ ra chữ phía
    // máy chủ — thông báo, file .ics, Razor — phải đổi về giờ Việt Nam, nếu không sẽ lệch 7 tiếng.
    public static class VnTime
    {
        private static readonly TimeZoneInfo Zone = Resolve();

        private static TimeZoneInfo Resolve()
        {
            foreach (var id in new[] { "Asia/Ho_Chi_Minh", "SE Asia Standard Time" })
            {
                try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
                catch (TimeZoneNotFoundException) { }
                catch (InvalidTimeZoneException) { }
            }
            return TimeZoneInfo.CreateCustomTimeZone("ICT", TimeSpan.FromHours(7), "ICT", "ICT");
        }

        public static DateTime ToLocal(DateTime utc)
        {
            var asUtc = utc.Kind == DateTimeKind.Local ? utc.ToUniversalTime() : DateTime.SpecifyKind(utc, DateTimeKind.Utc);
            return TimeZoneInfo.ConvertTimeFromUtc(asUtc, Zone);
        }

        public static string Format(DateTime utc, string format = "HH:mm dd/MM/yyyy") => ToLocal(utc).ToString(format);

        // Giá trị từ JSON có hậu tố Z → Kind=Utc; không có hậu tố thì coi là giờ Việt Nam.
        public static DateTime NormalizeToUtc(DateTime value) => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => TimeZoneInfo.ConvertTimeToUtc(value, Zone)
        };
    }
}
