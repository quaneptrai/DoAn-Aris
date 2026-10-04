using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Controllers
{
    // Backs the standalone CV builder UI served from wwwroot/cv-builder.
    // The builder keeps its whole document (template/design/personal/sections) as one
    // JSON blob; we persist that blob as-is on Resume.BuilderDataJson instead of trying
    // to fan it out across the Skills/Experiences/Education tables, which only model the
    // narrower shape produced by the external AI CV-parsing service.
    [Authorize]
    [Route("Resume")]
    public class ResumeController : Controller
    {
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        private const string PineconeDeleteEndpoint = "https://api.quandang.site/delete-cv";
        private readonly ArisDBContext _context;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _config;
        private readonly ResumeOriginalLifecycle _originals;

        public ResumeController(ArisDBContext context, IHttpClientFactory httpClientFactory, IConfiguration config,
            ResumeOriginalLifecycle originals)
        {
            _context = context;
            _httpClientFactory = httpClientFactory;
            _config = config;
            _originals = originals;
        }

        // CV gốc (cv-folder) và ảnh preview (cv-preview) được AiCore lưu bằng presigned URL
        // (giới hạn cứng 7 ngày theo spec SigV4, không set dài hơn được) thay vì link công khai
        // cố định — khác với ảnh/video bài đăng — vì đây là dữ liệu cá nhân của ứng viên, không
        // nên để bucket public. Nên Resume.FileUrl/PreviewImageUrl (và JobApplication's resume
        // snapshot url) chỉ còn dùng được như "toạ độ" (bucket + object key); link thật luôn
        // phải ký lại qua route này trước khi hiển thị, để không bao giờ bị hết hạn từ phía
        // người dùng nhìn thấy.
        [HttpGet("OpenCv")]
        public async Task<IActionResult> OpenCv(string url)
        {
            var freshUrl = await RefreshCvStorageUrlAsync(url);
            if (freshUrl == null) return NotFound();
            return Redirect(freshUrl);
        }

        private async Task<string?> RefreshCvStorageUrlAsync(string? storedUrl)
        {
            if (string.IsNullOrWhiteSpace(storedUrl)) return null;
            if (!Uri.TryCreate(storedUrl, UriKind.Absolute, out var uri)) return null;

            // Direct local / Google Drive storage URLs don't need presigned refresh
            if (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
                uri.AbsolutePath.StartsWith("/storage/", StringComparison.OrdinalIgnoreCase))
            {
                return storedUrl;
            }

            if (!string.Equals(uri.Host, "storage.quandang.site", StringComparison.OrdinalIgnoreCase)) return null;

            var segments = uri.AbsolutePath.TrimStart('/').Split('/', 2);
            if (segments.Length != 2) return null;
            var bucket = segments[0];
            var objectName = Uri.UnescapeDataString(segments[1]);
            if (bucket != "cv-folder" && bucket != "cv-preview") return null;

            var aiCoreBaseUrl = _config["AiCore:BaseUrl"] ?? "http://localhost:8001";
            var client = _httpClientFactory.CreateClient();
            var response = await client.GetAsync(
                $"{aiCoreBaseUrl}/media-refresh-url?bucket={Uri.EscapeDataString(bucket)}&object_name={Uri.EscapeDataString(objectName)}");
            if (!response.IsSuccessStatusCode) return null;

            var result = await response.Content.ReadFromJsonAsync<RefreshUrlResult>();
            return result?.Url;
        }

        private class RefreshUrlResult
        {
            public string? Url { get; set; }
        }

        [HttpGet("")]
        [HttpGet("Index")]
        public async Task<IActionResult> Index()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user?.Profile == null)
            {
                if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
                {
                    return PartialView("_MyCvsPartial", new List<Resume>());
                }
                return View(new List<Resume>());
            }

            var resumes = await _context.Resumes
                .Where(r => r.EmployeeId == user.Profile.Id)
                .OrderByDescending(r => r.LastUpdatedAt)
                .ToListAsync();

            // Profile/Index's "CVs" tab lazy-loads this same list via AJAX — return just
            // the fragment there instead of a full HTML document.
            if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
            {
                return PartialView("_MyCvsPartial", resumes);
            }

            return View(resumes);
        }

        // A builder session must name its target CV.  Choosing the first CV when the
        // id is absent made a generic /cv-builder/builder.html link silently load and
        // later overwrite an unrelated CV.  An id-less session is a new local draft;
        // SaveBuilderData will mint its own row on its first successful save.
        [HttpGet("GetBuilderData")]
        public async Task<IActionResult> GetBuilderData(int? resumeId = null)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user?.Profile == null)
            {
                return Ok(new { hasResume = false, data = (string?)null });
            }

            if (!resumeId.HasValue || resumeId.Value <= 0)
            {
                return Ok(new { hasResume = false, data = (string?)null });
            }

            var resumeQuery = _context.Resumes
                .Include(r => r.Skills)
                .Include(r => r.Experiences)
                .Include(r => r.Educations)
                .Where(r => r.EmployeeId == user.Profile.Id);

            var resume = await resumeQuery.FirstOrDefaultAsync(r => r.Id == resumeId.Value);

            if (resume == null)
            {
                return Ok(new { hasResume = false, data = (string?)null });
            }

            if (!string.IsNullOrWhiteSpace(resume.BuilderDataJson))
            {
                return Ok(new { hasResume = true, data = resume.BuilderDataJson, resumeId = resume.Id });
            }

            // The resume exists (e.g. created by the AI CV-scan pipeline) but was never
            // saved from the builder — synthesize a best-effort builder document from the
            // structured data so "update my CV" still opens pre-filled instead of blank.
            var fallback = BuildFallbackDocument(resume, user.Profile);
            return Ok(new { hasResume = true, data = JsonSerializer.Serialize(fallback, JsonOptions), resumeId = resume.Id });
        }

        // Tạo một CV trống mới, dùng cho luồng "Tạo CV mới" (picker.js gọi endpoint này
        // trước khi mở builder) — tách riêng khỏi SaveBuilderData vì find-or-create theo
        // EmployeeId không còn đúng khi một người có thể có nhiều CV.
        [HttpPost("CreateBlank")]
        public async Task<IActionResult> CreateBlank()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound();

            if (user.Profile == null)
            {
                user.Profile = new EmployesAccount { UserId = user.Id, FullName = user.Username ?? "User", Location = "Chưa cập nhật" };
                _context.Profiles.Add(user.Profile);
                await _context.SaveChangesAsync();
            }

            var resume = new Resume
            {
                EmployeeId = user.Profile.Id,
                Label = "CV mới",
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            };
            _context.Resumes.Add(resume);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, resumeId = resume.Id });
        }

        [HttpPost("RenameResume")]
        public async Task<IActionResult> RenameResume(int resumeId, string label)
        {
            if (string.IsNullOrWhiteSpace(label)) return Json(new { success = false, message = "Tên CV không được để trống." });

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user?.Profile == null) return NotFound();

            var resume = await _context.Resumes.FirstOrDefaultAsync(r => r.Id == resumeId && r.EmployeeId == user.Profile.Id);
            if (resume == null) return NotFound();

            resume.Label = label.Trim();
            await _context.SaveChangesAsync();

            return Json(new { success = true });
        }

        // resumeId is an exact, owner-scoped edit target.  When it is omitted the
        // standalone legacy builder creates a new CV instead of selecting the first
        // existing one; this is intentionally safer than preserving the old implicit
        // overwrite behaviour.
        [HttpPost("SaveBuilderData")]
        public async Task<IActionResult> SaveBuilderData([FromBody] SaveResumeBuilderDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.DataJson))
            {
                return BadRequest();
            }
            if (dto.ResumeId.HasValue && dto.ResumeId.Value <= 0)
            {
                return BadRequest(new { message = "resumeId phải là số dương." });
            }

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
            {
                return NotFound();
            }

            if (user.Profile == null)
            {
                user.Profile = new EmployesAccount { UserId = user.Id, FullName = user.Username ?? "User", Location = "Chưa cập nhật" };
                _context.Profiles.Add(user.Profile);
                await _context.SaveChangesAsync();
            }

            var (name, email) = ExtractPersonal(dto.DataJson);

            Resume? resume = dto.ResumeId.HasValue
                ? await _context.Resumes.FirstOrDefaultAsync(r => r.Id == dto.ResumeId.Value && r.EmployeeId == user.Profile.Id)
                : null;

            if (dto.ResumeId.HasValue && resume == null)
            {
                return NotFound();
            }

            if (resume == null)
            {
                resume = new Resume
                {
                    EmployeeId = user.Profile.Id,
                    Name = name,
                    Email = email,
                    BuilderDataJson = dto.DataJson,
                    CreatedAt = DateTime.UtcNow,
                    LastUpdatedAt = DateTime.UtcNow
                };
                _context.Resumes.Add(resume);
            }
            else
            {
                resume.BuilderDataJson = dto.DataJson;
                if (!string.IsNullOrWhiteSpace(name)) resume.Name = name;
                if (!string.IsNullOrWhiteSpace(email)) resume.Email = email;
                resume.LastUpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, resumeId = resume.Id });
        }

        // Phân tích CV qua AiCore từ phía máy chủ. employee_id lấy từ người dùng đang đăng nhập:
        // trước đây trang Profile gọi thẳng AiCore /process-cv-full với employee_id nằm trong
        // form, nên ai sửa số đó cũng ghi đè được CV của người khác; khoá dịch vụ AiCore
        // (AiCoreKeyHandler) cũng nhờ vậy không bao giờ lộ ra trình duyệt.
        [HttpPost("AnalyzeCv")]
        [RequestSizeLimit(20 * 1024 * 1024)]
        // newResume=true (trang "CV của tôi" › Tải CV có sẵn): file thành một CV mới, không ghi đè CV nào;
        // resumeId: thay file của đúng CV đó. Bỏ trống cả hai: hành vi cũ của trang Hồ sơ.
        // AiCore đọc/OCR/trích xuất bằng AI và lập chỉ mục CV: cần người dùng đồng ý AI xử lý CV (428 nếu chưa).
        [RequireCvAiConsent]
        public async Task<IActionResult> AnalyzeCv(IFormFile? file, bool newResume = false, int? resumeId = null)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { detail = "Chưa chọn file CV." });
            }
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext is not (".pdf" or ".doc" or ".docx"))
            {
                return BadRequest(new { detail = "Chỉ nhận file PDF hoặc Word (.doc, .docx)." });
            }
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var profileId = await _context.Profiles
                .Where(p => p.UserId == userId)
                .Select(p => (int?)p.Id)
                .FirstOrDefaultAsync();
            if (profileId == null)
            {
                return BadRequest(new { detail = "Vui lòng cập nhật hồ sơ cá nhân trước khi tải CV." });
            }

            var aiCoreBaseUrl = (_config["AiCore:BaseUrl"] ?? "http://localhost:8001").TrimEnd('/');
            using var content = new MultipartFormDataContent();
            content.Add(new StringContent(profileId.Value.ToString()), "employee_id");
            content.Add(new StringContent("vi-ateam"), "model");
            if (resumeId.HasValue)
            {
                var owns = await _context.Resumes.AnyAsync(r => r.Id == resumeId.Value && r.EmployeeId == profileId.Value);
                if (!owns) return NotFound(new { detail = "Không tìm thấy CV này." });
                content.Add(new StringContent(resumeId.Value.ToString()), "resume_id");
            }
            else if (newResume)
            {
                content.Add(new StringContent("true"), "new_resume");
                var label = Path.GetFileNameWithoutExtension(file.FileName).Replace('_', ' ').Replace('-', ' ').Trim();
                content.Add(new StringContent(label.Length > 80 ? label[..80] : label), "label");
            }
            var fileContent = new StreamContent(file.OpenReadStream());
            fileContent.Headers.ContentType = MediaTypeHeaderValue.TryParse(file.ContentType, out var type)
                ? type : new MediaTypeHeaderValue("application/octet-stream");
            content.Add(fileContent, "file", file.FileName);
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromMinutes(5); // OCR + trích xuất CV có thể mất vài phút
                var response = await client.PostAsync($"{aiCoreBaseUrl}/process-cv-full", content, HttpContext.RequestAborted);
                var body = await response.Content.ReadAsStringAsync(HttpContext.RequestAborted);
                return new ContentResult
                {
                    StatusCode = (int)response.StatusCode,
                    Content = body,
                    ContentType = "application/json; charset=utf-8"
                };
            }
            catch (HttpRequestException)
            {
                return StatusCode(502, new { detail = "Không kết nối được dịch vụ AI." });
            }
            catch (TaskCanceledException) when (!HttpContext.RequestAborted.IsCancellationRequested)
            {
                return StatusCode(504, new { detail = "Dịch vụ AI xử lý CV quá lâu, vui lòng thử lại." });
            }
        }

        // resumeId cho phép xoá đúng 1 CV cụ thể khi có nhiều CV; bỏ trống để giữ hành vi
        // cũ (xoá CV đầu tiên) cho các link xoá có từ trước.
        [HttpPost("DeleteResume")]
        public async Task<IActionResult> DeleteResume(int? resumeId = null)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user?.Profile == null)
            {
                return NotFound();
            }

            var resumeQuery = _context.Resumes
                .Include(r => r.Skills)
                .Include(r => r.Experiences)
                .Where(r => r.EmployeeId == user.Profile.Id);

            var resume = resumeId.HasValue
                ? await resumeQuery.FirstOrDefaultAsync(r => r.Id == resumeId.Value)
                : await resumeQuery.FirstOrDefaultAsync();

            if (resume == null)
            {
                return Ok(new { success = true, pineconeDeleted = true }); // already gone — deleting is idempotent
            }

            // Imported-layout originals are private per-user files.  Take the ID from a
            // validated Studio document before deleting the row; malformed/legacy blobs
            // deliberately do not authorize file-system cleanup.
            var originalSourceId = ResumeOriginalLifecycle.TryGetStoredSourceId(resume.BuilderDataJson);
            _context.Skills.RemoveRange(resume.Skills);
            _context.Experiences.RemoveRange(resume.Experiences);
            _context.Resumes.Remove(resume);
            await _context.SaveChangesAsync();
            // The row is gone before any file action. Re-check every remaining
            // owner document in the lifecycle service so an intentionally/shared
            // source ID is never removed while another saved CV still uses it.
            await _originals.DeleteIfUnreferencedAsync(userId, originalSourceId, HttpContext.RequestAborted);

            // Chỉ xoá vector Pinecone (khoá theo employee_id, không theo từng CV — có từ
            // trước khi có tính năng nhiều CV) khi đây là CV cuối cùng của ứng viên, để
            // không làm mất dữ liệu AI matching của các CV còn lại.
            var remaining = await _context.Resumes.AnyAsync(r => r.EmployeeId == user.Profile.Id);
            var pineconeDeleted = remaining ? true : await DeletePineconeRecordAsync(user.Profile.Id);

            return Ok(new { success = true, pineconeDeleted });
        }

        private async Task<bool> DeletePineconeRecordAsync(int employeeId)
        {
            try
            {
                var aiCoreBaseUrl = _config["AiCore:BaseUrl"] ?? "http://localhost:8001";
                var client = _httpClientFactory.CreateClient();
                var response = await client.PostAsJsonAsync($"{aiCoreBaseUrl}/delete-cv", new { employee_id = employeeId });
                return response.IsSuccessStatusCode;
            }
            catch (HttpRequestException)
            {
                return false;
            }
        }

        private static (string name, string email) ExtractPersonal(string dataJson)
        {
            try
            {
                using var doc = JsonDocument.Parse(dataJson);
                if (!doc.RootElement.TryGetProperty("personal", out var personal))
                {
                    return (string.Empty, string.Empty);
                }
                var name = personal.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                var email = personal.TryGetProperty("email", out var e) ? e.GetString() ?? "" : "";
                return (name, email);
            }
            catch (JsonException)
            {
                return (string.Empty, string.Empty);
            }
        }

        // AiCore writes one of these into Resume.Note as a placeholder while the real CV text
        // wasn't persisted yet — never show them as if they were the user's actual summary.
        private static readonly HashSet<string> PlaceholderNotes = new(StringComparer.OrdinalIgnoreCase)
        {
            "Processed by AI", "New CV", "Uploaded"
        };

        private static ResumeBuilderDocumentDto BuildFallbackDocument(Resume resume, EmployesAccount profile)
        {
            var sections = new List<ResumeBuilderSectionDto>();

            // Ưu tiên toàn văn CV đã trích xuất thật (ExtractedFullText) thay vì Note, vì Note
            // trước giờ chỉ là placeholder ("Processed by AI"/"New CV") chứ không phải nội dung
            // thật — hiển thị nó như tóm tắt sẽ khiến CV trông như "một CV khác" chứ không phải
            // CV người dùng đã upload.
            var summaryText = !string.IsNullOrWhiteSpace(resume.ExtractedFullText)
                ? resume.ExtractedFullText.Length > 3000 ? resume.ExtractedFullText[..3000] + "…" : resume.ExtractedFullText
                : (!string.IsNullOrWhiteSpace(resume.Note) && !PlaceholderNotes.Contains(resume.Note.Trim()) ? resume.Note : null);

            if (!string.IsNullOrWhiteSpace(summaryText))
            {
                sections.Add(new ResumeBuilderSectionDto
                {
                    Id = "summary",
                    CatalogId = "summary",
                    Type = "text",
                    Content = summaryText
                });
            }

            if (resume.Experiences is { Count: > 0 })
            {
                sections.Add(new ResumeBuilderSectionDto
                {
                    Id = "experience",
                    CatalogId = "experience",
                    Type = "entries",
                    Entries = resume.Experiences.Select(e => new Dictionary<string, string>
                    {
                        ["role"] = e.Role ?? "",
                        ["company"] = e.Company ?? "",
                        ["start"] = "",
                        ["end"] = "",
                        ["description"] = e.Duration ?? ""
                    }).ToList()
                });
            }

            if (resume.Educations is { Count: > 0 })
            {
                sections.Add(new ResumeBuilderSectionDto
                {
                    Id = "education",
                    CatalogId = "education",
                    Type = "entries",
                    Entries = resume.Educations.Select(ed => new Dictionary<string, string>
                    {
                        ["school"] = ed.School ?? "",
                        ["degree"] = string.IsNullOrWhiteSpace(ed.FieldOfStudy)
                            ? (ed.Degree ?? "")
                            : string.IsNullOrWhiteSpace(ed.Degree) ? ed.FieldOfStudy : $"{ed.Degree} · {ed.FieldOfStudy}",
                        ["start"] = ed.StartYear > 0 ? $"{ed.StartYear}-09-01" : "",
                        ["end"] = ""
                    }).ToList()
                });
            }

            if (resume.Skills is { Count: > 0 })
            {
                sections.Add(new ResumeBuilderSectionDto
                {
                    Id = "skills",
                    CatalogId = "skills",
                    Type = "tags",
                    Items = resume.Skills.Select(s => s.SkillName).Where(n => !string.IsNullOrWhiteSpace(n)).ToList()
                });
            }

            return new ResumeBuilderDocumentDto
            {
                Template = "modern",
                Personal = new ResumeBuilderPersonalDto
                {
                    Name = !string.IsNullOrWhiteSpace(resume.Name) ? resume.Name : profile.FullName,
                    Title = profile.JobTitle ?? "",
                    Email = !string.IsNullOrWhiteSpace(resume.Email) ? resume.Email : "",
                    Location = profile.Location ?? ""
                },
                Sections = sections
            };
        }
    }
}
