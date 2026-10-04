> ⚠️ **ĐÃ ĐƯỢC THAY THẾ (26/09/2026)** bởi bộ thiết kế V7 "Aris Line" trong `docs/design-v7/` — dùng `docs/design-v7/AGENT-PROMPT.md`. File này chỉ còn giá trị lịch sử; KHÔNG dùng để triển khai.

# PROMPT GIAO VIỆC — Aris V6: làm lại theme, bố cục, tương tác và animation

> Đưa **nguyên văn toàn bộ file này** cho agent thực thi. File này vừa là spec, vừa là luật.
> Soạn ngày 25/09/2026, dựa trên việc đọc trực tiếp source của repo.

---

## TÓM TẮT — đọc trước và nhớ trong suốt quá trình làm

1. Bỏ toàn bộ nền vũ trụ/3D/WebGL (starfield, quả địa cầu, hố đen, DNA, warp). Nền chỉ là **một màu phẳng lấy từ token**. **Không dành công sức nào cho background; dồn toàn bộ công sức vào nội dung và tương tác.**
2. Theme mới "Aris Workbench": nền sáng màu giấy ấm, **một** màu brand `#2F6FED`, **một** màu accent dùng rất ít. Dark mode là xám than, không có sao, không có glow.
3. Bố cục phải xuất phát từ tác vụ của từng trang, không rập khuôn mạng xã hội hay landing page. Không hero, không bento, không đặt card trong card.
4. Mọi animation phải gắn với một hành động thật: lọc, gửi, ứng tuyển, đổi trạng thái, chuyển trang… Không có animation trang trí chạy mãi.
5. Thêm tương tác thật: command palette Ctrl+K, xem trước job ngay tại danh sách không cần tải lại trang, phím tắt, kéo-thả pipeline ứng viên, cập nhật lạc quan (optimistic UI), nút Hoàn tác.
6. Phải nhẹ: không Three.js, không có vòng `requestAnimationFrame` khi trang đứng yên, ngân sách dung lượng đo bằng số.
7. Không phá chức năng cũ. Không đụng DB/migration. Không kill app đang chạy của chủ dự án. Không `git reset`, không commit.
8. Làm theo từng phase. Gặp chữ **DỪNG** thì dừng lại, báo cáo kèm ảnh và số đo.
9. Không bao giờ nói "xong" khi chưa có bằng chứng.

---

## 0. Vai trò và thái độ làm việc

Bạn là kỹ sư frontend kiêm product designer senior. Việc này phải làm **hết sức**, làm **đến cùng**, và **đúng luật**.

- Luật ở mục 2 là **bắt buộc tuyệt đối**. Không được "diễn giải lại", không được bỏ qua vì thấy "không cần", không được tự nới lỏng. Khi luật mâu thuẫn với ý bạn thì **luật thắng**.
- Không làm qua loa. Đổi màu nền, thêm shadow rồi gọi là "redesign" thì chưa đạt. Gắn fade-in cho mọi thứ rồi gọi là "animation" cũng chưa đạt.
- Không được viết "đã xong", "đã kiểm tra", "hoạt động tốt" khi chưa có **ảnh chụp màn hình và kết quả lệnh** chứng minh (mục 9).
- Làm theo **từng phase** (mục 7). Hết phase có chữ **DỪNG** thì dừng, báo cáo và chờ chủ dự án duyệt. Không tự nhảy sang phase tiếp theo.
- Nếu một luật không làm được thì **dừng lại và hỏi**, không tự chọn cách lách luật.
- Gặp một quyết định thuộc về chủ dự án (mục 11) thì không tự quyết.

---

## 1. Vì sao phải làm lại

### 1.1 Lời chủ dự án (giữ nguyên ý)

> "UI hiện tại quá nặng và màu mè quá mức cần thiết. Layout, component sắp xếp quá cliché và xấu, nặng, khó render. UX thì phẳng, không có gì để tương tác. Background tốn nhiều công sức mà không tận dụng được gì."
>
> "Không được spam AI cliché, quá nhiều hero banner… Các tính năng sẽ còn được update thêm, cần đặc biệt, nhiều animation, đầy đủ, hiện đại."

### 1.2 Từng lời chê ↔ nguyên nhân đo được trong code ↔ mục xử lý

| Lời chê | Nguyên nhân trong repo (đã đo) | Xử lý ở |
|---|---|---|
| **Nặng, khó render** | Riêng Dashboard tải ≈ 340 KB CSS/JS của dự án **cộng thêm `three.min.js` 589 KB** (quả địa cầu 3D). Trang auth ≈ 740 KB (three.js + `aris-auth-stage.js` 96 KB + `aris-auth.css` 46 KB). `aris-cosmos.css` 117 KB. `aris-constellation.js` 99 KB (nạp ở mọi trang workspace). Các file constellation, earth, gargantua, auth-stage đều có vòng `requestAnimationFrame`. | 2.4 |
| **Màu mè quá mức** | Palette `--star-*` tối kiểu vũ trụ, glow màu brand trong shadow, gradient. Ảnh bìa mặc định của Profile là **ảnh gradient sặc sỡ lấy từ Unsplash** (`Profile/Index.cshtml:13`). | 2.2, 3.2 |
| **Layout/component cliché, xấu** | Dashboard theo khuôn 3 cột mạng xã hội, JS còn chủ động "lấp chỗ trống bằng bento" (`aris-constellation.js`: *"bento grid filler for zero dead space"*). Card lồng card, khối trang trí. | 3.6 |
| **UX phẳng, không có gì để tương tác** | `Jobs/Index` có đúng 1 `transition`, `Settings` và `Employer` có 0. Bộ lọc job chỉ ẩn/hiện các card đã tải. Không có phím tắt, không có xem trước, không có hoàn tác. | 4 |
| **Background tốn công mà không dùng được gì** | Starfield, sao băng, quả địa cầu, hố đen, DNA: hàng trăm KB và CPU chạy liên tục, không giúp người dùng làm được việc gì. | 2.2, TÓM TẮT mục 1 |

### 1.3 Stack và các hiện trạng khác

- Aris (thư mục `ArisSkyve/`) là nền tảng nghề nghiệp: tìm việc, ứng tuyển, CV, bảng tin nghề nghiệp, chat, phỏng vấn video, trang doanh nghiệp/nhà tuyển dụng.
- Stack: **ASP.NET Core MVC + Razor + Bootstrap 5 + jQuery + SignalR + Lucide icons**. Không có bundler, không có bước build frontend bằng npm.
- 14 view có khối `<style>` inline (`Chat/Index` 1.772 dòng, `Jobs/Index` 1.715 dòng).
- `Chat/Index`, `Interview/Room`, `Account/NewUserInfor`, `Home/Error` tự dựng `<head>` riêng, không dùng layout chung. `Chat` và `Interview` còn nạp Bootstrap từ CDN, khác phiên bản với `~/lib/bootstrap`.
- Token đang lệch nhau: `aris-tokens.css` khai báo font `Space Grotesk`, nhưng layout chỉ tải Plus Jakarta Sans và Inter.
- Có nhiều file rác: `*.bak`, `_smoke-*.js`, `wwwroot/_smoke-*.png`.
- Footer dùng copy sáo rỗng: "Vũ trụ nghề nghiệp của bạn".

**Hướng thiết kế cũ (cosmos / constellation / DNA / nano / gargantua / earth / "WebGL tầm Lusion") ĐÃ BỊ BÁC BỎ.**
Các thư mục `docs/unified-theme/`, `docs/agent-bridge/`, `docs/design-lab/` mô tả hướng cũ đó → **KHÔNG đọc để lấy hướng thiết kế, KHÔNG sao chép.** Tài liệu cũ duy nhất được phép tham khảo là `docs/ui-redesign/01-audit.md`, và chỉ để biết những route nào đang lỗi.

---

## 2. LUẬT BẮT BUỘC

### 2.1 An toàn repo và môi trường

1. **Không** `git reset`, `git checkout -- .`, `git stash`, `git clean`, không commit, không push, không tạo branch, trừ khi chủ dự án cho phép bằng lời. Working tree đang có rất nhiều thay đổi chưa commit của chủ dự án.
2. **Không** tạo file `.bak` mới trong `Views/` hay `wwwroot/`. Muốn backup thì copy vào `.local/ui-v6-backup/` (thư mục `.local/` không được git track).
3. **Không** xoá file cũ (cosmos, constellation, earth, gargantua, warp, auth-stage, black-hole, three.js). Chỉ **gỡ tham chiếu** khỏi layout/view. Cuối việc, liệt kê các file không còn được dùng để chủ dự án tự quyết định có xoá hay không.
4. Chủ dự án đang **tự chạy app** ở `http://localhost:5025`. Process đó khoá file `bin/Debug/net10.0/ArisSkyve.exe`. **Tuyệt đối không kill process của họ.** Chỉ được dừng process do **chính bạn** khởi chạy (ghi lại PID ngay lúc khởi chạy).
   - Kiểm tra biên dịch (build ra thư mục riêng):
     ```powershell
     dotnet build ArisSkyve/ArisSkyve.csproj -c Debug -o .local/ui-v6-build --nologo
     ```
   - Tự chạy một bản riêng để chụp ảnh. Thư mục làm việc (cwd) phải là `ArisSkyve` để app dùng `wwwroot` gốc:
     ```powershell
     cd ArisSkyve; $env:ASPNETCORE_ENVIRONMENT="Development"; ..\.local\ui-v6-build\ArisSkyve.exe --urls http://localhost:5099
     ```
   - Project **không** bật Razor runtime compilation: sửa `.cshtml` thì phải build lại và khởi động lại bản 5099 của bạn. Sửa file trong `wwwroot` thì chỉ cần refresh trang.
5. **Không** sửa Model, DbContext, Migration, `appsettings*.json`, `Program.cs`. **Không** tạo migration. Đây là việc làm UI.
6. Controller: chỉ sửa khi một tương tác UI thật sự **cần**, và mọi thay đổi phải được ghi vào báo cáo kèm lý do. Trước khi sửa controller, kiểm tra endpoint có sẵn ở mục 4.6: hầu hết đã có đủ.
7. Không đổi route, tên action, `asp-for`, `name` của field trong form. Không đổi id/class mà JS nghiệp vụ đang dùng (`chat-client.js`, `notification-client.js`, `post-actions.js`, `application-actions.js`, `resume-actions.js`, các `<script>` inline trong view). **Grep trước khi đổi tên bất kỳ class/id nào.**
8. Modal: nếu JS nghiệp vụ gọi `bootstrap.Modal` hoặc các sự kiện `*.bs.modal` thì giữ nguyên cơ chế Bootstrap modal; chỉ được đổi style và animation.
9. **Không làm UI giả.** Tính năng chưa có backend thì không được giả vờ là đã chạy. Ví dụ: **lưu/bookmark job hiện chưa có backend** (không có `SavedJob`/`Bookmark` trong Controllers/Models), nên phải ẩn nút đó và ghi vào mục 11. Không bịa số liệu, không bịa người dùng, không viết kiểu "1.234 người đang xem".
10. Không đụng `wwwroot/cv-builder/` (ứng dụng CV builder riêng).

### 2.2 Chống "AI cliché" và màu mè — cấm tuyệt đối

Nếu thấy mình đang làm một trong các thứ dưới đây, dừng lại và làm theo cách khác.

**Bố cục**
- **Hero banner**: khối lớn ở đầu trang gồm tiêu đề to, dòng mô tả, 2 nút CTA, có thể kèm hình minh hoạ. Không trang nào trong workspace được mở đầu bằng hero. Vào trang là thấy **nội dung/tác vụ ngay**.
- Lưới "3 ô tính năng, mỗi ô có icon tròn + tiêu đề + mô tả".
- Hàng 4 ô KPI ở đầu trang. Bento grid để lấp chỗ trống. Card thống kê trang trí không gắn với dữ liệu thật.
- **Card soup**: bọc mọi thứ trong card có cùng padding và bo góc. Card lồng card.
- Khuôn 3 cột mạng xã hội gồm "thẻ hồ sơ bên trái + feed ở giữa + widget trang trí bên phải".
- Ảnh bìa lớn kèm avatar đè lên mép ảnh bìa; ảnh stock/gradient dùng làm ảnh bìa mặc định.
- Căn giữa khối nội dung trong workspace (chỉ được căn giữa empty state và trang auth).

**Màu sắc và hiệu ứng**
- Trong một khung nhìn, ngoài màu trung tính chỉ được xuất hiện **brand** và **accent**, cộng màu trạng thái (success/warning/danger) khi đang thật sự báo trạng thái. Ảnh người dùng và logo công ty không tính.
- Không dùng nền màu cho các section. Không dùng **icon đặt trong ô vuông/tròn có nền pastel**. Icon là đơn sắc `currentColor`.
- Gradient tím–xanh, gradient mesh, blob mờ trôi nổi, nền aurora, noise grain phủ toàn trang.
- **Chữ gradient** (`background-clip: text`).
- **Glow**: `box-shadow` kiểu `0 0 24px <màu brand>`, `text-shadow` phát sáng, viền neon.
- Glassmorphism tràn lan. `backdrop-filter` **chỉ** dùng cho top bar dính đầu trang và backdrop của modal/sheet, **tối đa 3 chỗ** trong toàn app.
- Canvas/WebGL/particle/starfield/sao băng/quả cầu/hố đen làm nền. **Không Three.js ở bất kỳ trang nào của workspace và auth.**

**Chuyển động**
- Animation `infinite` để trang trí (xoay, pulse, float, shimmer vĩnh viễn). `infinite` chỉ được dùng cho: spinner khi đang tải, skeleton khi đang tải, chấm "đang gõ" trong chat, chấm "đang live" trong phòng phỏng vấn. Trạng thái kết thúc thì animation phải dừng ngay.
- Làm mọi phần tử fade-in/slide-up khi cuộn tới ("reveal on scroll" đại trà).
- Con trỏ chuột tuỳ biến, hiệu ứng "spotlight theo chuột" trên card, tilt 3D khi hover, ripple kiểu Material.

**Nội dung**
- Emoji dùng làm icon, ✨ và 🚀. Chỉ dùng Lucide (có sẵn ở `wwwroot/lib/lucide`).
- Copy sáo rỗng: "Khám phá tiềm năng", "Nâng tầm sự nghiệp", "Hành trình của bạn bắt đầu từ đây", "Vũ trụ nghề nghiệp", "Trải nghiệm đẳng cấp", "Unlock", "Empower". Copy phải **cụ thể**: người dùng làm được gì, có bao nhiêu, bước tiếp theo là gì.
- Bo góc rất lớn (> 16px) cho mọi thứ; nút nào cũng là pill.

### 2.3 Kỹ thuật CSS/JS

1. **Không thêm thư viện** JS/CSS mới. Chỉ dùng CSS thuần, Web Animations API (`element.animate`), View Transitions API, `@starting-style`, `IntersectionObserver`, CSS `linear()` easing để làm spring. Nếu thật sự cần thư viện, dừng lại và xin phép kèm lý do cụ thể.
2. Mọi màu, khoảng cách, bo góc, bóng, thời lượng, easing **phải lấy từ token** (CSS custom property). File CSS riêng của trang (`wwwroot/css/pages/*.css`) **không được chứa mã hex/rgb trực tiếp**.
3. Chỉ animate `transform`, `opacity`, `clip-path`. Không animate `width/height/top/left/margin/box-shadow`. Riêng expand/collapse được dùng kỹ thuật `grid-template-rows: 0fr ↔ 1fr`. Muốn bóng đậm lên khi hover thì animate `opacity` của một pseudo-element mang bóng.
4. Mọi animation phải tôn trọng `prefers-reduced-motion: reduce`: thay bằng crossfade ≤ 120ms hoặc tắt hẳn.
5. Khối `<style>` inline trong view phải chuyển ra `wwwroot/css/pages/<trang>.css` và nạp qua `@section Styles`.
6. Mọi trang workspace phải dùng `_AppLayout`, kể cả `Chat/Index`, `Interview/Room`, `Home/Error`. Interview Room được dùng một biến thể layout tối giản, nhưng vẫn phải chung token và CSS lõi. Chỉ dùng một bản Bootstrap: `~/lib/bootstrap`.
7. Tiếng Việt có dấu phải hiển thị chuẩn: font hỗ trợ đủ dấu, `line-height` của body ≥ 1.5, không bị cắt dấu ở tiêu đề.
8. Accessibility: tương phản chữ thường ≥ 4.5:1; chữ lớn và icon ≥ 3:1; mọi thứ bấm được đều có `:focus-visible` rõ ràng; tap target ≥ 44px trên mobile; không chỉ dùng màu để truyền đạt trạng thái.
9. Phím tắt không được kích hoạt khi con trỏ đang ở `input`, `textarea`, `select` hoặc `[contenteditable]`.

### 2.4 Hiệu năng — ngân sách đo bằng số

Đo bằng script `.local/ui-v6/perf.js` (mã nguồn ở mục 6), desktop 1440×900, sau khi đăng nhập, **tắt cache**.

| Chỉ số | Ngân sách mỗi trang |
|---|---|
| `threeLoaded` (có tải `/lib/three/` hay không) | `false` |
| `ownCssJsKB`: tổng CSS+JS của dự án, không tính `/lib/`, đã giải nén | ≤ 150 KB (Dashboard hiện tại ≈ 340 KB, chưa kể three.js) |
| `rafIdle3s`: số lần gọi `requestAnimationFrame` trong 3 giây trang đứng yên | **0** |
| `cls` | ≤ 0.05 |
| `lcpAfterTtfb`: LCP tính từ lúc nhận byte đầu tiên | ≤ 1000 ms |
| `longTasks`: số task dài hơn 50 ms | ≤ 2 |
| `domNodes` | ≤ 3000 |
| `pageErrors` | 0 |

Và **mọi chỉ số phải tốt hơn hoặc bằng số đo baseline ở Phase 0.**

Quy tắc đi kèm:
- CSS lõi dùng chung (tokens + base + components + motion) ≤ 60 KB. `aris-motion.js` + `aris-palette.js` + `aris-theme-toggle.js` tổng ≤ 40 KB.
- Ảnh phải có `width`/`height` hoặc `aspect-ratio` để không gây layout shift. Ảnh nằm ngoài khung nhìn đầu tiên dùng `loading="lazy"`.
- Danh sách dài (feed, jobs, ứng viên) tải thêm bằng `IntersectionObserver`, không render tất cả cùng lúc.
- `will-change` chỉ gắn tạm trong lúc đang animate, animate xong thì gỡ.
- Không dùng `filter: blur()` trên vùng lớn.

---

## 3. Hướng thiết kế — "Aris Workbench"

Tinh thần: **một bàn làm việc sáng, gọn, nhanh**. Cá tính không đến từ trang trí. Nó đến từ typography chắc chắn, phân cấp rõ ràng, và **chuyển động gắn với hành động thật**. Người dùng phải cảm thấy: bấm vào đâu cũng có phản hồi, và phản hồi đó cho biết chuyện gì vừa xảy ra.

### 3.1 Dấu hiệu nhận diện duy nhất: đường quỹ đạo của logo

Logo Aris là một nét cong: `M 30,145 C 65,180 125,160 120,115 C 115,70 70,70 70,115 C 70,150 115,95 170,30`. Đây là **motif duy nhất** được lặp lại, và chỉ xuất hiện ở những chỗ mang nghĩa "tiến trình":
- loading indicator của app: nét logo tự vẽ (`stroke-dashoffset`), thay cho spinner tròn;
- thanh tiến trình của onboarding, ứng tuyển, mức hoàn thiện hồ sơ;
- timeline trạng thái của đơn ứng tuyển;
- khoảnh khắc chuyển giữa Login và Register.

Không dùng motif này làm hình nền, không rải khắp nơi.

### 3.2 Màu sắc

Viết lại `wwwroot/css/aris-tokens.css`. **Giữ tiền tố `--aris-*`** để không làm vỡ các chỗ đang dùng. Bỏ nhóm `--star-*` sau khi đã thay hết các chỗ tham chiếu (grep để xác nhận). Được phép tinh chỉnh giá trị bên dưới, nhưng phải kiểm tra lại tương phản và ghi vào báo cáo.

**Light (mặc định)**

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--aris-canvas` | `#F5F4F0` | nền trang (giấy ấm, không phải trắng tinh) |
| `--aris-surface` | `#FFFFFF` | đối tượng thao tác được: job, bài viết, CV; panel |
| `--aris-surface-sunken` | `#ECEAE4` | vùng lõm: nền input, thanh filter |
| `--aris-line` | `#E2DFD7` | đường kẻ, viền 1px |
| `--aris-line-strong` | `#CFCBC1` | viền khi hover, viền control |
| `--aris-text` | `#15171C` | chữ chính |
| `--aris-text-sub` | `#4B505C` | chữ phụ |
| `--aris-text-muted` | `#6F7482` | metadata, thời gian (kiểm tra ≥ 4.5:1 trên canvas) |
| `--aris-brand` | `#2F6FED` | hành động chính, trạng thái được chọn (màu logo, giữ nguyên) |
| `--aris-brand-strong` | `#1F54C9` | chữ/link màu brand trên nền sáng, hover |
| `--aris-brand-soft` | `#E6EEFD` | nền của chip/mục đang chọn |
| `--aris-accent` | `#E8743B` | **chỉ** dùng cho badge "mới"/"chưa đọc". Không bao giờ dùng cho nút |
| `--aris-success` / `--aris-warning` / `--aris-danger` | `#1E9A5F` / `#B7791F` / `#D0443B` | kèm biến thể `-soft` làm nền |

**Dark**: bật bằng nút đổi theme, lưu vào `localStorage`, lần đầu vào thì theo `prefers-color-scheme`.

| Token | Giá trị |
|---|---|
| canvas / surface / sunken | `#101216` / `#171A20` / `#0C0E11` |
| line / line-strong | `#262A33` / `#343945` |
| text / sub / muted | `#ECEEF2` / `#B3B8C4` / `#8A90A0` |
| brand / brand-strong / brand-soft | `#4D86F7` / `#7AA5FA` / `#1A2744` |

Dark mode là **xám than trung tính**: không có vũ trụ, không có sao, không có glow.

### 3.3 Typography

- Font: **Be Vietnam Pro** (được thiết kế cho tiếng Việt) cho toàn bộ app, tải từ Google Fonts với các weight 400/500/600/700. Bỏ Space Grotesk, Plus Jakarta Sans và Inter khỏi `<head>`.
- Số liệu (lương, số lượng, thời gian): `font-variant-numeric: tabular-nums`.
- Thang chữ: 12 / 13 / 14 (chữ UI) / 16 (chữ để đọc) / 18 / 22 / 28. Tiêu đề trang tối đa 28px. Workspace không có chữ nào cỡ 36–72px.
- Weight: body 400, label 500, tiêu đề 600, chỉ tiêu đề trang được dùng 700. Không dùng 800.

### 3.4 Hình khối, bóng, mật độ

- Bo góc: control 8px, card 12px, sheet/modal 16px. Nút là hình chữ nhật bo 8px, **không phải pill**. Pill chỉ dùng cho chip/tag.
- Bóng 2 lớp, trung tính, không có màu: `--aris-shadow-1: 0 1px 2px rgb(20 20 30 / .06), 0 1px 1px rgb(20 20 30 / .04)`; `--aris-shadow-2` cho đối tượng đang hover/kéo; `--aris-shadow-3` cho popover/modal. Dark mode thay bóng bằng viền sáng hơn.
- Khoảng cách theo lưới 4px (giữ các token `--aris-space-*`).
- Mật độ thông tin: đây là công cụ làm việc. Nhìn một hàng job là phải thấy tên job, công ty, lương, địa điểm, hình thức làm việc, thời gian đăng, **không cần mở ra**.

### 3.5 Token chuyển động

```css
--aris-dur-1: 120ms;   /* press, toggle, đổi màu khi hover */
--aris-dur-2: 200ms;   /* popover, dropdown, chip */
--aris-dur-3: 320ms;   /* sheet, modal, expand */
--aris-dur-4: 480ms;   /* chuyển trang, morph lớn */
--aris-ease-out: cubic-bezier(.2, .8, .2, 1);
--aris-ease-in-out: cubic-bezier(.65, 0, .35, 1);
--aris-ease-spring: linear(0, .009, .035 2.1%, .141 4.4%, .723 12.9%, .938 16.7%, 1.017 20.5%, 1.043 24.5%, 1.035 28.4%, 1.007 36%, .998 45.3%, 1);
```
Vào chậm hơn ra: thời lượng khi đóng bằng khoảng 70% thời lượng khi mở.

### 3.6 Bố cục

**Nguyên tắc**
- Bố cục suy ra từ tác vụ của trang: đọc (bảng tin) → một cột đọc; duyệt và so sánh (việc làm) → master–detail; giao tiếp (chat) → danh sách + hội thoại; quản lý (nhà tuyển dụng) → pipeline/bảng; cấu hình (cài đặt) → mục lục + form.
- Nhóm nội dung bằng khoảng trắng và đường kẻ trước, sau đó mới tính đến card. Card chỉ dành cho **đối tượng độc lập thao tác được** (một job, một bài viết, một CV, một ứng viên). Danh sách thì dùng hàng + đường kẻ phân cách.
- Căn trái. Mỗi màn hình có **đúng một** hành động chính (nút brand đặc); các nút còn lại là secondary hoặc ghost.

**Khung app** (thay cho navbar ngang hiện tại, giữ logic role đang có trong `Views/Shared/Components/AppNavbar/Default.cshtml`)

```
Desktop ≥ 1024px
┌──────┬────────────────────────────────────────────────────────────┐
│ Rail │ Top bar: Tiêu đề trang  [ Tìm kiếm…   Ctrl K ]  [chuông] [tin nhắn] [avatar] │
│ 64px ├────────────────────────────────────────────────────────────┤
│ logo │                                                            │
│ mục  │   Nội dung — bố cục riêng từng trang (bên dưới)            │
│ …    │                                                            │
│ theme│                                                            │
└──────┴────────────────────────────────────────────────────────────┘
```
- Rail rộng 64px, cố định. Logo ở trên cùng. Các mục điều hướng theo role (Business có "Tổng quan" → Employer, ứng viên có "Đơn ứng tuyển"). Mỗi mục có icon Lucide và nhãn 11px bên dưới. Chỉ báo mục đang active là **một thanh 3px duy nhất trượt dọc** theo mục được chọn. Dưới cùng rail là nút đổi theme và Cài đặt.
- Top bar cao 56px, dính trên cùng, được dùng `backdrop-filter`. Gồm: tiêu đề trang (h1), ô mở command palette (thay cho `#globalSearchInput` hiện tại, phải giữ được chức năng), chuông thông báo (giữ `_NotificationBellNavItem` và các id mà `notification-client.js` dùng), tin nhắn, menu avatar.
- Từ 768 đến 1023px: rail giữ nguyên nhưng ẩn nhãn, chỉ hiện tooltip.
- Dưới 768px: rail chuyển thành **thanh tab dưới cùng** gồm 5 mục quan trọng nhất theo role. Thanh này ẩn khi cuộn xuống và hiện lại khi cuộn lên. Top bar chỉ còn tiêu đề và nút tìm kiếm.

**Bố cục từng trang**

Jobs/Index: master–detail.
```
[ Tìm việc…………………… ] [Địa điểm ▾] [Ngành ▾] [Hình thức ▾] [Sắp xếp ▾]      ← thanh dính
[Hà Nội ×] [Remote ×]   ·  128 việc                                        ← chip đang bật, số kết quả
┌ Danh sách ~400px ──────────────┬ Xem trước ──────────────────────────────────┐
│ ▌hàng job (đang chọn)          │ Logo · Tiêu đề · Công ty                     │
│  hàng job                      │ Lương · Địa điểm · Hình thức · Ngày đăng     │
│  hàng job                      │ [Ứng tuyển]  [Mở trang chi tiết]             │
│  … tự tải thêm khi cuộn        │ Mô tả, yêu cầu, quyền lợi…                   │
└────────────────────────────────┴──────────────────────────────────────────────┘
```
Trên mobile chỉ hiện danh sách; chạm vào một job thì sang trang chi tiết bằng View Transition.

Dashboard/Index: bảng tin.
```
┌ Cột đọc 640px ─────────────────────┬ "Việc cần làm" 300px (chỉ khi ≥ 1280px) ┐
│ Ô đăng bài (thu gọn)               │ Lời mời phỏng vấn  [Nhận] [Từ chối]      │
│ Bài viết                           │ Lời mời kết bạn    [Đồng ý] [Bỏ qua]     │
│ Bài viết                           │ Việc làm phù hợp (3 hàng)                │
└────────────────────────────────────┴──────────────────────────────────────────┘
```
Bỏ cột trái "thẻ hồ sơ" (rail và avatar đã đủ). Cột phải là **danh sách việc làm được ngay**, không phải widget trang trí. Dưới 1280px, cột phải gộp thành một hàng "Việc cần làm (N)" ở đầu feed, bấm vào thì mở rộng (`expand`). Không có mục nào thì ẩn cả khối.

Chat/Index: `[Danh sách hội thoại 320px] [Hội thoại] [Ngăn thông tin, mặc định ẩn, trượt vào khi bấm]`.

Profile/Index:
```
Avatar 72px · Tên · Headline · Địa điểm                     [Chỉnh sửa] [Nhắn tin]
┌ Mục lục dính 200px ─┬ Nội dung tối đa 720px ────────────────────┐
│ ▌Giới thiệu         │ Giới thiệu …                               │
│  Kinh nghiệm        │ Kinh nghiệm …                              │
│  Học vấn            │ …                                          │
│  Kỹ năng · CV       │                                            │
└─────────────────────┴────────────────────────────────────────────┘
```
Bỏ ảnh bìa mặc định từ Unsplash. Người dùng có ảnh bìa thật thì hiện thành một dải cao tối đa 120px; không có thì không hiện gì.

Employer/Index: `[Chọn tin tuyển dụng ▾]  số liệu thật viết thành một dòng chữ (không phải 4 ô KPI)`, bên dưới là **pipeline theo cột trạng thái**, kéo-thả được (xem 4.6).

Settings/Index: `[Mục lục 200px] [Form]`. Khi form có thay đổi chưa lưu, một thanh "Có thay đổi chưa lưu · Huỷ · Lưu" trượt lên từ đáy màn hình.

Company/Index: danh sách dạng hàng + bộ lọc. Company/Details: header gọn + tab có chỉ báo trượt (Giới thiệu / Việc đang tuyển).

Account/Login, Register, NewUserInfor: một cột form rộng khoảng 400px nằm thẳng trên nền canvas (không có card nổi, không split-screen, không ảnh minh hoạ), logo nhỏ ở góc trên bên trái.

---

## 4. Tương tác và animation — đầy đủ, hiện đại, có ý nghĩa

Nguyên tắc: **mỗi animation phải trả lời một câu hỏi của người dùng**: "Cái này từ đâu ra?", "Hành động của tôi đã được nhận chưa?", "Đang chờ cái gì?", "Cái gì vừa thay đổi?". Animation nào không trả lời được câu nào trong số đó thì bỏ.

### 4.0 Ma trận trạng thái — mọi component tương tác được

Mỗi component (nút, input, chip, tab, hàng danh sách, card, toggle, mục menu) phải có đủ các trạng thái sau và phải hiện ra trong trang style guide:

| Trạng thái | Yêu cầu |
|---|---|
| default | theo token |
| hover | chỉ áp dụng trong `@media (hover: hover)`: đổi nền/viền; card nâng lên 2px |
| pressed | `scale(.97)` trong 80ms, thả tay ra thì spring về |
| focus-visible | outline 2px màu brand, offset 2px |
| selected / checked | nền `brand-soft` + chỉ báo; khi đổi lựa chọn thì chỉ báo **trượt** sang, không tắt chỗ cũ bật chỗ mới |
| disabled | giảm tương phản + `cursor: not-allowed` + tooltip giải thích vì sao bị tắt |
| loading | nét logo tự vẽ hoặc skeleton; giữ nguyên kích thước để layout không nhảy |
| error | viền danger + message trượt xuống + rung ngang 2 nhịp (≤ 6px) |

### 4.1 Primitive bắt buộc — `wwwroot/js/aris-motion.js`

Viết dạng IIFE, không phụ thuộc thư viện nào, expose ra `window.ArisMotion`. Các trang chỉ gọi primitive, không tự viết lại.

| Primitive | Mô tả |
|---|---|
| `flip(container, mutateFn)` | FLIP: đo vị trí cũ → chạy `mutateFn` (lọc/sắp xếp/thêm/xoá) → animate từ vị trí cũ sang vị trí mới. Phần tử bị xoá thì co lại và mờ dần, phần tử mới thì mọc ra. |
| `rollNumber(el, to)` | Số lăn theo từng chữ số (mỗi chữ số là một cột `overflow: hidden`). Dùng cho số like, số kết quả lọc, badge thông báo, số ứng viên. |
| `morphButton(btn, state)` | Nút chuyển trạng thái ngay tại chỗ: `idle → loading → success/error`. Nhãn trượt ra; khi loading thì nét logo tự vẽ; khi success thì dấu check tự vẽ; khi error thì rung 2 nhịp rồi quay về. Giữ nguyên chiều rộng nút. |
| `sheetFrom(originEl, sheetEl)` | Modal/sheet mở ra **từ chính cái nút vừa bấm** (tính `transform-origin` từ vị trí nút) và thu về nút đó khi đóng. Với Bootstrap modal thì lấy nút gốc từ `event.relatedTarget` của sự kiện `show.bs.modal`. Trên mobile là bottom sheet, kéo xuống để đóng. |
| `expand(el)` / `collapse(el)` | Mở/đóng theo chiều cao bằng `grid-template-rows: 0fr ↔ 1fr`. |
| `stagger(list, {max: 6})` | Các phần tử xuất hiện lần lượt, **chỉ tối đa 6 phần tử đầu**, mỗi bước cách nhau 30ms; phần tử thứ 7 trở đi hiện ngay. Chỉ dùng khi danh sách **vừa được tải hoặc vừa thay đổi**, không dùng khi cuộn. |
| `flyTo(sourceEl, targetEl)` | Một bản sao nhỏ bay theo đường cong từ nguồn đến đích, đích nảy nhẹ khi "nhận" được. Ví dụ: ứng tuyển thành công thì logo công ty bay vào mục "Đơn ứng tuyển" trên rail. |
| `toast(msg, type, {undo})` | Toast xếp chồng lên nhau, vuốt ngang để đóng, có nút **Hoàn tác** khi hành động đảo ngược được. Thay cho `window.showToast` hiện tại nhưng **giữ lại tên hàm cũ** để tương thích. |
| `skeleton(el)` | Khung xương có đúng hình dạng của nội dung sắp hiện ra. Shimmer chỉ chạy trong lúc đang tải. |
| `drawPath(svgPath, {duration})` | Vẽ nét SVG (dùng cho nét logo, dấu check, timeline). |

### 4.2 Chuyển trang (toàn app)

- Bật **cross-document View Transitions** bằng `@view-transition { navigation: auto; }` trong CSS lõi. Trình duyệt nào không hỗ trợ thì chuyển trang bình thường, không cần polyfill.
- Rail và top bar đứng yên, chỉ vùng nội dung chuyển cảnh (crossfade + dịch 8px trong 240ms).
- **Shared element**: gán `view-transition-name` động theo id. Ở trang nguồn thì gán lúc click; ở trang đích thì gán sẵn. Khi bấm Back, dùng sự kiện `pagereveal` và `navigation.activation.from.url` để gán lại tên cho đúng card.
  - Hàng job → Jobs/Details: logo công ty và tiêu đề job **bay** từ hàng sang header của trang chi tiết.
  - Avatar → Profile: avatar morph sang.
  - Công ty trong danh sách → Company/Details: logo công ty morph sang.
  - Nếu khi bấm Back không morph được thì chấp nhận crossfade, và ghi lại trong báo cáo.
- **Gỡ bỏ** `aris-warp-transition.*` khỏi mọi layout/view.
- Hiện một thanh tiến trình mỏng 2px ở mép trên trang khi đang điều hướng, hoặc khi một lệnh fetch chạy quá 300ms.

### 4.3 Đổi theme

Chuyển light ↔ dark bằng `document.startViewTransition`, với **hình tròn lan ra từ vị trí nút đổi theme** (`clip-path: circle()`). Nếu bật reduced-motion thì đổi tức thì.

### 4.4 Command palette (Ctrl/⌘ + K) — tính năng mới, bắt buộc

- Mở bằng Ctrl+K, phím `/`, hoặc bấm ô tìm kiếm trên top bar. Dùng endpoint có sẵn `GET /Search/Global?q=...` (trả về JSON gồm `jobs`, `companies`, `people`). Palette thay cho ô tìm kiếm cũ trong `AppNavbar/Default.cshtml`, và phải làm được ít nhất mọi thứ ô cũ đang làm.
- Debounce 150ms. Kết quả nhóm theo loại. Điều hướng bằng ↑ ↓ Enter Esc. Tô đậm phần chữ khớp với từ khoá. Có nhóm "Hành động nhanh" (Viết bài, Tạo CV, Xem đơn ứng tuyển, Đổi theme, Mở cài đặt), được lọc theo từ đang gõ.
- Animation: palette phóng từ 0.98 lên 1 kèm fade trong 160ms. Danh sách kết quả thay đổi thì dùng `flip`. Mục đang chọn có **một lớp nền duy nhất trượt theo**, không phải mỗi mục tự đổi nền.

### 4.5 Khung app

- Chỉ báo active trên rail trượt giữa các mục; khi hover vào mục khác thì chỉ báo nhích nhẹ về phía mục đó để xem trước.
- Top bar thu gọn chiều cao khi cuộn (scroll-driven animation `animation-timeline: scroll()`; trình duyệt không hỗ trợ thì giữ nguyên chiều cao).
- Thanh tab dưới trên mobile ẩn khi cuộn xuống, hiện khi cuộn lên.
- Chuông thông báo: khi SignalR đẩy thông báo mới thì chuông lắc **một lần** (không lặp) và badge dùng `rollNumber`. Dropdown mở bằng `sheetFrom`. Mục chưa đọc có vạch accent bên trái; bấm "Đánh dấu đã đọc" thì vạch co lại.

### 4.6 Theo từng trang — yêu cầu tối thiểu (được làm nhiều hơn, không được làm ít hơn)

**Jobs/Index** (ưu tiên 1)
- Lọc/sắp xếp phải gọi endpoint có sẵn `GET /Jobs/GetJobs?skip&take&q&location&category&workMode&sort`. Endpoint này trả về HTML partial `_JobCardPartial`, hoặc JSON `{success:false}` khi không có kết quả. **Như vậy sẽ sửa luôn lỗi "bộ lọc chỉ lọc trên các card đã tải".** Đồng bộ trạng thái lọc lên URL bằng `history.replaceState` để F5 hoặc Back vẫn giữ bộ lọc. Danh sách thay đổi thì dùng `flip`, số kết quả dùng `rollNumber`. Cuộn tới cuối thì tải thêm bằng `IntersectionObserver`.
- Chip bộ lọc: bật thì mọc ra, tắt thì co lại, các chip còn lại dồn chỗ bằng `flip`.
- Khung xem trước: lấy HTML từ `GET /Jobs/Details/{id}`, dùng `DOMParser` để trích vùng mang attribute `data-job-detail` (bạn thêm attribute này vào `Jobs/Details.cshtml`), cache kết quả trong một `Map`. Action `Details` chỉ đọc dữ liệu, không ghi DB, nên **được phép prefetch khi hover một hàng quá 150ms**. Khi đổi job, nội dung khung xem trước crossfade trong 160ms. Job đang chọn ghi vào URL `?job={id}`.
- Bàn phím: `J`/`K` hoặc ↓/↑ để chuyển job đang chọn, `Enter` để mở trang chi tiết, `A` để ứng tuyển.
- Lưu/bookmark: chưa có backend → ẩn nút này (luật 2.1.9).
- Empty state: nói rõ bộ lọc nào đang loại hết kết quả, kèm nút "Bỏ bộ lọc này" cho từng bộ lọc.

**Jobs/Details**
- Header nhận shared element từ hàng job. Cột hành động bên phải (lương, địa điểm, nút ứng tuyển) dính khi cuộn.
- Ứng tuyển: dùng `GET /JobApplications/GetApplyModal?jobId=` và `POST /JobApplications/Apply` (đã có sẵn). Sheet mở ra từ nút ứng tuyển. Chọn CV bằng các thẻ chọn được (trạng thái selected có animation). Bấm nộp thì chạy `morphButton`; thành công thì nút biến thành chip "Đã nộp · vừa xong" và `flyTo` bay vào mục "Đơn ứng tuyển" trên rail.
- Mở trang bằng URL có `#apply` thì tự mở sheet ứng tuyển (để nút "Ứng tuyển" ở khung xem trước dùng được).

**Dashboard/Index** (bảng tin)
- **Gỡ quả địa cầu 3D** (`three.min.js`, `aris-earth-globe3d.js`, `aris-earth.js`, `aris-earth.css`) và mọi thứ kiểu hero.
- Ô đăng bài thu gọn; bấm vào thì `expand` thành khung soạn bài đầy đủ. Đính ảnh thì có ảnh xem trước thu nhỏ; xoá ảnh thì các ảnh còn lại dồn chỗ bằng `flip`.
- Like: icon nảy spring một lần + `rollNumber`, cập nhật lạc quan (đổi ngay trên giao diện; nếu server báo lỗi thì hoàn lại và hiện toast).
- Bình luận: mở bằng `expand`; bình luận mới chèn vào bằng `flip`.
- Cột "Việc cần làm" dùng endpoint có sẵn: `GET /JobApplications/GetInterviewInvitations` + `RespondToInterview`; `GET /Friends/GetPendingRequests` + `AcceptRequest`/`DeclineRequest`; và `_RecommendedJobsPartial`. Xử lý xong một mục thì hàng đó co lại, các hàng khác dồn lên bằng `flip`, kèm toast có Hoàn tác nếu hoàn tác được.
- Bài mới: chỉ làm pill "N bài mới" nếu thật sự có tín hiệu realtime cho bài mới. Không có thì bỏ và ghi vào báo cáo.

**Chat/Index + `_ChatWidget`**
- **Gỡ** `aris-gargantua.*`, `aris-warp-transition.*`, Bootstrap từ CDN. Chuyển sang dùng `_AppLayout` (hoặc biến thể full-height của nó).
- Gửi tin: bong bóng mọc ra từ vị trí ô soạn tin, danh sách tin nhắn dịch lên bằng `flip`.
- Đang gõ: 3 chấm (được phép `infinite` trong lúc người kia đang gõ). Đã xem: avatar nhỏ trượt tới tin cuối cùng đã được đọc.
- Đổi hội thoại: vùng tin nhắn crossfade trong 160ms; mục hội thoại đang mở có lớp nền trượt theo.
- Hội thoại vừa có tin mới nhảy lên đầu danh sách bằng `flip`.

**JobApplications/MyApplications**
- Mỗi đơn có **timeline trạng thái** vẽ bằng `drawPath` tới đúng bước hiện tại. Đơn bị từ chối thì hiện lý do (dữ liệu đã có) trong vùng `expand`.
- Tab lọc theo trạng thái có nền trượt; danh sách thay đổi bằng `flip`. Rút đơn (`POST /JobApplications/Withdraw`) thì hỏi xác nhận bằng sheet, sau đó hàng co lại.

**Employer/Index**
- Pipeline ứng viên theo cột trạng thái: `GET /JobApplications/GetApplicantsForJob?jobId=&status=`; đổi trạng thái bằng `POST /JobApplications/UpdateApplicationStatus` (body `{ Status, Note }`). **Các cột phải lấy đúng những giá trị `Status` mà server chấp nhận.** Đọc code của action đó; không tự bịa trạng thái.
- Kéo-thả card ứng viên giữa các cột (Pointer Events, có hỗ trợ cảm ứng). Card đang kéo nâng lên với `--aris-shadow-2`, cột đích sáng viền. Thả xuống thì cập nhật lạc quan; server báo lỗi thì card bay về chỗ cũ kèm toast. Thả vào cột "Từ chối" thì mở sheet nhập lý do (`Note`); huỷ thì card bay về chỗ cũ. **Bắt buộc có cách thay thế bằng bàn phím/nút**: menu "Chuyển sang…" trên mỗi card.
- Lên lịch phỏng vấn: `POST /JobApplications/ScheduleInterview`, mở bằng sheet.
- Số liệu thật dùng `rollNumber` một lần khi vào khung nhìn. Không có dữ liệu thì hiện empty state, không vẽ biểu đồ giả.

**Profile/Index**
- Vòng/thanh hoàn thiện hồ sơ vẽ tới **đúng phần trăm thật** khi vào trang, chỉ một lần.
- Mục lục bên trái có scrollspy với chỉ báo trượt.
- Chỉnh sửa ngay tại chỗ (inline edit) mở bằng `expand`; lưu bằng `morphButton`.
- Avatar nhận shared element khi chuyển trang.

**Resume/Index + `_MyCvsPartial`**
- Lưới thumbnail CV; hover thì hiện các hành động. Xoá CV: nếu hoàn tác được thì card co lại, các card khác dồn chỗ bằng `flip`, kèm toast có Hoàn tác; nếu không hoàn tác được thì hỏi xác nhận trước khi xoá.
- Upload CV: vùng kéo-thả có trạng thái "đang kéo vào" (đổi viền và nền). Có thanh tiến trình upload thật nếu lấy được progress.

**Company/Index + Details + Edit**
- Index: danh sách dạng hàng + bộ lọc, dùng `flip` khi lọc. Details: logo nhận shared element, tab có chỉ báo trượt. Edit: form có thanh "Có thay đổi chưa lưu" giống Settings.

**Settings/Index**
- Toggle switch có thumb chuyển động spring. Thanh "Có thay đổi chưa lưu" trượt lên từ đáy. Lưu xong thì hiện "Đã lưu" với icon check của Lucide tự vẽ ngay tại chỗ.
- Nút đổi theme ở đây và trên rail dùng chung cơ chế ở 4.3.

**Interview/Room**
- Giao diện gọn, dùng token dark, tập trung vào video. Nút mic/cam/rời phòng có phản hồi khi nhấn rõ ràng. Chấm "đang live" được phép `infinite`.
- Kiểm tra route `/Interview/Room/{id}` (audit ghi nhận lỗi 404). Nếu route lỗi thì báo cáo, không tự đổi route.

**Account/Login + Register + NewUserInfor**
- **Gỡ WebGL**: bỏ `three.min.js`, `aris-auth-stage.js`, canvas, và 3 nút Bỏ qua/Phát lại/Tạm dừng.
- Khoảnh khắc đặc trưng duy nhất: vào trang thì nét logo tự vẽ trong ≤ 700ms. Chuyển Login ↔ Register bằng View Transition: khối form đổi chiều cao mượt, các field chung (email, mật khẩu) **đứng yên tại chỗ**, các field mới mọc ra.
- Nút Google/Facebook nằm cùng hàng trên desktop, xếp dọc khi không đủ chỗ.
- Lỗi validation: field rung 2 nhịp và message trượt xuống. Ô mật khẩu có thanh độ mạnh.
- NewUserInfor (onboarding): chia nhiều bước, thanh tiến trình là nét logo, chuyển bước bằng cách trượt ngang, nút Quay lại giữ nguyên dữ liệu đã nhập.

**Home/Error, SocialConnect/SelectFacebookPage**: dùng layout chung, trạng thái rõ ràng, có đường quay lại.

### 4.7 Trạng thái — mọi màn hình

Mỗi màn hình phải có đủ: **loading** (skeleton đúng hình dạng nội dung), **empty** (nói rõ vì sao trống + một hành động cụ thể), **error** (nói lỗi gì + nút thử lại), **success** (phản hồi ngay tại chỗ, không chỉ dựa vào toast). Màn hình nào chỉ đẹp khi có dữ liệu đẹp là **chưa đạt**.

### 4.8 Bàn phím

| Phím | Tác dụng |
|---|---|
| Ctrl/⌘+K, `/` | mở command palette |
| `?` | mở bảng liệt kê phím tắt (sheet) |
| `G` rồi `H` / `J` / `M` / `P` | đi tới Bảng tin / Việc làm / Tin nhắn / Hồ sơ |
| `J` / `K` | chuyển mục trong danh sách chính của trang (job, bài viết, hội thoại) |
| `Esc` | đóng sheet/palette/ngăn kéo đang mở trên cùng |

---

## 5. Cấu trúc file đích

```
wwwroot/css/aris-tokens.css      ← viết lại (light + dark + motion tokens)
wwwroot/css/aris-base.css        ← reset nhẹ, typography, override Bootstrap theo token
wwwroot/css/aris-components.css  ← a-btn, a-input, a-card, a-chip, a-tab, a-row, a-menu, a-sheet, a-toast, a-skeleton, a-empty, rail, topbar, palette
wwwroot/css/aris-motion.css      ← keyframes, view-transition, reduced-motion
wwwroot/css/pages/<trang>.css    ← CSS riêng từng trang (chỉ dùng token)
wwwroot/js/aris-motion.js        ← primitive ở 4.1
wwwroot/js/aris-palette.js       ← command palette + phím tắt
wwwroot/js/aris-theme-toggle.js  ← đổi theme
```
Các file `aris-theme.css`, `aris-cosmos.css`, `aris-dashboard.css`, `aris-earth*.css`, `aris-gargantua.css`, `aris-warp-transition.css`, `aris-cinematic-shell.css`, `aris-auth.css`, `aris-messenger.css`, `aris-constellation.js`: gỡ tham chiếu dần khi trang tương ứng đã chuyển xong (luật 2.1.3: không xoá file).

**Trang style guide**: thêm action `Home/StyleGuide`, trả về 404 nếu môi trường không phải Development. Trang này hiển thị mọi token, mọi component với đủ ma trận trạng thái ở 4.0, và mọi primitive animation kèm nút "Chạy lại". Các tính năng **thêm sau này** sẽ lấy component từ đây, nên component phải dùng lại được và đặt tên class nhất quán với tiền tố `a-`.

---

## 6. Công cụ kiểm tra có sẵn

- Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`. `puppeteer-core` đã có sẵn trong `ArisSkyve/node_modules`. Xem cách dùng mẫu ở `ArisSkyve/_smoke-matte.js`.
- Đăng nhập nhanh trong môi trường dev: `GET /Account/QuickLogin?returnUrl=/Dashboard` (mặc định là tài khoản ứng viên `ungvien@aris.vn`). Thêm tham số `email=` để dùng tài khoản khác; tra `EnsureUserAsync` trong `AccountController` để biết email của tài khoản doanh nghiệp.
- Mọi script đặt trong `.local/ui-v6/`, **không** đặt trong `wwwroot` hay ở thư mục gốc của project. Ảnh lưu tại `.local/ui-v6/shots/<phase>/<trang>-<viewport>-<theme>-<trạng thái>.png`.
- Script đo hiệu năng, lưu thành `.local/ui-v6/perf.js`:

```js
// Chạy:  node .local/ui-v6/perf.js http://localhost:5099 Dashboard Jobs Chat Profile Jobs/Details/1
// (tên trang KHÔNG có dấu / ở đầu, để Git Bash không tự đổi thành đường dẫn Windows)
// Tài khoản doanh nghiệp:  $env:ARIS_EMAIL="<email>"; node .local/ui-v6/perf.js ...
const puppeteer = require('../../ArisSkyve/node_modules/puppeteer-core');
const [base, ...names] = process.argv.slice(2);
const paths = names.map(n => '/' + n.replace(/^\/+/, ''));
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setCacheEnabled(false);
  await page.evaluateOnNewDocument(() => {
    window.__raf = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => { window.__raf++; return raf(cb); };
    window.__lcp = 0; window.__cls = 0; window.__long = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(l => { window.__long += l.getEntries().length; })
      .observe({ type: 'longtask', buffered: true });
  });
  let errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const email = encodeURIComponent(process.env.ARIS_EMAIL || '');
  await page.goto(`${base}/Account/QuickLogin?email=${email}&returnUrl=/Dashboard`, { waitUntil: 'networkidle2', timeout: 60000 });

  for (const p of paths) {
    errors = [];
    await page.goto(base + p, { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(2000);
    const rafBefore = await page.evaluate(() => window.__raf);
    await wait(3000);
    const m = await page.evaluate(rafBefore => {
      const nav = performance.getEntriesByType('navigation')[0];
      const res = performance.getEntriesByType('resource');
      const own = res.filter(r => /\/(css|js)\//.test(new URL(r.name).pathname) && !r.name.includes('/lib/'));
      return {
        lcpAfterTtfb: Math.round(window.__lcp - nav.responseStart),
        cls: +window.__cls.toFixed(3),
        longTasks: window.__long,
        rafIdle3s: window.__raf - rafBefore,
        ownCssJsKB: Math.round(own.reduce((s, r) => s + (r.decodedBodySize || 0), 0) / 1024),
        threeLoaded: res.some(r => r.name.includes('/lib/three/')),
        domNodes: document.getElementsByTagName('*').length,
      };
    }, rafBefore);
    console.log(p.padEnd(28), JSON.stringify({ ...m, pageErrors: errors.length }));
  }
  await browser.close();
})();
```
Script chỉ đếm CSS/JS nằm trong file, không đếm `<style>`/`<script>` inline. Vì vậy luật 2.3.5 (không `<style>` inline) là bắt buộc để con số `ownCssJsKB` có ý nghĩa.

---

## 7. Các phase — làm đúng thứ tự

### Phase 0 — Kiểm kê (không sửa gì)
1. Liệt kê mọi view: layout nó dùng, CSS/JS nó tải, khối `<style>` inline, số `@keyframes`, số `infinite`.
2. Chụp ảnh **trước khi sửa** cho mọi trang ở 1440×900 và 390×844, với tài khoản ứng viên và tài khoản doanh nghiệp. Dùng bản đang chạy ở 5025, chỉ gửi request GET.
3. Chạy `perf.js` trên mọi trang để lấy **baseline**, lưu thành `.local/ui-v6/perf-baseline.txt`.
4. Grep và lập danh sách class/id mà JS nghiệp vụ phụ thuộc vào (luật 2.1.7), cùng những chỗ gọi `bootstrap.Modal` (luật 2.1.8).
5. Đọc action `UpdateApplicationStatus` và ghi lại danh sách giá trị `Status` hợp lệ.
6. Báo cáo. **DỪNG.**

### Phase 1 — Token + component + style guide
1. Viết `aris-tokens.css`, `aris-base.css`, `aris-components.css`, `aris-motion.css`, `aris-motion.js`, `aris-theme-toggle.js`.
2. Làm trang style guide đầy đủ (mục 5). Chụp ảnh light, dark và mobile.
3. Lập bảng tương phản cho các cặp màu chữ/nền chính. Số liệu phải tính ra được, không ước lượng.
4. Vẽ khung app (3.6) ngay trong style guide dưới dạng bản demo tĩnh.
5. Báo cáo kèm ảnh. **DỪNG — chờ chủ dự án duyệt giao diện rồi mới áp vào các trang.**

### Phase 2 — Khung app
`_AppLayout`, rail/top bar/thanh tab dưới (3.6, 4.5), footer (bỏ copy sáo rỗng; nếu không cần footer thì bỏ luôn), toast, thanh tiến trình, View Transitions (4.2), đổi theme (4.3), command palette + phím tắt (4.4, 4.8). Gỡ `aris-constellation.js`, `aris-cosmos.css` và warp khỏi layout. Chụp ảnh và đo `perf.js`. **DỪNG.**

### Phase 3 — Từng trang, theo đúng thứ tự
Jobs/Index → Jobs/Details → Dashboard → Chat + ChatWidget → MyApplications → Employer → Profile → Resume → Company (3 trang) → Settings → Account (Login, Register, NewUserInfor) → Interview/Room → Home/Error → SocialConnect.

Mỗi trang phải hoàn tất **checklist ở mục 8** rồi mới chuyển sang trang tiếp theo. Cứ xong 3 trang thì gửi một báo cáo ngắn. **DỪNG sau Dashboard** để chủ dự án xem trước khi làm tiếp.

### Phase 4 — Rà soát toàn app
Chạy toàn bộ lệnh ở mục 9 và `perf.js` trên mọi trang, so với baseline. Chụp đủ bộ ảnh **sau khi sửa**. Liệt kê các file không còn được dùng và danh sách việc chưa làm được. **DỪNG.**

---

## 8. Checklist cho MỖI trang (ghi rõ ✓/✗ trong báo cáo)

- [ ] Không còn khối `<style>` inline; CSS nằm trong `css/pages/<trang>.css`, không có hex/rgb.
- [ ] Không vi phạm mục 2.2 (tự rà từng dòng trong danh sách cấm).
- [ ] Bố cục đúng 3.6. Vào trang là thấy nội dung/tác vụ, không có hero, không có card lồng card.
- [ ] Có đủ các tương tác/animation ghi cho trang đó ở 4.6, và mỗi cái gắn với một hành động thật.
- [ ] Mọi component tương tác đủ ma trận trạng thái 4.0.
- [ ] Đủ 4 trạng thái loading / empty / error / success (4.7).
- [ ] Đúng ở cả light lẫn dark.
- [ ] Ở 1440×900, 390×844 và 320×568 đều không tràn ngang, không có chữ đè lên nhau.
- [ ] Reduced-motion hoạt động.
- [ ] Bàn phím: Tab đi hết các phần tử, focus nhìn thấy rõ, Esc đóng sheet/palette, phím tắt ở 4.8 chạy được.
- [ ] `perf.js` đạt mọi ngân sách ở 2.4 và không kém hơn baseline (dán kết quả vào báo cáo).
- [ ] Các chức năng cũ của trang vẫn chạy (gửi form, like, chat realtime, ứng tuyển, upload CV, đổi trạng thái ứng viên…). Phải thử thật và ghi lại kết quả.
- [ ] Đã lưu ảnh trước/sau.

---

## 9. Lệnh kiểm tra bắt buộc ở Phase 4 (dán kết quả vào báo cáo)

```bash
cd ArisSkyve
# 1. Không còn Three.js / scene cũ trong view
grep -rnE "three\.min|aris-(earth|gargantua|constellation|warp|auth-stage|cosmos|cinematic)|black-hole" Views --include=*.cshtml
# 2. Không còn <style> inline
grep -rln "<style" Views --include=*.cshtml
# 3. Không có hex/rgb trong CSS của trang
grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(" wwwroot/css/pages/*.css
# 4. Không có chữ gradient, không có glow
grep -rnE "background-clip:\s*text|text-shadow|box-shadow:[^;]*\b0 0 [0-9]+px" wwwroot/css/aris-*.css wwwroot/css/pages
# 5. backdrop-filter ≤ 3 chỗ
grep -rn "backdrop-filter" wwwroot/css/aris-*.css wwwroot/css/pages | wc -l
# 6. infinite chỉ ở spinner/skeleton/đang gõ/live — liệt kê và giải thích từng dòng
grep -rn "infinite" wwwroot/css/aris-*.css wwwroot/css/pages wwwroot/js/aris-*.js
# 7. Có xử lý reduced-motion
grep -rln "prefers-reduced-motion" wwwroot/css wwwroot/js
# 8. Chỉ một bản Bootstrap
grep -rn "cdn.jsdelivr.net/npm/bootstrap" Views
# 9. Không còn ảnh bìa stock
grep -rn "images.unsplash.com" Views
# 10. Build
dotnet build ArisSkyve.csproj -c Debug -o ../.local/ui-v6-build --nologo
```
Các lệnh 1, 2, 3, 4, 8, 9 phải trả về rỗng. Lệnh 10 phải có 0 error, và số warning không được nhiều hơn mức hiện tại.

Lưu ý: lệnh 1 bắt theo tên file. Nếu còn file cũ được nạp bằng cách khác (ví dụ ghép chuỗi động), `perf.js` với `threeLoaded` và `ownCssJsKB` sẽ bắt được. Hai lớp kiểm tra này phải cùng đạt.

---

## 10. Mẫu báo cáo (dùng cho mọi lần DỪNG)

```
## Phase X — <tên>
Đã làm:
- <file>: <thay đổi gì, vì sao>
Bằng chứng:
- Ảnh: .local/ui-v6/shots/...
- perf.js: <dán nguyên kết quả, đặt cạnh baseline>
- Lệnh: <lệnh> → <kết quả dán nguyên văn>
Checklist mục 8: <bảng ✓/✗ theo từng trang>
Chưa làm được / chưa có backend:
- <việc> — <lý do>
Có sửa controller không: <không | có: file, action, lý do>
Câu hỏi cho chủ dự án:
- ...
```

Không viết "mọi thứ hoạt động hoàn hảo". Chỉ viết đúng những gì đã kiểm tra và những gì chưa kiểm tra.

---

## 11. Quyết định thuộc về chủ dự án — agent không tự quyết

1. **Lưu job (bookmark)**: chưa có backend. Có làm backend không (cần model + migration, nằm ngoài phạm vi UI)? Cho đến khi có câu trả lời thì ẩn nút.
2. **Xoá file cũ** (cosmos, constellation, earth, gargantua, warp, auth-stage, black-hole, three.js, `*.bak`, `_smoke-*`): chỉ liệt kê, chờ chủ dự án đồng ý.
3. **CV builder** (`wwwroot/cv-builder/`): có đưa vào theme mới ở đợt sau không.
4. **Commit/branch**: chỉ làm khi được cho phép.
