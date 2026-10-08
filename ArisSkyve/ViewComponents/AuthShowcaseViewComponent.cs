using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Presentation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace ArisSkyve.ViewComponents
{
    /// <summary>
    /// Cột giới thiệu bên trái trang Đăng nhập / Đăng ký (bản "Aris Night", 27/09/2026).
    /// Dùng công ty và tin tuyển dụng thật làm nền tĩnh; DB không phản hồi thì trang auth vẫn hiển thị.
    /// </summary>
    public class AuthShowcaseViewComponent : ViewComponent
    {
        private readonly ArisDBContext _context;
        private readonly IConfiguration _configuration;
        private readonly Microsoft.AspNetCore.Hosting.IWebHostEnvironment _environment;

        public AuthShowcaseViewComponent(ArisDBContext context, IConfiguration configuration, Microsoft.AspNetCore.Hosting.IWebHostEnvironment environment)
        {
            _context = context;
            _configuration = configuration;
            _environment = environment;
        }

        public async Task<IViewComponentResult> InvokeAsync()
        {
            var model = new AuthShowcaseViewModel();
            // Opt-in Visual Studio preview only: show clearly labelled examples without
            // touching SQL, seeding users, or presenting these as live Aris vacancies.
            if (_environment.IsDevelopment()
                && _configuration.GetValue<bool>("E2E:UseInMemoryDatabase")
                && _configuration.GetValue<bool>("AuthShowcase:Preview"))
            {
                model.IsPreview = true;
                model.TopCompanies = new List<AuthShowcaseCompany>
                {
                    new() { Name = "FPT Software", AvatarUrl = "/images/company-logos/fpt-software.svg", Industry = "Công nghệ" },
                    new() { Name = "Viettel", AvatarUrl = "/images/company-logos/viettel.svg", Industry = "Viễn thông" },
                    new() { Name = "Tiki", AvatarUrl = "/images/company-logos/tiki.png", Industry = "Thương mại điện tử" }
                };
                model.Jobs = new List<AuthShowcaseJob>
                {
                    new() { Title = "Software Engineering Intern", Company = "FPT Software", AvatarUrl = "/images/company-logos/fpt-software.svg", City = "Việt Nam" },
                    new() { Title = "Cloud Forward Deployed Engineer", Company = "FPT Software", AvatarUrl = "/images/company-logos/fpt-software.svg", City = "Việt Nam" }
                };
                return View(model);
            }
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
                    AvatarUrl = CompanyLogo(b.Name, b.AvatarUrl),
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
                    AvatarUrl = CompanyLogo(j.Company, j.BizAvatar),
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

        private static string? CompanyLogo(string? name, string? avatarUrl)
        {
            var realAvatar = AvatarPresentation.ResolveCompanyAvatar(avatarUrl);
            if (realAvatar != null) return realAvatar;
            // A verified logo is only used for its actual organisation.
            return name?.Trim() switch
            {
                "FPT Software" => "/images/company-logos/fpt-software.svg",
                "Viettel" => "/images/company-logos/viettel.svg",
                "Tiki" => "/images/company-logos/tiki.png",
                _ => null
            };
        }
    }

    public class AuthShowcaseViewModel
    {
        public bool IsPreview { get; set; }
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
