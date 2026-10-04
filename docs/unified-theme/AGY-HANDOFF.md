# AGY — nâng cấp V5 thành trải nghiệm auth thật, rồi đồng bộ Dashboard

**Yêu cầu mới nhất:** người dùng chỉ đích danh `docs/design-lab/aris-login-v5` là bản login cũ tốt hơn để lấy làm nền. Chỉ lập kế hoạch chi tiết để AGY triển khai. Người lập tài liệu không tiếp tục sửa ứng dụng. Người dùng muốn giao diện đẹp hơn rõ rệt, nhiều animation có chủ đích hơn; card sign in/up đang chật, chưa đẹp; các trang bên trong hiện quá đơn điệu.

**Điểm bắt đầu:** `http://localhost:5025/Dashboard`. **Chủ đề chung:** Aris — Career Atelier, phát triển từ blue trajectory mark và nano-motion của V5. **Phạm vi:** auth + toàn bộ workspace; Dashboard là màn kiểm chứng chính, không phải chỉ trang phụ để đổi màu.

Đọc tài liệu này trước [PLAN.md](PLAN.md). Tài liệu này cập nhật mức tham vọng thẩm mỹ/motion và thứ tự ưu tiên của PLAN. File `preview.html` đã bị bác bỏ về hướng thẩm mỹ: **không dùng bố cục split, card phẳng hoặc motion của file này làm mẫu**. Nguồn chính là V5; xem [ảnh và đánh giá lần chạy mới](V5-REFERENCE-REVIEW.md).

## 1. Kết quả cuối cùng phải trông như thế nào

Aris cần cảm giác một không gian nghề nghiệp được thiết kế có chủ đích: nhận diện mạnh ở auth, workspace có nhịp điệu và chiều sâu, thông tin dễ đọc. Người dùng phải nhìn thấy sự nâng cấp ngay ở bố cục, typography, card và chuyển động; chỉ đổi màu nền, thêm shadow hoặc gắn fade-in vào mọi thứ sẽ chưa đạt.

### Hướng hình ảnh đã đề xuất

- **Ink + cobalt + pearl** là trục chung: ink cho sân khấu auth/hero, cobalt cho hành động và selected state, pearl cho vùng đọc/làm việc. Giữ màu logo blue `#2F6FED`; xử lý cobalt `#355CFF` của V5 về cùng một primary khi tích hợp.
- **Typography:** Plus Jakarta Sans ở headline, Inter ở nội dung/controls. Hạn chế cấp độ đậm; headline không cần mọi chữ đều 800. Chữ tiếng Việt phải đủ line-height và rõ dấu.
- **Vật liệu:** ánh sáng cạnh, border tinh, shadow có hướng, các surface tách lớp rõ. Tránh dùng blur/glow để che cấu trúc yếu. Chỉ artwork/hero được phép có chiều sâu mạnh.
- **Dấu hiệu riêng:** đường quỹ đạo của logo, các điểm kết nối và vật liệu “tập hợp thành hình”. Áp dụng cùng ý tưởng từ intro đến onboarding/application timeline/active indicator, thay vì mỗi trang dùng một loại hình trang trí.
- **Mức độ biểu cảm:** auth nhiều nhất; Dashboard hero có điểm nhấn rõ; card/toolbar phản hồi tinh tế; chat, CV và bảng dữ liệu tập trung vào tác vụ. Đây là phân cấp animation, không phải lý do để phần bên trong tiếp tục phẳng và nhạt.
- Theme đồng nhất không có nghĩa mọi trang cùng một layout hoặc mọi vùng cùng màu đen. Preview cả light workspace và dark workspace nếu cần so sánh, nhưng chốt một hướng triển khai mặc định trước khi làm toàn bộ dark mode.

## 2. Kiểm tra hiện trạng trước khi sửa

1. Ghi lại snapshot và các thay đổi chưa commit. Repo hiện đã có nhiều sửa đổi trước phiên này; không reset về HEAD hoặc chép đè cả file bằng bản cũ.
2. Chụp Dashboard bằng phiên đăng nhập hợp lệ do môi trường phát triển cung cấp, xác định role Employee/Business và dữ liệu đang có. Trình duyệt kiểm tra mới ở phiên lập plan truy cập `/Dashboard` đã redirect về login; chưa có ảnh Dashboard authenticated mới.
3. Chụp auth thực tế ở 5025 và V5 ở 5183 riêng biệt, sau khi xác minh server đang chạy. Auth thực tế vẫn là Razor split light/dark; V5 là prototype nano 3D độc lập, không có auth backend thật.
4. Thu thập desktop 1440×900 và mobile 390×844: auth ready, register ready, Dashboard đầy dữ liệu và empty. Chụp thêm 320×568 để thấy vấn đề chiều cao/card.
5. Với V5, quay liên tục từ DNA → ARIS → card → register → login. Đánh giá từ frame thật, không dùng tên file hoặc báo cáo cũ thay cho quan sát.
6. Đọc CSS và trạng thái hiện tại; review cũ mô tả tile/dotted perimeter còn thấy ở ready-state. Đó là chỗ cần xác minh và cải thiện, không xem “đã chạy 60fps” là “đã đẹp”.

**Bằng chứng hiện có:** `evidence/live-before-login.png` là ảnh auth thật trong phiên này. `evidence/live-before-dashboard.png` cũng là login sau redirect, tuyệt đối không ghi nhãn là ảnh Dashboard thật. Các snapshot V5 trong `docs/design-lab/aris-login-v5/evidence/` là tư liệu lịch sử, cần đối chiếu revision mới.

## 3. Làm lại card sign in / sign up — ưu tiên cao nhất

### 3.1 Những vấn đề phải xử lý

**Cập nhật sau phản hồi:** auth source hiện dùng `.auth-glass-card`, `.auth-orbit-svg`, `orbitSpin` và `starPulse`; `_AuthLayout` còn một panel showcase cạnh form. Đó là CSS/SVG trang trí, chưa phải tích hợp trải nghiệm WebGL V5. Không coi việc đổi nền tối và thêm vòng tròn quay là hoàn thành bước auth. Các nhận xét auth thật bên dưới thuộc snapshot trước đó; không ghi đè source mới bằng snapshot cũ.


**Auth thật (5025):** card sáng to nhưng các hành động cạnh tranh nhau; social buttons xếp dọc, heading/helper/form/demo tách thành nhiều khối nhỏ. Button “vào thẳng hệ thống” và hai demo-role chiếm nhiều chỗ, làm mất trọng tâm đăng nhập. Border/radius/padding chưa có phân cấp đồng bộ.

**V5:** cần kiểm tra lớp kính, hạt nano và text ở ready-state. Snapshot cũ có dạng ma trận điểm sáng sau chữ và viền chấm; chữ phải dùng text-shadow để chống nhiễu. Header “Aris Studio”, badge mode, heading, instruction và helper có thể lặp thông tin. Card dài hơn khi Register, nhưng khoảng thở chưa chắc tương xứng.

### 3.2 Spec bố cục card

**Chốt composition auth:** một sân khấu ink toàn viewport, một vật thể nano-card ở trung tâm, khung header/footer nhẹ như V5. Hình khối 3D dẫn từ DNA đến ARIS đến card trong cùng không gian. Không chuyển thành marketing bên trái/form bên phải; không dùng các vòng SVG/CSS quay làm phương án chính thay scene. Fallback phẳng chỉ dành cho WebGL fail/reduced-motion, vẫn giữ silhouette và hierarchy giống scene chính.


| Thuộc tính | Desktop | Mobile |
|---|---|---|
| Width | Login 420–460px; Register cùng trục và width | `min(100% - 32px, 440px)`; 320px còn 288px |
| Padding nội dung | 32–36px | 22–24px; 20px ở 320px |
| Radius chính | 22–24px, viền ngoài mảnh | 20–22px |
| Heading | 28–32px, weight 600/700, line 1.25–1.35 | 24–28px, tránh chạm logo/badge |
| Body/helper | 13–14px / 12px, line 1.5–1.7 | Không thu nhỏ toàn bộ để nhét một màn |
| Field/CTA | 48–50px cao; input font 16px | 48px, tap target >=44px |
| Field gaps | Label → field 8px; field → next block 16–20px | Giữ cấu trúc, giảm khoảng trang trí |
| Social | Hai nút cùng hàng nếu label gọn và đủ rộng | Có thể cùng hàng 390px; stack khi label không vừa |
| Footer | Link đổi mode tách rõ; legal ở mức phụ | Được cuộn bình thường, không fixed che input |

**Hierarchy chính:** logo nhỏ hoặc mode label → heading → một câu giúp hiểu cách đăng nhập → email → primary CTA → social/alternative → đổi mode. Chọn một vị trí social và giữ nhất quán. Không lặp “nhập email”, “gửi liên kết”, “không cần mật khẩu” thành ba khối nặng ngang nhau.

Copy gợi ý:

- Login heading: “Chào bạn.” / supporting: “Cơ hội tiếp theo bắt đầu từ đây.”
- Register heading: “Bắt đầu hành trình.” / supporting: “Một tài khoản cho những cơ hội phía trước.”
- CTA: “Gửi liên kết đăng nhập” / “Tạo tài khoản bằng email”.
- Helper: “Nhận liên kết xác thực qua email. Không cần mật khẩu.”
- Gửi thành công: “Kiểm tra hộp thư của bạn” + địa chỉ email + đổi email; không thông báo “đăng nhập thành công” ở bước gửi link.

Demo/direct-login hiện có cần được đưa vào nhóm phụ có thể mở rộng, giữ luồng theo quyết định hiện tại của project. Thay đổi chính sách backend của các endpoint này là việc riêng; redesign không tự biến chúng thành primary CTA hoặc âm thầm thay cơ chế auth.

### 3.3 Card material: giải quyết “thô / chật / nhiễu”

1. Tạo một silhouette rõ và một mặt nền liên tục. Highlight cạnh mảnh và có hướng; bỏ cảm giác khung LED/ma trận chấm bao quanh.
2. **Giữ ý tưởng nano trở thành card của V5.** Không thay toàn bộ bằng một hộp CSS đục rồi coi như đã sửa. Sau chuyển đổi, nano-material phải đọc như một bề mặt có cấu trúc, không như hạt đang đứng trước form.
3. Đưa đặc tính nano về cạnh, độ sâu và phản xạ tinh tế; vùng ngay dưới heading/field/CTA phải ít biến thiên độ sáng. Hạn chế specular/texture ở khu vực chữ bằng target distribution/material mask hoặc surface treatment có chủ đích.
4. Nếu cần làm phẳng nền để đạt readability, điều chỉnh bề mặt scene và vùng nội dung có giới hạn; không thêm panel thứ hai phủ lên toàn bộ card mà quên geometry WebGL bên dưới.
5. Bỏ text-shadow đen dày khi nền đã ổn; dùng font weight/color/contrast để đọc. Không cho chuyển động hoặc ánh sáng đi qua chữ đang nhập.
6. Chụp ready-state trên nền tối, khi focus field, khi hover CTA, và giữa mode morph. Card đẹp cả khi đứng yên là điều kiện bắt buộc.

**Điểm code V5 cần đọc:** `.glass-auth-card`, `.card-top-bar`, `.card-mode-badge`, `.greeting-group`, `.form-instruction`, `.field-input-translucent`, `.btn-submit-cta`, `.social-stack`, `.card-footer`; `computeCardStructureTargets`, `surfaceMat`, `rimMat`, `titleMat`, `switchAuthMode`, `skipIntro`, `replayChoreography` và `animate`.

Không đổi material chỉ trong nhánh animation bình thường: final state của Skip/Reduced motion/Fallback phải cùng shape/spacing/readability. `surfaceMat.opacity` hoặc radius sửa ở một chỗ nhưng các nhánh khác giữ giá trị cũ sẽ tạo hai giao diện khác nhau.

### 3.4 Login ↔ Register

Register không chỉ là Login dài thêm một field. Thiết kế điểm neo thị giác ở vùng heading/email: bề mặt và viền mở rộng quanh nội dung, nhóm social/footer dịch theo một nhịp rõ; giữ khoảng trống khi thêm name và error. Chiều cao phải từ content thật và clamp theo viewport cho phép cuộn. Không ép fit-screen bằng scale nhỏ toàn form.


- Dùng cùng card, cùng x-axis, cùng baseline của logo/heading, cùng width. Height thay đổi theo nội dung, không để cả card nhảy tâm mạnh.
- Fade nội dung cũ 100–140ms → morph material/height khoảng 300–450ms → reveal nội dung mới 180–240ms. Các pha có thể chồng nhẹ; chỉ cần một lần đọc được transition, không diễn lại intro.
- Preserve email, preserve name nếu form có tên, clear đúng field error. Focus chuyển có chủ đích sau khi panel mới tương tác được; panel ẩn `inert`/không tab được.
- Xử lý chuỗi click nhanh login/register/login, replay khi chưa hoàn tất intro, skip giữa DNA và ARIS, resize khi Register mở. Không có lớp invisible chặn input và không có title DOM + WebGL chồng nhau.
- Runtime Razor Register hiện dùng email; V5 có thêm name. Khi tích hợp phải map theo model/backend hiện có hoặc chuyển name về onboarding. Không bắt nhập một trường rồi bỏ dữ liệu mà không nói rõ.

## 4. Dashboard — phải có sự thay đổi thị giác rõ

`Views/Dashboard/Index.cshtml` là social/career home, không phải Employer analytics. Giữ composer, bài đăng, like/comment/share, media, việc gợi ý và role/data thật.

### 4.1 Bố cục đề xuất

**Desktop 1440px:** container 1280–1360px; gutter 32px; navbar 72–80px. Page intro 56–72px → hero 260–300px → workspace 3 cột `248px / minmax(0,1fr) / 280px`, gaps 24px. Ở 1024px, bỏ rail phải hoặc chuyển xuống dưới, không để cột feed chỉ chiếm 50% khi rail phải đang ẩn. Mobile chỉ một cột, thứ tự hero → composer → feed → nội dung phụ.

| Vùng | Thiết kế cụ thể | Motion cụ thể | Bảo toàn hành vi |
|---|---|---|---|
| Page intro | Eyebrow “Không gian của bạn”, greeting theo tên và giờ; tiêu đề lớn hơn | Text reveal theo 2 nhịp, tổng <=500ms | Dùng `firstName`, `greeting`, không hardcode tài khoản mẫu |
| Hero | Ink sâu, headline có 1 cụm blue, 1 artwork quỹ đạo có thể tích hợp motif nano; tránh banner gradient Bootstrap mặc định | Artwork reveal 800–1200ms, ambient chậm; parallax giới hạn trong vùng artwork | CTA theo `upcomingInterview` / `hasCv` / số jobs hiện có |
| Metrics | Hai số liệu thật tách đẹp, divider mảnh và nhãn rõ | Reveal nhẹ cùng hero; không count-up làm giả dữ liệu | `ActiveJobCount`, `AppliedCount` |
| Profile rail | Cover/crop có chủ đích, avatar nổi ở mép, type/name/bio phân cấp | Avatar/cover lift rất nhẹ; nav shortcut translate 2px | Profile, applications, CV links giữ nguyên |
| Composer | Card có vùng nhập rõ, avatar + placeholder có điểm nhấn; toolbar tách khỏi input | Focus-within highlight; upload preview thêm/bớt 180–220ms | Giữ `postForm`, `postInput`, `articleTitleInput`, mode toggle, media IDs |
| Feed heading | “Trong mạng lưới của bạn” + mô tả/ordering đang thật sự hỗ trợ | Selected indicator chuyển mượt nếu có filter thật | Không thêm tab “dành cho bạn” giả khi backend chưa có |
| Post | Padding 24px, body 14–15px, line 1.7; author/time/action có cấp độ; media bo đồng bộ | Hover elevation 2px, like phản hồi scale nhỏ theo kết quả thực, comment expand | Giữ dataset, buttons và listeners của post-actions |
| Jobs rail | Logo có fallback, title 2 dòng nếu dài, lương rõ, card nội dung compact | Hover border/arrow, không auto-carousel | `recentJobs`, link Details và dữ liệu thật |
| Empty state | Một minh họa native SVG theo logo/quỹ đạo + heading và CTA hữu ích | Reveal một lần, không vòng lặp gây phân tâm | Hướng về composer hoặc khám phá việc, không tạo bài giả |

### 4.2 Artwork và chiều sâu

- Hero cần một hình ảnh nhận diện mạnh, không chỉ một blob gradient hoặc hạt ngẫu nhiên. Dùng cấu trúc quỹ đạo/đường kết nối có khối và khoảng trống rõ, palette lấy từ auth.
- Cho artwork vùng riêng bên phải; không chồng chữ hoặc đẩy CTA xuống ngoài viewport. Mobile crop có chủ đích, artwork nhỏ hơn hoặc tĩnh.
- Mặc định ưu tiên SVG/CSS/canvas nhẹ cho Dashboard; không load nguyên Three.js/nano scene vào tất cả page để tạo vài hover.
- Chỉ một vùng ambient nổi bật trong viewport. Các card khác có phản hồi tương tác/reveal để phần trong vẫn sống động mà không biến feed thành animation demo.
- Cần xem hero đủ rộng ở 1440 và laptop 1024 trước khi polish shader/material.

### 4.3 Những lỗi dễ xảy ra

- `_AppLayout` navbar fixed: kiểm tra content offset và số lần render navbar khi nhập shell, không để hero bị che.
- Navbar có z-index 3000/3100 trong theme cũ; modal Bootstrap mặc định có thể bị nav phủ. Đồng bộ layer scale thay vì liên tục tăng z-index.
- Luôn scope hero/card CSS bằng page/component class. Không thay toàn bộ `.card` thành glass khi nó còn dùng trong modal, CV list và form.
- Không dùng `overflow:hidden` trên body của các trang cuộn để che overflow bug; Chat/Interview là ngoại lệ cần viewport riêng.

## 5. Motion system — nhiều hơn, nhưng có quy tắc

### Storyboard bắt buộc của auth

1. **DNA có khối:** hai sợi và cầu nối có chiều sâu, front/back rõ; key light xanh/trắng và vùng tối cho volume. Giữ cấu trúc đã có trong V5.
2. **DNA → ARIS:** chính các body đó di chuyển có đường đi liên tục, thành chữ đủ đặc để đọc. Có khoảng dừng đọc chữ, không thêm cảnh chờ không liên quan.
3. **ARIS → card:** body tạo silhouette/cạnh rồi mặt card liên tục; camera/ánh sáng nối cảnh; không cut sang một hộp HTML xuất hiện riêng.
4. **Ready:** hạt ở bề mặt tụ/chuyển material thành mặt quang học liền hơn, rim mảnh thay chuỗi hạt trang sức; form HTML xuất hiện theo nhóm. Giữ layers foreground/card/background và hình khối lúc đứng yên.
5. **Register ↔ Login:** cùng vật thể đổi hình, biên/ánh sáng chạy theo shape; field không nhảy tâm và không bị mesh che.
6. **Typing/submitting:** vật liệu vẫn sống ở cạnh nhưng vùng text ổn định; phản hồi nhỏ theo input/trạng thái server, không diễn lại intro.

Mốc thời gian cần tinh chỉnh từ V5 đang chạy, không bắt đầu lại bằng 8 giây hiệu ứng khác. Nghiệm thu clip toàn chuỗi, không chỉ từng ảnh đẹp.


| Tương tác | Thời lượng mục tiêu ban đầu | Biên độ/đặc tính | Trigger / hoàn tất |
|---|---|---|---|
| Page enter | 450–650ms, stagger 45–70ms | opacity 0→1, y 12–18→0 | Nội dung luôn có sẵn; tối đa 5–6 vùng top-level, không mỗi dòng |
| Hero artwork intro | 800–1200ms | Một biến đổi hình học rõ | Một lần khi vào trang, không chặn UI |
| Hero ambient | 10–20s/vòng, hoặc chuyển động rất chậm | ánh sáng/rotation có giới hạn | Pause khi tab ẩn hoặc ngoài viewport |
| Pointer artwork | damping 180–300ms | góc <=3°, offset <=8px | Chỉ fine pointer, tắt khi form focus/mobile |
| Card hover | 180–240ms | y -2px; shadow/border đổi | hover/focus-within theo ngữ cảnh, không tilt card có chữ dài |
| CTA | 160–220ms | arrow x +3px, pressed scale .98 | hover/press; highlight chạy một lượt, không sheen lặp |
| Field focus | 160–200ms | border và ring xuất hiện | không dịch field làm layout nhảy |
| Tabs/selection | 180–240ms | active indicator trượt; content crossfade | Cập nhật state, giữ focus và URL behavior hiện tại |
| Drawer/modal | 220–300ms | translate 12–24px + opacity | Bootstrap lifecycle/focus trap; không thêm listener hai lần |
| Feed insert | 220–320ms | xuất hiện nhẹ sau server xác nhận | Không render “đăng thành công” trước response |
| Like/save | 160–200ms | scale icon 1→1.12→1 | Theo state thật; không tung confetti |
| Loading/error/success | 160–240ms | icon/text/panel local | Không rung cả card; `aria-live` đúng |
| Auth mode morph | khoảng 450–700ms tổng | cùng material/body IDs, height có kiểm soát | interruptible; không queue nhiều lần |
| Auth full intro | kế thừa sequence DNA → ARIS → card ~8–9s nếu vẫn phù hợp | transition liên tục, chữ ARIS đọc được | Skip luôn có; không bắt người quay lại xem lại |

**Implementation contract:** một motion controller dùng chung, CSS custom properties cho timing/easing; `prefers-reduced-motion`, `visibilitychange`, `IntersectionObserver` và pause chủ động. Chỉ animation `transform/opacity` cho nhiều node; không animate box-shadow/filter blur lớn mỗi frame. `will-change` có giới hạn và được gỡ sau animation. Không thêm GSAP/Framer hoặc đổi framework chỉ để làm stagger cơ bản.

**Reduced motion:** vào final state ngay; controls vẫn hoạt động. **JS fail:** content không được mãi ở `opacity:0`. **Dynamic content:** observer không loop khi Lucide thay node. **LCP:** không giấu heading/form chính chờ scene; không chặn tương tác vì intro.

Các số ở bảng là điểm bắt đầu thiết kế, không phải thông số hiệu năng đã đo. Tối ưu sau khi đo trên máy thực; kiểm tra một máy cấu hình thấp/mobile profile, ghi viewport/DPR, frame intervals, dropped frames, long tasks. Không suy từ một sample thành cam kết 60fps mọi máy.

## 6. Mang ngôn ngữ đó ra toàn bộ trang

### Nhóm A — việc làm và ứng tuyển

- `Jobs/Index`: header có cá tính, search/filter thành một hệ controls rõ, JobCard tinh hơn; same blue/ink/material accent với Dashboard. Empty/loading/selected/filter states phải được thiết kế. Business variant giữ toolbar quản lý.
- `Jobs/Details`: summary bên cạnh apply panel; long content dễ quét. Sticky CTA mobile có safe-area và không che nội dung; animation panel nhẹ, không parallax mô tả công việc.
- `_JobCardPartial` và `_RecommendedJobsPartial`: chia sẻ primitive, không mỗi partial một kiểu. Tách style khỏi list item.
- `MyApplications`: timeline/step dùng trajectory motif, state icon/text/màu thống nhất với Employer. Link Interview và withdrawal giữ nghiệp vụ.

### Nhóm B — cá nhân, công ty, onboarding

- `Profile`: cover đẹp hơn, avatar/header cân đối, tabs có indicator và panel loading; giữ posts/CVs/applications và quyền chỉnh sửa.
- `NewUserInfor`: step progress đặc trưng, form nhóm nhỏ và chuyển bước có chuyển động; preserve input khi lỗi; tránh full-screen intro giữa các bước.
- `Company/Index`, `Details`, `Edit`: logo, cover, stats và job cards chung hệ; verification chỉ khi dữ liệu cho biết. Form edit có save/error feedback rõ.
- `Settings`, `SelectFacebookPage`, `Home/Error`: cùng typography/button/surface; trạng thái lỗi cũng cần được chăm chút.

### Nhóm C — CV, realtime, employer

- CV picker/builder: đổi **editor chrome** (header, toolbar, sidebar, tile), không đổi màu/font của CV được xuất. Hiển thị saving/saved/error có motion nhỏ và thật.
- Chat: shell cùng nhận diện, avatar/bubble/search/selected row thống nhất; message insert nhẹ, reconnect dễ nhận biết; không animate toàn bộ history khi mở hội thoại.
- Interview: giữ dark stage riêng cho video, chrome và action control cùng theme. Waiting/permission/reconnect/ended có state rõ; không làm nút kết thúc mất nổi bật.
- Employer: cùng component với application status; KPI, pipeline và danh sách phải rõ, không chèn artwork che dữ liệu quản lý.

Chi tiết inventory 20 bề mặt và token nằm trong PLAN. Shared components sẽ mang cải tiến tới nhiều page, nhưng AGY vẫn phải mở từng page/role để kiểm tra; không tuyên bố “đã đồng bộ toàn bộ” chỉ vì thêm CSS global.

## 7. Thứ tự làm và đầu ra từng bước

### A — Baseline + visual studies

- Chụp/quay hiện trạng và kiểm kê token/selector thật.
- Tạo 2 study của **cùng một theme** cho card auth: khác mức glass/material/readability, giữ DNA/ARIS. Đồng thời có một Dashboard study để kiểm tra sự nối tiếp thương hiệu.
- So sánh cạnh nhau, chọn hướng có silhouette đẹp, type rõ, spacing thoáng; ghi lý do và nhược điểm. Đây là mốc tự review của người triển khai, không cần hỏi người dùng sau từng thay đổi nhỏ.
- Đầu ra: desktop/mobile auth ready, register ready và Dashboard; spec component đủ để triển khai.

### B — Foundation + card auth + Dashboard

- Token ngữ nghĩa + font + control/component nền tảng. Giữ alias token cũ trong lúc migrate, map Bootstrap states/utility.
- Sửa card V5, sau đó kiểm tra intro/morph/fallback. Không viết lại scene khi chưa cần.
- Xây Dashboard composition và motion theo mục 4–5. Đủ cả populated và empty bằng fixture phù hợp.
- Làm Login/Register thật dùng same visual system và partial/shared assets; kết nối lại đúng server forms. Không copy `simulateOAuth` hoặc fake submit từ V5 sang production.
- Đầu ra: 3 màn mẫu thật hoạt động, clip tương tác, ghi phần backend chưa được test.

### C — lan rộng theo user journey

- Jobs → Details → Applications → Profile → CV → Company → Onboarding → Employer → Settings/Social → Chat/Interview/Error.
- Mỗi nhóm có trước/sau, states và breakpoint. Không thay UI giữa chừng sang style khác.
- Reuse components và motion contract; không nhân bản CSS animation và script event listeners ở mỗi view.

### D — QA và handoff

- Build, browser console, keyboard, reduced motion, form validation/loading, layout mobile, current nav/role, modal layering.
- Quay một clip: Login intro → skip/ready → Register → Login → sample Dashboard interaction → Jobs → Profile, và clip mobile ngắn.
- Ghi exact source revision, lệnh chạy, URL, ảnh/clip và phần chưa xác minh. Không coi tài liệu này hay một ảnh mockup là bằng chứng hoàn thành.

**Ước lượng sửa UI:** 10–17 ngày công, phụ thuộc mức chỉnh material/morph và data fixture. A 1–2; B 4–6; C 3–6; D 2–3. Đây là ước lượng lập kế hoạch, không là cam kết deadline. Nếu chia milestone nhỏ, hoàn thiện **auth card + Dashboard** trước rồi lan rộng; không giảm tham vọng hai màn này để đổi sơ sài toàn bộ trang.

## 8. Gate nghiệm thu thẩm mỹ và tương tác

### Card auth

- [ ] So sánh cạnh V5 cũ tại cùng viewport: scene/material giữ hoặc nâng độ hấp dẫn; ready card tốt hơn ở khoảng trống, typography và chất liệu.
- [ ] Đọc được ba lớp background / vật thể card / controls. Mặt card, cạnh và nền có tương phản vật liệu thực sự; không chỉ một rectangle tối có border xanh.
- [ ] Có nhận diện riêng khi dừng motion: silhouette rõ, ánh sáng có hướng, khoảng trống có chủ đích, primary CTA cân với hình khối.
- [ ] Trên route auth thật có cùng DNA → ARIS → card hoặc final V5 phù hợp trạng thái lượt truy cập; demo lab đẹp nhưng login thật vẫn cũ là chưa hoàn thành.

- [ ] Không còn cảm giác form bị nhồi; mỗi nhóm nội dung có khoảng thở, primary CTA rõ nhất.
- [ ] Material không thành lưới chấm/ô vuông sáng xuyên chữ; border không dày/nhòe; heading không bị double render.
- [ ] Card đẹp ở ready-state không cần scene đang chạy để che nhược điểm.
- [ ] Login/Register cùng hệ; height/morph tự nhiên; email/name không mất ngoài ý muốn.
- [ ] Desktop/mobile 320–390 đều đọc được, reach được CTA, không scale toàn card đến chữ quá nhỏ.
- [ ] Skip, replay, pause, reduced motion, WebGL fallback, rapid mode switching không làm form mất tương tác.

### Dashboard và toàn app

- [ ] So sánh before/after thấy thay đổi ở composition/type/surface/artwork, không chỉ background.
- [ ] Hero có điểm nhấn nhận diện, nhưng composer/feed/next action vẫn rõ và dễ dùng.
- [ ] Các component xuất hiện có nhịp; hover/focus/press có phản hồi; không mọi thứ cùng chuyển động liên tục.
- [ ] Dữ liệu thật/fixture được phân biệt; không invent metrics, posts hoặc trạng thái thành công.
- [ ] Login, Dashboard, Jobs, Profile, Chat nhìn cạnh nhau vẫn nhận ra cùng Aris.
- [ ] Light/dark text contrast, focus indicators, 200% zoom, long Vietnamese text và image fallback đạt.
- [ ] Không regress submit/upload/comment/save/apply/chat/call; ghi rõ chức năng nào chưa đủ môi trường test.

Nếu card vẫn chật hoặc Dashboard vẫn giống template dù tests pass, tiếp tục chỉnh visual. Build pass và animation chạy không thay thế đánh giá thiết kế.

## 9. Nguồn tham khảo và cách dùng

- [Linear — A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh): học hierarchy, consistency và cách giảm chrome thừa; không lấy đây làm lý do giảm độ nổi bật mà người dùng yêu cầu ở auth/hero.
- [Untitled UI — free Figma UI kit](https://www.untitledui.com/free-figma-ui-kit): reference component anatomy/spacing/state. Không cần mua kit để thực hiện theme.
- [Figma YouTube — Design System Foundations](https://www.youtube.com/watch?v=EK-pHkc5EL4): nguồn bổ trợ foundations; phiên này mới xác minh metadata, chưa xem nội dung video đầy đủ.
- [Jobify — Figma Community](https://www.figma.com/community/file/1427716315717875267): link khám phá job portal; chưa truy cập layer được trong phiên này.
- V5 source + evidence + `docs/agent-bridge/dna-sequence-latest.md`: nguồn motion/identity riêng của project. Ưu tiên kiểm tra bản mới hơn là tái dùng nhận xét lịch sử.

**Không gửi dự án lên Figma hoặc dùng tài sản trả phí chưa có quyền.** Có thể nghiên cứu thêm public design/video; ghi nguồn, phần thực sự đã xem và điều gì áp dụng. Không nói đã xem video/layer nếu chỉ đọc search snippet.

## 10. Prompt giao việc có thể đưa nguyên văn cho AGY

> **Bổ sung ưu tiên:** mở và chạy `docs/design-lab/aris-login-v5` trước. Đây là baseline người dùng muốn giữ, tốt hơn hướng preview phẳng đã bị bác bỏ. Giữ scene toàn màn hình và một nano-card trung tâm. Sửa chất liệu/spacing/card morph và tích hợp scene vào login/register thật. Không thay bằng split marketing/form, SVG constellation hoặc hộp glass CSS xuất hiện riêng. So sánh ảnh/clip cùng viewport với V5 trước khi báo nâng cấp.


> Đọc `docs/unified-theme/AGY-HANDOFF.md` trước, rồi `PLAN.md`. Hãy thực hiện redesign Aris cho đẹp hơn rõ rệt và nhiều animation được thiết kế có chủ đích hơn. Ưu tiên card sign in/up và Dashboard tại `http://localhost:5025/Dashboard`; phần bên trong đang quá plain. Giữ concept DNA → ARIS → card của V5 nhưng sửa chất liệu/spacing/typography/hierarchy để ready card sạch, thoáng và tinh tế hơn; không phủ thêm một CSS panel để che nano scene. Làm Dashboard có hero/artwork và composition riêng, feed/card/control nhiều phản hồi hơn, giữ chức năng social và dữ liệu thật. Xây token/components/motion dùng chung rồi lan sang toàn bộ 20 bề mặt đã kiểm kê. Giữ ASP.NET MVC/Razor/Bootstrap và auth/CSRF/returnUrl; không đưa fake submit/OAuth vào app. Preview HTML hiện có chỉ là study cấu trúc, không là đích visual đã duyệt. Review bằng ảnh và clip thật, desktop/mobile, reduced motion/fallback và keyboard. Bảo toàn thay đổi có sẵn của project, chỉ báo hoàn thành phần đã kiểm chứng.
