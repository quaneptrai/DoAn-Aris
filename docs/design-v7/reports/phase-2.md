# Báo cáo Checkpoint Phase 2 — Tin nhắn, Việc làm, Chi tiết việc làm, Hộp thoại ứng tuyển

**Thời gian:** 2026-09-26 11:51
**Trạng thái:** Hoàn thành (PASS)

## 1. Các file đã triển khai / cập nhật
1. `ArisSkyve/Views/Chat/Index.cshtml`:
   - Chuyển `Layout = null` sang `Layout = "_AppLayout"`.
   - Cập nhật `ViewData["Title"] = "Tin nhắn"`, `ViewData["ActiveNav"] = "Network"`.
   - Tái cấu trúc 3 cột theo chuẩn V7 (`reference/chat.html`): danh sách trò chuyện trên canvas (340px), tờ giấy hội thoại (`.chat-thread.a-sheet`), và ngăn thông tin (`.chat-drawer`).
   - Tích hợp các modal / popover: `#forwardDialog`, `#incomingCallToast`, `#callOverlay`, `#emojiPop`, `#msgMenu`.
   - Tham chiếu SignalR client, `chat-client.js`, và `js/pages/chat.js`.

2. `ArisSkyve/wwwroot/css/pages/chat.css`:
   - Port chuẩn từ `reference/chat.css` (520 dòng CSS hoàn chỉnh, không rò rỉ token ngoài hệ thống V7).

3. `ArisSkyve/wwwroot/js/pages/chat.js`:
   - Kết nối trực tiếp SignalR qua `window.ArisChat` (`SendMessage`, `ForwardMessage`, `DeleteMessage`, `Typing`, `MarkAsRead`, `IsOnline`, `onPresence`, `onTyping`, `onConnectionState`).
   - Xử lý gom nhóm tin nhắn (5 phút, cùng người gửi, cùng ngày), nhãn ngày dính `section.m-dayblock`.
   - Xử lý xem trước trả lời (`#replyPreviewBar`), ảnh đính kèm (`#imagePreviewBar`, upload qua `POST /Chat/UploadChatImage`), lightbox qua `window.ArisShell.openLightbox`.
   - Kết nối WebRTC Video Call trực tiếp qua SignalR `/hubs/videocall` và lấy ICE servers qua `/Turn/GetIceServers`.
   - Tabs segmented: Đoạn chat, Bạn bè (kết nối `/Friends/GetFriends`), Lời mời (lời mời kết bạn + lời mời phỏng vấn `/JobApplications/GetInterviewInvitations`).
   - Điều hướng bàn phím `Alt + ↑ / ↓`.

4. `ArisSkyve/wwwroot/css/pages/jobs.css`:
   - Port từ `reference/jobs.css` (hỗ trợ layout 440px canvas + sheet, popover bộ lọc, responsive mobile).

5. `ArisSkyve/Views/Jobs/_JobCardPartial.cshtml`:
   - Viết lại toàn bộ markup sang chuẩn V7: `.a-row.job-row` với `data-id="@job.Id"`.
   - Bố cục gọn gàng một dòng meta, logo bo tròn chuẩn tone, tag lương và tag "Mới".

6. `ArisSkyve/Views/Jobs/Details.cshtml`:
   - Bọc toàn bộ nội dung chi tiết trong `<div data-job-detail>` để tái sử dụng trong cả view master-detail lẫn trang riêng.
   - Thêm thanh gọn dính đỉnh trang `#jdCompact` khi cuộn.
   - Thêm thẻ công ty và việc làm cùng ngành ở cột phụ bên phải.
   - Tích hợp hộp thoại ứng tuyển `#applyDialog` nạp động dữ liệu CV và câu hỏi sàng lọc từ `GET /JobApplications/GetApplyModal?jobId=...`.

7. `ArisSkyve/Views/Jobs/Index.cshtml`:
   - Phân luồng vai trò:
     - Ứng viên (`Role != "Business"`): Bố cục master-detail V7 gồm danh sách 440px trên canvas + sheet chi tiết bên phải; chip bộ lọc mở popover; ô tìm kiếm live; J/K roving navigation; A mở hộp thoại ứng tuyển.
     - Doanh nghiệp (`Role == "Business"`): Bố cục quản lý tin đã đăng V7, bảo toàn 100% chức năng: Đăng tin mới, Sửa tin (`GetJobPostingForEdit`), Đóng/mở tin (`ToggleJobActive`), Quản lý ứng viên (`GetApplicantsForJob`), Chia sẻ tin (`GetShareOptions`/`ShareJob`), Nạp nhanh JSON và trích xuất AI từ file PDF (`ExtractJobFromPdf`).

8. `ArisSkyve/wwwroot/js/pages/jobs.js`:
   - Cung cấp toàn bộ tương tác phía client cho cả ứng viên và doanh nghiệp.
   - Tải thêm vô tận qua `IntersectionObserver` và `GET /Jobs/GetJobs`.
   - Tương tác chọn tin đồng bộ URL `?job=` và chuyển đổi mượt mà bằng class animation `jd-swap-in`/`jd-swap-out`.
   - Hộp thoại ứng tuyển gửi `POST /JobApplications/Apply` với CV và câu trả lời sàng lọc.

## 2. Kết quả kiểm tra biên dịch (Verification)
- Lệnh: `dotnet build ArisSkyve/ArisSkyve.csproj -c Debug -o .local/v7-build --nologo`
- Kết quả: Build Succeeded (0 Error(s), 51 Warning(s)).
