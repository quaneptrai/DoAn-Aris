# Báo cáo Phase 6 — Xác thực, Onboarding, Phòng phỏng vấn & Chat Widget

**Thời gian hoàn thành:** 2026-09-26 12:15  
**Trạng thái:** Hoàn tất, build 0 lỗi (`dotnet build -c Debug -o .local/v7-build --nologo`)

---

## 1. Tóm tắt công việc
Đã hoàn thành toàn bộ các màn hình và thành phần thuộc Phase 6 theo đúng triết lý thiết kế Aris Line V7:

### A. Giao diện Xác thực & Onboarding (Auth & Onboarding)
1. **Layout xác thực tối giản (`Views/Shared/_AuthLayout.cshtml` & `wwwroot/css/pages/auth.css`):**
   - Loại bỏ hoàn toàn Three.js, `aris-auth-stage.js`, `aris-auth.css`, canvas 3D và các nút intro rườm rà.
   - Thẻ căn giữa Kiểu D chuẩn mực (400px), logo Aris Line và viền thẻ sắc nét theo tokens `--line-strong` và `--surface`.
2. **Đăng nhập (`Views/Account/Login.cshtml`):**
   - Hỗ trợ gửi Magic link với trường email và nút gửi tức thì.
   - Đăng nhập mạng xã hội (Google, Facebook).
   - Duy trì tiện ích đăng nhập nhanh dành riêng cho môi trường Development (`QuickLogin`/`DirectLogin`).
3. **Đăng ký (`Views/Account/Register.cshtml`):**
   - Đồng bộ giao diện Kiểu D với ô nhập email và các nút đăng nhập xã hội.
4. **Onboarding người dùng mới (`Views/Account/NewUserInfor.cshtml`):**
   - 3 bước trượt mượt mà (Về bạn, Mục tiêu nghề nghiệp, Quyền riêng tư & Hoàn tất) mà không tải lại trang.
   - Thanh tiến trình quỹ đạo (`trajectory indicator`) trực quan.
   - Bảo toàn 100% tên trường model và luồng POST lên `Account/NewUserInfor`.

### B. Phòng phỏng vấn trực tuyến (`Views/Interview/Room.cshtml`)
- Giao diện tập trung cao độ `#0E0F11` (Focus mode).
- Thanh điều khiển nổi ở cạnh dưới tự động ẩn sau 3 giây không tương tác chuột và hiện lại ngay khi rê chuột.
- Giữ nguyên toàn bộ logic WebRTC, SignalR, chia sẻ màn hình, mic, camera, và chat phòng họp.
- Thay thế triệt để các thư viện CDN ngoài (Bootstrap Icons) sang icon SVG nội bộ.

### C. Trang Lỗi chuẩn (`Views/Home/Error.cshtml`)
- Trình bày thông điệp lỗi rõ ràng theo mẫu `.a-empty`.
- Hỗ trợ sao chép Request ID nhanh cho việc hỗ trợ kỹ thuật.
- Tự động chuyển đổi layout linh hoạt giữa `_AppLayout` và `_AuthLayout` tùy theo trạng thái đăng nhập của người dùng.

### D. Chat Widget (`Views/Shared/_ChatWidget.cshtml`)
- **Nút khởi động Launcher:** Hình tròn 48px, nền `--brand`, icon `message-circle`, nhãn badge accent đếm tin nhắn chưa đọc.
- **Cửa sổ Popover 380×560px:** Nở êm ái từ launcher, chia thành 2 view trượt ngang mượt mà (danh sách hội thoại ↔ chi tiết cuộc trò chuyện).
- **Trải nghiệm gõ phím chuẩn:** Xử lý sự kiện Enter gửi tin nhắn an toàn với bộ gõ tiếng Việt (IME-safe, kiểm tra `isComposing` và `keyCode === 229`).
- **Ẩn đúng ngữ cảnh:** Tự động ẩn trên trang `/Chat` và `/Interview/Room` thông qua kiểm tra `Context.Request.Path`.
- **Tối ưu di động:** Ẩn hoàn toàn trên màn hình mobile (`max-width: 768px`) do đã có tab Tin nhắn chuyên dụng trên thanh rail di động.

---

## 2. Kiểm chứng kỹ thuật
- Chạy `dotnet build ArisSkyve/ArisSkyve.csproj -c Debug -o .local/v7-build --nologo`: **0 Lỗi, 51 Cảnh báo không liên quan**.
- Kiểm tra tính gắn kết của các kết nối SignalR (`/hubs/chat`), Hub thông báo (`ArisNotifications`), và bộ tải hình ảnh `/Chat/UploadChatImage`.
