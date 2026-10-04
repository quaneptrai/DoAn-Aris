# Báo cáo Phase 4 — Đơn ứng tuyển, CV, Hồ sơ, Cài đặt (Applications, CV, Profile, Settings)

**Thời gian hoàn thành:** 2026-09-26 12:04  
**Trạng thái:** Hoàn tất, build 0 lỗi (`dotnet build -c Debug -o .local/v7-build --nologo`)

---

## 1. Tóm tắt công việc
Đã thiết kế lại toàn bộ nhóm trang cá nhân và ứng tuyển theo đúng chuẩn Aris Line V7:
1. **Đơn ứng tuyển (`/JobApplications/MyApplications` & `_MyApplicationsPartial.cshtml`):**
   - CSS: `ArisSkyve/wwwroot/css/pages/applications.css`.
   - Timeline quỹ đạo 5 bước (`.app-timeline`): Nộp đơn -> Nhà tuyển dụng đã xem -> Hẹn phỏng vấn -> Đã phỏng vấn -> Trúng tuyển / Từ chối.
   - Thống kê trực quan, bộ lọc phân khúc (Tất cả, Đang xử lý, Phỏng vấn, Trúng tuyển, Từ chối).
   - Hộp thoại xác nhận rút đơn ứng tuyển Aris V7.
   - Script điều khiển: `ArisSkyve/wwwroot/js/application-actions.js` (không dùng `alert()`/`confirm()` trình duyệt).
2. **Quản lý CV (`/Resume/Index` & `_MyCvsPartial.cshtml`):**
   - CSS: `ArisSkyve/wwwroot/css/pages/cv.css`.
   - Thẻ CV định dạng A4 tỷ lệ chuẩn 1:1.414 với nhãn trạng thái và hành động nhanh.
   - Đổi tên CV tại chỗ (in-place rename).
   - Xóa CV kèm mẫu Hoàn tác trong 6 giây (undo toast) và modal xác nhận.
   - Script điều khiển: `ArisSkyve/wwwroot/js/resume-actions.js`.
3. **Hồ sơ cá nhân (`/Profile/Index.cshtml`):**
   - CSS: `ArisSkyve/wwwroot/css/pages/profile.css`.
   - Bố cục Type B với header: ảnh đại diện 96px có nút đổi ảnh gửi POST tới `/Settings/UpdateAvatar`, ảnh bìa gửi POST tới `/Settings/UpdateCoverPhoto`, thang đo độ hoàn thiện hồ sơ (`.profile-meter`).
   - Thanh tab dính (Sticky Tabs) kèm The Line:
     - **Tổng quan:** Tiểu sử sửa tại chỗ kèm hiệu ứng đánh máy (POST `/Profile/UpdateBio`), trạng thái tìm việc & làm việc từ xa (POST `/Profile/UpdatePreferences`), danh sách liên hệ & modal thêm liên hệ, khu vực kéo thả phân tích CV bằng AI (`.cv-drop-ai`), kỹ năng nổi bật, mục lục và việc làm phù hợp.
     - **Bài viết:** Danh sách bài viết của người dùng, tích hợp sửa tại chỗ và xóa hoàn tác 6s qua `post-actions.js`.
     - **CV của tôi:** Tải lười partial `_MyCvsPartial.cshtml` qua `/Resume/Index`.
     - **Đơn ứng tuyển:** Tải lười partial `_MyApplicationsPartial.cshtml` qua `/JobApplications/MyApplications`.
4. **Cài đặt tài khoản (`/Settings/Index.cshtml`):**
   - CSS: `ArisSkyve/wwwroot/css/pages/settings.css`.
   - Bố cục Type B với thanh điều hướng phụ dính bên trái (`.settings-nav`):
     - Hồ sơ & Tài khoản: Cập nhật ảnh đại diện, đổi tên hiển thị (POST `/Settings/UpdateUsername`), hiển thị email liên kết.
     - Quyền riêng tư & Trạng thái: Bật/tắt trạng thái trực tuyến (POST `/Settings/UpdateActiveStatus`).
     - Giao diện: Chuyển đổi chủ đề Sáng / Tối / Tự động theo hệ thống.
     - Mẫu phản hồi từ chối (Dành cho tài khoản Doanh nghiệp): Thêm/xóa/lưu mẫu (POST `/Settings/UpdateRejectionTemplates`, GET `/Settings/GetRejectionTemplates`).
     - Kênh liên kết: Quản lý fanpage Facebook kết nối.
     - Phiên đăng nhập: Nút đăng xuất an toàn kèm xác nhận.
5. **Kênh liên kết mạng xã hội (`/SocialConnect/SelectFacebookPage.cshtml`):**
   - Cập nhật sang token chuẩn V7, loại bỏ CSS Bootstrap cũ.

---

## 2. Kiểm chứng kỹ thuật
- Chạy `dotnet build ArisSkyve/ArisSkyve.csproj -c Debug -o .local/v7-build --nologo`: **0 Lỗi, 51 Cảnh báo không liên quan**.
- Kiểm tra tính gắn kết của các partial và AJAX lazy load giữa Profile, Resume và JobApplications.
