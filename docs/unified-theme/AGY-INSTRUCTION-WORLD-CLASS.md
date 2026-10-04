# Giao việc AGY — UI world-class cho toàn bộ chương trình, và làm lại đăng nhập/đăng ký

> Đưa nguyên file này cho AGY. Nó tự chứa đủ yêu cầu, hiện trạng đo được, ranh giới và cổng nghiệm thu.
> Viết 18/09/2026 bởi phiên Claude (review kỹ thuật, không sửa source). Tài liệu đi kèm: [V5-CARD-UPGRADE-BRIEF.md](V5-CARD-UPGRADE-BRIEF.md) (nguyên nhân gốc mức code của scene V5), [SESSION-HANDOFF.md](../SESSION-HANDOFF.md), [PLAN.md](PLAN.md).

## 1. Yêu cầu của người dùng

Hai vế, phải đạt cả hai, không được chọn một:

1. **UI world-class cho chương trình bên trong** — toàn bộ các trang sau đăng nhập, đạt **đúng đẳng cấp của login V5**.
2. **Sửa và nâng cấp lại phần đăng nhập/đăng ký thật** trong ứng dụng.

Người dùng đã bác bỏ nhiều lượt trước với cùng một lý do: *"design xấu, y hệt đợt trước, animation chẳng có gì đặc biệt."* Đọc phần 3 để biết lượt này bị chấm theo cái gì.

## 2. "Ngang tầm V5" nghĩa là gì — và không phải là gì

V5 (`docs/design-lab/aris-login-v5/index.html`, 2.548 dòng, Three.js, chuỗi DNA → chữ ARIS → nano-card) là **mốc chất lượng tay nghề**, không phải mẫu để dán đi khắp nơi.

**Không phải:** nhét helix DNA làm nền trang Jobs, đặt canvas WebGL sau danh sách công việc, hay bê nền tối của login vào workspace. Bên trong là chỗ người ta đọc dữ liệu và làm việc; sân khấu tối toàn màn hình sẽ phá nó.

**Chính là:** cùng một mức tay nghề, thể hiện bằng năm thứ đo được:

| Tiêu chí | V5 làm được | Bên trong phải đạt tương đương |
|---|---|---|
| Chiều sâu vật liệu | vật thể có mặt, cạnh, phản chiếu | mặt phẳng phân lớp rõ: nền → panel → card → control, bóng và viền có logic, không phải card phẳng viền xám |
| Chuyển động có nghĩa | chuỗi kể một câu chuyện nhận diện | mỗi surface có **một** cử chỉ đặc trưng gắn với nội dung, không phải fade-in đại trà |
| Phân cấp thị giác | một tiêu đề, một accent, phần còn lại lùi | mỗi màn có đúng một hành động chính; metadata phải lùi xuống |
| Nhất quán | một hệ vật liệu duy nhất | một hệ token + component duy nhất cho 20 bề mặt |
| Hoàn chỉnh trạng thái | focus/loading/error/accepted đều được dựng | mọi màn có đủ empty / loading (skeleton) / error / success, không màn nào chỉ đẹp lúc có dữ liệu đẹp |

Phép thử nhanh cho AGY trước khi nộp: **chụp màn hình xám** (bỏ hết màu, chỉ còn độ sáng). Nếu bố cục vẫn đọc ra được cấp bậc và chiều sâu thì đạt; nếu thành một mảng phẳng đều thì chưa, và thêm glow hay gradient sẽ không cứu được.

### V5 là sàn, không phải trần — bản thân nó cũng chưa ổn

Đọc kỹ chỗ này, đừng hiểu nhầm cả tài liệu: **V5 chưa phải là đích**. Nó là bản tốt nhất đang có và là mốc để không tụt xuống dưới, nhưng chính nó vẫn còn dở ở mấy chỗ, ngoài ba lỗi P0 kỹ thuật trong brief kia:

- **Ý tưởng chuyển động chưa có gì riêng.** "Hạt tụ lại thành chữ rồi thành card" là mô-típ đã quá quen, ai cũng làm được bằng thư viện particle. Nó chưa nói được điều gì riêng của Aris ngoài việc đánh vần tên thương hiệu.
- **Chỉ có một cú.** Xem lần đầu thấy được, xem lần thứ hai trở đi thì phần thú vị đã hết, mà đăng nhập là trang người ta quay lại thường xuyên. Chưa có lớp thưởng cho lần thứ mười.
- **Tương tác nghèo.** Ngoài việc đẩy hạt theo con trỏ, người dùng không làm được gì với cảnh. Cảnh không phản ứng theo nội dung thật (gõ email, chuyển mode, gửi thành công) ở mức đáng kể.
- **Không gian còn phẳng.** Vẫn là các thân thể rải trên một mặt phẳng trước camera: thiếu môi trường, thiếu phản chiếu thật, thiếu chiều sâu tiêu cự, nên "vật liệu" mới chỉ là màu kim loại chứ chưa phải chất liệu.
- **Card cuối vẫn là form tối thông thường** sau khi hiệu ứng kết thúc — đúng điều người dùng chê là "y hệt đợt trước".
- **Chrome chiếm chỗ:** ba nút Bỏ qua/Phát lại/Tạm dừng nằm ngay hàng trên cùng, nặng hơn cả thương hiệu.

Vậy nên: **đạt đúng bằng V5 là chưa đủ.** V5 định nghĩa mức sàn về tay nghề dựng hình và vật liệu; phần ý tưởng và chiều sâu tương tác thì phải vượt hẳn. Nếu AGY chỉ mang được chất lượng V5 hiện tại sang các trang khác, kết quả sẽ lại bị chê đúng như các lượt trước.

## 3. Hiện trạng đo được — đây là lý do bị chê, không phải cảm tính

Đo trên source ngày 18/09/2026:

**Animation gần như không tồn tại bên trong.** Toàn bộ ứng dụng có **9 `@keyframes`**: `orbitSpin`, `starPulse`, `authCardEnter`, `heroOrbitSpin`, `likeHeartbeat`, `ring-fill`, `msgPopoverIn`, `callToastIn`, `blink`. Phần lớn là vòng xoay trang trí và nhấp nháy.

| View | Dòng | `transition:` | `:hover` | `transform:` |
|---|---|---|---|---|
| `Dashboard/Index.cshtml` | 1.443 | 12 | 10 | 15 |
| `Jobs/Index.cshtml` | **1.671** | **1** | 3 | 2 |
| `Chat/Index.cshtml` | 1.770 | 3 | 10 | 5 |
| `Profile/Index.cshtml` | 917 | 3 | 2 | **0** |
| `Interview/Room.cshtml` | 417 | 1 | 2 | 1 |
| `Employer/Index.cshtml` | 319 | **0** | 2 | **0** |
| `Settings/Index.cshtml` | 265 | **0** | **0** | **0** |

Trang Jobs dài 1.671 dòng mà có **một** transition. Settings và Employer không có gì. Chỉ Dashboard từng được chăm. Bảng đo đầy đủ 31 view nằm ở [surface-briefs/00-INDEX.md](surface-briefs/00-INDEX.md), kèm bốn chỉ số nữa mà bảng này không chứa: `:focus-visible` (**0** toàn app), skeleton (**0**), `style=""` inline (**401**), và `font-size: Npx` cứng (**118**).

**Hệ thiết kế chưa có thật.** Mỗi view tự mang một khối `<style>` riêng và tự chế màu: `Profile/Index.cshtml` dùng token 5 lần nhưng có 18 mã hex cứng; `_ChatWidget.cshtml` 911 dòng, **0** token, 40 hex cứng; `Chat/Index.cshtml` 38 hex cứng. `aris-tokens.css` và `aris-theme.css` đã có nhưng mới chỉ Dashboard dùng nghiêm túc (105 lần `var(--`).

**Đăng nhập/đăng ký thật đang chạy đúng hướng người dùng đã bác.** `_AuthLayout.cshtml` hiện dùng `.auth-orbit-svg` (vòng tròn nét đứt xoay 120 giây), `.orbit-pulse-star` nhấp nháy, `.auth-glass-card { backdrop-filter: blur(28px) }`, và `.auth-showcase-desktop` — tức **bố cục chia đôi marketing/form**, đúng thứ người dùng đã bác. **Không có scene V5 trong đó.**

`Login.cshtml` và `Register.cshtml` mỗi file 160 dòng và gần như trùng nhau từng khối: cùng logo SVG có gradient riêng, cùng lưới social, cùng form, 16 hex cứng mỗi file, 0 token. Sửa một bên quên bên kia là chuyện sớm muộn.

## 4. Vế A — đăng nhập/đăng ký thật

**Mục tiêu:** trải nghiệm V5 đã polish chạy trên route auth thật, không phải một bản lab riêng.

1. **Polish V5 trước, trong lab.** Làm theo [V5-CARD-UPGRADE-BRIEF.md](V5-CARD-UPGRADE-BRIEF.md): wordmark bị chia băng (lỗi mapping chỉ số body ↔ thứ tự scanline), mặt card dạng chăn bông (facet vát góc nhỏ hơn ô lưới nên hở bốn góc), viền là chuỗi hạt (rim body thiếu tiếp tuyến). Ba lỗi này có số dòng cụ thể trong brief đó, kèm phần **bẫy ràng buộc** phải đọc trước khi đổi bất kỳ hằng số nào.
2. **Bỏ hướng cũ trong `_AuthLayout.cshtml`:** gỡ `.auth-showcase-desktop` (split marketing), `.auth-orbit-svg`, `orbitSpin`, `orbit-pulse-star`. Chúng không cùng ngôn ngữ với V5 và đã bị bác.
3. **Một nguồn duy nhất cho hai trang.** Tách phần thân card thành partial dùng chung (ví dụ `_AuthForm.cshtml`), Login/Register chỉ truyền mode + nội dung khác nhau. Hiện hai file đang là bản sao của nhau.
4. **Giữ nguyên backend:** antiforgery token, `returnUrl`, validation phía server, OAuth thật (`GoogleLogin`/`FacebookLogin`), luồng magic link. **Không** bê `simulateOAuth` hay response "đã chấp nhận" giả từ lab sang production. Chấp nhận một request không phải là đăng nhập thành công.
5. **Không phụ thuộc runtime mới.** Three.js đưa vào phải là file vendor cục bộ dưới `wwwroot`, không thêm package/CDN cho ứng dụng ASP.NET.
6. **Fallback bắt buộc:** không WebGL, `prefers-reduced-motion`, và máy yếu → vẫn ra một trạng thái tĩnh đẹp và dùng được ngay từ paint đầu. Form phải dùng được trước khi scene chạy xong; không bao giờ để artwork chắn input.
7. **Đủ trạng thái:** rỗng, đang gửi, email sai định dạng, lỗi server hồi phục được, đã gửi link, gửi lại, hết hạn link, đã đăng nhập ở tab khác. Mỗi trạng thái phải có hình.

**Không tính là đạt:** đổi màu, font, bo góc, thêm shadow cho form hiện tại rồi báo xong.

## 5. Vế B — chương trình bên trong

Thứ tự làm, mỗi bước nộp bằng chứng trước khi sang bước sau:

**B1. Nền hệ thống (làm một lần, mọi trang hưởng).**
- Gom CSS từ các khối `<style>` rải trong 19 view vào layer chung (`aris-tokens.css` + `aris-theme.css` + các file component). View chỉ giữ lại phần thật sự riêng của nó.
- Thay hex cứng bằng token. Mục tiêu đo được: **không view nào còn quá 3 mã hex cứng**, trừ logo thương hiệu bên thứ ba (Google/Facebook).
- Dựng **motion system** trong token: thang thời lượng (micro 120ms, control 200ms, surface 320ms, cảnh 600ms+), 3 đường easing, một class stagger dùng chung, và **một** khối `@media (prefers-reduced-motion: reduce)` tắt sạch ở tầng hệ thống chứ không rải từng trang.
- Dựng component thật: card, panel, list-row, chip/badge, button (primary/ghost/danger), input, tab, modal, toast, **skeleton**, empty-state. Có skeleton mới nói tới loading đẹp được.

> Chi tiết từng bề mặt (hiện trạng đo được, lỗi cụ thể, cử chỉ đặc trưng riêng, nghệm thu riêng): [surface-briefs/00-INDEX.md](surface-briefs/00-INDEX.md) — 11 brief, mỗi bề mặt một file.

**B2. Dashboard** — trang chính, đang là surface tốt nhất nhưng vẫn chưa đủ. Hero phải có artwork nhận diện (được dùng 3D nhẹ ở đây, nhưng phải chịu được reduced-motion và không chặn nội dung), feed/composer/card/control phải có phản hồi có chất: hover nâng nhẹ có bóng đổi theo, focus rõ, like/post có phản hồi tức thì và trạng thái optimistic, cuộn vào khung thì card vào theo nhịp lệch pha. Giữ vai trò **social/career home** — không biến thành dashboard KPI, không bịa số liệu.

**B3. Jobs (Index + Details + card partial)** — 1.670 dòng, 1 transition; đây là surface tệ nhất so với tầm quan trọng. Cần: card công việc có chiều sâu và trạng thái đã lưu/đã ứng tuyển rõ ràng, filter/search có phản hồi tức thì và skeleton khi tải, empty-state tử tế, chuyển Index → Details mượt (ít nhất là giữ điểm neo thị giác của card).

**B4. Profile** — 916 dòng, 0 `transform`, gần như không dùng token. Cần dựng lại phân cấp: header hồ sơ, nhóm nội dung, chế độ xem/sửa, ảnh đại diện và các card kỹ năng/kinh nghiệm có nhịp rõ.

**B5. Chat + `_ChatWidget`** — widget 910 dòng không dùng một token nào. Đồng bộ với hệ chung, tin nhắn vào có chuyển động ngắn và đúng hướng, trạng thái gõ/gửi/lỗi rõ, danh sách hội thoại có skeleton.

**B6. Company, Employer, Settings, Interview, Resume/CV, JobApplications** — Settings và Employer hiện **không có một transition nào**. Tối thiểu: áp component chung, làm đủ trạng thái, thêm phản hồi ở mọi control. Interview Room và CV editor được phép là ngoại lệ về mật độ chuyển động vì là công cụ tập trung — nhưng vẫn phải dùng cùng token và component.

**Quy tắc chung cho vế B — không dùng một loại animation quá nhiều lần:**

Tách hai tầng và đối xử ngược nhau. **Vi tương tác** (hover, focus, nhấn, bật/tắt, toast) phải **giống hệt nhau toàn app** — đó là ngữ pháp, khác nhau là lỗi. **Cử chỉ đặc trưng** (chuyển động lớn định nghĩa một màn) thì **mỗi surface đúng một cái và không được trùng surface khác**; bảng phân bổ cụ thể nằm ở [surface-briefs/00-INDEX.md](surface-briefs/00-INDEX.md).

Ba ràng buộc đi kèm: một màn hình chỉ một cử chỉ lớn; không stagger đại trà (Dashboard đang dùng `stagger-in` 9 lần cho 9 khối); không chuyển động lặp vô hạn trừ chỉ báo trạng thái đang diễn ra thật — vòng orbit xoay vĩnh viễn hiện có ở cả `_AuthLayout` lẫn hero Dashboard là tiếng ồn, phải bỏ.

Rải cùng một hiệu ứng fade-up lên mọi thứ rồi gọi đó là animation chính là thứ người dùng đang chê.

## 6. Ranh giới

- Không sửa backend, controller logic, database, migration, cấu hình xác thực. Sửa view/CSS/JS phía client; đụng controller chỉ khi thật sự cần cho state UI và phải nêu rõ trong báo cáo.
- Không bịa nội dung hay số liệu để trang trông đầy.
- Không thêm dependency runtime cho app ASP.NET. Asset đặt trong `wwwroot`.
- Giữ nguyên các prototype cũ trong `docs/design-lab/` và các file `index_snapshot_v5_*.html`.
- `docs/unified-theme/preview.html` đã bị bác về hướng thẩm mỹ — không dùng làm mẫu.
- Không tự chuyển sang vế A bước 2 (đụng Razor auth) khi chưa báo và chưa qua cổng của bước 1.

## 7. Nghiệm thu — đây là **mức tối thiểu**, không phải đích

Toàn bộ các cổng dưới đây là **điều kiện cần**: qua hết vẫn chỉ có nghĩa là "không còn lỗi rõ ràng", chưa có nghĩa là đẹp. Một bản qua sạch bốn cổng mà nhìn vẫn tầm thường thì vẫn là **chưa đạt** — người chấm cuối cùng là mắt người dùng, không phải checklist. Đừng tối ưu để tick cho đủ ô.

Báo cáo phải nói rõ **build nào** đang được chụp, và chụp **cùng viewport** cho cặp trước/sau. Report viết hay không thay được kết quả render.

**Cổng 1 — V5 lab:** theo 8 mục trong [V5-CARD-UPGRADE-BRIEF.md](V5-CARD-UPGRADE-BRIEF.md) (hết banding ở frame ARIS, crop 200% mặt card không còn mạng hình thoi, cạnh card là nét liền 1–2px, FPS thực đo ≥ 55 trong 10 giây, không console exception qua đủ trạng thái, reduced motion + 320/390px, clip 12–20 giây, nút Bỏ qua ra đúng card như đường animation thường).

**Cổng 2 — auth thật:** clip route thật cho cả login và register; đủ ảnh các trạng thái ở mục 4.7; chứng minh antiforgery/`returnUrl`/validation/OAuth còn nguyên; ảnh fallback không-WebGL và reduced-motion; 320/390/1440; bàn phím đi hết form không kẹt bẫy focus.

**Cổng 3 — mỗi surface bên trong:** trước/sau cùng viewport; **ảnh xám** (bỏ màu) chứng minh phân cấp còn đọc được; ảnh 4 trạng thái (empty/loading/error/có dữ liệu); một clip ngắn cử chỉ đặc trưng; số liệu token (`var(--` tăng, hex cứng giảm — nêu con số trước và sau).

**Cổng 4 — toàn cục:** build chạy được, không lỗi console trên các route chính, không vỡ layout ở 320/390/768/1440, Lighthouse accessibility ≥ 90 trên Dashboard/Jobs/Login, và một bảng kê surface nào đã xong / còn lại.

Không nhận các câu sau làm bằng chứng hoàn tất: "đã cập nhật shared CSS", "đã thêm animation", "đã đồng bộ token" — mà không kèm ảnh, clip và số đo.

## 7b. Vượt mức tối thiểu — phần thật sự được chấm

Bốn cổng trên chỉ dọn sạch lỗi. Muốn được nhận là world-class thì phải có những thứ sau, và đây mới là chỗ quyết định:

1. **Một art direction riêng, không phải preset.** Cần một ý tưởng thị giác gắn với chính việc Aris làm — quỹ đạo nghề nghiệp, sự chuyển pha của một người đi làm — dựng bằng vật liệu và ánh sáng có chủ đích. "Hạt tụ thành chữ", "cầu particle", "vòng orbit xoay" đều là preset; thấy ở đâu cũng được nên không phải nhận diện của ai.
2. **Cảnh phản ứng theo trạng thái thật**, không chỉ theo con trỏ: gõ email, đổi mode, gửi thành công, lỗi — mỗi cái làm cảnh đổi theo cách người ta hiểu được, chứ không phải nhấp nháy thêm.
3. **Có lớp cho lần thứ mười.** Intro đầy đủ cho lần đầu; những lần sau rút ngắn và chuyển sang trạng thái sống nhẹ nhàng. Không bắt người quay lại xem lại toàn bộ hoạt cảnh mỗi ngày.
4. **Chất liệu thật:** phản chiếu môi trường, bóng tiếp xúc, chiều sâu tiêu cự. Màu kim loại không phải là kim loại.
5. **Liên tục thị giác giữa các màn:** chuyển Jobs → Details, Login → Dashboard giữ được điểm neo (shared element), không cắt cảnh thô.
6. **Khoảnh khắc đáng nhớ ở đúng chỗ:** nộp đơn thành công, hoàn thành CV, nhận lịch phỏng vấn. Có chừng mực, một lần, không confetti rẻ tiền.
7. **Typography và nhịp lưới mức tạp chí:** thang chữ có logic, độ dài dòng có kiểm soát, lề và nhịp dọc nhất quán. Đây là thứ phân biệt giao diện đắt tiền với template.
8. **Hiệu năng là một phần của đẳng cấp:** 60fps khi cuộn, không giật khi mở modal, không nhảy layout khi ảnh tải. Đẹp mà khựng thì không tính là đẹp.

**Phép tự chấm trước khi nộp:** đặt ảnh chụp màn hình của mình **cạnh** một sản phẩm thật ở tầm mong muốn (Linear, Stripe, Vercel, Framer…), cùng kích thước, cùng nội dung tương đương. Nếu nhìn ra ngay bên nào là sản phẩm thật thì chưa xong — và báo cáo phải kèm chính cặp ảnh so sánh đó, kèm nhận xét thẳng của AGY về chỗ mình còn thua.

## 8. Thứ tự và mốc báo cáo

1. Polish V5 trong lab → **dừng, nộp cổng 1**.
2. Nền hệ thống B1 → nộp số đo token/component + 2 surface mẫu áp thử.
3. Auth thật (vế A) → **dừng, nộp cổng 2**.
4. Dashboard → Jobs → Profile → Chat → phần còn lại, mỗi surface nộp cổng 3.
5. Rà toàn cục → cổng 4.

Nếu một bước bị chặn, báo đúng chỗ chặn và làm tiếp phần không phụ thuộc nó; đừng đổi việc khác rồi báo là xong.

---

### Prompt giao việc ngắn

> Đọc `docs/unified-theme/AGY-INSTRUCTION-WORLD-CLASS.md` và `docs/unified-theme/V5-CARD-UPGRADE-BRIEF.md` trước khi làm gì. Yêu cầu gồm hai vế: UI world-class cho toàn bộ chương trình bên trong, **đồng thời** làm lại trang đăng nhập/đăng ký thật. Login V5 là **mức sàn về tay nghề, không phải đích** — chính nó cũng còn dở (ý tưởng chuyển động là mô-típ quen, chỉ hay ở lần xem đầu, tương tác nghèo, card cuối vẫn là form tối thường), nên bê nguyên chất lượng V5 sang chỗ khác là chưa đạt. Các cổng nghiệm thu trong tài liệu là **mức tối thiểu**, phần được chấm thật nằm ở mục 7b. Bắt đầu ở bước 1 (polish V5 trong lab), dừng nộp bằng chứng ở cổng 1 trước khi sang bước sau. Không đổi màu/font rồi báo xong; không bịa dữ liệu; không thêm dependency runtime cho app ASP.NET; không sửa backend/DB.
