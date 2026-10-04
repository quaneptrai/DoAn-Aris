using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ArisSkyve.Controllers
{
    // Backs the global search box in the shared navbar (AppNavbar). One endpoint
    // aggregating Jobs/Companies/People rather than three separate round trips,
    // since the navbar's search dropdown renders all three sections at once.
    [Authorize]
    public class SearchController : Controller
    {
        private readonly ArisDBContext _context;

        public SearchController(ArisDBContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> Global(string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return Json(new { jobs = Array.Empty<object>(), companies = Array.Empty<object>(), people = Array.Empty<object>() });

            var term = q.Trim();
            var myId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            // Tin hết hạn vẫn tìm được ở đây (chỉ bị ẩn khỏi trang chủ Jobs/Index), nên
            // không lọc theo isActive — chỉ ưu tiên tin còn hạn lên trước.
            var jobs = await _context.JobPostings
                .Where(j => j.Title.Contains(term) || j.Company.Contains(term) || j.Category.Contains(term))
                .OrderByDescending(j => j.isActive)
                .ThenByDescending(j => j.CreatedAt)
                .Take(5)
                .Select(j => new
                {
                    id = j.Id,
                    title = j.Title,
                    company = j.Company,
                    salary = j.Salary,
                    isActive = j.isActive
                })
                .ToListAsync();

            var companies = await _context.BussinessAccounts
                .Where(b => b.CompanyName.Contains(term) || (b.Industry != null && b.Industry.Contains(term)))
                .Take(5)
                .Select(b => new
                {
                    id = b.Id,
                    name = b.CompanyName,
                    industry = b.Industry,
                    avatar = b.AvatarUrl
                })
                .ToListAsync();

            var people = await _context.Users
                .Include(u => u.Profile)
                .Where(u => u.Id != myId && (u.Username.Contains(term) || (u.Profile != null && u.Profile.FullName.Contains(term))))
                .Take(5)
                .Select(u => new
                {
                    id = u.Id,
                    username = u.Username,
                    avatar = u.Profile != null ? u.Profile.AvatarUrl : null
                })
                .ToListAsync();

            return Json(new { jobs, companies, people });
        }
    }
}
