using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.ViewComponents
{
    /// <summary>
    /// Cột giới thiệu bên trái trang Đăng nhập / Đăng ký (bản "Aris Night", 27/09/2026).
    /// Chỉ dùng dữ liệu thật: tin tuyển dụng mới nhất chạy thành "bức tường" phía sau tiêu đề,
    /// thẻ "Mới đăng" là tin gần nhất. DB không phản hồi thì vẫn vẽ trang, chỉ ẩn phần số liệu.
    /// </summary>
    public class AuthShowcaseViewComponent : ViewComponent
    {
        private readonly ArisDBContext _context;

        public AuthShowcaseViewComponent(ArisDBContext context)
        {
            _context = context;
        }

        public async Task<IViewComponentResult> InvokeAsync()
        {
            var model = new AuthShowcaseViewModel();
            try
            {
                model.Companies = await _context.BussinessAccounts.AsNoTracking().CountAsync();
                model.OpenJobs = await _context.JobPostings.AsNoTracking().CountAsync(j => j.isActive);
                model.Members = await _context.Users.AsNoTracking().CountAsync();
                model.TopCompanies = await _context.BussinessAccounts.AsNoTracking()
                    .Select(b => new AuthShowcaseCompany
                    {
                        Name = b.CompanyName,
                        AvatarUrl = b.AvatarUrl,
                        Industry = b.Industry,
                        Jobs = _context.JobPostings.Count(j => j.BusinessAccountId == b.Id && j.isActive)
                    })
                    .OrderByDescending(c => c.Jobs)
                    .ThenBy(c => c.Name)
                    .Take(6)
                    .ToListAsync();
                model.Jobs = await _context.JobPostings.AsNoTracking()
                    .Where(j => j.isActive)
                    .OrderByDescending(j => j.CreatedAt)
                    .Take(12)
                    .Select(j => new AuthShowcaseJob
                    {
                        Id = j.Id,
                        Title = j.Title,
                        Company = j.BusinessAccount != null ? j.BusinessAccount.CompanyName : j.Company,
                        AvatarUrl = j.BusinessAccount != null ? j.BusinessAccount.AvatarUrl : null,
                        Salary = j.Salary,
                        WorkTime = j.WorkTime,
                        City = j.Locations.Select(l => l.City).FirstOrDefault(),
                        CreatedAt = j.CreatedAt
                    })
                    .ToListAsync();
                model.HasData = true;
            }
            catch
            {
                model.HasData = false;
            }
            return View(model);
        }
    }

    public class AuthShowcaseViewModel
    {
        public bool HasData { get; set; }
        public int Companies { get; set; }
        public int OpenJobs { get; set; }
        public int Members { get; set; }
        public List<AuthShowcaseCompany> TopCompanies { get; set; } = new();
        public List<AuthShowcaseJob> Jobs { get; set; } = new();
    }

    public class AuthShowcaseCompany
    {
        public string Name { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public string? Industry { get; set; }
        public int Jobs { get; set; }
    }

    public class AuthShowcaseJob
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Company { get; set; }
        public string? AvatarUrl { get; set; }
        public string? Salary { get; set; }
        public string? WorkTime { get; set; }
        public string? City { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
