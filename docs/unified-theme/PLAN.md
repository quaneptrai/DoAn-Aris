# Aris — kế hoạch nâng cấp từ V5

**Hướng tham chiếu được người dùng chỉ rõ: `docs/design-lab/aris-login-v5`.** Giữ trải nghiệm 3D DNA → ARIS → nano card và nâng chất lượng card. Study HTML phẳng trước đó không đáp ứng yêu cầu; không dùng composition/material/motion của `preview.html` làm mẫu triển khai.

Đọc [đánh giá V5 đã chạy thực tế](V5-REFERENCE-REVIEW.md) và [handoff AGY đã hiệu chỉnh](AGY-HANDOFF.md) trước. Tài liệu này giữ inventory, token và mapping code làm nền tảng triển khai. “Career Atelier” chỉ là nhãn nội bộ, không đổi tên sản phẩm và không áp đặt phong cách form split/phẳng.

Phạm vi của người lập plan: tài liệu và quan sát browser, không sửa app. Audit bên dưới là snapshot ở lần kiểm tra trước; source auth sau đó đã thay đổi, xem V5-REFERENCE-REVIEW để phân biệt bản mới.

## 1. Kết luận từ project hiện tại

Aris là nền tảng nghề nghiệp kết hợp tìm việc, tuyển dụng, hồ sơ/CV, mạng xã hội nghề nghiệp, chat và phỏng vấn. Stack hiện tại là ASP.NET Core MVC/Razor, Bootstrap, SignalR; CV builder là HTML/JS độc lập. Giữ stack và các chức năng này.

Vấn đề chính không phải thiếu một màu chung: project đã có `aris-theme.css`. Vấn đề là **các lớp giao diện có ngôn ngữ hình ảnh khác nhau**, token bị khai báo lại, và component chưa thống nhất ở cấp sản phẩm.

| Nhóm | Bằng chứng source hiện tại | Chênh lệch cần xử lý |
|---|---|---|
| Login/Register thực tế | `Views/Account/Login.cshtml:2`, `Register.cshtml:2`, `_AuthLayout.cshtml:70–100` | Form sáng + panel constellation tối, Inter; card 28px, padding 48×40. Khác hẳn prototype V5. |
| Login V5 thử nghiệm | `docs/design-lab/aris-login-v5/index.html:11–24` | Ink `#070B14`, cobalt `#355CFF`, Plus Jakarta + Inter; nano/glass, DNA → ARIS → form. Đây là HTML lab, **không phải** view auth đã tích hợp. |
| App dùng chung | `Views/Shared/_AppLayout.cshtml`, `wwwroot/css/aris-theme.css:25–53` | Nền `#F7F9FC`, blue `#2F6FED`, Inter, card 14/20px. Đã có shell chung, không cần viết lại từ đầu. |
| Jobs | `Views/Jobs/Index.cshtml:22`, `_JobCardPartial.cshtml:100` | CSS trong view và partial; card 16px, nhiều giá trị trực tiếp. Jobs/Index 1.671 dòng, 59 thuộc tính inline style. |
| Dashboard/Profile | `Dashboard/Index.cshtml:26`, `Profile/Index.cshtml:69` | Hero gradient lớn, nhiều surface/card riêng; Dashboard có 41, Profile có 63 inline style. Số lượng là tín hiệu bảo trì, không tự chứng minh giao diện lỗi. |
| Employer | `Employer/Index.cshtml:35` | Nhiều Bootstrap utility điều khiển radius/màu riêng, KPI và status cần chung component với hồ sơ ứng tuyển. |
| Chat | `Chat/Index.cshtml:4–16,29–51` | `Layout=null`, CDN Bootstrap riêng, `lang=en`, cột trái 340px và input pill riêng. Có dùng theme nhưng vẫn mang shell độc lập. |
| Onboarding | `Account/NewUserInfor.cshtml:3–18` | Document độc lập, cần shell phù hợp nhiều bước và cùng bộ field với auth/settings. |
| Interview | `Interview/Room.cshtml:3–19` | Tối riêng `#0b0d17`, không load aris-theme; nên giữ môi trường gọi video tối nhưng dùng token chung. |
| CV picker/builder | `wwwroot/cv-builder/style.css:1–45` | `:root` riêng, radius 8/12/18/24, thêm glow tím; có nguy cơ thành một sản phẩm khác. |
| Error/social connect | `Home/Error.cshtml`, `SocialConnect/SelectFacebookPage.cshtml` | Trang hỗ trợ cũng cần trạng thái và điều hướng nhất quán. |

Kiểm kê hiện tại: **18 full-page Razor views + 2 trang CV HTML = 20 bề mặt**, trong đó Jobs có thêm biến thể nhà tuyển dụng. 12 Razor views đã dùng `_AppLayout`, 2 dùng `_AuthLayout`, 4 vẫn độc lập (onboarding, chat, interview, error). Partial, modal, widget là phạm vi component bổ sung.

Audit cũ `docs/ui-redesign/01-audit.md` có giá trị lịch sử, nhưng nhận định “đa số Layout=null”, không có HomeController, và route thiếu `{id?}` không còn phản ánh source hiện tại. Không dùng lỗi lịch sử làm kết luận mới nếu chưa tái kiểm tra.

### Phạm vi đã kiểm chứng

- Đã đọc cấu trúc, layout, stylesheet, các view/partial chính và tài liệu thiết kế trước đó; xem ảnh login/register lịch sử trong repo.
- Ảnh `codex-latest-login.png` cho thấy cảnh hạt sáng xuyên dưới chữ/form; đây là một snapshot lịch sử, chưa kết luận bản V5 mới nhất còn lỗi đó. Thiết kế mới phải đảm bảo độ tương phản khi hiệu ứng chạy.
- Thử chụp auth ở localhost 5025 thất bại vì connection refused; lần điều hướng V5 5183 bị ngắt bởi trang lỗi trước đó. Xem `evidence/baseline.json`. Không coi đây là lỗi của app. Chưa xác minh trực quan các trang có đăng nhập trong phiên này.
- Không khởi động backend, không dùng demo login, không chạm database/email/OAuth. Có nhiều thay đổi chưa commit sẵn trong repo; tài liệu này được thêm ở thư mục mới.

## 2. Brief sản phẩm

**Mục tiêu:** khi đi từ đăng nhập → tìm việc → hồ sơ → chat, người dùng nhận ra cùng một Aris, tìm được hành động chính nhanh và đọc nội dung thoải mái.

**Đối tượng:** ứng viên/fresher và nhà tuyển dụng; desktop là nơi làm việc chính, mobile hỗ trợ đầy đủ tác vụ cốt lõi. Ngôn ngữ mặc định: tiếng Việt; giữ CV và thuật ngữ nghề nghiệp cần thiết.

**Thành công quan sát được:** các màn mẫu có cùng nhận diện; cùng một button/input/status không thay đổi kiểu theo trang; chuyển màn không làm đổi điều hướng; tên dài, dữ liệu rỗng và lỗi vẫn rõ ràng. Không đổi Dashboard mạng xã hội thành dashboard KPI.

**Người phụ trách:** chủ sản phẩm quyết định ưu tiên; người triển khai UI quản lý token/component. Chưa gán cá nhân hoặc lịch bàn giao cam kết. Ước lượng bên dưới để sắp thứ tự, không phải hạn chót.

### Luồng bắt buộc giữ

1. Login/Register → gửi magic link → thông báo kiểm tra email → xác thực → onboarding nếu thiếu thông tin → đích ban đầu. Có submitting, lỗi mạng, email sai, link hết hạn, đổi email; chỉ hiện trạng thái “đã gửi” sau phản hồi server. Luồng OAuth giữ Google/Facebook.
2. Jobs → filter/sort → chi tiết → chọn CV → xác nhận nộp → theo dõi trạng thái. Có không có kết quả, thiếu CV, job đóng, lỗi nộp, dữ liệu đang tải. Không hứa bookmark tồn tại vĩnh viễn khi chưa có API lưu.
3. Dashboard → bài đăng/bình luận → hồ sơ → kết nối/chat. Có bài dài, không có bài, upload lỗi, quyền riêng tư.
4. Employer → tin tuyển dụng → ứng viên → xếp lịch → Interview. Có không có ứng viên, lịch thay đổi, từ chối lời mời, mic/camera bị chặn, reconnect.
5. Profile/Resume → picker → builder → lưu/xuất. Có draft chưa lưu, thiếu file, lỗi lưu, mất kết nối; theme app không làm đổi thiết kế bản CV xuất/in.

## 3. Theme chủ đạo: Career Atelier

**Tính cách:** hiện đại, chính xác, có chiều sâu, thể hiện hành trình nghề nghiệp. Tránh việc mỗi trang có một “hero công nghệ” tranh sự chú ý với dữ liệu.

### Ba lớp của cùng một theme

- **Identity:** auth dùng một sân khấu 3D toàn viewport và một nano-card ở trung tâm, trực tiếp phát triển từ V5. Giữ DNA → ARIS → card, Skip/Replay/Pause và reduced-motion. Không thay bằng panel marketing cạnh form hoặc nền SVG vòng tròn quay.
- **Workspace:** bề mặt pearl sáng dịu, card trắng, chữ ink; navbar ink tạo mối nối trực tiếp với auth. Jobs/feed/settings dùng cùng top navigation, độ cao và header trang. Biến thể tối có cùng token ngữ nghĩa, không phải một bộ CSS khác.
- **Signature:** đường quỹ đạo có điểm đầu/cuối — dùng ở logo, progress onboarding, application timeline và selected indicator. Không đưa hạt/WebGL vào bảng, chat hoặc mọi card.

Nét độc đáo nằm ở cách một đường quỹ đạo xuyên suốt hành trình, typography và bố cục thông tin. Không cam kết “độc nhất trên thị trường” khi chưa có nghiên cứu so sánh toàn diện.

### Màu và vật liệu

| Vai trò | Light workspace | Dark workspace |
|---|---|---|
| Brand/CTA | `#2F6FED`, hover `#1E54C4`, chữ trắng | Cùng CTA để giữ nhận diện |
| Brand subtle/text | `#EAF2FF` / `#1B3E82` | `#192E52` / `#A4C8FF` |
| Canvas | `#F4F6FA` | `#0B1120` |
| Surface | `#FFFFFF` | `#131E30` |
| Text/muted | `#172033` / `#5E6B80` | `#F4F7FC` / `#A7B4C9` |
| Border trang trí | `#DCE2EB` | `#2B3A50` |
| Border nhận diện input | `#7C899C` | `#73839B` |
| Success text/bg | `#166B4B` / `#E8F5EE` | `#94D8B5` / `#123A2C` |
| Pending text/bg | `#885400` / `#FFF3D6` | `#F6D18A` / `#3B2C14` |
| Error text/bg | `#B42332` / `#FFF0F1` | `#FFA8B0` / `#401E29` |

Chọn `#2F6FED` từ logo/app hiện có làm brand chính; thay `#355CFF` của V5 khi tích hợp, không tạo hai màu primary. Sky blue chỉ dùng trong artwork/on-ink đã đo contrast. Card auth giữ chiều sâu quang học: mặt trước yên tĩnh, cạnh có độ dày, phản xạ có hướng và bóng tách khỏi nền. Vùng chữ/input ổn định bằng material treatment, không xóa chất liệu 3D của cả card. Với workspace, glass dùng có giới hạn ở chrome/artwork; vùng đọc dài vẫn rõ.

Tỷ lệ tương phản được tính bằng công thức relative luminance; xem bảng sinh tự động trong [contrast.md](contrast.md). Border trang trí không thay thế viền cần nhận diện của input. Tỷ lệ palette không thay thế kiểm tra DOM thật, overlay và animation.

### Typography, spacing, layout

- Heading: **Plus Jakarta Sans 600/700** kế thừa V5. Body/UI: **Inter 400/500/600**. Chỉ 2 family, kiểm tra đủ glyph tiếng Việt; production ưu tiên WOFF2 tự host, `font-display:swap`, fallback Segoe UI.
- Auth headline 48/56 desktop, 32/40 mobile; page title 32/40; section 20/28; body 14–16/22–24; metadata 12/18. Nội dung nhập mobile >=16px. Không nén chữ tiếng Việt bằng tracking quá âm.
- Scale khoảng cách 4/8/12/16/24/32/48/64. Control radius 10, card 16, feature 24; pill dành cho tag/status/avatar, không dùng ngẫu nhiên cho mọi CTA.
- Control chính cao 44px, auth 48px; icon 18/20px, stroke nhất quán. Reuse Lucide đã có, chốt phiên bản khi triển khai thay vì `@latest`.
- Top nav 72px; content max-width 1280px; gutter 32px desktop, 24px tablet, 16px mobile. Jobs: filter 248px + kết quả co giãn; feed: profile 248px + feed + rail phụ nếu đủ chỗ.
- Dưới 1024px: rail phụ xuống dưới; dưới 768px: một cột, filter mở panel, nav rút gọn có nhãn. Chat có danh sách và hội thoại chuyển màn, có Back. Interview được phép full-screen; CV builder giữ bố cục editor.
- Layer đề xuất: base 0, sticky 100, dropdown 1000, backdrop 1040, modal 1050, toast 1100. Hiện navbar dùng 3000/3100; cần xác minh không che Bootstrap modal rồi chuẩn hóa đồng bộ.

### Motion

Micro-interaction 160ms, chuyển panel 240ms, easing `cubic-bezier(.2,.8,.2,1)`. Hover nâng card tối đa 2px. Chuyển tab ưu tiên đổi opacity nhẹ, không trượt toàn bộ nội dung dài. Dùng trạng thái loading thật.

Auth được phép giàu motion hơn: kế thừa DNA → ARIS → form V5; skip luôn sẵn, lần quay lại đi thẳng form, reduced-motion/WebGL fail hiển thị form ngay. Không chặn OAuth hoặc nhập email vì animation. Tắt render khi tab ẩn; đặt ngân sách scene sau khi đo máy yếu. Preview đính kèm chỉ minh họa theme/bố cục, **không tái tạo animation V5**.

## 4. Áp dụng theo từng bề mặt

| Màn hiện có | Thay đổi thiết kế chính | Thành phần/trạng thái quan trọng |
|---|---|---|
| Login | Nâng cấp scene/card V5: composition, silhouette, material, typography, field/CTA/social; đưa cùng trải nghiệm vào route auth thật | Magic-link form, OAuth, email sent/error; giữ returnUrl |
| Register | Cùng vật thể nano-card, mở rộng vùng field bằng morph có điểm neo ổn định; spacing/hierarchy được thiết kế riêng cho chiều cao mới | Đăng ký/đăng nhập, validation, không tạo email success giả |
| NewUserInfor | OnboardingShell, progress quỹ đạo, mỗi bước một nhiệm vụ | Label/helper/error, back/next, lưu giá trị khi lỗi |
| Jobs – Candidate | Header gọn, search một hàng, filter rail, job card rõ lương/địa điểm | Search/filter/sort, empty, loading, save state |
| Jobs – Business | Cùng shell, toolbar quản lý, danh sách tin và applicant panel | Create/edit/close job, status, modal xác nhận |
| Jobs/Details | Summary + nội dung dễ quét, apply panel desktop và CTA mobile | Job đóng, CV selection, nộp/lỗi, deadline |
| Dashboard | Feed là nội dung chính; banner nhỏ, composer và next action | Post, comment, media, empty feed; không thêm số liệu giả |
| Employer | KPI gọn, thống nhất bảng pipeline/applicant | Giá trị thật, empty pipeline, filters |
| Profile | Cover gọn, identity + tabs; sidebar thông tin | Editability/privacy, posts/CV/applications loading |
| Resume | Grid/list nhất quán và CTA tạo/tải CV | Preview, file unavailable, delete confirmation |
| CV picker | Tile preview chung, filter loại mẫu | Selected/template unavailable, back to Resume |
| CV builder | Token chỉ áp dụng chrome/toolbars/sidebar | Draft/saving/saved/error, export; canvas CV tách scope |
| MyApplications | Timeline/status cùng Employer | Withdraw confirmation, lịch hẹn, đóng tin |
| Company/Index | Card logo/mô tả/job count cùng JobCard | Search, long name, no jobs |
| Company/Details | Identity header + thông tin + list jobs | Logo fallback, dữ liệu thiếu, trạng thái xác minh thật |
| Company/Edit | Form chia nhóm, footer lưu rõ ràng | Validation, upload preview, unsaved changes |
| Chat | Immersive variant của shell; cùng avatar/search/button | Unread, sending/fail, reconnect, attachment |
| Interview | Surface tối cố định từ cùng token; toolbar rõ | Permission, waiting, reconnect, ended |
| Settings | Grouped sections; cùng form/banners | Saving/saved/error, active status, social connect |
| SelectFacebookPage | Cùng shell và selection card | Empty/expired session/permission, chọn rồi xác nhận |
| Home/Error | Brand/type/button chung, đường về an toàn | Mô tả dễ hiểu, retry/back; không lộ chi tiết kỹ thuật |

### Component: reuse trước, bổ sung sau

| Component | Hiện có | Hành động |
|---|---|---|
| AppShell/AppNavbar | `_AppLayout`, `AppNavbar/Default.cshtml` | Extend regular/immersive; giữ active theo role, không render navbar hai lần |
| AuthShell | `_AuthLayout` + V5 lab | Tích hợp có kiểm soát, shared form thay copy nguyên HTML demo |
| Button/Field/Alert/Toast | Bootstrap + theme | Wrapper class `aris-*`, variants/state chung, text-safe toast |
| JobCard | `_JobCardPartial`, `_RecommendedJobsPartial` | Một card nền tảng, variant recommended/list; tách style khỏi partial |
| CVCard/ApplicationRow | `_MyCvsPartial`, `_MyApplicationsPartial` | Reuse và đồng bộ status/spacing |
| PageHeader/FilterBar/EmptyState | Rải trong view | Trích shared partial có model/props rõ |
| Avatar/StatusBadge/Tabs | Rải trong view | Shared component, label + icon; không chỉ dựa vào màu |
| Modal/Drawer/Confirm | Bootstrap và markup riêng | Chuẩn width, focus trap, Escape, return focus, layer |
| FeedPost/Composer/MessageBubble | Dashboard/Chat | Giữ nghiệp vụ, đổi phần hiển thị; không ép giống job card |
| CareerPath | Logo/progress rời rạc | Motif riêng cho onboarding/application timeline; SVG nhẹ |

## 5. Kế hoạch triển khai theo phụ thuộc

| Bước | Đầu ra cụ thể | File trọng tâm | Ước lượng công việc | Điều kiện qua bước |
|---|---|---|---|---|
| P0 – Baseline | Chụp trạng thái thật của 20 bề mặt, cả 2 role; kiểm kê token/style; fixture local | views + docs/evidence | 0,5–1 ngày | Có ảnh desktop/mobile, biết trạng thái nào chưa kiểm chứng; không ghi đè thay đổi đang có |
| P1 – Foundation | Token ngữ nghĩa, font, spacing, button/field/status, mapping Bootstrap | `wwwroot/css/aris-theme.css`, thêm token/component CSS | 1–2 ngày | Gallery control/states rõ; contrast đạt; CSS load một lần |
| P2 – Shell + 3 màn chuẩn | Auth (login/register), Jobs, Dashboard làm mẫu cho mọi page | `_AppLayout`, `_AuthLayout`, navbar, views tương ứng | 2–3 ngày | Nhìn như cùng sản phẩm; desktop/mobile đạt; các luồng cũ hoạt động |
| P3 – Candidate journey | Onboarding, detail, profile, CV, applications, company | view/partial liên quan + cv-builder chrome | 2–3 ngày | Đi trọn tìm việc → ứng tuyển → theo dõi với dữ liệu local |
| P4 – Employer + realtime | Employer, Jobs business, settings/social, chat, interview, error | view và JS có liên quan | 2–3 ngày | Role/state đúng, modal không bị nav che, chat/call không vỡ responsive |
| P5 – QA/handoff | Bảng nghiệm thu, ảnh trước/sau, lỗi còn lại, checklist merge | docs + build/tests | 1–2 ngày | Đủ trạng thái/role/viewport và báo rõ phần chưa test |

Tổng sơ bộ **8,5–14 ngày công**, phụ thuộc trạng thái backend và mức hoàn thiện motion V5; không bao gồm viết lại backend hoặc xây lại scene 3D. Có thể chia thành nhiều PR nhỏ theo thứ tự trên. Chốt nền tảng rồi mới polish từng trang.

### Cách đưa token vào code

1. Tạo `aris-tokens.css` chứa primitive + semantic tokens; `aris-theme.css` consume và giữ alias cũ để migration dần (`--primary-color → --aris-brand`, `--text-main → --aris-text`, `--card-radius → --aris-radius-card`).
2. Đồng bộ Bootstrap variables/component states, kể cả hover/focus/disabled và các utility `.bg-white/.text-dark` đang hardcode. Không chỉ đổi `:root` rồi gọi là xong dark mode.
3. Tách CSS view vào `css/pages/*.css` scope `.aris-jobs`, `.aris-profile`...; không đặt `.card/.btn` override toàn cục trong page/partial. Loại `<style>` trong list partial để tránh lặp theo số item.
4. App/Auth/Immersive dùng shared asset partial để nạp font, CSS, JS đúng thứ tự. `_Layout` scaffold cần được rà lại; không ép CV HTML dùng Razor.
5. CV builder load token chung qua đường dẫn phù hợp nhưng chỉ bind vào chrome. Print/export và template font/accent giữ độc lập.
6. Khi tích hợp V5 giữ form server thật, antiforgery, returnUrl và trạng thái gửi email. Prototype response giả không được vào production. Demo/direct-login controls hiện diện trong view là quyết định sản phẩm/backend cần kiểm tra riêng trước release, không biến thành primary CTA của thiết kế mới.
7. Rollout theo class/feature flag ở môi trường local trước; bỏ compatibility alias khi không còn consumer. Không nâng framework hoặc đổi routing chỉ để đổi theme.

## 6. Nghiệm thu

- So sánh Login, Register, Jobs, Feed, Profile, Chat cạnh nhau: cùng brand blue/type/control, nav ổn định; ngoại lệ Interview/CV được ghi rõ.
- Viewport 320, 390, 768, 1024, 1440; zoom 200%; không scroll ngang trang ngoài vùng table/canvas có chủ đích.
- Form có label thật, helper/error gắn `aria-describedby`; keyboard focus rõ, modal trap/restore focus, semantic heading/landmark và `lang=vi`.
- Text thường mục tiêu >=4.5:1, text lớn >=3:1; input/focus/icon chức năng >=3:1 so với nền liên quan. Đo trên trạng thái thực; không dùng màu thương hiệu nhạt làm text nhỏ trên trắng.
- Kiểm tra default/hover/focus/pressed/disabled/loading/error/success, empty, long text, image fallback, mất mạng, dữ liệu thiếu và 2 role.
- Auth: skip/reduced-motion/WebGL fallback; không chặn input; không báo đã đăng nhập chỉ vì gửi email thành công.
- Job filter/count/page dựa trên dữ liệu thật; status tuyển dụng đồng nhất candidate/employer; state có text ngoài màu.
- CV export không nhận theme dark của editor. Chat reconnect và interview permission/end state được test bằng môi trường phù hợp.
- Chạy `dotnet build` và kiểm tra luồng local khi bắt đầu sửa app; lần lập kế hoạch này không cần build backend vì chỉ thêm tài liệu/preview.
- Chụp ảnh trước/sau và ghi console errors; chỉ coi đạt phần đã chạy thật. Preview minh họa không là bằng chứng app đã hoàn tất.

## 7. Tham khảo đã truy cập và cách áp dụng

| Nguồn | Mức truy cập trong phiên này | Dùng cho Aris |
|---|---|---|
| [Linear – A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh) | Đọc bài gốc, truy cập ảnh minh họa; 12/03/2026 | Phân cấp header, navigation dịu, giảm viền thừa; áp dụng cho workspace. Không sao chép bố cục issue tracker. |
| [Untitled UI – Free Figma UI Kit](https://www.untitledui.com/free-figma-ui-kit) | Đọc trang nhà phát hành và mô tả system | Tham khảo cấu trúc token/component/state; dựng lại theo Aris, không cần mua kit để thực hiện plan. |
| [Figma – Design systems 102](https://www.figma.com/blog/design-systems-102-how-to-build-your-design-system/) | Tìm và đọc nội dung công khai qua web search | Foundations trước, component sau, rồi screen; spec map về CSS token. |
| [Figma YouTube – Build it in Figma: Foundations](https://www.youtube.com/watch?v=EK-pHkc5EL4) | Xác minh tiêu đề/kênh/mô tả bằng kết quả search; watch page trả lỗi | Video bổ trợ xây type/color/grid; **chưa xem video**, không trích timecode hay nhận xét chuyển động. |
| [Jobify – Figma Community](https://www.figma.com/community/file/1427716315717875267) | Tìm qua trang tác giả; Community fetch không thành công | Link để đối chiếu cấu trúc job portal sau; **chưa đọc layer**, không dùng làm bằng chứng visual đã kiểm chứng. |
| V5 nội bộ và ảnh trong `docs/design-lab/aris-login-v5/evidence/` | Đọc source và xem ảnh snapshot | Kế thừa ink, typography và ý tưởng motion; cần kiểm tra bản chạy mới trước khi tích hợp. |

Chưa tạo file Figma hoặc tải bộ layer thiết kế: phiên này không có Figma MCP đang kết nối. Tài liệu và HTML preview đủ để review theme ngay. Khi đưa sang Figma: pages `00 Foundations`, `01 Components`, `02 Auth`, `03 Candidate`, `04 Employer`, `05 Realtime`, `06 QA`; mỗi màn có desktop/mobile + states, dùng variable modes Light/Dark cùng tên token CSS.

## 8. Quyết định đề xuất và điểm còn mở

Mặc định đề xuất: workspace sáng + navbar ink, auth/Interview tối; Dark workspace là biến thể cùng system và có thể làm sau khi light đạt QA. Preview cũ đã bị bác bỏ về hướng visual và không dùng để chốt theme. Giữ navigation trên của workspace để giảm thay đổi thói quen; auth là scene toàn màn hình theo V5.

Chủ sản phẩm có thể điều chỉnh sau khi xem preview: ưu tiên dark làm mặc định, mức độ hiện intro V5 với người quay lại, và lịch rollout. Đây là lựa chọn mở không chặn việc xây token/component. Không tự coi hướng lịch sử trong agent-bridge là phê duyệt mới cho toàn app.
