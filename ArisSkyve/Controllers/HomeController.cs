using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace ArisSkyve.Controllers
{
    public class HomeController : Controller
    {
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error(int? statusCode = null)
        {
            ViewBag.StatusCode = statusCode ?? Response.StatusCode;
            ViewBag.RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier;

            string title = "Đã xảy ra lỗi";
            string message = "Hệ thống gặp sự cố trong quá trình xử lý yêu cầu của bạn. Vui lòng thử lại sau.";

            if (statusCode == 404)
            {
                title = "Trang không tồn tại (404)";
                message = "Đường dẫn bạn truy cập không tồn tại hoặc đã được chuyển sang vị trí khác.";
            }
            else if (statusCode == 403)
            {
                title = "Từ chối truy cập (403)";
                message = "Bạn không có quyền truy cập vào nội dung này.";
            }
            else if (statusCode == 401)
            {
                title = "Yêu cầu đăng nhập (401)";
                message = "Phiên làm việc của bạn đã hết hạn. Vui lòng đăng nhập lại.";
            }

            ViewBag.ErrorTitle = title;
            ViewBag.ErrorMessage = message;

            return View();
        }
    }
}
