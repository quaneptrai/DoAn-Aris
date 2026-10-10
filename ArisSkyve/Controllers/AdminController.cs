using System.Globalization;
using System.Security.Claims;
using ArisSkyve.Application.DTOs;
using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using ArisSkyve.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace ArisSkyve.Controllers;
[Authorize, Route("Admin"), ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AdminController(ArisDBContext db, AdminAccess access, InterviewAdministration administration, InterviewVideoJobs jobs, IInterviewEngine engine) : Controller
{
    private void Audit(int actor, int? target, string action, string detail) => db.AdminAuditLogs.Add(new() { ActorUserId = actor, TargetUserId = target, Action = action, Detail = detail });
    private IActionResult Back(string tab, string message, bool error = false) { TempData[error ? "AdminError" : "AdminSaved"] = message; return Redirect("/Admin?tab=" + tab); }
    [HttpGet("")]
    public async Task<IActionResult> Index(string tab = "requests", string? search = null, string? filter = null, int page = 1, int? requestId = null, CancellationToken token = default)
    {
        if (await access.CurrentAsync(User, token) == null) return Forbid();
        if (tab is not ("requests" or "accounts" or "interviews" or "system" or "audit")) tab = "requests";
        search = search?.Trim(); if (search?.Length > 100) search = search[..100]; page = Math.Clamp(page,1,10000);
        var model = new AdminIndexViewModel { Tab = tab, Search = search, Filter = filter, Page = page,
            Users = await db.Users.CountAsync(token), Businesses = await db.Users.CountAsync(u => u.Role == "Business",token),
            Kits = await db.InterviewKits.CountAsync(token), Pending = await db.SupportRequests.CountAsync(r => r.Status == "pending" || r.Status == "processing" || r.Status == "granting", token) };
        const int count = 30;
        if (tab == "requests") {
            var query = db.SupportRequests.AsNoTracking().Include(r=>r.User).AsQueryable();
            if (requestId != null) query=query.Where(r=>r.Id==requestId);
            if (filter is "pending" or "processing" or "granting" or "resolved" or "rejected") query=query.Where(r=>r.Status==filter);
            if (!string.IsNullOrEmpty(search)) query=query.Where(r=>r.Message.Contains(search) || r.User.Email.Contains(search));
            model.Requests=await query.OrderByDescending(r=>r.Id).Skip((page-1)*count).Take(count+1).ToListAsync(token);
            model.HasNext=model.Requests.Count>count; model.Requests=model.Requests.Take(count).ToList();
        }
        if (tab == "accounts") {
            var query=db.Users.AsNoTracking().AsQueryable();
            if (!string.IsNullOrEmpty(search)) query=query.Where(u=>u.Username.Contains(search)||u.Email.Contains(search));
            if (filter is "Admin" or "Business" or "Employee") query=query.Where(u=>u.Role==filter);
            if (filter == "suspended") query=query.Where(u=>u.IsSuspended);
            model.Accounts=await query.OrderBy(u=>u.Id).Skip((page-1)*count).Take(count+1).Select(u=>new AdminUserRow(u.Id,u.Username,u.Email,u.Role,u.IsSuspended,u.Profile is BussinessAccount ? ((BussinessAccount)u.Profile).CompanyName : null, db.InterviewKits.Count(k=>k.BusinessAccount.UserId==u.Id))).ToListAsync(token);
            model.HasNext=model.Accounts.Count>count;model.Accounts=model.Accounts.Take(count).ToList();
        }
        if (tab == "interviews") {
            var query=db.InterviewKits.AsNoTracking().AsQueryable();
            if (!string.IsNullOrEmpty(search)) query=query.Where(k=>k.Title.Contains(search)||k.BusinessAccount.CompanyName.Contains(search));
            model.Interviews=await query.OrderByDescending(k=>k.Id).Skip((page-1)*count).Take(count+1).Select(k=>new AdminKitRow(k.Id,k.Title,k.BusinessAccount.CompanyName,k.BusinessAccountId,k.BusinessAccount.UserId,k.InviteCode!=null,k.Questions.Count,k.Videos.Count,k.Sessions.Count)).ToListAsync(token);
            model.HasNext=model.Interviews.Count>count;model.Interviews=model.Interviews.Take(count).ToList();
        }
        if (tab == "audit") {
            model.Audit=await db.AdminAuditLogs.AsNoTracking().Include(a=>a.ActorUser).OrderByDescending(a=>a.Id).Skip((page-1)*count).Take(count+1).ToListAsync(token);
            model.HasNext=model.Audit.Count>count;model.Audit=model.Audit.Take(count).ToList();
        }
        return View("~/Views/Admin/Index.cshtml",model);
    }
    [HttpPost("Requests/{id:int}"), ValidateAntiForgeryToken]
    public async Task<IActionResult> Review(int id, string version, string status, string? reply, int? credits, CancellationToken token)
    {
        var admin=await access.CurrentAsync(User,token); if(admin==null)return Forbid();
        var request=await db.SupportRequests.FirstOrDefaultAsync(r=>r.Id==id,token);if(request==null)return NotFound();
        reply=reply?.Trim()??"";
        if(reply.Length>2000 || reply.Length<3 || status is not ("processing" or "resolved" or "rejected")) return Back("requests","Nhập phản hồi từ 3 đến 2.000 ký tự và chọn trạng thái hợp lệ.",true);
        if(request.Status is "resolved" or "rejected" || request.Version != version) return Back("requests","Yêu cầu đã được xử lý hoặc thay đổi. Tải lại để xem trạng thái mới.",true);
        if(request.Kind=="credits" && status=="resolved" && credits is not (>=1 and <=10000)) return Back("requests","Số credit bổ sung phải từ1 đến10.000.",true);
        var employer=request.Kind==EmployerAccounts.RequestKind;
        var details=employer?EmployerAccounts.Details(request.Payload):null;
        if(employer && status=="resolved" && details==null) return Back("requests","Yêu cầu thiếu thông tin công ty nên không duyệt được. Hãy từ chối và đề nghị người gửi gửi lại.",true);
        if(request.Status=="granting" && status!="resolved") return Back("requests","Đang xác nhận credit. Dùng Duyệt lại để xác nhận cùng khoản đã gửi.",true);
        try {
            if(request.Kind=="credits" && status=="resolved") {
                if(request.Status!="granting") {
                    request.Status="granting"; request.GrantedCredits=credits; request.HandledByUserId=admin.Id; request.AdminReply=reply;
                    request.CreditDay=TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTime.UtcNow,"Asia/Ho_Chi_Minh").ToString("yyyy-MM-dd",CultureInfo.InvariantCulture);
                    request.Version=Guid.NewGuid().ToString("N"); request.UpdatedAtUtc=DateTime.UtcNow; await db.SaveChangesAsync(token);
                }
                await administration.GrantAsync(request.Id,request.UserId,request.HandledByUserId!.Value,request.GrantedCredits!.Value,request.CreditDay!,token);
            } else {request.AdminReply=reply;request.HandledByUserId=admin.Id;}
            request.Status=status;request.UpdatedAtUtc=DateTime.UtcNow;request.Version=Guid.NewGuid().ToString("N");
            Audit(admin.Id,request.UserId,"support."+status,$"Yêu cầu #{id}; credit {request.GrantedCredits ?? 0}; ngày {request.CreditDay ?? ""}");
            var staged=await NotificationWriter.StageAsync(db,request.UserId,admin.Id,"SupportResponse",
                !employer?$"Yêu cầu #{id} đã có phản hồi từ quản trị viên.":status=="resolved"?"Yêu cầu đăng tuyển đã được duyệt. Bảng tuyển dụng đã mở.":status=="rejected"?"Yêu cầu đăng tuyển chưa được duyệt. Xem phản hồi của quản trị viên.":$"Quản trị viên đang xem yêu cầu đăng tuyển #{id}.",
                employer?"/Account/BecomeEmployer":"/Employer/InterviewFlow/Support");
            if(employer && status=="resolved") {
                // Approval is the only way a non-admin account becomes an employer: role and profile change in this same save.
                var user=await db.Users.Include(u=>u.Profile).FirstAsync(u=>u.Id==request.UserId,token);
                if(!EmployerAccounts.IsEmployer(user)) {
                    Audit(admin.Id,user.Id,"account.role",$"Duyệt yêu cầu #{id}: chuyển sang nhà tuyển dụng");
                    if(user.Profile is BussinessAccount) user.Role="Business";  // company profile kept from an earlier downgrade
                    else await EmployerAccounts.UpgradeAsync(db,user,EmployerAccounts.Company(details!),token);
                }
            }
            await db.SaveChangesAsync(token);await NotificationWriter.PushAsync(NotificationWriter.HubFrom(HttpContext),db,staged);
            return Back("requests",status=="resolved" && request.GrantedCredits!=null ? "Đã duyệt và bổ sung credit cho ngày " + request.CreditDay + "." : employer && status=="resolved" ? "Đã duyệt: tài khoản đã chuyển sang nhà tuyển dụng." : "Đã lưu phản hồi.");
        } catch(DbUpdateConcurrencyException) {return Back("requests","Yêu cầu vừa được quản trị viên khác cập nhật. Tải lại trang.",true);}
        catch(DbUpdateException) {return Back("requests","Chưa lưu được thay đổi. Tải lại trang rồi thử lại.",true);}
        catch(InterviewEngineException e) {return Back("requests",e.Message+" Khoản credit đang chờ xác nhận; duyệt lại sẽ không cộng trùng.",true);}
    }
    [HttpPost("Accounts/{id:int}/State"), ValidateAntiForgeryToken]
    public async Task<IActionResult> AccountState(int id, bool suspended, CancellationToken token)
    {
        var admin=await access.CurrentAsync(User,token);if(admin==null)return Forbid();
        var user=await db.Users.FirstOrDefaultAsync(u=>u.Id==id,token);if(user==null)return NotFound();
        if(AdminAccess.IsDesignated(user.Email))return Back("accounts","Hai tài khoản quản trị được bảo vệ khỏi khóa hoặc hạ quyền.",true);
        if(user.IsSuspended==suspended)return Back("accounts","Trạng thái tài khoản đã đúng.");
        user.IsSuspended=suspended; Audit(admin.Id,id,suspended?"account.suspend":"account.restore","Đổi trạng thái tài khoản");
        if(suspended) {
            var kits=await db.InterviewKits.Where(k=>k.BusinessAccount.UserId==id).Select(k=>new{k.Id,k.BusinessAccountId}).ToListAsync(token);
            foreach(var kit in kits)jobs.StopVideos(kit.Id,kit.BusinessAccountId);
        }
        await db.SaveChangesAsync(token);return Back("accounts",suspended?"Đã tạm khóa tài khoản; các phiên đăng nhập sẽ bị từ chối.":"Đã mở lại tài khoản.");
    }
    [HttpPost("Accounts/{id:int}/Role"), ValidateAntiForgeryToken]
    public async Task<IActionResult> AccountRole(int id, string role, string? companyName, CancellationToken token)
    {
        var admin=await access.CurrentAsync(User,token);if(admin==null)return Forbid();
        var user=await db.Users.Include(u=>u.Profile).FirstOrDefaultAsync(u=>u.Id==id,token);if(user==null)return NotFound();
        if(AdminAccess.IsDesignated(user.Email))return Back("accounts","Hai tài khoản quản trị được bảo vệ khỏi khóa hoặc hạ quyền.",true);
        if(role is not ("Employee" or "Business"))return Back("accounts","Chỉ hai tài khoản đã chỉ định được cấp quyền Admin.",true);
        // Role=Business with a candidate profile (upgraded before the 09/10 fix) is not an employer yet: let the admin finish it.
        if(user.Role==role && (role!="Business" || user.Profile is BussinessAccount))return Back("accounts","Loại tài khoản đã đúng.");
        if(role=="Business" && user.Profile is not BussinessAccount) {
            companyName=companyName?.Trim(); if(string.IsNullOrEmpty(companyName)||companyName.Length>160)return Back("accounts","Nhập tên công ty (tối đa160 ký tự) khi chuyển sang nhà tuyển dụng.",true);
            var old=user.Profile;
            if(old!=null && db.Database.IsRelational()) {
                await using var transaction=await db.Database.BeginTransactionAsync(token);
                await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE [Profiles] SET [Discriminator]='BussinessAccount',[CompanyName]={companyName} WHERE [Id]={old.Id} AND [UserId]={id}",token);
                user.Role=role;Audit(admin.Id,id,"account.role","Đổi loại tài khoản sang "+role);await db.SaveChangesAsync(token);await transaction.CommitAsync(token);
                return Back("accounts","Đã chuyển tài khoản sang nhà tuyển dụng; giữ nguyên hồ sơ và dữ liệu cũ.");
            }
            Audit(admin.Id,id,"account.role","Đổi loại tài khoản sang "+role);
            await EmployerAccounts.UpgradeAsync(db,user,new BussinessAccount{CompanyName=companyName},token);  // in-memory store, or no profile yet
            return Back("accounts","Đã chuyển tài khoản sang nhà tuyển dụng; giữ nguyên hồ sơ và dữ liệu cũ.");
        }
        user.Role=role;Audit(admin.Id,id,"account.role","Đổi loại tài khoản sang "+role);await db.SaveChangesAsync(token);
        return Back("accounts","Đã đổi loại tài khoản; dữ liệu cũ được giữ lại.");
    }
    [HttpPost("Interviews/{id:int}/Close"), ValidateAntiForgeryToken]
    public async Task<IActionResult> CloseInterview(int id, CancellationToken token)
    {
        var admin=await access.CurrentAsync(User,token);if(admin==null)return Forbid();var kit=await db.InterviewKits.Include(k=>k.BusinessAccount).FirstOrDefaultAsync(k=>k.Id==id,token);if(kit==null)return NotFound();
        kit.InviteCode=null;kit.UpdatedAtUtc=DateTime.UtcNow;Audit(admin.Id,kit.BusinessAccount.UserId,"interview.close",$"Đóng link nhận ứng viên bộ #{id}");await db.SaveChangesAsync(token);return Back("interviews","Đã đóng link nhận ứng viên; kết quả đã lưu được giữ lại.");
    }
    [HttpPost("Interviews/{id:int}/Stop"), ValidateAntiForgeryToken]
    public async Task<IActionResult> StopInterview(int id, CancellationToken token)
    {
        var admin=await access.CurrentAsync(User,token);if(admin==null)return Forbid();var kit=await db.InterviewKits.Include(k=>k.BusinessAccount).FirstOrDefaultAsync(k=>k.Id==id,token);if(kit==null)return NotFound();
        jobs.StopVideos(kit.Id,kit.BusinessAccountId);Audit(admin.Id,kit.BusinessAccount.UserId,"interview.stop",$"Yêu cầu dừng tạo video bộ #{id}");await db.SaveChangesAsync(token);return Back("interviews","Đã gửi lệnh dừng. Lượt đã gửi có thể hoàn tất và tính credit.");
    }
    [HttpGet("Services")]
    public async Task<IActionResult> Services(CancellationToken token) {if(await access.CurrentAsync(User,token)==null)return Forbid();try{return Json(new{ok=true,status=await administration.StatusAsync(token)});}catch(InterviewEngineException e){return Json(new{ok=false,error=e.Message});}}
    [HttpGet("Accounts/{id:int}/Allowance")]
    public async Task<IActionResult> Allowance(int id,CancellationToken token) {if(await access.CurrentAsync(User,token)==null)return Forbid();if(!await db.Users.AnyAsync(u=>u.Id==id,token))return NotFound();try{return Json(new{ok=true,allowance=await engine.AllowanceAsync(id,token)});}catch(InterviewEngineException e){return Json(new{ok=false,error=e.Message});}}
    [HttpPost("Services/Pause"), ValidateAntiForgeryToken]
    public async Task<IActionResult> Pause(bool paused,CancellationToken token) {
        var admin=await access.CurrentAsync(User,token);if(admin==null)return Forbid();
        try {await administration.PauseAsync(paused,token);Audit(admin.Id,null,paused?"service.pause":"service.resume","Đổi trạng thái dịch vụ tạo ảnh/video");await db.SaveChangesAsync(token);return Back("system",paused?"Đã tạm dừng gửi lượt dựng ảnh/video mới.":"Đã mở lại dịch vụ tạo ảnh/video.");}
        catch(InterviewEngineException e){return Back("system",e.Message,true);}
    }
}
