using ArisSkyve.Domain.Entities;

namespace ArisSkyve.Infrastructure.Services
{
    /// <summary>
    /// Độ hoàn thiện hồ sơ ứng viên — dùng chung cho sidebar (AppNavbar) và Bảng tin.
    /// Cần nạp sẵn Profile.Education và Profile.ContactMethods.
    /// </summary>
    public static class ProfileCompleteness
    {
        public static (int Percent, List<string> Missing) Compute(EmployesAccount? profile, bool hasResume)
        {
            if (profile == null) return (0, new List<string>());

            var checks = new List<(bool Done, string Missing)>
            {
                (!string.IsNullOrWhiteSpace(profile.AvatarUrl) && profile.AvatarUrl != "/images/default-avatar.png", "ảnh đại diện"),
                (!string.IsNullOrWhiteSpace(profile.JobTitle) && profile.JobTitle != "Ứng viên tiềm năng", "chức danh"),
                (!string.IsNullOrWhiteSpace(profile.Location) && profile.Location != "Chưa cập nhật", "nơi làm việc"),
                (!string.IsNullOrWhiteSpace(profile.Bio) && profile.Bio != "Chưa có tiểu sử.", "giới thiệu"),
                (profile.Education != null, "học vấn"),
                (hasResume, "CV"),
                (profile.ContactMethods != null && profile.ContactMethods.Count > 0, "liên hệ")
            };

            var percent = (int)Math.Round(checks.Count(c => c.Done) * 100.0 / checks.Count);
            var missing = checks.Where(c => !c.Done).Select(c => c.Missing).ToList();
            return (percent, missing);
        }
    }
}
