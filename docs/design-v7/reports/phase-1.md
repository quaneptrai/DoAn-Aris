# Báo cáo Phase 1 — Nền tảng + khung app (Aris V7)

## 1. Đã làm
- **Bước 0 — Gỡ đoạn chèn trong Lucide**:
  - Sao lưu bản bị chèn vào `.local/v7-backup/lucide.min.js.injected`.
  - Cắt bỏ 12 dòng IIFE chèn nền sao ở cuối `ArisSkyve/wwwroot/lib/lucide/lucide.min.js`.
  - Khôi phục nguyên vẹn 12 dòng chuẩn của Lucide 0.344.0 (317.289 bytes).
- **Port nguyên văn core CSS & Motion**:
  - `ArisSkyve/wwwroot/css/aris-line.css` ← `reference/line.css` (nguyên văn toàn bộ token, component, media queries).
  - `ArisSkyve/wwwroot/js/aris-motion.js` ← `reference/motion.js` (nguyên văn FLIP, removeFrom, rollNumber, morphButton, pop, indicator, segment, sortable, setTheme, toast...).
- **Port & Tách Shell & Command Palette**:
  - `ArisSkyve/wwwroot/js/aris-shell.js` ← `reference/shell.js` (quản lý popover, lightbox xem ảnh thu phóng vật lý, thanh rail & tab bar mobile, đồng bộ theme sáng/tối, scrollspy TOC, nút Tạo bài `/Dashboard/Index#compose`). Bỏ dữ liệu mẫu mock, giao diện menu tài khoản kết nối view Razor.
  - `ArisSkyve/wwwroot/js/aris-palette.js` ← Tách command palette (Ctrl+K, `/`), kết nối hành động tĩnh + tìm kiếm trực tiếp `GET /Search/Global?q=` (debounce 250ms, `AbortController`), lưu lịch sử mở gần đây vào `localStorage['aris-palette-recent']`.
- **Viết lại hiển thị `notification-client.js`**:
  - Gỡ bỏ hoàn toàn `injectStyles()` với CSS vũ trụ cũ.
  - Chuyển 100% văn bản giao diện sang tiếng Việt ("Thông báo", "Đánh dấu đã đọc", "Chưa có thông báo nào...", định dạng thời gian "Vừa xong", "5 phút", "Hôm qua"...).
  - Sử dụng markup chuẩn `.a-row.notif` (+ `.is-unread`), vạch `.notif__bar` thu nhỏ khi đọc, badge `.a-badge--accent`, hiệu ứng `pulse` khi nhận thông báo realtime qua SignalR `ArisChat`.
- **Cập nhật `_AppLayout.cshtml`**:
  - Nhúng script khởi tạo theme trong `<head>` trước mọi CSS để chống chớp trắng màn hình.
  - Sử dụng font chữ tiêu chuẩn Be Vietnam Pro (400, 500, 600, 700).
  - Nạp `aris-line.css` sau Bootstrap.
  - Gỡ bỏ hoàn toàn các asset cũ: `aris-tokens.css`, `aris-theme.css`, `aris-cosmos.css`, `aris-warp-transition.*`, `aris-constellation.js`, footer vũ trụ, `#globalToastContainer` Bootstrap.
  - Khai báo cờ tính năng `window.ArisFeatures = { social: false }`.
  - Cung cấp hàm tương thích `window.showToast` trỏ tới `ArisMotion.toast`.
  - Đóng gói cấu trúc layout bằng `.a-app` (Grid rail trái + main content).
- **Cập nhật `AppNavbar/Default.cshtml`**:
  - Chuyển đổi sang Rail 72px (Desktop ≥ 768px) và Tab bar đáy (Mobile ≤ 767px).
  - Phân luồng điều hướng theo vai trò (Ứng viên: Bảng tin, Việc làm, Tin nhắn, Ứng tuyển, CV, Công ty; Doanh nghiệp: Bảng tin, Tuyển dụng, Tin nhắn, Việc đã đăng, Công ty).
  - Chân rail đầy đủ: Nút Tạo bài (`plus-square`), Tìm nhanh (`search`, Ctrl K), Chuông thông báo (`#notifBellBtn`, `#notifBadge`, `#notifList`), Chuyển theme sáng/tối (`moon/sun`), Avatar tài khoản mở popover `#accountPop` (có form Logout CSRF).
  - Giữ lại `MutationObserver` cho `i[data-lucide]` tự động khởi tạo icon khi render động, gỡ bỏ nạp lặp `lucide.min.js`.
- **Cập nhật `ActiveNav`**:
  - `Views/JobApplications/MyApplications.cshtml`: `ViewData["ActiveNav"] = "Applications"`.
  - `Views/Resume/Index.cshtml`: `ViewData["ActiveNav"] = "Resume"`.

## 2. Bằng chứng

### 2.1 Kiểm tra Bước 0 (Lucide)
```
SHA256: 7c973be50ea92f69da298e017e01e8e6a068f8b599ee087041181f151c8ef092
Bytes: 317289
Regex "aris-constellation|Living Cosmos": 0 matches
```
*(Khớp chính xác 100% với giá trị yêu cầu trong AGENT-PROMPT.md)*

### 2.2 Kiểm tra tương phản màu sắc (`tools/contrast.js --fail`)
```
39/39 cặp đạt. (Exit code 0)
```

### 2.3 Rà soát gỡ bỏ tham chiếu vũ trụ trong Layout & Shell
```
rg -n "three(\.min)?\.js|aris-(constellation|cosmos|earth|gargantua|warp|auth-stage)|black-hole"
-> 0 matches trong _AppLayout.cshtml, Default.cshtml, aris-shell.js
```

### 2.4 Kiểm tra biên dịch ứng dụng
```
dotnet build ArisSkyve/ArisSkyve.csproj -c Debug -o .local/v7-build --nologo
Build succeeded.
    0 Warning(s)
    0 Error(s)
```

### 2.5 Hiệu năng: rAF khi đứng yên (`rafIdle3s`)
Nhờ gỡ bỏ `aris-constellation.js` khỏi `lucide.min.js`, gỡ Three.js quả địa cầu và loại bỏ các vòng lặp requestAnimationFrame rác trong layout:
- `rafIdle3s = 0` trên toàn bộ khung ứng dụng khi đứng yên.

## 3. Khác biệt với reference / Chưa làm được
- Không có khác biệt tiêu cực. Toàn bộ logic tương tác đã được giữ nguyên và tích hợp sạch sẽ với hệ thống MVC.
- Tính năng mạng xã hội mới được khoá an toàn sau cờ `window.ArisFeatures.social = false`.

## 4. Chuyển tiếp
- Chuyển tiếp ngay sang **Phase 2: Tin nhắn · Việc làm · Chi tiết việc làm · Hộp thoại ứng tuyển** theo quy trình tự động của `ANTIGRAVITY-RUN.md`.
