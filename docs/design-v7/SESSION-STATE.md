# Aris V7 "Aris Line" — trạng thái phiên thiết kế

> ## ▶ PHIÊN 28/09 (rạng sáng) — dữ liệu mẫu + Tin nhắn kiểu Zalo
> - `Infrastructure/Data/DemoSocialSeeder.cs` (Program.cs, chỉ Development, chỉ thêm): tài khoản chủ dự án tohkadangyeu@gmail.com (không có mật khẩu — đăng nhập nhanh bằng ô email ở trang Đăng nhập), 6 người dùng mẫu, 6 trang giới thiệu công ty (FPT Software, VNG, MoMo, Tiki, Viettel, Vinamilk — thông tin công khai, chưa xác minh, email @example.com), bài có ảnh/video (`wwwroot/uploads/demo`), bạn bè, lời mời, tin nhắn (có ảnh + video), thông báo, theo dõi công ty, tin 24h (tự tạo lại khi hết hạn).
> - Tin nhắn (trang + khung chat nổi): avatar cuối cụm, giờ trong bong bóng, nút nổi không xô tin, menu "…" kiểu Zalo, "Đã xem", gửi/xem video (`POST /Chat/UploadChatMedia`, lưu `wwwroot/uploads/chat`), bảng emoji đầy đủ tiếng Việt (`js/aris-emoji-picker.js`). Sửa lỗi thật: trang Tin nhắn không tải được tin do biến chỉ báo cũ.
> - Chưa làm: thả cảm xúc cho tin nhắn (cần bảng mới), đăng nhập bằng mật khẩu.

> ## ▶ PHIÊN 27/09 (tối) — "Aris Night": áp bộ Stitch "Aris Careers" (thư mục stitch_mobile_social_feed_ui) — ĐÃ LÀM, BUILD OK
> Build `.local/claude-build` 0 lỗi, xem trước `http://localhost:5098`. App 5025 của chủ dự án **cần dừng + `dotnet run` lại** (đã đổi Razor + controller). Bản sao trước khi sửa: `.local/v8-backup/` (css, js, Views).
> - **Toàn app:** token mới trong `aris-line.css` (zinc tối mặc định, brand tím #7C3AED, `--grad-sunset` / `--grad-ring`, `.a-btn--sunset` = một nút chính mỗi màn, `.a-btn--ink`), font Plus Jakarta Sans (tiêu đề) + Inter; khung app mới (sidebar có nút "Tạo bài viết", bỏ ô tìm trùng, logo Aris + "CAREERS").
> - **Logo:** đúng mẫu `aris_premium_logo` (chữ A chuyển sắc + chấm cam ở đỉnh) — `_ArisMark.cshtml`, `images/brand/aris-mark.svg`, `aris-logo.svg`, `favicon.svg`. Tên sản phẩm luôn là **Aris**, không dùng "Lumina".
> - **Icon riêng:** `js/aris-icons.js` (~110 tên, nạp sau lucide.min.js; `.ai-dot` sáng cam ở mục đang chọn). Tên chưa vẽ vẫn rơi về Lucide cùng nét.
> - **Trang:** Đăng nhập/Đăng ký (+ `AuthShowcase`: "bức tường" tin tuyển dụng thật thay ảnh AI), Bảng tin (thẻ kiểu Instagram, bình luận ngay trong thẻ, khối "Việc làm mới đăng"), Việc làm (thẻ danh sách, ô lương/hình thức/địa điểm/kinh nghiệm, cột "Việc khác / Việc tương tự" — `JobsController.Details` thêm AppliedAt/CompanyJobs/SimilarJobs), Khám phá công ty (số liệu thật, "Nổi bật tuần này", thẻ có tin đang tuyển mới nhất), Chi tiết công ty mới (`css/pages/company-profile.css`, `js/pages/company.js`; controller thêm người theo dõi + "Khoảnh khắc").
> - Ảnh "chữ cái" tự sinh `ui-avatars.com` trong dữ liệu mẫu bị ẩn (CSS) → hiện chữ viết tắt theo tông Aris.
> **CÒN LẠI:** chủ dự án duyệt; Tin nhắn / Hồ sơ / Cài đặt / CV / Nhà tuyển dụng mới chỉ nhận token mới (chưa dựng lại bố cục); `/Employer` có lỗi JS cũ `applicants.forEach is not a function`; nhánh Nhà tuyển dụng trong NewUserInfor vẫn chưa làm.

> ## ▶ PHIÊN 26/09 (chiều) — "Aris Kinetic" theo mẫu Stitch: ĐÃ LÀM, BUILD OK, CÒN KIỂM THỬ
> Chủ dự án: "làm xong hết rồi build, test bổ sung để session sau". Build `.local/claude-build` 0 lỗi; xem trước `http://localhost:5098` (bản của Claude, Development). App 5025 của chủ dự án **cần dừng + `dotnet run` lại** mới thấy (Razor/C# đã đổi; CSS/JS thì đọc thẳng wwwroot).
> **Đã làm (Claude tự sửa source, không qua Antigravity):**
> - Logo mới `wwwroot/images/brand/aris-mark.svg`, `favicon.svg`, partial `Views/Shared/_ArisMark.cshtml` (ô gradient xanh + chữ A + gạch ngang xanh ngọc).
> - Khung app: sidebar Stitch (nhóm Chính/Giao tiếp/Khám phá, badge tin chưa đọc thật, pip phỏng vấn, thẻ % hồ sơ, thu gọn Ctrl+\, nhớ `aris-side`), thanh trên (tìm Ctrl K, chips theo trang qua `ViewData["TopChips"]`, chuông, Đăng bài), tab bar mobile. `AppNavbarViewComponent.cs` + `Default.cshtml` + `aris-line.css` (mục 16, 17b `.fx-*`) + `aris-shell.js`. Theme mặc định **tối**.
> - Bảng tin: `DashboardController` (`BuildPostMetaAsync`, `ToFeedDto` dùng chung cho Index + `GetPosts`; lời mời kết nối, việc cần làm thật), `Views/Dashboard/Index.cshtml`, `css/pages/feed.css`, `js/pages/feed.js` (thẻ bài Stitch, Theo dõi công ty, Kết nối, Lưu/Ẩn bài qua backend V7, "N bài mới" SignalR `NewPost` — thêm vào `chat-client.js`, cuộn vô hạn, soạn bài/viết bài/cột mốc).
> - Stories dùng chung: `js/aris-stories.js` + `css/aris-stories.css` (xem, giữ để dừng, trả lời qua tin nhắn, xem ai đã xem, đăng tin). **Sửa lỗi 500 `/Stories/Feed`** (route trùng → AmbiguousMatch), thêm `?scope=companies`.
> - Khám phá công ty: `CompanyController.Index` (người theo dõi, câu chuyện văn hoá = bài có ảnh của doanh nghiệp, gợi ý theo chức danh), `CompanyViewModels.cs`, `Views/Company/Index.cshtml`, `css/pages/company-discover.css`, `js/pages/company-discover.js`.
> - Đăng nhập/Đăng ký: `_AuthLayout` chia đôi + `AuthShowcaseViewComponent` (số liệu thật), `Login`/`Register` (chọn vai trò), `_AuthSent` (Kiểm tra hộp thư + đếm ngược gửi lại), `_AuthSocial`, `css/pages/auth.css`, `js/pages/auth.js`. **Bảo mật:** `QuickLogin`/`DirectLogin` chỉ chạy ở Development; link xác nhận chỉ lộ ở Development; user mới qua magic link → `NewUserInfor?intent=`; OAuth nhớ vai trò bằng cookie `aris_intent`.
> **CÒN LẠI (phiên sau):**
> 1. Kiểm thử bổ sung: mobile/light cho mọi trang mới; tương tác thật (theo dõi, lưu, ẩn, lời mời, đăng tin 24h, bài mới realtime), ảnh `.local`/scratch `app-shots/v2-*.png`.
> 2. `NewUserInfor`: nhánh **Nhà tuyển dụng** (form công ty → `POST /Account/UpgradeToBusiness`, đã có `ViewBag.Intent`) — CHƯA làm; hiện ai chọn NTD vẫn qua onboarding ứng viên.
> 3. Company/Details, các trang khác (Jobs, Chat, Profile…) chưa áp Stitch; kiểm tra lại sticky header các trang (đã chuyển `top` theo `--topbar-h`).
> 4. Nhắc chủ dự án: Antigravity đã tự áp migration V7Social (trái luật "chỉ tạo") — PROGRESS.md.


> **Cập nhật 26/09/2026: BỘ THIẾT KẾ ĐÃ HOÀN TẤT (mục 5.1–5.7).** Bàn giao cho agent triển khai bằng `AGENT-PROMPT.md`.
> Đọc theo thứ tự: `AGENT-PROMPT.md` → `README.md` → `PAGES.md` → `BACKEND.md` → mở `reference/*.html`.
> Việc còn lại của người thiết kế (chờ chủ dự án): duyệt các mục trong `BACKEND.md`; tuỳ chọn publish bản xem trước (5.8).

## 0. Phiên 26/09 — đã làm
- 5.1 Sửa Việc làm (+ lỗi thật: thanh Ứng tuyển cố định bị ghim sai do animation fill `both`).
- Chủ dự án chốt hướng: nền gọn + **tăng mạnh tương tác**; **Bảng tin kiểu Instagram**; được thiết kế tính năng cần backend (ghi rõ).
- 5.2 `feed.html/css/-demo.js` (Bảng tin đầy đủ tương tác). Dùng chung mới: lightbox (`openLightbox`), `.a-logo`, `--like`, nút Tạo bài trên rail, `ArisMotion.sortable`, `.a-toc` + `initToc`, `.a-drag/.is-dragging`, dialog mobile `width:100% !important`.
- 5.3 `components.html/css/-demo.js`: mọi token (đọc giá trị thật), bảng tương phản đo trực tiếp, mọi component, 17 demo chuyển động + 6 mẫu tương tác có "Chạy lại".
- 5.7 `tools/contrast.js` + **sửa token để đạt WCAG AA 39/39 cặp**: thêm `--line-control` (viền ô nhập/checkbox/radio/công tắc ≥ 3:1), `--danger-fill`, `--on-status`; brand tối `#4F86F7→#2A6DF5`, accent tối `#E8683D→#D24719`, success sáng `#1D8452→#1B7C4D`.
- 5.4 `README.md` (hệ thiết kế + bẫy kỹ thuật), `PAGES.md` (16 trang, map endpoint/id thật), `BACKEND.md` (24 tính năng cần API, xếp ưu tiên, chờ duyệt).
- 5.5 `AGENT-PROMPT.md` (luật, bước 0 Lucide có sha256 đã kiểm: 12 dòng đầu = bản sạch 0.344.0, `7c973be5…`, 317.289 byte; 8 phase có DỪNG; Phase B backend).
- 5.6 Đã chèn dòng "ĐÃ ĐƯỢC THAY THẾ" đầu `docs/ui-redesign/06-AGENT-PROMPT-THEME-V6.md`.

# (Nhật ký cũ) trạng thái phiên thiết kế — tạm dừng 25/09/2026, ~22:40

> File này để **tiếp tục vào phiên sau**. Đọc hết trước khi làm tiếp.
> Người thiết kế: Claude (phiên này). Agent khác (model yếu hơn) sẽ **chỉ triển khai** theo bản thiết kế này.

## 1. Yêu cầu của chủ dự án (theo thứ tự thời gian)

1. UI hiện tại "quá nặng, màu mè quá mức, layout/component cliché và xấu, khó render, UX phẳng không có gì để tương tác, background tốn công mà không dùng được gì". Cấm AI cliché (hero banner…). Muốn nhiều animation hiện đại, có ý nghĩa, "đặc biệt".
2. Đã viết prompt V6 (`docs/ui-redesign/06-AGENT-PROMPT-THEME-V6.md`). Agent kia mới làm **Phase 0** (kiểm kê + ảnh + baseline ở `.local/ui-v6/`), **chưa sửa source**.
3. Chủ dự án xem `/Chat` và thấy vẫn xấu và nặng: **"khởi đầu mới, tạo lại mọi thứ từ đầu; bạn tự nghĩ ý tưởng từ đầu và mô tả thật kỹ các component, ý tưởng design để agent kia chỉ việc triển khai."**
4. → Phiên này: Claude **tự thiết kế** hệ V7 và dựng **bản tham chiếu HTML/CSS/JS chạy được** để agent kia port y nguyên.
5. Chủ dự án yêu cầu tạm dừng, sáng mai làm tiếp.

6. **26/09 — chủ dự án chốt hướng (qua câu hỏi lựa chọn):** "Giữ nền gọn, **tăng tương tác**" (nhiều tương tác và chuyển động hơn, không thêm màu); **được thiết kế tính năng cần backend mới**, nhưng spec phải ghi rõ "cần backend" + endpoint cần thêm; **Bảng tin học theo Instagram** (media là chính, carousel, nhấn đúp để thích, hàng tin 24h, gửi cho bạn bè, lưu bài, bình luận trong modal/bottom sheet).

## 2. Phát hiện quan trọng (phải đưa vào spec và prompt)

- **`ArisSkyve/wwwroot/lib/lucide/lucide.min.js` bị chèn thêm code** ở cuối file (sau dòng `//# sourceMappingURL=lucide.min.js.map`): một IIFE "Aris Constellation & Living Cosmos Engine Loader" tự tải `/js/aris-constellation.js` (99 KB, vòng rAF starfield) vào **mọi trang có Lucide**. Vì vậy gỡ tham chiếu trong view là KHÔNG đủ. Phải xoá đoạn chèn (hoặc thay bằng bản lucide 0.344.0 sạch). Các thư viện khác trong `wwwroot/lib` đã kiểm tra: sạch.
- Baseline của agent kia (`.local/ui-v6/perf-baseline.txt`): `/Chat` tải **636 KB** CSS/JS riêng, `rafIdle3s` 362 (2 vòng rAF chạy khi đứng yên); Dashboard 465 KB + three.js; hầu hết các trang ~380 KB và rAF 160–180 (do constellation được chèn qua lucide).
- Chat hiện tại dùng ảnh hố đen (Gargantua) làm nền toàn trang.
- Auth thật là **magic link qua email + Google + Facebook** (`RequestMagicLink`, `ConfirmMagicLink`), không có mật khẩu → prompt V6 nói "thanh độ mạnh mật khẩu" là **sai**; spec V7 không được có.
- Không có trang hồ sơ công khai của người khác (`ProfileController.Index()` không nhận id).
- Không có backend lưu/bookmark job.
- Endpoint có sẵn dùng được cho tương tác: xem danh sách ở mục 6.

## 3. Quyết định thiết kế đã chốt — "Aris Line"

Năm nguyên tắc:
1. **Canvas & Sheet**: nền app (canvas, `#F6F5F2` ấm) chứa rail, danh sách, bộ lọc; vùng làm việc chính là một "tờ giấy" trắng bo 16px (`.a-sheet`), cách mép 8px. Master–detail: **danh sách trên canvas, chi tiết trong sheet** (Chat, Việc làm, sau này Cài đặt/Hồ sơ/Công ty…).
2. **The Line**: mọi trạng thái "đang chọn" dùng **một thanh chỉ báo duy nhất màu brand trượt** tới mục được chọn (rail, danh sách, tab); nét quỹ đạo của logo là loader/tiến trình (thay spinner).
3. **Direct & Physical**: mọi thứ mọc ra từ chỗ bấm (dialog/popover từ nút gốc, gọi video lan hình tròn từ nút gọi, ảnh phóng từ thumbnail), spring cho phản hồi, FLIP khi danh sách đổi, kéo-thả có quán tính (PiP camera).
4. **Quiet color**: trung tính ấm + **một brand `#2F6FED`** (hành động chính, lựa chọn) + **một accent ember `#C9481F`** chỉ cho "mới / chưa đọc / đang live" (mọi badge chưa đọc dùng accent). Màu trạng thái chỉ khi báo trạng thái. Không gradient, không glow, không glass tràn lan.
5. **Chữ tạo phân cấp**: Be Vietnam Pro 400/500/600/700; UI 14px, chat 15px, đọc 15–16px; tiêu đề trang 22px; không chữ in hoa giãn cách làm "eyebrow".

Khác: light là mặc định, dark là than chì trung tính (token đầy đủ trong `line.css`); đổi theme bằng View Transition hình tròn lan từ nút. Khung app: **rail trái 72px** (desktop) → **thanh tab dưới 5 mục** (mobile: Bảng tin, Việc làm, Tin nhắn, Thông báo, Tôi), ẩn khi cuộn xuống. Bong bóng chat: của mình `--bubble-me` (xanh nhạt), của đối phương `--bubble-them` (xám ấm), bo 18px, phía liền nhóm bo 6px. Tin nhắn gom nhóm: cùng người gửi, cách < 5 phút, cùng ngày; mỗi ngày là một `section.m-dayblock` để nhãn ngày chỉ dính trong ngày đó.

## 4. Đã làm (thư mục `docs/design-v7/`)

| File | Trạng thái |
|---|---|
| `reference/line.css` | Token light/dark, base, button (+ morph states), loader quỹ đạo, form, chip/tag/status/badge, avatar (6 tông), segmented/tabs/indicator, list row, sheet/card, popover/menu/tooltip, dialog (bottom sheet trên mobile), toast, skeleton/empty/collapse/flash, notif item, app shell (rail/tab bar/page header), command palette, view transitions, reduced motion. **Xong, đã soát bằng ảnh.** |
| `reference/motion.js` | `window.ArisMotion`: flip, removeFrom, rollNumber, morphButton, shake, pulse, indicator, segment, expand/collapse/toggle, stagger, pop/unpop, openDialog/closeDialog, flyTo, highlight, toast (vuốt để đóng, Hoàn tác), setTheme (hình tròn), stickyHeader, initTooltips; `window.showToast` tương thích ngược. **Xong.** |
| `reference/shell.js` | Rail + chỉ báo, ẩn tab bar khi cuộn, đổi theme, tooltip, popover thông báo/tài khoản, bảng demo, command palette Ctrl+K (dữ liệu mẫu), helper avatar/initials/tone. **Xong.** |
| `reference/chat.html` + `chat.css` + `chat-demo.js` | Trang Tin nhắn đầy đủ, chạy được: danh sách + tìm + segmented (Đoạn chat/Bạn bè/Lời mời), chọn hội thoại, gom nhóm tin, nhãn ngày dính, "Tin nhắn mới", trả lời/trích dẫn (bấm để nhảy + nháy), chuyển tiếp (dialog), thu hồi, sao chép, ảnh + xem ảnh phóng từ thumbnail, đã xem di chuyển, đang nhập, nút xuống cuối có badge, ngăn thông tin (View Transition) + tìm trong cuộc trò chuyện + ảnh đã chia sẻ, gọi video (lan tròn, PiP kéo-thả bám góc, tự ẩn điều khiển), cuộc gọi đến, mất kết nối, mobile (danh sách ↔ hội thoại). **Xong, đã soát light/dark/desktop/mobile/các trạng thái.** |
| `reference/jobs.html` + `jobs.css` + `jobs-demo.js` | Trang Việc làm master–detail: tìm + chip lọc (popover đổi là ra kết quả, có số đếm), FLIP + số lăn, empty state bỏ từng điều kiện, tải thêm bằng skeleton, xem chi tiết tại chỗ (thanh gọn khi cuộn), phím J/K/A, ứng tuyển (chọn CV dạng thẻ, lời nhắn, morph nút, trạng thái thành công, flyTo vào rail "Ứng tuyển"). **Chạy được; còn sửa nhỏ ở mục 5.** |
| `tools/shoot.js` | Chụp ảnh các cảnh để soát (đã chạy thử OK). |

Query param để xem trạng thái:
- `chat.html?drawer=1&typing=1`, `?reply=1`, `?offline=1`, `?call=1`, `?ring=1`, `?requests=1`, `?empty`, `?userId=11`
- `jobs.html?job=1`, `?apply=1`, `?location=Đà Nẵng&mode=Toàn thời gian` (empty), bảng demo ở nút bình thí nghiệm trên rail.

## 5. Việc còn lại — làm theo thứ tự

1. ✅ **XONG 26/09** — Sửa nhỏ ở Việc làm. Đã làm thêm: `window.orgInitials` trong `shell.js` (viết tắt tên tổ chức, dùng cho mọi logo công ty); hàng job trên mobile bỏ cột phải, tiêu đề 2 dòng, lương xuống dòng riêng (`.job-row__msal`); sheet chi tiết có câu riêng khi 0 kết quả; `.a-empty__text` có `text-wrap: balance`; **lỗi thật đã sửa**: `.jd-swap-in` dùng fill `both` giữ transform → thanh Ứng tuyển `position:fixed` trên mobile bị ghim cuối nội dung → đổi sang `backwards` + gỡ class khi `animationend` (ghi vào README mục "bẫy thường gặp"). Nội dung cũ của mục này:
   - Viết tắt logo công ty 1 từ: "TechNova" đang ra "T" → tách camelCase để ra "TN" (hàm `initials` trong `jobs-demo.js`).
   - Chuyển nút sắp xếp ra dòng "12 kết quả" (ghost sm, bên phải); hàng chip chỉ còn bộ lọc (hiện đang xuống dòng thứ hai).
   - Dòng meta của hàng job: một dòng, `white-space: nowrap; text-overflow: ellipsis` (đang xuống dòng, dấu "·" rơi đầu dòng).
   - Copy empty state khi không có từ khoá: "Các bộ lọc bên dưới không cho kết quả nào. Bỏ bớt một điều kiện:" (đang bắt đầu bằng chữ thường).
   - Chưa xem ảnh: `jobs-dark-scrolled`, `jobs-m` → chụp lại và soát.
2. ✅ **XONG 26/09 — Bảng tin kiểu Instagram** (`feed.html` + `feed.css` + `feed-demo.js`, đã soát ảnh desktop/dark/mobile + ~20 trạng thái). Có: hàng tin 24h (vòng xanh chưa xem/xám đã xem, xem xong trượt về cuối bằng FLIP; trình xem: thanh tiến trình, giữ để dừng, chạm trái/phải, vuốt xuống đóng, trả lời + thả cảm xúc; "Tin của bạn" → tạo tin), ô tạo bài thu gọn, hộp tạo bài 3 bước (chọn/kéo-thả/dán ảnh → sắp xếp kéo-thả + tỉ lệ khung → chú thích/tiêu đề/@nhắc tên/ai được xem; chế độ chỉ chữ; bình chọn; hỏi xác nhận khi bỏ), bài viết (carousel scroll-snap + chấm + đếm, nhấn đúp = tim trắng lớn + thích, nhấn 1 lần desktop = lightbox, thích lạc quan có lỗi → trả lại + rung, lưu, gửi cho bạn bè (chọn nhiều + lời nhắn), "Xem thêm", bình luận nhanh, việc làm gắn trong bài, bình chọn có thanh %), modal bình luận (desktop ảnh | bình luận; mobile bottom sheet; trả lời lồng, thích bình luận, xoá + Hoàn tác, emoji nhanh, @gợi ý), menu … (sửa tại chỗ, xoá + Hoàn tác, ẩn + Hoàn tác, báo cáo), thẻ hồ sơ khi hover (Kết bạn/Nhắn tin/Theo dõi), cột phụ (Việc cần làm: nhận lời phỏng vấn → "Thêm vào lịch" .ics thật; lời mời kết bạn; gợi ý; việc phù hợp; số liệu trực tiếp), < 1100px các mô-đun này chèn giữa bảng tin dạng cuộn ngang, nút "N bài mới" realtime, cuộn vô hạn + skeleton, "Bạn đã xem hết bài mới", kéo để làm mới (mobile), bảng tin trống, phím tắt J/K/L/C/S/←→/N/?. Mọi chỗ cần API mới đánh dấu `[CẦN BACKEND]` trong `feed-demo.js`. Query: `?post=1`, `?post=3`, `?compose=sample|write|poll`, `?share`, `?menu`, `?edit`, `?keys`, `?story=0`, `?new`, `?empty`, `?still` (tắt bài mới tự đến sau 15s).
   Thay đổi dùng chung làm kèm: **lightbox chung** (`openLightbox(items, index, caption)` trong `shell.js`, CSS `.a-lightbox` trong `line.css`; Chat đã chuyển sang dùng); **`.a-logo`** chuyển vào `line.css` (+ cỡ 32/36/44); token **`--like`** (ngoại lệ màu duy nhất, chỉ cho tim); nút **"Tạo bài viết"** trên rail mọi trang (`data-action="compose"`, phím N, trang khác → `feed.html#compose`); **mobile: mọi `.a-dialog` là bottom sheet `width:100% !important`** (trước đó `.apply-dialog`/`.cm`/`.share` bị hở mép phải); icon lucide 0.344 dùng `plus-square`/`play-circle` (KHÔNG có `square-plus`/`circle-play`).
   Nội dung cũ của mục này (giữ để đối chiếu): cột đọc 600–640px + cột "Việc cần làm" 300px (lời mời phỏng vấn → `GetInterviewInvitations`/`RespondToInterview`; lời mời kết bạn → `Friends/GetPendingRequests`/`AcceptRequest`/`DeclineRequest`; việc phù hợp → `_RecommendedJobsPartial`). Ô đăng bài thu gọn → mở rộng tại chỗ; bài viết (tiêu đề tuỳ chọn, nội dung "Xem thêm", lưới ảnh 1/2/3/4+), thích (spring + số lăn, lạc quan), bình luận (expand + FLIP), sửa/xoá bài của mình; bài mới chèn đầu bằng FLIP. Không hero, không lời chào "Xin chào…".
3. ✅ **XONG 26/09** — **`components.html`** (style guide): token màu (light/dark), thang chữ, mọi component × ma trận trạng thái, demo từng primitive có nút "Chạy lại".
4. ✅ **XONG 26/09 (tách thành README.md + PAGES.md + BACKEND.md)** — **`README.md` — spec thiết kế** (tiếng Việt, rất chi tiết cho model yếu): chẩn đoán; 5 nguyên tắc có ví dụ nên/không nên; foundations (bảng token + quy tắc dùng màu); motion (bảng: tên, kích hoạt khi nào, thuộc tính, thời lượng, easing, reduced-motion); khung app; **giải phẫu từng component** (kích thước, biến thể, trạng thái, chuyển động, class, a11y); patterns (lạc quan + Hoàn tác, loading/empty/error/success, master–detail, palette, phím tắt, kéo-thả, shared element); **Chat spec đầy đủ** (map sang `chat-client.js`: sendMessage/forwardMessage/deleteMessage/typing (throttle ~2s)/markAsRead, event ReceiveMessage/PresenceChanged/UserTyping/MessagesRead/MessageDeleted, onreconnecting/onreconnected; Enter gửi, Shift+Enter xuống dòng, bỏ qua khi `isComposing` — quan trọng với bộ gõ tiếng Việt); blueprint mọi trang còn lại: Jobs/Details (trang riêng), Profile (mục lục dính + scrollspy, bỏ ảnh bìa Unsplash mặc định), Resume, MyApplications (timeline quỹ đạo), Employer (pipeline kéo-thả qua `GetApplicantsForJob` + `UpdateApplicationStatus {Status, Note}`, thả vào Từ chối → hỏi lý do; `ScheduleInterview`), Company Index/Details/Edit, Settings (mục lục + form + thanh "Có thay đổi chưa lưu"; mẫu từ chối `Get/UpdateRejectionTemplates`), Thông báo (`GetNotifications`/`MarkAsRead`/`MarkAllAsRead`), Auth (magic link: nhập email → "Kiểm tra hộp thư", Google/Facebook, lối vào demo chỉ ở Development), NewUserInfor (nhiều bước, thanh tiến trình quỹ đạo), Interview Room (tối, tập trung video), Error, SocialConnect, Chat widget (launcher 48px + popover 380×560, ẩn trên /Chat); copy & giọng văn; danh sách cấm (kèm eyebrow in hoa, ô icon nền pastel, viền trái màu trên card bo góc…); nghiệm thu.
5. ✅ **XONG 26/09** — **`AGENT-PROMPT.md`** cho agent triển khai (thay thế 06): đọc README + mở reference; port nguyên `line.css` → `wwwroot/css/aris-line.css`, `motion.js` → `wwwroot/js/aris-motion.js`, `shell.js` → tách `aris-shell.js`/`aris-palette.js`; **bước 0 bắt buộc: gỡ đoạn chèn trong `lucide.min.js`**; giữ luật an toàn repo của V6 (không kill app 5025, build ra `.local/`, không git reset/commit, không migration, giữ id/class JS nghiệp vụ, grep trước khi đổi); từng phase có DỪNG; so ảnh với reference bằng `tools/shoot.js` + `.local/ui-v6/perf.js`; ngân sách hiệu năng; không làm UI giả.
6. ✅ **XONG 26/09** — Đánh dấu `docs/ui-redesign/06-AGENT-PROMPT-THEME-V6.md` là **đã được thay thế bởi `docs/design-v7/`** (thêm 1 dòng ở đầu file).
7. ✅ **XONG 26/09 (tools/contrast.js, 39/39 đạt sau khi sửa token)** — Chạy kiểm tra tương phản cho các cặp token chính (light + dark) và ghi bảng vào README. Ước tính tay: `--text-3` trên canvas ≈ 5.9:1, trắng trên `--brand` ≈ 4.55:1, trắng trên `--accent` ≈ 4.7:1, `--accent-text` trên `--accent-soft` ≈ 5.5:1 — cần đo lại bằng script.
8. (Tuỳ chọn) Publish bản xem trước cho chủ dự án (Artifact) nếu họ muốn xem trên web; hiện mở trực tiếp `docs/design-v7/reference/chat.html` trong Chrome là xem được.

## 6. Endpoint có sẵn (để spec tương tác, không cần sửa backend)

- Chat: `GET /Chat/GetConversations` (userId, username, avatar, lastMessage, lastMessageAt, isMine, unreadCount, isOnline), `GET /Chat/GetMessages?userId=` (id, senderId, content, imageUrl, isForwarded, sentAt, isRead, replyTo{…}; partner{id, username, avatar, isOnline}), `GET /Chat/SearchUsers?q=` (friendStatus: none | pending_sent | pending_received | accepted), `POST /Chat/UploadChatImage`. Hub: `ChatHub` (SendMessage, ForwardMessage, DeleteMessage, Typing, MarkAsRead, IsOnline), `VideoCallHub` (JoinChatCall, SendChatSignal, LeaveChatCall, DeclineChatCall; Interview…).
- Friends: GetFriends, GetPendingRequests, SendRequest, AcceptRequest, DeclineRequest, CancelRequest, RemoveFriend.
- Jobs: Index(q, location, category, workMode, sort), Details(id) (chỉ đọc), GetJobs(skip, take, …) → partial `_JobCardPartial`, GetAiRecommendations, CreateJobPosting, UpdateJobPosting, ToggleJobActive, GetShareOptions, ShareJob, ExtractJobFromPdf.
- JobApplications: GetApplyModal(jobId), Apply, Withdraw, MyApplications, GetApplicantsForJob(jobId, status), UpdateApplicationStatus({Status, Note}), ScheduleInterview, GetInterviewInvitations, RespondToInterview(applicationId, accept).
- Dashboard: Index, GetLiveStats, CreatePost(content, title, mediaFiles), ToggleLike, GetComments, AddComment, DeletePost, EditPost.
- Profile: Index, AddContact, UpdateBio, UpdatePreferences. Resume: Index, OpenCv, GetBuilderData, CreateBlank, RenameResume, SaveBuilderData, DeleteResume. Settings: Index, UpdateActiveStatus, UpdateUsername, UpdateAvatar, UpdateCoverPhoto, Get/UpdateRejectionTemplates. Company: Index, Details(id), Edit. Notifications: GetNotifications, MarkAsRead, MarkAllAsRead. Search: Global(q). Account: Login, Register, RequestMagicLink, ConfirmMagicLink, GoogleLogin, FacebookLogin, NewUserInfor, QuickLogin/DirectLogin (dev), Logout, UpgradeToBusiness.

## 7. Cách tiếp tục

```powershell
# Xem bản thiết kế
start chrome "D:\Downloads\ArisThucTap-main\ArisThucTap-main\docs\design-v7\reference\chat.html"
# Chụp soát (từ thư mục gốc repo)
node docs/design-v7/tools/shoot.js .local/v7-shots '[{"name":"jobs","url":"jobs.html"},{"name":"jobs-m","url":"jobs.html","w":390,"h":844,"dpr":2,"mobile":true}]'
```
Bắt đầu từ mục 5.1, rồi 5.2 → 5.8. Không đụng source app (`ArisSkyve/`) trong giai đoạn thiết kế; mọi thứ nằm trong `docs/design-v7/`.
