using System.Text.Json;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Data
{
    // Test/demo data: two employer companies with a public profile, each with a
    // handful of job postings bound to them via JobPosting.BusinessAccountId.
    // Only runs once (skips if any BussinessAccount already exists) and is wired
    // up for the Development environment only in Program.cs.
    public static class DbSeeder
    {
        private record SeedJob(
            string Title,
            string Category,
            string Salary,
            string Experience,
            string WorkTime,
            List<string> Responsibilities,
            List<string> Requirements,
            List<string> Benefits,
            List<string> Hashtags,
            string City,
            string Address);

        private record SeedCompany(
            string Username,
            string Email,
            string CompanyName,
            string Industry,
            string Description,
            string WebsiteUrl,
            string CompanySize,
            string TaxCode,
            int FoundedYear,
            string CompanyAddress,
            string Location,
            bool IsVerified,
            List<SeedJob> Jobs);

        public static async Task SeedCompaniesAndJobsAsync(ArisDBContext context)
        {
            if (await context.BussinessAccounts.AnyAsync())
                return;

            var companies = new List<SeedCompany>
            {
                new SeedCompany(
                    Username: "technova_hr",
                    Email: "hr@technova.example.com",
                    CompanyName: "TechNova Solutions",
                    Industry: "Công nghệ thông tin",
                    Description: "TechNova Solutions là công ty phát triển phần mềm và giải pháp AI cho doanh nghiệp vừa và lớn tại Việt Nam, với hơn 8 năm kinh nghiệm triển khai hệ thống cho các đối tác trong và ngoài nước.",
                    WebsiteUrl: "https://technova.example.com",
                    CompanySize: "100-499 nhân viên",
                    TaxCode: "0312345678",
                    FoundedYear: 2015,
                    CompanyAddress: "Tòa nhà Innovation, 123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh",
                    Location: "TP. Hồ Chí Minh",
                    IsVerified: true,
                    Jobs: new List<SeedJob>
                    {
                        new SeedJob(
                            Title: "Backend Developer (.NET)",
                            Category: "Công nghệ thông tin",
                            Salary: "20 - 30 triệu",
                            Experience: "2 năm",
                            WorkTime: "Toàn thời gian",
                            Responsibilities: new List<string>
                            {
                                "Phát triển và bảo trì API bằng ASP.NET Core",
                                "Thiết kế cơ sở dữ liệu SQL Server, tối ưu truy vấn",
                                "Phối hợp với team Frontend và QA để đảm bảo chất lượng sản phẩm"
                            },
                            Requirements: new List<string>
                            {
                                "Thành thạo C#, ASP.NET Core, Entity Framework",
                                "Hiểu biết về SQL Server, REST API",
                                "Có tư duy giải quyết vấn đề tốt"
                            },
                            Benefits: new List<string>
                            {
                                "Lương tháng 13, thưởng dự án",
                                "Bảo hiểm sức khỏe cao cấp",
                                "Review lương 2 lần/năm"
                            },
                            Hashtags: new List<string> { ".NET", "C#", "Backend", "SQL Server" },
                            City: "TP. Hồ Chí Minh",
                            Address: "Tòa nhà Innovation, 123 Nguyễn Huệ, Quận 1"
                        ),
                        new SeedJob(
                            Title: "Frontend Developer (ReactJS)",
                            Category: "Công nghệ thông tin",
                            Salary: "18 - 25 triệu",
                            Experience: "1 năm",
                            WorkTime: "Toàn thời gian",
                            Responsibilities: new List<string>
                            {
                                "Xây dựng giao diện người dùng bằng ReactJS",
                                "Làm việc trực tiếp với UI/UX Designer",
                                "Tối ưu hiệu năng tải trang"
                            },
                            Requirements: new List<string>
                            {
                                "Thành thạo JavaScript/TypeScript, ReactJS",
                                "Hiểu biết về HTML/CSS, responsive design",
                                "Kinh nghiệm làm việc với REST API"
                            },
                            Benefits: new List<string>
                            {
                                "Môi trường trẻ, năng động",
                                "Laptop công ty cấp",
                                "Du lịch công ty hàng năm"
                            },
                            Hashtags: new List<string> { "ReactJS", "Frontend", "JavaScript" },
                            City: "TP. Hồ Chí Minh",
                            Address: "Tòa nhà Innovation, 123 Nguyễn Huệ, Quận 1"
                        ),
                        new SeedJob(
                            Title: "AI Engineer (Junior)",
                            Category: "Trí tuệ nhân tạo",
                            Salary: "Thỏa thuận",
                            Experience: "Không yêu cầu",
                            WorkTime: "Toàn thời gian",
                            Responsibilities: new List<string>
                            {
                                "Xây dựng và huấn luyện mô hình NLP/RAG",
                                "Tích hợp mô hình AI vào sản phẩm thực tế",
                                "Nghiên cứu và thử nghiệm các kỹ thuật AI mới"
                            },
                            Requirements: new List<string>
                            {
                                "Thành thạo Python, hiểu biết về Machine Learning",
                                "Có kiến thức nền tảng về NLP hoặc Vector DB là lợi thế",
                                "Ham học hỏi, chủ động nghiên cứu"
                            },
                            Benefits: new List<string>
                            {
                                "Được đào tạo bởi đội ngũ AI Core",
                                "Cơ hội tham gia dự án AI thực chiến",
                                "Bảo hiểm sức khỏe"
                            },
                            Hashtags: new List<string> { "AI", "Python", "NLP", "Machine Learning" },
                            City: "TP. Hồ Chí Minh",
                            Address: "Tòa nhà Innovation, 123 Nguyễn Huệ, Quận 1"
                        ),
                    }
                ),
                new SeedCompany(
                    Username: "greenleaf_hr",
                    Email: "hr@greenleaffoods.example.com",
                    CompanyName: "GreenLeaf Foods",
                    Industry: "Thực phẩm & Đồ uống",
                    Description: "GreenLeaf Foods chuyên sản xuất và phân phối thực phẩm sạch, hữu cơ trên toàn quốc, hướng đến một hệ sinh thái tiêu dùng bền vững.",
                    WebsiteUrl: "https://greenleaffoods.example.com",
                    CompanySize: "50-99 nhân viên",
                    TaxCode: "0398765432",
                    FoundedYear: 2018,
                    CompanyAddress: "Khu công nghiệp Tân Bình, Quận Tân Phú, TP. Hồ Chí Minh",
                    Location: "TP. Hồ Chí Minh",
                    IsVerified: false,
                    Jobs: new List<SeedJob>
                    {
                        new SeedJob(
                            Title: "Nhân viên Kinh doanh",
                            Category: "Kinh doanh / Bán hàng",
                            Salary: "10 - 15 triệu + hoa hồng",
                            Experience: "Không yêu cầu",
                            WorkTime: "Toàn thời gian",
                            Responsibilities: new List<string>
                            {
                                "Tìm kiếm và chăm sóc khách hàng là đại lý, siêu thị",
                                "Đạt chỉ tiêu doanh số theo tháng/quý",
                                "Báo cáo kết quả kinh doanh định kỳ"
                            },
                            Requirements: new List<string>
                            {
                                "Giao tiếp tốt, chịu được áp lực doanh số",
                                "Ưu tiên có kinh nghiệm ngành FMCG",
                                "Có phương tiện di chuyển cá nhân"
                            },
                            Benefits: new List<string>
                            {
                                "Hoa hồng không giới hạn",
                                "Phụ cấp xăng xe, điện thoại",
                                "Thưởng cuối năm"
                            },
                            Hashtags: new List<string> { "Sales", "Kinh doanh", "FMCG" },
                            City: "TP. Hồ Chí Minh",
                            Address: "Khu công nghiệp Tân Bình, Quận Tân Phú"
                        ),
                        new SeedJob(
                            Title: "Chuyên viên Marketing",
                            Category: "Marketing",
                            Salary: "12 - 18 triệu",
                            Experience: "1 năm",
                            WorkTime: "Toàn thời gian",
                            Responsibilities: new List<string>
                            {
                                "Lên kế hoạch và triển khai chiến dịch marketing đa kênh",
                                "Quản lý fanpage, nội dung mạng xã hội",
                                "Phối hợp agency triển khai sản xuất nội dung"
                            },
                            Requirements: new List<string>
                            {
                                "Có kinh nghiệm chạy quảng cáo Facebook/TikTok Ads",
                                "Kỹ năng viết content tốt",
                                "Tư duy sáng tạo, cập nhật xu hướng"
                            },
                            Benefits: new List<string>
                            {
                                "Thưởng theo hiệu quả chiến dịch",
                                "Ngân sách thử nghiệm ý tưởng riêng",
                                "Nghỉ phép 12 ngày/năm"
                            },
                            Hashtags: new List<string> { "Marketing", "Content", "Social Media" },
                            City: "TP. Hồ Chí Minh",
                            Address: "Khu công nghiệp Tân Bình, Quận Tân Phú"
                        ),
                    }
                ),
            };

            var deadline = DateTime.UtcNow.AddMonths(2);

            foreach (var seedCompany in companies)
            {
                var avatarUrl = "https://ui-avatars.com/api/?name=" + Uri.EscapeDataString(seedCompany.CompanyName) + "&background=0D6EFD&color=fff&size=128";

                var user = new User
                {
                    Username = seedCompany.Username,
                    Email = seedCompany.Email,
                    Role = "Business",
                    ShowActiveStatus = true
                };

                var businessAccount = new BussinessAccount
                {
                    FullName = seedCompany.CompanyName + " HR",
                    Location = seedCompany.Location,
                    JobTitle = "Nhà tuyển dụng",
                    Bio = seedCompany.Description,
                    AvatarUrl = avatarUrl,
                    IsLookingForJob = false,
                    ShareWithRecruiters = false,
                    CompanyName = seedCompany.CompanyName,
                    CompanyAddress = seedCompany.CompanyAddress,
                    Industry = seedCompany.Industry,
                    Description = seedCompany.Description,
                    WebsiteUrl = seedCompany.WebsiteUrl,
                    CompanySize = seedCompany.CompanySize,
                    TaxCode = seedCompany.TaxCode,
                    FoundedYear = seedCompany.FoundedYear,
                    IsVerified = seedCompany.IsVerified,
                    User = user
                };

                context.BussinessAccounts.Add(businessAccount);
                // Saved one company/job at a time: this host's SQL Server rejects
                // EF Core's default multi-row batched MERGE insert for JobPostings
                // ("column cannot be modified because it is ... the result of a
                // UNION operator"), so batching is avoided entirely here.
                await context.SaveChangesAsync();

                foreach (var seedJob in seedCompany.Jobs)
                {
                    var job = new JobPosting
                    {
                        Title = seedJob.Title,
                        Company = seedCompany.CompanyName,
                        Responsibilities = JsonSerializer.Serialize(seedJob.Responsibilities),
                        Requirements = JsonSerializer.Serialize(seedJob.Requirements),
                        Benefits = JsonSerializer.Serialize(seedJob.Benefits),
                        WorkTime = seedJob.WorkTime,
                        Salary = seedJob.Salary,
                        Experience = seedJob.Experience,
                        Deadline = deadline,
                        Category = seedJob.Category,
                        Hashtags = JsonSerializer.Serialize(seedJob.Hashtags),
                        LocationTags = JsonSerializer.Serialize(new List<string> { seedJob.City }),
                        FullText = $"{seedJob.Title} tại {seedCompany.CompanyName}. {string.Join(" ", seedJob.Responsibilities)}",
                        OriginalUrl = string.Empty,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                        BusinessAccount = businessAccount
                    };

                    job.Locations.Add(new JobLocation
                    {
                        City = seedJob.City,
                        Address = seedJob.Address
                    });

                    context.JobPostings.Add(job);
                    await context.SaveChangesAsync();
                }
            }
        }
    }
}
