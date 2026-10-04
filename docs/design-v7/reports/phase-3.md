# Báo cáo Phase 3 — Bảng tin (Feed / Dashboard)

**Thời gian hoàn thành:** 2026-09-26 11:57  
**Trạng thái:** Hoàn tất, build 0 lỗi (`dotnet build -c Debug -o .local/v7-build --nologo`)

---

## 1. Tóm tắt công việc
Đã thiết kế lại toàn bộ Bảng tin (`/Dashboard`) theo đúng chuẩn Aris Line V7 (Instagram-style feed):
- **Cấu trúc bố cục:** Cột bảng tin 560px + cột phụ 312px căn giữa trên canvas.
- **Loại bỏ di sản cũ:** Gỡ bỏ hoàn toàn 3D globe (`aris-earth-root`, `aris-earth.css`, `three.min.js`), banner hero cũ và bố cục 3 cột kiểu cũ.
- **Tập tin đã tạo / cập nhật:**
  1. `ArisSkyve/wwwroot/css/pages/feed.css`: 728 dòng CSS V7 chuẩn hóa, responsive desktop (560px + 312px) và mobile (<768px).
  2. `ArisSkyve/Views/Dashboard/Index.cshtml`: Viết mới toàn bộ giao diện Bảng tin theo mẫu V7 với đầy đủ dialog (#composeDialog, #postDialog, #shareDialog, #keysDialog, #confirmDialog, #postMenu).
  3. `ArisSkyve/wwwroot/js/pages/feed.js`: Viết mới module điều khiển bảng tin với đầy đủ tương tác:
     - Thích bài viết lạc quan (optimistic UI) + tim lớn khi nhấn đúp.
     - Bình luận modal (`#postDialog`) kèm emoji picker và bình luận nhanh tại chỗ (`.post__quick`).
     - Hộp thoại tạo bài viết 3 bước (chọn tệp, sắp xếp/xem trước, viết nội dung/tiêu đề) kết nối `multipart/form-data` tới `/Dashboard/CreatePost`.
     - Chỉnh sửa bài viết tại chỗ (`/Dashboard/EditPost`).
     - Xóa bài viết có hoàn tác trong 6 giây (`/Dashboard/DeletePost/{id}`).
     - Cột phụ: Thẻ người dùng, mời phỏng vấn (`/JobApplications/RespondToInterview`), việc làm phù hợp, thống kê trực tuyến lăn số mỗi 30 giây (`/Dashboard/GetLiveStats`).
     - Phím tắt J/K, L, C, S, N, ?, Esc.
     - Kéo để làm mới (pull-to-refresh) trên mobile.

---

## 2. Kiểm chứng kỹ thuật
- Chạy `dotnet build ArisSkyve/ArisSkyve.csproj -c Debug -o .local/v7-build --nologo`: **0 Lỗi, 51 Cảnh báo không liên quan**.
- Kiểm tra tính tương thích `_AppLayout.cshtml`: Kế thừa toàn bộ hệ thống rail/tab bar, `aris-motion.js`, `aris-shell.js`.
