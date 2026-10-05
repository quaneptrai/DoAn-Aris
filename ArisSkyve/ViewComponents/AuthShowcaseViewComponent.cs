using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Presentation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.ViewComponents
{
    /// <summary>
    /// Cột giới thiệu bên trái trang Đăng nhập / Đăng ký (bản "Aris Night", 27/09/2026).
    /// Dùng công ty và tin tuyển dụng thật làm nền tĩnh; DB không phản hồi thì trang auth vẫn hiển thị.
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
                var companies = await _context.BussinessAccounts.AsNoTracking()
                    .Select(b => new
                    {
                        b.Id,
                        Name = b.CompanyName,
                        b.AvatarUrl,
                        b.Industry,
                        Jobs = _context.JobPostings.Count(j => j.BusinessAccountId == b.Id && j.isActive)
                    })
                    .OrderByDescending(c => c.Jobs)
                    .ThenBy(c => c.Name)
                    .Take(6)
                    .ToListAsync();

                model.TopCompanies = companies.Select(b => new AuthShowcaseCompany
                {
                    Name = b.Name,
                    AvatarUrl = AvatarPresentation.ResolveCompanyAvatar(b.AvatarUrl),
                    Industry = b.Industry,
                    Jobs = b.Jobs
                }).ToList();

                var rawJobs = await _context.JobPostings.AsNoTracking()
                    .Where(j => j.isActive)
                    .OrderByDescending(j => j.CreatedAt)
                    .Take(12)
                    .Select(j => new
                    {
                        j.Id,
                        j.Title,
                        Company = j.BusinessAccount != null ? j.BusinessAccount.CompanyName : j.Company,
                        BizAvatar = j.BusinessAccount != null ? j.BusinessAccount.AvatarUrl : null,
                        j.Salary,
                        City = j.Locations.Select(l => l.City).FirstOrDefault()
                    })
                    .ToListAsync();

                model.Jobs = rawJobs.Select(j => new AuthShowcaseJob
                {
                    Id = j.Id,
                    Title = j.Title,
                    Company = j.Company,
                    AvatarUrl = AvatarPresentation.ResolveCompanyAvatar(j.BizAvatar),
                    Salary = j.Salary,
                    City = j.City
                }).ToList();
            }
            catch
            {
                model.TopCompanies.Clear();
                model.Jobs.Clear();
            }
            return View(model);
        }
    }

    public class AuthShowcaseViewModel
    {
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
        public string? City { get; set; }
    }
}
