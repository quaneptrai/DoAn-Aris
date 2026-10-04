# PROMPT GIAO VIỆC — Aris V7 "Aris Line": triển khai giao diện mới

> Đưa **nguyên văn file này** cho agent triển khai. File này là **luật + quy trình**. Thiết kế nằm ở `README.md` (hệ thiết kế), `PAGES.md` (từng trang), `BACKEND.md` (tính năng cần API mới) và bản chạy được `reference/`.
> Soạn 26/09/2026 bởi người thiết kế V7. Thay thế `docs/ui-redesign/06-AGENT-PROMPT-THEME-V6.md`.

---

## TÓM TẮT — nhớ trong suốt quá trình làm

1. Bạn **triển khai** một thiết kế đã có sẵn và chạy được (`docs/design-v7/reference/*.html`). Bạn **không thiết kế lại**. Thấy chỗ nào nên khác → ghi vào báo cáo, không tự đổi.
2. Port **nguyên văn** `line.css` → `wwwroot/css/aris-line.css`, `motion.js` → `wwwroot/js/aris-motion.js`; `shell.js` → `aris-shell.js` + `aris-palette.js` (bỏ dữ liệu mẫu, nối API thật).
3. **Bước 0 bắt buộc:** gỡ đoạn code bị chèn vào cuối `wwwroot/lib/lucide/lucide.min.js` (nó tự nạp nền sao 99 KB vào mọi trang).
4. Bỏ toàn bộ nền vũ trụ/3D (constellation, cosmos, earth, gargantua, warp, auth-stage, black-hole, three.js) khỏi layout và view. **Không xoá file**, chỉ gỡ tham chiếu.
5. Mọi hành động của người dùng phải có phản hồi nhìn thấy trong ≤ 100ms, đúng chuyển động của reference (thời lượng, easing, "mọc ra từ chỗ bấm").
6. **Không làm UI giả.** Tính năng ghi **[CẦN BACKEND]** mà chưa được chủ dự án duyệt trong `BACKEND.md` → **ẩn**.
7. Không phá chức năng cũ: giữ route, action, `name`/`asp-for` của form, id/class mà JS nghiệp vụ đang dùng. **Grep trước khi đổi tên bất kỳ id/class nào.**
8. Không đụng DB/migration/Model/`Program.cs`/`appsettings*`. Không kill app của chủ dự án. Không `git reset/checkout/stash/clean/commit/push`.
9. Làm theo **phase**. Gặp chữ **DỪNG** → dừng, gửi báo cáo có ảnh + số đo, chờ duyệt.
10. Không bao giờ viết "xong", "đã kiểm tra", "chạy tốt" khi chưa có **ảnh chụp và kết quả lệnh** làm bằng chứng.

---

## 0. Vai trò và thái độ

Bạn là kỹ sư frontend senior, làm cẩn thận và làm đến cùng.
- Luật trong file này là **bắt buộc tuyệt đối**. Luật mâu thuẫn với ý bạn → luật thắng. Luật không làm được → **dừng và hỏi**, không tự lách.
- Reference là chuẩn về **hình và hành vi**. So ảnh của bạn với ảnh của reference (cùng kích thước khung nhìn, cùng theme). Khác mà không có lý do = chưa đạt.
- Đổi màu nền rồi gọi là "làm lại giao diện" = chưa đạt. Thêm fade-in cho mọi thứ rồi gọi là "animation" = chưa đạt.
- Việc gì thuộc quyền quyết định của chủ dự án (mục 8) → không tự quyết.

---

## 1. Đọc gì, theo thứ tự

1. File này (hết).
2. `docs/design-v7/README.md` — **toàn bộ**, đặc biệt mục 3 (token), 4 (chuyển động), 5 (khung app), 7 (mẫu tương tác), 9 (cấm), **10 (bẫy kỹ thuật)**.
3. Mở trong Chrome và **tự bấm thử mọi thứ**: `reference/components.html`, `feed.html`, `jobs.html`, `chat.html` (danh sách query param trong README 0.1; nút bình thí nghiệm trên rail = bảng mô phỏng lỗi/đang tải).
4. `docs/design-v7/PAGES.md` — phần của trang bạn sắp làm, **trước khi** làm trang đó.
5. `docs/design-v7/BACKEND.md` — để biết cái gì phải ẩn.

Không đọc để lấy hướng thiết kế: `docs/unified-theme/`, `docs/agent-bridge/`, `docs/design-lab/`, `docs/ui-redesign/02…06` (hướng cũ đã bị bác). `docs/ui-redesign/01-audit.md` chỉ để biết route nào đang lỗi.

---

## 2. Luật an toàn repo và môi trường

1. **Không** `git reset`, `git checkout -- .`, `git stash`, `git clean`, commit, push, tạo branch — trừ khi chủ dự án cho phép bằng lời. Working tree có rất nhiều thay đổi chưa commit của chủ dự án.
2. **Không** tạo file `.bak` trong `Views/` hay `wwwroot/`. Muốn sao lưu → copy vào `.local/v7-backup/` (thư mục `.local/` không được git theo dõi).
3. **Không xoá** file cũ (cosmos, constellation, earth, gargantua, warp, auth-stage, black-hole, three.js, các `*.bak` có sẵn). Chỉ gỡ tham chiếu. Cuối việc liệt kê file không còn được dùng để chủ dự án tự quyết.
4. Chủ dự án đang **tự chạy app** ở `http://localhost:5025`; process đó khoá `bin/Debug/net10.0/ArisSkyve.exe`. **Tuyệt đối không kill process của họ.** Chỉ dừng process **bạn** khởi chạy (ghi PID ngay lúc chạy).
   ```powershell
   # Build kiểm tra biên dịch ra thư mục riêng
   dotnet build ArisSkyve/ArisSkyve.csproj -c Debug -o .local/v7-build --nologo
   # Chạy bản riêng để chụp ảnh (cwd phải là ArisSkyve để dùng wwwroot gốc)
   cd ArisSkyve; $env:ASPNETCORE_ENVIRONMENT="Development"; ..\.local\v7-build\ArisSkyve.exe --urls http://localhost:5099
   ```
   Project **không** bật Razor runtime compilation: sửa `.cshtml` → build lại + khởi động lại bản 5099 của bạn. Sửa file trong `wwwroot` → chỉ cần tải lại trang.
5. **Không** sửa Model, DbContext, Migration, `appsettings*.json`, `Program.cs`. **Không** tạo migration.
6. Controller: **không sửa** ở Phase 1–7. Mọi thay đổi controller thuộc Phase B (mục 6) và cần duyệt từng mục trong `BACKEND.md`. Ngoại lệ duy nhất: đổi `ViewData["ActiveNav"]` trong **view** (README 5.1).
7. Không đổi route, tên action, `asp-for`, `name` của field, `asp-route-*`. Không đổi id/class mà JS nghiệp vụ dùng: `chat-client.js`, `notification-client.js`, `post-actions.js`, `application-actions.js`, `resume-actions.js`, `aris-messenger.js`, các `<script>` inline trong view. **Muốn đổi → viết lại JS đó trong cùng một lần sửa, grep chứng minh không còn chỗ dùng cũ, ghi vào báo cáo.**
8. Modal: JS nghiệp vụ gọi `bootstrap.Modal` hoặc sự kiện `*.bs.modal` → giữ cơ chế Bootstrap, chỉ đổi style/animation (README 6.10).
9. **Không làm UI giả**: không số liệu bịa ("1.234 người đang xem"), không nút cho tính năng chưa có API, không dữ liệu mẫu từ `*-demo.js`.
10. Không đụng `wwwroot/cv-builder/`.
11. Không thêm thư viện JS/CSS. Chỉ CSS thuần, Web Animations API, View Transitions API, IntersectionObserver. Lucide 0.344.0 (bản trong repo sau bước 0), Bootstrap có sẵn trong `~/lib/bootstrap` (chỉ một bản).

---

## 3. Bước 0 — gỡ đoạn chèn trong Lucide (làm đầu tiên)

`ArisSkyve/wwwroot/lib/lucide/lucide.min.js` = Lucide 0.344.0 **cộng 12 dòng bị chèn thêm** ở cuối (sau dòng `//# sourceMappingURL=lucide.min.js.map`): IIFE "Aris Constellation & Living Cosmos Engine Loader" tự nạp `/js/aris-constellation.js` vào mọi trang có Lucide.

Đã kiểm (26/09): **12 dòng đầu của file giống hệt từng byte** bản sạch `https://cdn.jsdelivr.net/npm/lucide@0.344.0/dist/umd/lucide.min.js`.

```powershell
# 1) Sao lưu
New-Item -ItemType Directory -Force .local/v7-backup | Out-Null
Copy-Item ArisSkyve/wwwroot/lib/lucide/lucide.min.js .local/v7-backup/lucide.min.js.injected
# 2) Giữ đúng 12 dòng đầu (ghi UTF-8 không BOM, giữ nguyên xuống dòng LF)
$lines = Get-Content ArisSkyve/wwwroot/lib/lucide/lucide.min.js -TotalCount 12
[IO.File]::WriteAllText("$PWD/ArisSkyve/wwwroot/lib/lucide/lucide.min.js", ($lines -join "`n") + "`n")
```
```bash
# 3) Kiểm tra — phải đúng như sau
sha256sum ArisSkyve/wwwroot/lib/lucide/lucide.min.js   # 7c973be50ea92f69da298e017e01e8e6a068f8b599ee087041181f151c8ef092
wc -c ArisSkyve/wwwroot/lib/lucide/lucide.min.js       # 317289
rg -n "aris-constellation|Living Cosmos" ArisSkyve/wwwroot/lib/lucide/lucide.min.js   # rỗng
```
Nếu sha256 khác: tải lại bản sạch từ jsdelivr (URL trên) và kiểm lại. Ghi kết quả 3 lệnh vào báo cáo Phase 1.

Lucide đang được nạp **hai lần** (`_AppLayout.cshtml` và `AppNavbar/Default.cshtml`). Sau Phase 1 chỉ còn **một** lần, trong layout.

---

## 4. Luật thiết kế

Toàn bộ ở `README.md`. Những điều hay bị làm sai nhất:
- Không hex/rgb trong `css/pages/*.css` (trừ ngoại lệ README 3.1.2). Mọi màu, khoảng cách, bo góc, thời lượng, easing qua token.
- Mỗi vùng tối đa **một** nút primary. Badge chưa đọc luôn accent. `--like` chỉ cho trái tim.
- Chỉ animate `transform/opacity/clip-path` (+ ngoại lệ README 4.3.2). Không `infinite` trang trí. Không rAF khi đứng yên.
- Mobile: mọi dialog là bottom sheet tràn ngang; giữ `width: 100% !important` trong `aris-line.css`.
- `Enter` để gửi: bỏ qua khi `e.isComposing || e.keyCode === 229` (bộ gõ tiếng Việt).
- Đọc lại **README mục 10 (bẫy kỹ thuật)** trước mỗi trang.
- Chữ giao diện 100% tiếng Việt (kể cả toast, thông báo, thời gian "5 phút").

---

## 5. Cấu trúc file đích

```
ArisSkyve/wwwroot/
  css/aris-line.css            ← reference/line.css (nguyên văn)
  css/pages/feed.css           ← reference/feed.css (bỏ khối demo)
  css/pages/jobs.css           ← reference/jobs.css
  css/pages/chat.css           ← reference/chat.css (bỏ khối "Bảng demo")
  css/pages/<trang>.css        ← trang không có reference: viết mới, chỉ dùng token + component của aris-line.css
  js/aris-motion.js            ← reference/motion.js (nguyên văn)
  js/aris-shell.js             ← reference/shell.js trừ palette; bỏ NOTIFS/renderNotifs mẫu (dùng notification-client.js), bỏ renderAccount mẫu (menu tài khoản render bằng Razor), bỏ nút demo
  js/aris-palette.js           ← phần command palette của shell.js, nối GET /Search/Global (README 5.4)
  js/pages/feed.js · jobs.js · chat.js · employer.js · …   ← viết lại từ *-demo.js: giữ hành vi/thời lượng/class, thay dữ liệu mẫu bằng API
  js/notification-client.js    ← viết lại phần hiển thị (README 5.5), giữ API init()
  js/post-actions.js · application-actions.js · resume-actions.js   ← bỏ confirm/alert/prompt, dùng mẫu Hoàn tác / sửa tại chỗ / hộp xác nhận (PAGES 6–8)
ArisSkyve/Views/Shared/
  _AppLayout.cshtml            ← head mới (theme script, Be Vietnam Pro, aris-line.css), rail qua AppNavbar, bỏ footer/cosmos/warp/constellation/toast Bootstrap
  Components/AppNavbar/Default.cshtml  ← rail (desktop) / tab bar (mobile), README 5.1–5.2; giữ MutationObserver tạo icon Lucide
  _AuthLayout.cshtml           ← kiểu D (README 5.3)
  _ChatWidget.cshtml           ← PAGES 16
```
Mỗi view: bỏ `<style>` inline → `css/pages/<trang>.css` nạp qua `@section Styles`; script trang → `js/pages/<trang>.js` qua `@section Scripts`. Trang tự dựng `<head>` (`Chat/Index`, `Interview/Room`, `Account/NewUserInfor`, `Home/Error`) chuyển sang layout chung (Interview dùng biến thể tối giản của `_AppLayout` không rail).

---

## 6. Các phase — làm đúng thứ tự

### Phase 0 — Kiểm kê (không sửa gì)
- Chạy bản 5099 của bạn; đăng nhập 2 tài khoản (ứng viên + doanh nghiệp; `QuickLogin` ở Development).
- Chụp ảnh hiện trạng mọi route trong `PAGES.md` (desktop 1440×900 + mobile 390×844) → `.local/v7-shots/before/`.
- Đo hiệu năng mọi route bằng `.local/ui-v6/perf.js` (script của V6; nếu không còn, viết lại theo README 11) → `.local/v7-perf-before.json`.
- Liệt kê mọi hành động hiện có của phần Business trong `Jobs/Index.cshtml` và của `Employer/Index.cshtml` (PAGES 2.4, 10) → bảng trong báo cáo.
- **DỪNG** — báo cáo: danh sách route, ảnh, số đo, danh sách hành động Business.

### Phase 1 — Nền tảng + khung app
1. Bước 0 (Lucide).
2. Port `aris-line.css`, `aris-motion.js`, `aris-shell.js`, `aris-palette.js`.
3. `_AppLayout.cshtml`: theme script trong `<head>` (README 3.6), font Be Vietnam Pro, `aris-line.css` sau Bootstrap; gỡ `aris-tokens.css`, `aris-theme.css`, `aris-cosmos.css`, `aris-warp-transition.*`, `aris-constellation.js`, footer, `#globalToastContainer` + `showToast` cũ (thay bằng bản trong `aris-motion.js`, **giữ tên `window.showToast`**).
4. `AppNavbar/Default.cshtml` → rail + tab bar theo vai trò (README 5.1–5.2); menu tài khoản (form Logout giữ AntiForgeryToken); nút Tạo bài (trang khác Bảng tin → `/Dashboard/Index#compose`); tìm nhanh; chuông thông báo với id `#notifBellBtn/#notifBadge/#notifList`.
5. Viết lại hiển thị `notification-client.js` (README 5.5).
6. Đổi `ViewData["ActiveNav"]` của `MyApplications` → `Applications`, `Resume/Index` → `Resume`.
7. Kiểm: mọi route vẫn mở được, **0 lỗi JS**, rail sáng đúng mục, đổi theme vòng tròn, Ctrl+K tìm thật, thông báo thật, `rafIdle3s = 0` trên mọi route (dù nội dung trang còn cũ).
- **DỪNG** — báo cáo: ảnh rail/tab bar sáng + tối + mobile, 3 lệnh bước 0, bảng `rafIdle3s` mọi route, `rg` chứng minh đã gỡ tham chiếu vũ trụ khỏi layout.

### Phase 2 — Tin nhắn, Việc làm, Chi tiết việc làm, Hộp thoại ứng tuyển
Có reference đầy đủ. Làm theo `PAGES.md` 2–5. So ảnh từng cảnh với reference (cùng query param/trạng thái). Quay/chụp từng bước các tương tác chính (gửi tin, trả lời, chuyển tiếp, thu hồi, ảnh + lightbox, gọi video; lọc, chọn job, J/K, ứng tuyển thành công + flyTo, không kết quả).
- **DỪNG**.

### Phase 3 — Bảng tin (chỉ phần [CÓ API])
`PAGES.md` 1. Mọi mục **[CẦN BACKEND]** chưa được duyệt → ẩn (không nút Lưu, không hàng tin 24h, không bình chọn, không gợi ý kết bạn…). Ghi rõ trong báo cáo cái nào đã ẩn.
- **DỪNG**.

### Phase 4 — Đơn ứng tuyển, CV, Hồ sơ, Cài đặt
Không có reference → **trước tiên** dựng mock HTML tĩnh trong `.local/v7-mock/<trang>.html` (dùng `aris-line.css` + component, dữ liệu thật chụp từ app), chụp sáng/tối/mobile.
- **DỪNG (duyệt mock)** — chủ dự án duyệt mock trước khi sửa view.
- Sau khi duyệt: sửa view + JS (viết lại `application-actions.js`, `resume-actions.js`, `post-actions.js` theo PAGES 6–8).
- **DỪNG**.

### Phase 5 — Tuyển dụng (pipeline), Việc đã đăng, Công ty
Như Phase 4: mock → **DỪNG (duyệt mock)** → làm → **DỪNG**. Pipeline kéo-thả giữa cột phải chạy bằng chuột, cảm ứng **và** bàn phím (PAGES 10.1).

### Phase 6 — Đăng nhập, Người dùng mới, Phòng phỏng vấn, Lỗi, Chat widget
Như Phase 4 (mock → duyệt → làm). Gỡ Three.js/auth-stage khỏi auth. Đăng nhập nhanh chỉ ở Development.
- **DỪNG**.

### Phase 7 — Rà soát toàn app
- Chạy **README 12.2** (mọi lệnh), dán kết quả.
- Đo lại hiệu năng mọi route → so với Phase 0 (bảng trước/sau). Mọi chỉ số đạt README 11.
- Ảnh sau cùng mọi route: sáng, tối, mobile → `.local/v7-shots/after/`.
- Danh sách file không còn được dùng (để chủ dự án quyết định xoá).
- **DỪNG** — báo cáo cuối.

### Phase B — Backend mới (chỉ khi được duyệt, có thể chen giữa các phase)
Chỉ làm các mục có ✅ trong `BACKEND.md`. Gom mọi thay đổi Model/DbContext của các mục đã duyệt, **xin chủ dự án tắt app 5025**, tạo **một** migration, build, chạy thử. Mỗi mục: API + test tay bằng `curl`/DevTools + bật lại UI đã thiết kế sẵn (reference có đủ). Báo cáo riêng từng mục.

---

## 7. Mẫu báo cáo (mỗi lần DỪNG)

```markdown
## Phase X — <tên>

### Đã làm
- <file>: <thay đổi> (lý do nếu khác reference)

### Bằng chứng
- Ảnh: `.local/v7-shots/phaseX/<tên>.png` (sáng · tối · mobile) — kèm ảnh reference tương ứng
- Tương tác: <tương tác> → <ảnh từng bước / GIF>
- Lệnh: <lệnh> → <kết quả dán nguyên văn>
- Hiệu năng: <bảng route × chỉ số, trước/sau>

### Khác với reference / chưa làm được
- <mục> — <vì sao> — <đề xuất>

### Đã ẩn vì cần backend
- <tính năng> (BACKEND.md #n)

### Cần chủ dự án quyết định
- <câu hỏi>
```

---

## 8. Quyết định thuộc về chủ dự án — không tự quyết

- Duyệt mục nào trong `BACKEND.md`.
- Duyệt mock ở Phase 4, 5, 6.
- Xoá file cũ không còn dùng.
- Mọi thay đổi controller/model/migration.
- Thay đổi luồng nghiệp vụ (vd. bỏ bước, đổi trạng thái đơn ứng tuyển).
- Nội dung chữ pháp lý (điều khoản, chính sách).
- Có làm trang `/Styleguide` nội bộ từ `components.html` hay không.
