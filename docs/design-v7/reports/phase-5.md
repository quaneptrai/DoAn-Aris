# Báo cáo Phase 5 — Tuyển dụng & Doanh nghiệp (Employer Pipeline, Posted Jobs, Company)

**Thời gian hoàn thành:** 2026-09-26 12:09  
**Trạng thái:** Hoàn tất, build 0 lỗi (`dotnet build -c Debug -o .local/v7-build --nologo`)

---

## 1. Tóm tắt công việc
Đã thiết kế lại toàn bộ nhóm trang Doanh nghiệp & Tuyển dụng theo đúng chuẩn Aris Line V7:

### A. Tuyển dụng & Pipeline (`/Employer/Index.cshtml`)
- **Loại bỏ hoàn toàn di sản cũ:** Gỡ bỏ 4 ô KPI Bootstrap mặc định và bảng danh sách table cũ.
- **Bố cục Kiểu A (Master–Detail) chuẩn V7:**
  - **Cột trái (Canvas 320px):** Danh sách tin tuyển dụng với tiêu đề, mức lương, số lượng ứng viên (`.employer-job-item__badge`), chấm trạng thái, chọn tin đổi pipeline tại chỗ qua `selectJob(jobId)`.
  - **Cột phải (Sheet):** Header tin tuyển dụng được chọn kèm các nút hành động (Quản lý tin, Trang công ty).
  - **Bảng Pipeline 6 cột (`.pipeline-board`):**
    1. `Submitted` — Đã nộp
    2. `UnderReview` — Đang xem xét
    3. `Shortlisted` — Rút gọn
    4. `InterviewScheduled` — Phỏng vấn
    5. `Offered` — Nhận Offer
    6. `Rejected` — Từ chối (thu gọn mặc định, bấm để mở rộng)
  - **Thẻ ứng viên (`.candidate-card`):** Avatar 32px, tên, vị trí, nhãn "Lần N" nếu ứng tuyển nhiều lần, nhãn "Phỏng vấn", ngày nộp.
  - **Tương tác kéo–thả (Drag & Drop) và phím tắt (Alt+Mũi tên):**
    - Kéo thả thẻ giữa các cột để cập nhật trạng thái ngay lập tức (lạc quan) và hoàn tác trong 6 giây qua Toast (`ArisMotion.toast`).
    - Thả vào `Rejected`: Mở modal xác nhận từ chối `#rejectionModal` kèm danh sách gợi ý từ `GetRejectionTemplates`.
    - Thả vào `InterviewScheduled`: Mở modal lên lịch `#scheduleInterviewModal` (ngày, giờ, địa điểm, công tắc tạo phòng phỏng vấn trực tuyến Aris Video Room `IsVideoCall`).
  - **Ngăn chi tiết ứng viên trượt từ phải (Slide-in Drawer 420px):** Bấm thẻ mở drawer hiển thị thông tin liên hệ, thư giới thiệu, câu trả lời, nút mở CV gốc qua `/Resume/OpenCv` và nút nhắn tin trực tiếp qua `/Chat?userId=...`.
- **Tập tin CSS & JS:**
  - `ArisSkyve/wwwroot/css/pages/employer.css`
  - `ArisSkyve/wwwroot/js/pages/employer.js`

### B. Công ty & Doanh nghiệp
1. **Khám phá doanh nghiệp (`/Company/Index.cshtml`):**
   - CSS: `ArisSkyve/wwwroot/css/pages/company.css`.
   - Bố cục Kiểu B với ô tìm kiếm tức thì và số đếm doanh nghiệp/vị trí tuyển dụng.
   - Chuyển từ lưới card lớn sang danh sách hàng công ty (`.company-row`): Logo 44px, tên công ty, tích xanh xác minh, ngành nghề, quy mô, địa chỉ và số lượng việc làm đang tuyển.
2. **Hồ sơ chi tiết công ty (`/Company/Details.cshtml`):**
   - Header công ty với logo 72px, tên 22px, ngành nghề, quy mô, website, nút "Xem việc làm" và "Chỉnh sửa" (nếu là chủ sở hữu).
   - Ảnh bìa 3:1 (nếu có).
   - Hệ thống Tabs + The Line: Tab "Giới thiệu" (về chúng tôi) và Tab "Việc đang tuyển" (danh sách tin tuyển dụng đang mở).
   - Cột phụ (Right Rail): Thẻ thông tin nhanh (Năm thành lập, Quy mô, Mã số thuế, Địa chỉ trụ sở kèm nút sao chép nhanh).
3. **Chỉnh sửa hồ sơ công ty (`/Company/Edit.cshtml`):**
   - Bố cục Kiểu B với thanh điều hướng mục lục dính bên trái (`.company-edit-nav`).
   - Tải lên ảnh bìa (POST `/Settings/UpdateCoverPhoto`) và logo công ty (POST `/Settings/UpdateAvatar`) kèm xem trước tức thì.
   - Biểu mẫu cập nhật thông tin doanh nghiệp (Tên, ngành nghề, mã số thuế, năm thành lập, quy mô, website, địa chỉ, mô tả) gửi POST `/Company/Edit`.
   - Thanh cảnh báo thay đổi nổi (`.unsaved-bar`) tự động xuất hiện khi người dùng sửa form.

---

## 2. Kiểm chứng kỹ thuật
- Chạy `dotnet build ArisSkyve/ArisSkyve.csproj -c Debug -o .local/v7-build --nologo`: **0 Lỗi, 51 Cảnh báo không liên quan**.
- Kiểm tra tính gắn kết của các luồng API: `/JobApplications/GetApplicantsForJob`, `/JobApplications/UpdateApplicationStatus`, `/JobApplications/ScheduleInterview`, `/Company/Edit`.
