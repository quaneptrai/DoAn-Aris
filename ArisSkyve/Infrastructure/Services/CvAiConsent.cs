using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Services
{
    // Đồng ý cho AI xử lý CV (User.CvAiConsentAt). Các API gửi nội dung CV sang AI (AiCore, OpenAI)
    // gắn [RequireCvAiConsent]; khi chưa đồng ý chúng trả 428 với code "cv_ai_consent_required" để
    // giao diện hỏi người dùng, ghi nhận qua POST /privacy/cv-ai-consent rồi gửi lại yêu cầu.
    public static class CvAiConsent
    {
        public const string ErrorCode = "cv_ai_consent_required";
        public const string PolicyUrl = "/privacy#cv-ai";

        public static async Task<bool> HasConsentAsync(ArisDBContext db, ClaimsPrincipal principal)
        {
            if (!int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return false;
            return await db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => u.CvAiConsentAt)
                .FirstOrDefaultAsync() is not null;
        }

        public static ObjectResult RequiredResult() => new(new
        {
            error = "Bạn cần đồng ý cho Aris dùng AI xử lý CV trước khi dùng tính năng này.",
            code = ErrorCode,
            policyUrl = PolicyUrl
        })
        { StatusCode = StatusCodes.Status428PreconditionRequired };
    }

    // onlyWhenModeIs: chỉ áp dụng khi tham số "mode" của action bằng giá trị này
    // (Parse: "template" gửi CV sang OpenAI; "layout" xử lý cục bộ, không dùng AI).
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class RequireCvAiConsentAttribute : TypeFilterAttribute
    {
        public RequireCvAiConsentAttribute(string onlyWhenModeIs = "") : base(typeof(RequireCvAiConsentFilter))
        {
            Arguments = new object[] { onlyWhenModeIs };
        }
    }

    public sealed class RequireCvAiConsentFilter : IAsyncActionFilter
    {
        private readonly ArisDBContext _db;
        private readonly string _onlyWhenModeIs;

        public RequireCvAiConsentFilter(ArisDBContext db, string onlyWhenModeIs)
        {
            _db = db;
            _onlyWhenModeIs = onlyWhenModeIs;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            if (!string.IsNullOrEmpty(_onlyWhenModeIs))
            {
                var mode = context.ActionArguments.TryGetValue("mode", out var value) ? value as string : null;
                if (!string.Equals(mode, _onlyWhenModeIs, StringComparison.OrdinalIgnoreCase))
                {
                    await next();
                    return;
                }
            }

            if (!await CvAiConsent.HasConsentAsync(_db, context.HttpContext.User))
            {
                context.Result = CvAiConsent.RequiredResult();
                return;
            }
            await next();
        }
    }
}
