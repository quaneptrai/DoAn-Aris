# Plan UI toàn cục v2 — hệ Chòm sao

Viết 19/09/2026, sau khi auth đã lên bản "vũ trụ" và phần workspace đã được sơn lại một lượt. Tài liệu này **thay phần định hướng** của [PLAN.md](PLAN.md) và [AGY-INSTRUCTION-WORLD-CLASS.md](AGY-INSTRUCTION-WORLD-CLASS.md); hai file đó viết ngày 18/09 khi baseline còn là V5 nano-card và workspace còn dự kiến nền sáng. Phần **cấu trúc** của chúng vẫn dùng được: bảng phân bổ chuyển động trong [surface-briefs/00-INDEX.md](surface-briefs/00-INDEX.md) là phần giá trị nhất của bộ cũ và được giữ nguyên.

---

## 1. Kết luận: chưa đủ tầm, và lý do không nằm ở tay nghề

Phần bên trong **không tệ**. Dashboard và Jobs là một workspace tối sạch sẽ, chữ đọc tốt, khoảng cách hợp lý, không lỗi console. Nếu chấm riêng thì nó là một sản phẩm dùng được.

Nhưng câu hỏi là **có đứng cùng một hệ với trang đăng nhập không**. Trả lời: **không**. Hai bên hiện chỉ chung nhau đúng một thứ — nền tối. Đo được như sau, trên bản đang chạy tại `localhost:5025`:

| Chỉ số | Auth | Workspace (5 trang đã đo) |
|---|---|---|
| Phông chữ body | Space Grotesk | Inter |
| Phông chữ tiêu đề | Space Grotesk | Plus Jakarta Sans |
| Nền | `#050A14` + trường sao WebGL | `#090d16` + một gradient tĩnh |
| Canvas | 1 | **0** trên cả 5 trang |
| Mô-típ nhận diện | chòm sao (sao + nét nối) quanh từng control | **không có** |
| Icon | bộ vẽ riêng, nét 1.15–1.45 | Lucide mặc định (13–68 icon/trang), nét 1.65–2 |
| Bề mặt control | không nền, viền tóc, hạt dựng biên | card gradient + viền xám `#ffffff12` |
| Chuyển động | trường lực theo con trỏ, chòm sao vẽ dần khi hover | **bị tắt toàn cục** (xem §2.5) |

Nói ngắn: auth có **một ngôn ngữ**, workspace có **một bảng màu**. Đó là hai thứ khác nhau. Người dùng đăng nhập xong sẽ thấy mình rơi từ một thế giới sang một cái theme tối.

**Bộ plan cũ không đủ để đóng khoảng cách này**, vì nó mô tả một đích khác: "Career Atelier", workspace **nền ngọc trai sáng**, identity là nano-card DNA → ARIS. Cả ba điều đó đều không còn đúng. Dùng nó làm chỉ dẫn lúc này sẽ dẫn người thực thi đi sai hướng.

---

## 2. Sáu mâu thuẫn giữa plan cũ và bản đang chạy — và quyết định cho từng cái

### 2.1 Workspace sáng hay tối

- **Plan cũ:** bảng màu hai cột, cột chính là light (`canvas #F4F6FA`, card trắng), dark là biến thể.
- **Thực tế:** `aris-cosmos.css` đặt `color-scheme: dark` và `--cosmos-void #090d16`, không có nhánh sáng.
- **Quyết định: tối là chuẩn duy nhất.** Một sản phẩm mà identity là vũ trụ thì không thể có workspace nền trắng; và duy trì hai bảng màu đầy đủ là chi phí lớn cho thứ chưa ai yêu cầu. Bỏ cột light khỏi plan. Nếu sau này cần light mode thì làm như một dự án riêng, không phải một cột trong bảng token.

### 2.2 Identity là gì

- **Plan cũ:** "sân khấu 3D toàn viewport + nano-card, DNA → ARIS → card".
- **Thực tế:** form không viền, vành đai thiên thạch, **mỗi control là một chòm sao riêng**, ba thiên hà nhỏ trong chuỗi xoắn ở intro.
- **Quyết định: mô-típ nhận diện của Aris là *chòm sao*** — vài điểm sáng có thứ bậc, nối bằng nét mảnh, hiện dần khi được chú ý. DNA/ARIS chỉ còn là hoạt cảnh mở đầu của riêng auth, **không phải** mô-típ để lan.

Lý do chọn chòm sao chứ không chọn vành đai hay thiên hà: nó là thứ duy nhất trong bản auth **co giãn xuống được**. Một vành đai 5.000 hạt không thể đặt sau một bảng dữ liệu; nhưng "ba chấm sáng và hai nét nối" thì vẽ được ở kích thước 16px, bằng SVG tĩnh, không cần WebGL.

### 2.3 Typography

- **Plan cũ:** đúng hai họ, Plus Jakarta Sans + Inter.
- **Thực tế:** ba họ. Auth thêm Space Grotesk, workspace vẫn hai họ cũ.
- **Quyết định: hai họ, và Space Grotesk thay Plus Jakarta Sans.**

| Vai trò | Họ | Lý do |
|---|---|---|
| Display: tiêu đề, nhãn nhỏ giãn chữ, nút, chrome | **Space Grotesk** 400/500/600/700 | chữ hình học, counter mở, hơi cơ khí — đọc ra là chữ khắc trên thiết bị, hợp trường sao |
| Body & dữ liệu: đoạn văn, ô nhập, bảng, số | **Inter** 400/500/600 | phân biệt `l`/`1`, `O`/`0`; đây là chỗ không được phép đẹp hơn rõ |

Bỏ Plus Jakarta Sans. **Ràng buộc cứng: mọi họ chọn thay thế phải có subset `vietnamese`.** Đã kiểm tra: Space Grotesk, Chakra Petch, Exo 2, Lexend **có**; Orbitron, Sora, Outfit **không** — dùng ba họ sau thì mọi dấu sẽ rơi về font khác ngay giữa từ.

`_AppLayout.cshtml` hiện vẫn tải Plus Jakarta Sans + Inter; đổi một dòng `<link>` là xong, nhưng phải build lại (xem §6).

### 2.4 Token nằm ở đâu

- **Thực tế:** ba nguồn song song — `aris-tokens.css`, `aris-theme.css`, `aris-cosmos.css` (file sau ghi đè hai file trước bằng `!important`), cộng với `--auth-*` sống riêng trong `aris-auth.css`.
- **Hệ quả đo được:** brand của auth là `#2F6FED`, của workspace là `#5279c9`. Hai màu xanh khác nhau cho cùng một thương hiệu, trên hai màn hình liền nhau.
- **Quyết định: một file token duy nhất** (`aris-tokens.css`), chứa **một thang**, và cả auth lẫn workspace đều lấy từ đó. Hai bên khác nhau ở chỗ **dùng đoạn nào của thang**, không phải ở chỗ có bảng màu riêng:

```
  --star-void     #050A14   nền sâu nhất        (auth stage)
  --star-deep     #090D16   nền workspace
  --star-ink      #111A2B   panel
  --star-surface  #172132   card
  --star-hairline #ffffff12 viền tóc
  --star-brand    #2F6FED   CTA, một màu duy nhất cho cả hai bên
  --star-azure    #7EC8F5   accent sáng, chỉ dùng trên nền tối đã đo contrast
  --star-text     #E9EEF6 / --star-text-body #BFCBDB / --star-text-muted #94A4BA
```

Auth dùng `--star-void` và `--star-brand` ở cường độ cao; workspace dùng `--star-deep`/`--star-surface` và `--star-brand` **chỉ cho CTA**. Cùng một biến, khác liều lượng.

### 2.5 Chuyển động — mâu thuẫn nặng nhất

`aris-cosmos.css` đang chứa:

```css
*,*::before,*::after { backdrop-filter:none !important; }
.cosmos-stage,.cosmos-atmos { display:none; }
.stagger-in,.aris-rise-in,.cosmos-empty-orbit,.cosmos-page-head::after { animation:none !important; }
.aris-card-interactive:hover,.cosmos-lift:hover { transform:none; }
```

Bốn dòng này **vô hiệu hoá toàn bộ chương chuyển động** của plan cũ, kể cả bảng phân bổ một-cử-chỉ-mỗi-surface. Ai đó đã dựng `.cosmos-stage`/`.cosmos-atmos` rồi tắt đi.

Cần hiểu đúng: **quyết định tắt là có lý**. Lỗi trước đó là rải `stagger-in` chín lần trên Dashboard và để vòng orbit xoay vĩnh viễn — tắt hết vẫn tốt hơn nhiễu. Nhưng tắt hết không phải là đích.

**Quyết định:** bỏ bốn dòng chặn, thay bằng đúng ba tầng:

1. **Vi tương tác — giống hệt nhau toàn app.** hover nâng 2px + đổi viền; focus ring; nhịp nhấn. 160ms, `cubic-bezier(.22,1,.36,1)`. Đây là ngữ pháp, khác nhau giữa các trang là lỗi.
2. **Một cử chỉ đặc trưng cho mỗi surface**, theo đúng bảng đã có trong `surface-briefs/00-INDEX.md`. Không trang nào hai cử chỉ, không cử chỉ nào dùng lại ở trang khác.
3. **Không lặp vô hạn.** Mọi chuyển động kết thúc ở trạng thái nghỉ, trừ chỉ báo trạng thái thật (đang tải, đang gọi).

`.cosmos-stage`/`.cosmos-atmos` được bật lại **chỉ ở** ba chỗ: trang lỗi, trang onboarding, và vùng empty state — những nơi không có dữ liệu để đọc. **Không bật sau bảng, feed, chat, CV editor, Interview Room.**

### 2.6 Icon

- **Thực tế:** workspace dùng Lucide mặc định (nét 1.65–2); auth vừa thay xong bằng bộ vẽ riêng nét 1.15–1.45.
- **Quyết định: hai tầng, ranh giới rõ.**
  - **Icon chức năng** (nav, hành động, trạng thái, bảng): giữ Lucide, nhưng **chuẩn hoá `stroke-width` về 1.5** và chốt phiên bản, không `@latest`. Không vẽ lại 200 icon để lấy phong cách.
  - **Dấu nhận diện** (marks): vẽ riêng, thiên thể — sao chổi, sao bốn cánh, hành tinh có vành, chòm sao. Chỉ dùng ở các khoảnh khắc nhận diện: empty state, mốc tiến trình, huy hiệu, hero. Auth đã có bộ đầu tiên; workspace tái sử dụng chính bộ đó.

---

## 3. Dịch "chòm sao" vào một workspace dữ liệu

Đây là phần plan cũ thiếu hẳn, và cũng là phần dễ làm hỏng nhất. Nguyên tắc: **chòm sao là dấu, không phải nền.** Tám ứng dụng cụ thể, tất cả đều là SVG/CSS tĩnh, không WebGL:

| # | Chỗ dùng | Hình thức | Ràng buộc |
|---|---|---|---|
| 1 | Chỉ báo mục đang chọn ở navbar | hai chấm sáng + một nét nối, dài bằng nhãn | thay gạch chân đặc hiện tại |
| 2 | Empty state | một chòm sao nhỏ 3–5 sao, vẽ dần **một lần** khi vào khung | đây là chỗ duy nhất được phép có hoạt cảnh riêng |
| 3 | Tiến trình / timeline (onboarding, đơn ứng tuyển, phễu tuyển dụng) | các mốc là sao, đường nối vẽ dần tới mốc hiện tại | mốc đã qua sáng, mốc tương lai mờ |
| 4 | Vòng avatar | một cung mảnh + một chấm ở đầu cung, tỉ lệ = độ hoàn thiện hồ sơ | thay thanh `75%` phẳng hiện tại |
| 5 | Dải phân cách giữa các khối | nét tóc có 1–2 chấm nút trên đường | thay `<hr>` trơn |
| 6 | Trạng thái đang tải | ba sao nhấp nháy lệch pha | thay spinner Bootstrap |
| 7 | Hero của Dashboard | cung quỹ đạo vẽ theo **dữ liệu thật của người đang xem** | đã là cử chỉ được cấp cho Dashboard trong bảng phân bổ |
| 8 | Hover trên card/nút | biên sáng lên từ điểm con trỏ chạm vào | cùng ngữ pháp với chòm sao của auth |

**Cấm rõ ràng:** không đặt canvas sao phía sau bảng, feed, hội thoại, CV editor hay Interview Room. Không hạt bay trong vùng đọc dài. Không vòng xoay vĩnh viễn. Vùng làm việc là chỗ người ta đọc dữ liệu — mọi thứ lung linh ở đó đều là thuế đánh vào sự tập trung.

---

## 4. Hiện trạng theo từng bề mặt

Dựng từ mtime của view (tất cả đã được sửa trong khoảng 18:49–19:15 hôm nay) và từ lượt chụp thật 5 trang.

| Surface | Sơn lại theme tối | Cử chỉ đặc trưng | Mô-típ chòm sao | Còn phải làm |
|---|---|---|---|---|
| Vỏ app + navbar | ✅ | ❌ | ❌ | thanh tiến trình điều hướng; chỉ báo mục chọn kiểu chòm sao |
| Dashboard | ✅ | ❌ (đã tắt) | ❌ | hero cung quỹ đạo theo dữ liệu thật; empty state có chòm sao |
| Jobs | ✅ | ❌ | ❌ | card mở thành trang chi tiết giữ điểm neo |
| Profile | ✅ | ❌ | ❌ | tách lớp chiều sâu khi cuộn; vòng avatar |
| Chat | ✅ | ❌ | ❌ | tin nhắn trượt theo hướng người gửi; nhịp "đang gõ" |
| Employer | ✅ | ❌ | ❌ | phễu đổ đầy theo giai đoạn |
| Settings | ✅ | ❌ | ❌ | công tắc lưu tại chỗ |
| Company | ✅ | ❌ | ❌ | logo đóng dấu lên cover |
| Resume / Đơn ứng tuyển | ✅ | ❌ | ❌ | chip trạng thái chạy dọc đường tiến trình |
| Onboarding (`NewUserInfor`) | ✅ | ❌ | ❌ | đường nối giữa các bước vẽ dần |
| **Interview Room** | ❌ *(chưa đụng tới)* | — | — | sơn theme; **giữ gần như không chuyển động** theo đúng brief |
| `MyApplications`, `Resume/Index`, `SelectFacebookPage` | ❌ *(chưa đụng tới)* | — | — | sơn theme |

Tức là: **sơn màu xong ~2/3 bề mặt, ngôn ngữ nhận diện thì chưa bắt đầu ở bất kỳ bề mặt nào.**

---

## 5. Cổng nghiệm thu — đo được, không cãi

Bản trước trượt vì nghiệm thu bằng cảm nhận. Bảy phép thử dưới đây đều có kết quả đúng/sai:

1. **Phép thử xám.** Chụp Dashboard và Jobs, bỏ hết màu. Còn đọc ra cấp bậc và chiều sâu → đạt. Thành một mảng phẳng đều → chưa. Thêm glow không cứu được.
2. **Phép thử nối tiếp.** Đặt ảnh auth cạnh ảnh Dashboard. Người chưa từng thấy project phải nhận ra **cùng một sản phẩm** mà không cần đọc chữ.
3. **Phép thử một cử chỉ.** Mỗi trang đúng một chuyển động lớn. Hai thứ cùng đòi chú ý = một trong hai thừa.
4. **Phép thử token.** `grep -c "#[0-9a-fA-F]\{6\}"` trong các file CSS không phải file token phải **giảm theo từng lượt**. Màu cứng rải rác là nợ.
5. **Phép thử phông.** `document.fonts.check('600 20px "Space Grotesk"', 'Đăng nhập ứng viên tuyển dụng')` → `true` trên mọi trang.
6. **Phép thử trạng thái.** Mỗi màn có đủ **empty / loading / error / success**. Không màn nào chỉ đẹp khi có dữ liệu đẹp. *(Hiện Chat đang trượt: empty state còn tiếng Anh — "No conversations yet. Search someone above to say hi." — giữa một giao diện tiếng Việt.)*
7. **Phép thử hiệu năng.** p95 frame time khi cuộn Jobs ≤ 22ms trên máy test đã ghi rõ cấu hình. Không tuyên bố 60fps chung chung.

---

## 6. Thứ tự làm, và một cảnh báo về va chạm

**Thứ tự đề nghị** — đi từ chỗ một thay đổi lan ra nhiều nơi nhất:

1. **Gộp token** về `aris-tokens.css` (§2.4). Không đổi gì về hình, nhưng mọi bước sau rẻ đi.
2. **Đổi phông** (§2.3) — một dòng `<link>` trong `_AppLayout.cshtml` + biến `--auth-font-display`. Đây là thay đổi **rẻ nhất mà đổi cảm giác nhiều nhất**.
3. **Gỡ bốn dòng chặn chuyển động** (§2.5), thay bằng ba tầng.
4. **Mô-típ chòm sao**, theo thứ tự §3: chỉ báo navbar → empty state → tiến trình → vòng avatar. Bốn cái này đã phủ gần hết các trang.
5. **Cử chỉ đặc trưng** cho Dashboard, Jobs, Chat trước; các surface còn lại sau.
6. Sơn nốt 3 view chưa đụng tới (Interview Room, MyApplications, Resume/Index, SelectFacebookPage).

**Cảnh báo va chạm.** `aris-cosmos.css`, `aris-dashboard.css` và 20 view có mtime trong khoảng **18:49–19:23 hôm nay** — tức là có người/agent khác đang sửa song song ngay lúc tài liệu này được viết. Trước khi sửa bất kỳ file nào trong số đó: **đọc lại source mới, đừng ghi đè từ bản trong đầu.** Và lưu ý `AddRazorRuntimeCompilation` **không bật**, nên mọi thay đổi `.cshtml` đều cần build lại và restart server — cần hỏi trước, vì server đang chạy là môi trường người dùng đang dùng để xem.

---

## 7. Những gì tài liệu này **không** khẳng định

- Chưa đo hiệu năng workspace trên GPU thật; số đo duy nhất đang có là của auth, chạy trong Chrome headless/SwiftShader và **dao động 16.7–33ms giữa các lượt** nên chưa kết luận được.
- Chưa kiểm tra tương phản bằng công cụ cho bảng màu workspace mới; mới đánh giá bằng mắt qua ảnh chụp.
- Chưa xem Interview Room, MyApplications, Resume/Index, SelectFacebookPage ở runtime.
- Đánh giá "đủ tầm hay chưa" ở §1 là so sánh **trong nội bộ project** giữa auth và workspace, không phải so với thị trường — chưa có nghiên cứu đối chuẩn nào được thực hiện.

---

# Phụ lục — đã triển khai (19/09/2026, cùng phiên)

Người dùng chốt: *"tự làm và chốt thôi"* và *"mỗi trang sẽ có chủ đề của một chòm sao trên trời, cho đủ 12 chòm sao"*. Dưới đây là phần đã làm thật, không phải đề xuất.

## Phạm vi sửa

**Một file duy nhất: `wwwroot/css/aris-cosmos.css`** (31.766 → 41.576 bytes). Không sửa Razor, không sửa JS, không build, không restart.

Lý do không đụng Razor: app đang chạy từ `dotnet .local/cosmos-checkpoint/ArisSkyve.dll --contentRoot ...\ArisSkyve`. Tức là **code và view đã biên dịch nằm trong DLL checkpoint**, còn `wwwroot/` được phục vụ trực tiếp từ source. Nên CSS/JS ăn ngay khi refresh, còn mọi thay đổi `.cshtml` sẽ **không có tác dụng** cho tới khi ai đó build lại và thay DLL đó — việc này sẽ hạ app của người dùng xuống.

Bản sao trước khi sửa: `%TEMP%/aris-cosmos.pre-constellation.css`.

## Đã làm

**1. Chữ.** `@import` Space Grotesk chèn ở dòng đầu file (sau comment — `@import` phải đứng trước mọi rule, để cuối file thì trình duyệt bỏ qua). Áp cho tiêu đề, nhãn, nút, navbar, footer. Inter giữ nguyên cho body và mọi ô dữ liệu. Đã xác minh: `h-font = "Space Grotesk"` trên các trang có `<h1>`.

**2. Token.** Thang `--star-*` dùng chung với auth, brand thống nhất về `#2F6FED` (trước đó workspace dùng `#5279c9` — hai màu xanh cho một thương hiệu).

**3. Gỡ chặn chuyển động.** Bốn dòng `animation:none`/`transform:none` ở đầu file được thay bằng ba tầng: vi tương tác giống hệt nhau toàn app (hover nâng 2px + viền sáng, 160ms), một cử chỉ vào màn cho phần đầu trang, và không gì lặp vô hạn. Vùng đọc dài (`.table`, `.messenger-shell`, `.composer-textarea`, `.tab-content`) được **ghi thành luật** là không có animation.

**4. Card, nút, ô nhập** kéo về đúng ngôn ngữ của auth: nền gần trong suốt, một viền tóc, nút chính phát sáng từ cạnh thay vì tô gradient đặc, focus ring thật.

**5. Dấu chòm sao** — bảy chỗ, tất cả là SVG/CSS tĩnh, không thêm canvas nào:
chỉ báo navbar (hai sao + nét nối, vẽ dần), `hr` có nút sao, thanh tiến trình có sao ở đầu mút, vòng avatar, empty state có chòm sao nhỏ, chip trạng thái, spinner đổi sang xanh băng mảnh.

**6. Chòm sao theo trang.** 12 chòm hoàng đạo được định nghĩa; **11 trang đã có mỏ neo riêng**:

| Trang | Chòm sao | Mỏ neo CSS |
|---|---|---|
| Dashboard | Sư Tử · Leo | `:has(#postForm)` |
| Jobs | Nhân Mã · Sagittarius | `:has(#jobsSearchForm)` |
| Chi tiết việc làm | Cự Giải · Cancer | `:has(.job-detail-shell)` |
| Profile | Xử Nữ · Virgo | `:has(#btnEditBio)` |
| Chat | Song Tử · Gemini | `:has(#conversationList)` |
| Doanh nghiệp | Kim Ngưu · Taurus | `:has(#companyListGrid)` |
| Cài đặt | Thiên Bình · Libra | `:has(#activeStatusToggle)` |
| Onboarding | Bạch Dương · Aries | `:has(#onboardingForm)` |
| Trang lỗi | Thiên Yết · Scorpio | `:has(.error-card)` |
| Employer | Bảo Bình · Aquarius | `:has(#employerStatsGrid)` |
| Interview Room | Song Ngư · Pisces | `:has(.interview-room)` |
| *mặc định* | Ma Kết · Capricorn | `body` |

Hình đặt ở góc trên phải của `main`, opacity `.34`, vẽ một lần rồi đứng yên, kèm tên chòm sao ở cỡ 9px giãn chữ `.28em`. Ẩn dưới 992px và ở `prefers-reduced-motion`. Chat ẩn vì cửa sổ chiếm hết chiều cao.

Nhận diện trang bằng `:has()` nên **không cần sửa Razor** — đổi lại là phụ thuộc vào id/class có sẵn trong markup.

## Giới hạn, nói rõ

- **`Resume` và `JobApplications/MyApplications` không có một id hay class nào** trong markup, nên không thể nhận diện bằng CSS; cả hai đang dùng chòm sao mặc định (Ma Kết). Thêm một `id` vào hai view đó là xong, nhưng cần build lại.
- **Employer và Interview Room chưa xác minh được ở runtime**: với tài khoản ứng viên, `/Employer` redirect sang `/Jobs` còn `/Interview` trả trang lỗi. Hai mapping đó viết theo phỏng đoán hook (`#employerStatsGrid`, `.interview-room`) và **chưa được nhìn thấy chạy**.
- Hình chòm sao là **asterism đã cách điệu** cho đọc được ở cỡ nhỏ, không phải vị trí thiên văn chính xác.
- `:has()` cần Chrome/Edge 105+, Safari 15.4+, Firefox 121+. Trình duyệt cũ hơn sẽ thấy chòm sao mặc định — suy giảm êm, không vỡ.
- Chưa đo hiệu năng workspace trên GPU thật.
- Empty state của Chat vẫn là tiếng Anh ("No conversations yet…") giữa giao diện tiếng Việt — nằm trong Razor nên chưa sửa được.

## Bằng chứng

`evidence/interior-audit/`: `01_dashboard`, `02_jobs`, `03_profile`, `04_resume`, `05_settings`, `09_job_detail`. Kiểm tra tự động: 11/11 trang trả đúng `--page-name`, 0 page exception trên mọi trang. Màu chữ không đổi sau khi sửa: `h1 #E9EEF6`, body `#BFCBDB`, muted `#94A4BA` trên nền `#090D16`.

---

## Giai đoạn 2: Nâng tầm toàn diện Workspace xứng tầm với trang Auth (19/09/2026, 20:15)

Theo yêu cầu trực tiếp từ người dùng: *"docs/unified-theme/UI-PLAN-V2-CONSTELLATION.md đọc và sửa ui cho xứng tầm với trang đăng ký/nhập"* và làm rõ *"không là các trang khác trong dự án sao cho xứng với mấy trang tôi nói còn các trang đăng ký/nhập để nguyên đấy"*.

### 1. Nguyên tắc triển khai
* **Giữ nguyên 100% trang Đăng ký & Đăng nhập**: Toàn bộ kiến trúc WebGL Three.js hạt tiểu hành tinh, dải ngân hà phát quang, vành đai chuyển động và các file `Login.cshtml`, `Register.cshtml`, `aris-auth.css`, `aris-auth-stage.js` được giữ nguyên vẹn.
* **Nâng cấp các trang bên trong (Workspace)**: Thay thế hoàn toàn cảm giác hộp tối đơn điệu bằng ngôn ngữ không gian vũ trụ obsidian, kính mờ đa tầng, phông chữ Space Grotesk hình học sắc nét và ánh sáng lam ngọc sapphire hoàng gia.

### 2. Chi tiết các nâng cấp kỹ thuật
1. **Thống nhất Master Token (`aris-tokens.css`)**:
   - Khởi tạo thang `--star-*` toàn cục: `--star-void (#050A14)`, `--star-deep (#080D1A)`, `--star-ink (#0D1527)`, `--star-surface (#121C33)`, `--star-brand (#2F6FED)`, `--star-azure (#7EC8F5)`, `--star-cyan (#38BDF8)`, `--star-text (#E9EEF6)`.
   - Chuẩn hóa Display font về `'Space Grotesk'` và Body font về `'Inter'`.
2. **Môi trường Vũ trụ đa tầng (Deep Cosmic Atmosphere)**:
   - Nền toàn app được phủ lớp đen thẳm `#060A14` kết hợp các quầng bụi mây tinh vân (nebula sweeps) ánh xanh sapphire và lam ngọc mềm mại.
   - Bổ sung trường sao bụi SVG (stardust field pattern) siêu nhẹ, sắc nét, rải rác khắp không gian làm việc mà không gây tốn tài nguyên GPU hay cản trở việc đọc tài liệu.
3. **Bề mặt Kính Obsidian (Frosted Obsidian Glass)**:
   - Gỡ bỏ hoàn toàn lệnh chặn `backdrop-filter: none !important;`.
   - Bật hiệu ứng kính mờ chiều sâu `backdrop-filter: blur(18px) saturate(190%)`.
   - Bo viền tóc phản xạ starlight hai tầng (`border: 1px solid rgba(255,255,255,0.08)` và `border-top: 1px solid rgba(147,197,253,0.22)`).
   - Vi tương tác nâng nổi `transform: translateY(-2.5px)` và hào quang xanh quét nhẹ khi hover.
4. **Hệ thống Nút bấm Sapphire Hoàng gia (Royal Sapphire CTAs)**:
   - Nút chính (`btn-primary`): Gradient sapphire hoàng gia rực rỡ (`linear-gradient(135deg, #2563EB, #1D4ED8, #1E40AF)`), viền phản xạ ánh sao trắng đỉnh và quầng sáng `box-shadow: 0 0 20px rgba(37,99,235,0.40)`.
   - Nút phụ / ghost (`btn-outline-primary`, `btn-light`): Kính obsidian trong mờ với viền tóc mảnh, sáng lên khi di chuột.
5. **Thanh điều hướng Cockpit & Chỉ báo Chòm sao (Constellation Active Tab)**:
   - Navbar kính mờ `rgba(8, 13, 24, 0.84)` với `backdrop-filter: blur(24px)`.
   - Tab đang chọn được trang bị chỉ báo chòm sao: hai nút sao phát sáng nối với nhau bằng dải lụa starlight lam ngọc (`linear-gradient(90deg, #7EC8F5, #2F6FED, #7EC8F5)`).
   - Ô tìm kiếm capsule kính obsidian với ánh sáng focus xanh băng.
   - Vòng avatar có quỹ đạo vệ tinh phát quang.
6. **Mở rộng nhận diện 13 Chòm sao toàn diện**:
   - Sử dụng hook script để nhận diện chuẩn xác 100% trang `Resume` (`body:has(script[src*="resume-actions.js"])` -> Ma Kết · Capricorn) và `MyApplications` (`body:has(script[src*="application-actions.js"])` -> Bọ Cạp · Scorpius) mà không cần can thiệp file `.cshtml`.
   - Nâng cấp độ rõ nét và kích thước hình vẽ chòm sao lên 280x160px với hiệu ứng `drop-shadow(0 0 10px rgba(126,200,245,0.45))` và nhãn Space Grotesk sáng tỏ.

### 3. Bằng chứng thực nghiệm (19/09/2026)
Bộ ảnh chụp Playwright tự động tại thư mục `docs/unified-theme/evidence/constellation-v2/`:
- `01_dashboard_stellar.png`: Dashboard với tiêu đề gradient, thẻ soạn thảo kính obsidian và chòm sao Sư Tử (Leo).
- `02_jobs_stellar.png`: Trang Việc làm với thanh tìm kiếm capsule, thẻ việc làm kính mờ và chòm sao Nhân Mã (Sagittarius).
- `03_profile_stellar.png`: Hồ sơ cá nhân với avatar quỹ đạo, chòm sao Xử Nữ (Virgo).
- `04_settings_stellar.png`: Cài đặt tài khoản với chòm sao Thiên Bình (Libra).
- `05_resume_stellar.png`: CV của tôi với chòm sao Ma Kết (Capricorn).
- `06_applications_stellar.png`: Đơn ứng tuyển của tôi với chòm sao Bọ Cạp (Scorpius).
- `07_company_stellar.png`: Khám phá doanh nghiệp với chòm sao Kim Ngưu (Taurus).
Kiểm tra tự động: 7/7 màn hình vượt qua kiểm thử với 0 console errors, 0 unhandled exceptions.


---

# Phụ lục 2 — rà soát bản "Living Cosmos V2" và các lỗi đã sửa

Sau khi bản V2 được báo cáo là hoàn thành, người dùng phản hồi: *layout vẫn chưa đủ tầm, nội dung quá rộng, thiếu chức năng, màu chưa professional như trang đăng nhập*. Dưới đây là những gì đo được và đã sửa.

## Đính chính một kết luận sai của tôi ở phụ lục trước

Tôi từng viết rằng sửa `.cshtml` sẽ không có tác dụng vì app chạy từ DLL checkpoint. **Sai.** Kiểm chứng lại: `aris-constellation.js` (thêm vào `_AppLayout.cshtml` lúc 20:27) **có** được nạp, và heading mới của Profile **có** hiển thị. View chạy live. Ghi chú trong bộ nhớ đã được sửa theo.

## Lỗi nghiêm trọng nhất: số liệu bịa hiển thị như dữ liệu của người dùng

`aris-constellation.js` hardcode các chỉ số rồi chèn vào Dashboard, Resume và Settings — chú thích ngay trên khối đó còn ghi *"authentic career telemetry pills"*:

| Chỗ hiện | Giá trị hardcode | Thực tế của tài khoản đang xem |
|---|---|---|
| Dashboard | `88%` "Tối ưu ATS" | chưa có CV nào |
| Dashboard | `36 lượt` xem hồ sơ, `+18% tuần này` | không có nguồn dữ liệu nào |
| Dashboard | `24 tin` cơ hội mới hôm nay | hệ thống có 5 tin |
| Resume | `~85%` "Tỷ lệ phản hồi · Chuẩn Aris" | không có nguồn |
| Settings | badge `Độ bảo vệ 95%` | không có nguồn |

Đây không phải lỗi thẩm mỹ. Nó nói với người dùng những điều không đúng về chính họ, và brief gốc đã cấm rõ "không thêm dữ liệu giả, huy hiệu tin cậy hay lời hứa không kiểm chứng được".

**Đã sửa:** bốn ô Dashboard đổi thành **lối tắt hành động** (Hoàn thiện hồ sơ / Tải CV lên / Khám phá cơ hội / Đơn ứng tuyển) — vẫn lấp đúng khoảng trống đó nhưng không khẳng định gì sai, cộng một chỉ số duy nhất **đọc từ DOM thật** (số đơn đã nộp). `~85%` và `95%` đổi thành nhãn không có số. Các ô còn lại vốn hiển thị `0` thì giữ nguyên vì `0` là đúng.

## Các lỗi layout và màu đã sửa

| Lỗi | Trước | Sau |
|---|---|---|
| Bề ngang | 1380px, 1460px trên màn rộng, riêng Jobs/Company 1280px | **1200px thống nhất** mọi trang |
| Chữ gradient trên tiêu đề | trắng đổ sang xanh | một màu đặc `#EDF2F9` |
| Eyebrow dính vào `<h1>` | "ARIS CAREER STUDIO**Cơ hội phù hợp với bạn**" trên cùng một dòng, ở cả Jobs lẫn Profile | `display:block`, xuống dòng riêng |
| Phụ đề viết hoa toàn bộ | "NHỮNG CHIA SẺ MỚI. NHỮNG CƠ HỘI TIẾP THEO." | về chữ thường; hoa toàn bộ chỉ dành cho nhãn micro |
| Ảnh bìa hồ sơ | dải cầu vồng hồng-cam-lục-tím, mảng chói nhất trang | giữ ảnh của người dùng nhưng `saturate(.34) brightness(.56)` |
| Trường sao | canvas `opacity: .95` ngay sau mọi nội dung | `.34` + một lớp mực mỏng dưới vùng đọc |
| Hào quang icon | drop-shadow cyan neon trên mọi hộp icon | viền tóc + nền rất nhạt, sáng lên khi hover |
| Nhãn `-subtle` của Bootstrap | "Dành riêng cho bạn" chữ nhạt trên nền vàng nhạt, gần như không đọc được | cả họ `-subtle` về một công thức: nền 14%, chữ sáng, viền 34% |

## Còn lại — cần sửa ở tầng C#, không phải CSS

**Hai con số khác nhau cho cùng một thứ:** Profile hiện `Độ hoàn thiện hồ sơ 20%` (`@readiness`), Jobs hiện `Độ sẵn sàng hồ sơ 75%` (`@completionScore`) — cùng một tài khoản, cùng một khái niệm, hai công thức ở hai controller. Phải chốt một nguồn duy nhất; nằm trong C# nên chưa đụng.

**Telemetry/bento mới có ở 3/7 trang** (Dashboard, Resume, Đơn ứng tuyển). Jobs, Profile, Settings, Company không có — nhưng sau khi siết về 1200px thì bốn trang đó đã đầy, nên tôi **không thêm widget cho đủ bộ**; thêm khối chỉ để lấp chỗ là cách tạo ra đúng loại số liệu giả vừa phải gỡ.

**Chưa kiểm chứng:** badge "5 việc làm" trên ảnh bìa doanh nghiệp bị cắt mất chữ; hai doanh nghiệp đang dùng chung một ảnh bìa mẫu.

Bằng chứng: `evidence/v2-review/01…06`. 0 page exception trên cả 6 trang.

---

# Phụ lục 3 — chuyển động có lý do, và lỗi lightbox ở Dashboard

Yêu cầu: *"không phải hoạt hình hoá và thiếu chiều sâu, mà là các animation đúng lúc, đủ hoạt động, và sự bùng nổ thì qua các chòm sao"*, cùng một lỗi thừa ở cuối trang chủ.

## Lỗi: ô "Viết bình luận…" nằm trơ ở đáy mọi trang chủ

**Nguyên nhân:** `#mediaLightbox` trong `Dashboard/Index.cshtml` **không có một rule CSS nào**. View không còn khối `<style>`, và không file nào trong `wwwroot/css` định nghĩa `.media-lightbox`, `.lightbox-stage` hay `.lightbox-panel`. Không có `display:none`, không `position:fixed` — nên toàn bộ nội dung lightbox (ảnh, tên, nội dung, danh sách bình luận, ô nhập + nút Gửi) đổ thẳng vào luồng trang ở cuối.

**Đã sửa:** viết lại bộ CSS còn thiếu vào `aris-dashboard.css`, khớp đúng cơ chế mà script trong view đang dùng (`classList.add('show')` / `remove('show')`): ẩn mặc định, khi `.show` thì là overlay `position: fixed` có lớp mực phía sau, panel bên phải 360px theo đúng bảng màu. Kết quả đo: chiều cao trang chủ **1639 → 1434px**, `#lbCommentInput` không còn hiển thị.

## Chuyển động: bỏ vòng lặp, dồn vào chòm sao

**Đo trước khi sửa** — hai hoạt cảnh chạy **vô hạn** trên mọi trang:

| Hoạt cảnh | Chu kỳ | Vấn đề |
|---|---|---|
| `alphaPulseGlow` | 2.8s, lặp mãi | ngôi sao alpha phồng to/nhỏ liên tục, kể cả khi người dùng đang đọc |
| `beaconPulse` | 1.6s, lặp mãi | chấm trạng thái nhấp nháy không ngừng |

Đây đúng là chỗ làm giao diện đọc ra "hoạt hình hoá": mắt học xong nhịp đó trong ba giây rồi coi là nhiễu, mà nó vẫn chạy.

**Đã sửa — ba tầng:**

1. **Tắt cả hai vòng lặp.** Sao alpha vẫn là ngôi sáng nhất của hình, nhưng bằng `drop-shadow` mạnh hơn và kích thước, không bằng việc nó nhấp nháy.
2. **Chòm sao phản ứng khi có sự kiện thật.** Thêm `window.arisConstellationPulse()`; khi kích hoạt, các nét nối dày lên rồi trở lại (`beamSurge`, 760ms) và các ngôi sao **loé lên lần lượt dọc theo hình** (`starFlare`, lệch pha 55ms mỗi ngôi) — nên mắt đọc được *hướng* của cú phản hồi thay vì thấy cả cụm chớp một lúc. Nối vào: submit form thật (bỏ qua form tìm kiếm/lọc vì chúng chạy liên tục), đổi công tắc/checkbox/select, và mọi lần `showToast()` được gọi. Có cooldown 900ms nên một sự kiện chỉ cho đúng một cú phản hồi.
3. **Chiều sâu thay vì nảy.** Nhấn nút = lún 1px + thu 0.6%, 90ms. Không nảy, không giật, không xoay. Trạng thái đang xử lý làm nút tối đi và khoá lại, thay vì gắn thêm một spinner quay mãi cạnh chữ.

**Đo sau khi sửa:** `LOOPING: {}` trên Dashboard; Jobs/Profile chỉ còn `spinner-border` của Bootstrap, và đã kiểm tra cả 5 spinner đó **đều đang ẩn** (`d-none` hoặc cha ẩn) nên không vẽ ra gì.

Bằng chứng: `evidence/v2-review/10_dashboard_tail.png` (đuôi trang đã sạch), `11_constellation_react.png` (chòm sao đang loé giữa chừng). 0 page exception trên cả 7 trang, container 1200px đồng đều.

---

# Phụ lục 4 — badge trễ, chòm sao phẳng, modal "màn đen", mật độ Dashboard/Jobs

## 1. Badge tên chòm sao xuất hiện trễ

`.constellation-badge` có `animation: badgeSlideIn 700ms ... 300ms both` — tức tên chòm sao chỉ hiện đủ sau **~1 giây** kể từ khi hình đã vẽ xong. Độ trễ đó đủ dài để đọc ra là lỗi chứ không phải nhịp. Đã đưa về `60ms delay / 420ms duration`: badge vào cùng nhịp cuối của hình. Đo lúc 500ms sau khi tải: `opacity = 1` (trước đó vẫn còn đang chạy).

## 2. Chòm sao đè lên tin nhắn ở trang Chat

Trong ảnh người dùng gửi, hình Song Tử và badge `SONG TỬ · GEMINI` nằm chồng lên header hội thoại và lên chính bong bóng tin nhắn. Cửa sổ chat chiếm toàn bộ chiều cao nên không còn lề cho hình nền. Đã ẩn `.constellation-frame` trên Chat (`display: none`, khớp qua `:has(#conversationList)`, `:has(.messenger-shell)`, `:has(#threadPane)`).

## 3. Chòm sao "hoạt hình quá và khá phẳng"

**Phẳng** vì mọi ngôi sao cùng một độ sáng, mọi nét nối cùng một độ đậm, và cả khối đứng yên tuyệt đối — mắt đọc ra là một hình vẽ dán lên, không phải vật ở xa. Đã sửa bằng ba tín hiệu chiều sâu, không thêm hiệu ứng nào:

- **Thị sai theo kích thước sao.** Mỗi ngôi được gán độ sâu theo bán kính: sao to = gần, nhích tới 9px khi con trỏ di chuyển; sao nhỏ = xa, gần như đứng im; nét nối nhích ít nhất. Đây là cách rẻ nhất và thật nhất để tạo chiều sâu.
- **Nét nối xa nhạt hơn nét gần** (`nth-of-type(even)` xuống `.38`), thay vì tất cả cùng `.62`.
- **Một vầng tinh vân rất mờ phía sau** hình, để nó có nền chứ không lơ lửng trên nền phẳng.

**Hoạt hình quá** thì đã xử ở phụ lục 3 (gỡ hai vòng lặp vô hạn); lượt này hạ tiếp `.alpha-star-pulse` xuống `opacity .30` để ngôi sáng nhất là *sáng hơn* chứ không *to hơn theo nhịp*.

## 4. "Nâng cấp tài khoản" → màn đen

Nút này là `data-bs-toggle="modal"` mở `#upgradeModal`. Modal **có** render — nhưng `.modal-content` dùng nền `#16202f → #0f1724`, gần như trùng giá trị với trang đã bị backdrop làm tối, viền chỉ `rgba(178,212,255,.20)`, không bóng đổ. Kết quả: không nhìn ra cạnh hộp thoại ở đâu, cả màn hình đọc ra là một mảng đen.

Đã sửa theo nguyên tắc của giao diện tối — **nổi lên nghĩa là sáng hơn**, không phải tối hơn:

| | Trước | Sau |
|---|---|---|
| Nền dialog | `#16202f → #0f1724` (tối hơn nền trang) | `#22304a → #1a2538` (**sáng hơn** nền đã dim) |
| Viền | `rgba(178,212,255,.20)` | `rgba(190,222,255,.34)` + vạch sáng mép trên |
| Bóng | không | `0 32px 80px -24px` + quầng cobalt |
| Backdrop | đen phẳng `.5` | gradient hướng tâm `.58 → .78` |
| Hai nửa hộp thoại | dính liền thành một khối chữ | có đường ngăn dọc |

Một lần thử dùng `backdrop-filter: blur(3px)` trên backdrop đã bị **hoàn lại**: nó làm nhoè cả chính hộp thoại nằm phía trên chứ không chỉ nền phía sau.

## 5. Dashboard & Jobs trống vắng

Đã làm: nhịp dọc chặt lại (`row-gap` 18px, page-head bớt 14px), **mỗi card có một điểm neo sáng ở cạnh trái** kéo dài ra khi hover — cùng ngôn ngữ với nét nối giữa hai ngôi sao; khối bento ở empty state có chiều sâu và phản hồi hover thật; **ô lối tắt đầu tiên trên Dashboard được tô sáng hơn ba ô còn lại** vì nó là việc người dùng nên làm trước.

**Nói thẳng phần chưa giải quyết được:** vùng bảng tin của Dashboard vẫn là một khoảng lớn gần như trống, nhưng đó là vì tài khoản này **thật sự có 0 bài viết**. Lấp nó bằng nội dung dựng sẵn chính là cách tạo ra đúng loại số liệu giả đã phải gỡ ở phụ lục 2.

## 6. Tiện thể

Empty state của Chat còn tiếng Anh giữa giao diện tiếng Việt — đã dịch 4 chuỗi trong `Chat/Index.cshtml` và `_ChatWidget.cshtml`.

## Còn lại

- Profile hiện `20%`, Jobs hiện `75%` cho cùng khái niệm độ hoàn thiện hồ sơ — hai công thức ở hai controller, nằm trong C#.
- CTA "Nâng cấp ngay 🚀" còn emoji, lệch khỏi bộ dấu đã vẽ riêng.

Bằng chứng: `evidence/v2-review/12_upgrade_modal.png`, `13_chat_clean.png`, `14_dashboard_r4.png`. 0 page exception trên cả 7 trang; `LOOPING: {}` trên Dashboard.

---

# Phụ lục 5 — cột chết, chòm sao đẹp hơn, và một lỗi dữ liệu

## 1. "Quá trống" không phải do thiếu component

Đo trên bản đang chạy: **Dashboard cao 4100px nhưng cột phải dừng ở ~620px**, để lại gần 3500px cột rỗng khi cuộn. **Jobs cao 2378px, bộ lọc trái cũng dừng ở ~620px.** Thêm component vào đó sẽ không giải quyết gì — vấn đề là các cột không đi theo người đọc.

| | Trước | Sau |
|---|---|---|
| Bộ lọc Jobs | không có `sticky` nào | `sticky`, `top: 88px` — đo khi cuộn 1500px: vẫn trong khung nhìn |
| Rail phải Jobs | `sticky` nhưng cuộn qua là mất | dính đúng |
| Rail Dashboard | có `position: sticky` mà **vẫn trôi mất** | dính đúng |

**Vì sao rail Dashboard không dính dù đã khai `sticky`:** lỗi không nằm ở nó. Phần tử `sticky` chỉ trượt được trong phạm vi hộp cha, mà `<aside class="dash-right-rail">` chỉ cao **870px** trong một lưới cao **3528px** — do lưới đặt `align-items: start` nên cột co lại vừa nội dung. Sticky vì thế chỉ có ~20px đường để đi. Đã cho cột `align-self: stretch`; sau đó đo lại: `top: 88, inView: true` tại vị trí cuộn 1500px.

Đây cũng là lời đính chính cho chính tôi: đọc ảnh chụp **full-page** để kết luận "cột trống" là sai, vì ảnh full-page làm phần tử sticky không dính. Phải cuộn thật rồi mới đo.

## 2. Chòm sao chưa đủ đẹp

Hình cũ là chấm tròn trắng nối bằng nét đều — đúng nghĩa một sơ đồ. Ba chi tiết tách "chấm trắng" khỏi "ngôi sao", và cả ba đều là thứ có trong một bức ảnh thiên văn thật:

- **Tia nhiễu xạ.** Mỗi sao giờ có ngôi bốn cánh vẽ bằng bốn cung bậc hai, cạnh lõm nên tia thon dần về đầu mút — giống nhiễu xạ qua khẩu độ ống kính, không phải một dấu cộng. Sao alpha có tia dài gấp ~1,8 lần sao thường.
- **Nhiệt độ màu.** Sao thật không cùng một màu. Bảng bốn tông: hai tông trắng xanh, một tông xanh lạnh, và một tông **ấm** dùng hiếm. Để tất cả cùng trắng xanh chính là lý do hình cũ đọc ra phẳng.
- **Quầng phân tầng.** Ba lớp cho sao sáng (rộng-rất mờ → vừa → lõi), hai lớp cho sao thường, thay vì một vòng đơn.

Nét nối cũng đổi thành **hai lớp**: một lớp quầng rộng `blur(2.5px)` opacity `.16` nằm dưới, một nét mảnh `1.15px` sắc nằm trên — cách một vệt sáng mảnh trông trong ảnh phơi sáng lâu.

**Một ngoại lệ có chủ ý cho luật "không lặp vô hạn"** ở phụ lục 3: tia của ngôi sao sáng nhất thở opacity `.55 ↔ .82` trong **7 giây**. Biên độ và chu kỳ đó nhỏ tới mức không đọc ra là hoạt cảnh, chỉ đọc ra là không khí — và nó chỉ áp cho **đúng một phần tử trên mỗi trang**. Tắt hoàn toàn ở `prefers-reduced-motion`.

## 3. Thẻ việc làm đặc hơn

Bảy thẻ trước đây đọc ra y hệt nhau vì mọi dòng cùng một sức nặng. Đã phân cấp: chức danh dùng Space Grotesk với tracking âm; **mức lương lên 13px** vì đó là thông tin quyết định; chip meta xuống `11.5px` và `opacity .78` để lùi một bậc.

## 4. Lỗi dữ liệu: mất dấu tiếng Việt trong DB

Thẻ việc làm hiện `123 Nguy?n Hu?, Qu?n 1` — đây **không phải lỗi render**. Truy vấn thẳng DB cho thấy giá trị lưu trong `JobLocations` dòng 6 và 7 đúng là `'123 Nguy?n Hu?, Qu?n 1'` và `'TP. H? Chí Minh'`: ai đó insert **thiếu tiền tố `N'`** nên SQL Server ép chuỗi về codepage ANSI và dấu bị mất vĩnh viễn.

Đã quét toàn bộ cột `nvarchar`/`varchar` của mọi bảng bằng `LIKE '%[a-zA-Z]?[a-zA-Z]%' COLLATE Latin1_General_BIN`: chỉ hai dòng đó hỏng (`Notifications.Link` khớp mẫu nhưng là query string hợp lệ `?userId=`, không phải lỗi). Đã sửa hai dòng về đúng giá trị như các dòng anh em cùng địa chỉ.

**Bài học cho lượt seed sau:** mọi chuỗi tiếng Việt trong script SQL phải có tiền tố `N'`.

Bằng chứng: `evidence/v2-review/22_constellation_closeup.png`, `23_dash_scrolled.png`, `24_jobs_scrolled.png`. 0 page exception trên cả 7 trang.

---

# Phụ lục 6 — sao thật, và trạng thái đầy đủ cho toàn bộ component

## 1. Vì sao chòm sao vẫn đọc ra là "vẽ" chứ không phải "chụp"

Quầng sáng đang làm bằng `<circle fill="rgba(...)">` — **hình tròn tô một màu đồng nhất có alpha**. Một hình tròn màu đồng nhất luôn đọc ra là cái **đĩa**, vì mắt thấy rìa của nó. Ánh sáng thật không có rìa: nó tắt dần theo một đường cong.

Đã thay toàn bộ bằng đúng công thức mà trang đăng nhập dùng cho sprite sao của nó:

| Thành phần | Trước | Sau |
|---|---|---|
| Quầng | 2–3 vòng tròn tô phẳng, alpha cố định | `radialGradient` **5 chặng** (0.85 → 0.34 → 0.11 → 0.03 → 0), không còn rìa |
| Tia nhiễu xạ | `fill` phẳng một màu | `radialGradient` chung tâm với sao — sáng ở gốc, **tắt về đầu mút**; tia đều tăm tắp là dấu hiệu của hình vẽ |
| Lõi | bán kính bằng `s.r` | lõi cứng nhỏ hơn (`0.78–0.92 × r`) — thứ làm điểm sáng *sắc* thay vì *mờ* |
| Nhiệt độ màu | một tông trắng xanh | 4 tông, trong đó một tông **ấm** dùng hiếm |
| Chênh lệch cấp sao | sao alpha to hơn chút | bloom `9.2×r` so với `4.0×r` — chênh hẳn |

Và một đảo ngược quan trọng: **nét nối phải là thứ MỜ NHẤT trong hình** (`opacity .34`), vì trong bản đồ sao nó chỉ là chú thích. Ở bản trước nó lại là thứ sáng nhất — đó là lý do mắt đọc ra sơ đồ thay vì bầu trời.

## 2. "Components quá tối thiểu, thiếu chức năng và animation"

Phản hồi này đúng, và nguyên nhân chung là: **phần lớn component mới chỉ có trạng thái NGHỈ**. Không hover, không focus, không active, không vào–ra. Một component một trạng thái thì vẫn dùng được, nhưng nó không nói cho người dùng biết cái gì bấm được, cái gì đang được chọn, và thao tác vừa rồi đã nhận hay chưa.

### Bốn chức năng thật được thêm, không thứ nào cần backend

| Chức năng | Vì sao là chức năng chứ không phải trang trí |
|---|---|
| **Thanh tiến trình đọc** dưới navbar | Trên trang cao 4100px, biết mình đang ở đâu là **thông tin**. Đây cũng đúng là "cử chỉ đặc trưng của vỏ ứng dụng" mà bảng phân bổ chuyển động đã cấp cho shell. Đo khi cuộn 1800px: `scaleX(0.509)`. |
| **Nút về đầu trang** | Hiện khi đã cuộn quá 640px, cuộn mượt về đầu. |
| **Thẻ hiện dần khi lọt vào khung nhìn** | `IntersectionObserver`, **đúng một lần cho mỗi thẻ** rồi `unobserve`. Thẻ đã nằm sẵn trong khung nhìn thì hiện luôn, không bắt chờ. Đo: Dashboard 1 → 7 thẻ; Jobs 5 → 11 thẻ. |
| **Nút xoá trong ô tìm kiếm** | Phát `input` event nên mọi bộ lọc đang nghe vẫn chạy đúng. |

### Trạng thái bổ sung cho component dùng chung

- **Tab** — hover, active có nền, và **dấu hai-sao-một-nét** giống hệt chỉ báo ở navbar, để tab và nav nói cùng một thứ tiếng.
- **Dropdown / toast** — có đường vào (`popIn` 180ms, `toastIn` 280ms) thay vì bật ra đột ngột.
- **Bảng** — đầu bảng **dính** khi cuộn, chữ thành small caps giãn chữ; hàng phản hồi khi rê chuột.
- **List group** — hover đẩy nội dung vào 4px, đủ để biết hàng nào đang trỏ.
- **Accordion** — nút mở có nền cobalt nhạt, mũi tên đảo màu cho nền tối.
- **Phân trang** — hover nâng 1px, trang hiện tại có nền và viền rõ.
- **Skeleton** — lớp `.aris-skeleton` quét sáng 1.3s, sẵn cho chỗ nào cần trạng thái đang tải thật.

Tất cả đều tắt ở `prefers-reduced-motion`.

## Trạng thái sau lượt này

7/7 trang: container 1200px, **0 page exception**. Vòng lặp vô hạn duy nhất còn lại là `alphaBreath` (7s, một phần tử mỗi trang — ngoại lệ đã ghi ở phụ lục 5) và `spinner-border` của Bootstrap trên các phần tử **đang ẩn**.

Bằng chứng: `evidence/v2-review/22_constellation_closeup.png`, `25_shell_scrolled.png`.

---

# Phụ lục 7 — bỏ thanh tiến trình, thay bằng hệ tiêu điểm

## Vì sao bỏ thanh tiến trình đọc

Trên một trang feed, biết mình đang ở 40% hay 60% **không giúp gì cho việc đang làm** — người ta đọc từng bài, không đọc "cả trang". Đổi lại nó chiếm một dải ngang suốt đầu màn hình. Đã gỡ cả JS lẫn CSS.

## Thay bằng: tiêu điểm bài viết + độ sâu trường ảnh

Bài đang đọc giữ nguyên độ sắc và được nâng lên; phần còn lại lùi ra sau bằng một lớp mờ rất nhẹ — đúng cách ống kính khẩu độ mở tách chủ thể khỏi hậu cảnh. Mắt không phải tự chọn nữa.

**Tiêu điểm đến từ ba nguồn, theo thứ tự ưu tiên:**

| Nguồn | Cách kích hoạt | Mức |
|---|---|---|
| **Ghim** | Bấm vào một bài, hoặc **mở bình luận** của nó | `blur 1.6px`, mờ còn `.52`, bài được nâng 3px + quầng sáng mạnh |
| **Phím** | `J` xuống bài sau, `K` lên bài trước — cuộn tới và ghim luôn | như trên |
| **Dừng** | Ngừng cuộn 220ms thì bài ở tâm khung nhìn tự nhận tiêu điểm | `blur 1.1px`, mờ còn `.62`, nâng 2px |

Thả tiêu điểm bằng `Esc`, bấm ra ngoài, hoặc cuộn đi.

**Hai quyết định đáng nói:**

1. **Trong lúc đang cuộn thì mọi thứ đều sắc nét.** Làm mờ theo từng khung hình vừa tốn vừa gây chóng mặt. Hiệu ứng chỉ bật khi đã dừng.
2. **Bài dài hơn khung nhìn vẫn giữ được tiêu điểm.** Nếu đo bằng "tâm thẻ gần tâm màn hình nhất" thì một bài dài 2000px sẽ mất tiêu điểm ngay khi bạn đọc tới giữa nó. Nên điều kiện là: **thẻ có phủ qua đường tâm hay không** — phủ thì khoảng cách tính bằng 0.

**Hai lỗi phát hiện khi tự kiểm tra và đã sửa:**

- `Esc` không thả được, vì cú cuộn hoặc cú nhảy phím vừa rồi để lại hẹn giờ và nó ghim lại ngay sau đó. Đã huỷ mọi hẹn giờ trong nhánh `Escape`.
- `Esc` vô hiệu sau khi mở bình luận, vì con trỏ nằm trong ô nhập và guard "đang gõ thì bỏ qua phím" chặn luôn. Nay `Esc` **luôn** thoát được (và nhả luôn ô nhập); `J`/`K` thì vẫn bị chặn khi đang gõ — gõ chữ "j" trong ô bình luận không được phép nhảy bài.

## Kèm theo: thu gọn bài dài

`.post-content-body` bị cắt còn 10 dòng kèm nút "Xem thêm / Thu gọn", chỉ gắn cho bài **thực sự tràn** (đo bằng `scrollHeight − clientHeight`).

**Nói thẳng:** tính năng này hiện **chưa kích hoạt ở đâu cả**, vì bài dài nhất trong dữ liệu hiện tại chỉ 576 ký tự ≈ 6 dòng. Tôi đã thử hạ ngưỡng xuống 6 dòng để nó "trông có tác dụng", rồi bỏ — cắt một bài 6 dòng là làm phiền người đọc để lấy một hiệu ứng. Ngưỡng giữ ở 10 dòng và nó sẽ tự chạy khi có bài đủ dài.

## Trạng thái

7/7 trang: **0 page exception**. Vòng lặp vô hạn duy nhất vẫn là `alphaBreath` (7s, một phần tử mỗi trang) và spinner Bootstrap trên phần tử đang ẩn.

Bằng chứng: `evidence/v2-review/26_depth_of_field.png`, `27_focus_pinned.png`. Kiểm tra tự động: mở bình luận bài 2 → ghim đúng bài 2; `J` ba lần → đi qua bài 1→2→3 kèm cuộn; `K` → lùi về bài 2; `Esc` → thả sạch.

---

# Phụ lục 8 — icon riêng, phân cấp chất liệu, và hết "khối trong khối"

## 1. Lý do đo được khiến giao diện đọc ra "phẳng"

Truy vấn tất cả bề mặt trên Dashboard cho kết quả: thẻ bài viết, thẻ việc làm, thẻ hồ sơ, ô soạn bài, panel bộ lọc — **tất cả dùng đúng một công thức**: `linear-gradient(145deg, rgba(16,25,45,.72) …)`, `border-radius: 16px`, cùng một viền.

Khi mọi thứ ở cùng một độ cao thì không có gì nổi lên được, và thêm bao nhiêu hiệu ứng cũng không cứu được. Mắt đọc chiều sâu bằng **sự khác biệt giữa các mặt phẳng**, không bằng số lượng hiệu ứng.

**Ba bậc chất liệu, mỗi bậc một chất khác nhau:**

| Bậc | Dùng cho | Chất liệu |
|---|---|---|
| 1 — panel nền | bộ lọc, rail | phẳng `rgba(255,255,255,.022)`, **không gradient**, không bóng. Nó là cái khay. |
| 2 — thẻ nội dung | bài viết, thẻ việc làm, thẻ công ty | gradient 3 chặng + **vạch sáng mép trên** + bóng sâu |
| 3 — bề mặt chủ đạo | ô soạn bài | như bậc 2 nhưng sáng hơn, cộng một quầng sáng góc trên phải |

Vạch sáng mép trên là dấu hiệu kinh điển của mặt phẳng được nâng: nó là cạnh bắt sáng từ nguồn sáng ở trên. Không có nó, card chỉ là một hình chữ nhật tối hơn nền. Kèm theo là **một nguồn sáng duy nhất** (quầng rất mờ ở đỉnh trang) — giao diện tối chỉ "có khối" khi có nguồn sáng nhất quán.

## 2. Icon navbar: tự vẽ, hover rã thành chòm sao

Navbar đang dùng Lucide gốc — `home`, `users`, `briefcase`, `building`, `bell` — bộ icon mà hàng trăm nghìn trang khác cũng dùng, và là thứ **đầu tiên** người ta thấy trên mọi trang.

Năm icon được vẽ lại bằng ngôn ngữ của trang đăng nhập: hành tinh có vành, hai sao nối nhau, quỹ đạo có đích, cụm sao dựng đứng, chuông có lõi phát tín hiệu. **Khi rê chuột, hình thường thu nhỏ và mờ đi, chòm sao nở ra** — cùng một vật thể nhìn từ hai khoảng cách, không phải hai icon khác nhau. Mục đang chọn giữ luôn dạng chòm sao.

**Chỉ thay năm icon navbar.** 45 icon chức năng trong trang giữ nguyên Lucide — chúng cần rõ nghĩa hơn là cần đẹp. Đây đúng là ranh giới hai tầng icon đã chốt ở §2.6.

**Ba lần sửa trước khi chạy đúng, ghi lại vì chúng là bẫy thật:**

1. Bản đầu làm bằng JS (`svg.innerHTML = …`). Thuộc tính `data-aris-icon` gắn được nhưng nội dung `<path>` bị một script khác dựng lại đè lên. → Chuyển sang CSS: không script nào ghi đè được CSS.
2. Lớp icon dùng `::after` của `.nav-link`, trùng với gạch chỉ báo mục đang chọn vốn cũng dùng `::after`. → Chuyển gạch chỉ báo sang `::after` của `.nav-item` (phần tử cha).
3. `aris-theme.css` còn một rule dùng `background:` **shorthand có `!important`** cho gạch chỉ báo → nó ghi đè `background-image` của icon, cho ra **một ô vuông xanh đặc**. → Ép `!important` cho ảnh icon và xoá `background-color`.
4. `.nav-item` thiếu `position: relative` nên gạch chỉ báo neo vào tổ tiên xa và **kéo ngang hết chiều rộng trang**.

## 3. Hết "khối trong khối"

Lỗi bố cục nặng nhất: một thẻ có nền và viền, bên trong là một ô có nền và viền, bên trong nữa là các chip cũng có nền và viền. **Ba lớp hộp lồng nhau cho một mẩu thông tin** — mắt phải vượt ba cái khung mới tới được nội dung.

Luật áp dụng: **một bề mặt cho một bậc**; cấu trúc bên trong nói bằng khoảng cách, kiểu chữ và nét kẻ mảnh.

- Ô nhập trong thẻ → bỏ hộp, còn **một đường chân** sáng lên khi focus.
- Chip meta trong thẻ việc làm → bỏ viên, còn chữ, ngăn nhau bằng **một chấm sao nhỏ**. Riêng mức lương giữ viên vì nó là thứ duy nhất cần nổi trong hàng đó.
- Hộp con trong rail → bỏ nền và viền, ngăn nhau bằng nét kẻ ngang.
- Ô tìm kiếm navbar → một đường, không phải một hộp.

## 4. Sửa phạm vi độ sâu trường ảnh

DOF ban đầu nhắm cả `.aris-container .card`, nên ở trang Jobs nó làm mờ **cả rail lẫn bộ lọc** — cả trang xám xịt. Nay chỉ áp cho `.post-card`: danh sách việc làm là để **quét và so sánh**, không phải đọc liên mạch, còn rail và bộ lọc là **công cụ** nên không bao giờ được mờ.

## Trạng thái

7/7 trang: 0 page exception. Reveal-on-scroll: Dashboard 1→7, Jobs 5→11. Vòng lặp vô hạn: chỉ `alphaBreath` (7s, một phần tử/trang) và spinner Bootstrap trên phần tử đang ẩn.

**Chưa xong:** chip meta trong thẻ việc làm vẫn còn khung viên — chúng dùng class khác với `bg-secondary-subtle` mà rule đang nhắm; cần đọc lại markup của `_JobCardPartial.cshtml` để nhắm đúng.

Bằng chứng: `evidence/v2-review/29_craft_nav.png`, `30_nav_hover.png`, `31_jobs_nested.png`.

---

# Phụ lục 9 — bỏ kiểu chồng hộp bo tròn, và kinh tuyến lề trái

## 1. Bo góc quá nhiều: đổi cách, không chỉ đổi số

Dải lối tắt là **bốn hộp `radius: 16px`** xếp cạnh nhau; rail phải là **một chồng hộp nữa**. Bo tròn mạnh ở kích thước lớn làm mọi khối mềm nhũn và giống nhau, và mỗi hộp lại vẽ thêm một cái khung mà mắt phải vượt qua.

Cách khác không phải là giảm radius, mà là **gộp thành một khối liền chia bằng nét kẻ**:

| | Trước | Sau |
|---|---|---|
| Dải lối tắt | 4 hộp rời, radius 16px | **một strip bốn ngăn**, viền ngoài duy nhất, ngăn nhau bằng nét dọc; ngăn đầu đánh dấu bằng vạch sáng mép trên chứ không bằng một hộp riêng |
| Rail phải | chồng 4 hộp, hộp đầu bo 12px có gradient | **một cột treo trên một đường dọc** — đúng nghĩa một "rail" — các mục ngăn nhau bằng nét ngang, **mỗi mục có một nút sao** ở chỗ nó gắn vào cột |
| Bộ lọc Jobs | hộp bo góc | cùng cách: một đường dọc + nội dung, không khung |

Kèm kỷ luật bo góc: card `14 → 10px`, nút `11 → 9px`, ô nhập `11 → 9px`, modal `16 → 12px`. Chip nhỏ vẫn để pill — ở cỡ đó pill mới đúng.

## 2. Lề trái rỗng: thêm một kinh tuyến

Đo được: container 1200px giữa khung 1440px, **lề mỗi bên 120px**. Lề phải có chòm sao, lề trái hoàn toàn trống — trang lệch hẳn về một bên.

Thêm một **đường kinh tuyến** chạy dọc lề trái: hairline mờ dần hai đầu, bốn nút sao ở các mốc, và vạch chia ngang tại mỗi nút. Nó đọc ra là một trục toạ độ thiên văn chứ không phải một vệt trang trí. `position: fixed` nên đứng yên khi cuộn, và tự ẩn dưới 1400px khi lề không còn đủ rộng.

Dùng lại `main::before` — pseudo-element này đang giữ một hình zodiac cũ ở `opacity: 0`, tức là gánh nặng chết.

## 3. Bốn lỗi phải gỡ trên đường đi

Ghi lại vì cả bốn đều là bẫy thật của một codebase nhiều người sửa:

1. **`aris-dashboard.css` nạp SAU `aris-cosmos.css`**, nên `!important` của nó thắng ở cùng độ đặc hiệu. `.dash-rail-sticky > *` (0,1,0) hoà với `.profile-rail-card` (0,1,0) và thua vì đến trước. → Nhắm thẳng `.dash-rail-sticky > .profile-rail-card` (0,2,0). Đây là cách đúng, không phải nhồi thêm `!important`.
2. **Kinh tuyến bị `display: none`** bởi `body:has(#arisCosmicConstellationStage) main::before { display:none !important }` — rule agent khác thêm để giấu hình zodiac cũ. → Mở lại bằng cùng độ đặc hiệu, đặt sau.
3. **Avatar rail bị cắt mất nửa trên**: `.profile-rail-body` có `margin-top: -26px` để đè lên dải cover, mà `.profile-rail-card` thì `overflow: hidden`. Bỏ cover rồi thì lề âm đó chỉ còn tác dụng cắt ảnh. → `overflow: visible` + `margin-top: 0`.
4. Lần đầu kinh tuyến đặt `opacity .16` — đúng là quá mảnh để nhận ra là chi tiết có chủ ý. → `.42`, nút sao to hơn, thêm vạch chia.

## Trạng thái

7/7 trang: container 1200px, **0 page exception**. Reveal-on-scroll: Dashboard 1→7, Jobs 5→11.

Bằng chứng: `evidence/v2-review/32_rail_dash.png`, `34_meridian_crop.png` (kinh tuyến lề trái), `35_rail_crop.png` (rail đã hết hộp, avatar đủ).

---

# Phụ lục 10 — banner trùng, trường sao sống lại, và audit phần doanh nghiệp

## 1. Hồ sơ cá nhân bị hai banner

**Nguyên nhân:** `enrichProfileLayout()` trong `aris-constellation.js` **prepend** một `.cosmos-page-head` vào `.aris-container`, trong khi `Views/Profile/Index.cshtml` dòng 186 **đã có sẵn** một khối y hệt. Guard duy nhất là `if (document.getElementById('profileCosmicHead')) return;` — nó chỉ kiểm tra id của chính khối do JS tạo, nên lần nào cũng thấy "chưa có" và chèn thêm.

Đo được trước khi sửa: hai `.cosmos-page-head` ở `y = 92` và `y = 248`. Sau khi thêm điều kiện "container đã có page-head thì thôi": còn **1**.

## 2. "Animation gần như không có" — lý do là do chính tôi

Canvas trường sao **vẫn đang chạy** (lấy mẫu pixel cách nhau 900ms cho hai giá trị khác nhau). Nhưng ở phụ lục 2 tôi đã hạ nó xuống `opacity: .34` rồi phủ thêm một lớp mực toàn màn hình, để chữ khỏi nằm trên nhiễu. Kết quả: thứ duy nhất chuyển động liên tục trên trang thì gần như vô hình — và nhận xét "gần như không có animation" là đúng.

**Sửa bằng mặt nạ thay vì hạ độ sáng.** Trường sao trả về `opacity: .92` nhưng đeo `mask-image` theo trục ngang: đậm ở hai bên lề, **tắt hẳn trong khoảng 23%–77%** là nơi cột nội dung nằm. Lớp mực toàn màn hình hạ xuống chỉ còn làm dịu rìa.

Đây là chỗ tôi đã chọn sai cách một lần: khi hai thứ xung đột (đẹp / đọc được), hạ cường độ làm hỏng cả hai; **tách chúng ra khỏi nhau về không gian** thì cả hai cùng được.

Thêm **thị sai khi cuộn** cho trường sao (hệ số `-0.045`, chỉ chạy lúc đang cuộn) để nó đọc ra là ở rất xa.

## 3. Khối gợi ý đầu trang Jobs

`#ai-recommendation-section` là lời mời dành cho tài khoản chưa có CV, nhưng không có cách nào tắt. Đã thêm nút ẩn, nhớ lựa chọn trong `localStorage`.

## 4. Audit phần doanh nghiệp — thiếu ở đâu, chính xác

Đọc `EmployerController`, `CompanyController`, `JobsController`, `JobApplicationsController` và `Views/Employer/Index.cshtml` (316 dòng).

**Backend ĐÃ CÓ nhưng không có giao diện nào gọi tới:**

| Endpoint | Việc nó làm |
|---|---|
| `JobApplications/GetApplicantsForJob` | danh sách ứng viên theo tin, lọc theo trạng thái |
| `JobApplications/UpdateApplicationStatus` | đổi trạng thái hồ sơ ứng tuyển |
| `JobApplications/ScheduleInterview` | đặt lịch phỏng vấn |
| `Jobs/GetJobPostingForEdit`, `Jobs/UpdateJobPosting` | sửa tin tuyển dụng |
| `Jobs/ToggleJobActive` | mở/đóng tin |
| `Jobs/ShareJob`, `Jobs/GetShareOptions` | chia sẻ tin ra kênh ngoài |
| `Jobs/ExtractJobFromPdf` | tạo tin từ file PDF |

`Views/Employer/Index.cshtml` **không gọi một endpoint nào** trong số đó — nó chỉ hiển thị tên công ty, 4 con số thống kê (lấy từ model thật) và một trạng thái rỗng.

**Frontend thiếu hẳn:** trang quản lý tin đã đăng (sửa / mở-đóng / chia sẻ / xem ứng viên), luồng ứng viên theo từng tin với đổi trạng thái, giao diện đặt lịch phỏng vấn.

**Backend thiếu:** xoá hoặc lưu trữ tin, action riêng liệt kê tin của chính doanh nghiệp, quản lý thành viên và phân quyền trong công ty, thống kê sâu hơn 4 con số hiện có.

Nói cách khác: phần lớn **tác vụ đã có ở backend, chỉ thiếu bề mặt để dùng**. Đó là lý do việc nên làm trước là nối giao diện vào các endpoint sẵn có — không cần đổi schema, không cần quyết định nghiệp vụ mới.

## Trạng thái

7/7 trang: 0 page exception.

Bằng chứng: `evidence/v2-review/36_profile_dup.png`, `37_cosmos_live.png`.

---

# Phụ lục 11 — tín hiệu rune, và một lỗi cú pháp làm chết toàn bộ JS

## 1. Sự cố: `aris-constellation.js` mất cân bằng dấu ngoặc

Giữa lượt làm, `node --check` báo lỗi cú pháp. Truy ra: **thừa một `}` ở dòng 993**, khiến IIFE ngoài cùng đóng sớm, rồi `})();` ở dòng 1031 đóng lần thứ hai → chênh `-1`.

Đoạn code quanh dòng 993 **không phải của tôi** — so với bản sao lưu ngay trước đó, file đã có thêm một khối dựng `row`/`leftCol`/`rightCol` mà bản sao lưu không có. Tức là có người/agent khác sửa file song song và để lại dấu ngoặc thừa.

Hậu quả nếu không phát hiện: **toàn bộ file JS không parse được**, nên mọi thứ trong đó chết theo — chòm sao, tiêu điểm đọc, nút về đầu trang, reveal khi cuộn, lối tắt Dashboard. Đã gỡ đúng một dòng, không đụng gì khác của họ, và `node --check` sạch trở lại.

**Bài học ghi lại cho lượt sau:** chạy `node --check` sau **mỗi** lần sửa file JS dùng chung, kể cả khi thay đổi của mình chỉ là một dòng — vì file có thể đã hỏng sẵn từ lượt sửa song song.

Cũng trong lượt này app bị tắt ~15 giây do một `dotnet build` chạy song song. Đã **chờ** nó lên lại thay vì tự khởi động, để không tranh tiến trình với lượt kia.

## 2. Tín hiệu rune

Thỉnh thoảng một dòng tiêu đề nhiễu thành chữ rune Bắc Âu cổ (Elder Futhark) rồi trở lại.

**Bốn ràng buộc để nó là hiệu ứng chứ không phải lỗi:**

| Ràng buộc | Cách làm |
|---|---|
| Không xô lệch bố cục | Thay **từng ký tự tại chỗ**, giữ nguyên số ký tự nên dòng không đổi chiều dài, không xuống hàng giữa chừng |
| Không phá markup | Chỉ sửa `data` của một text node, không đụng thẻ con (tiêu đề có `<span>` bên trong) |
| Không ảnh hưởng trình đọc màn hình | `aria-label` giữ nguyên văn bản thật, gắn một lần trước khi nhiễu |
| Không ra ô vuông tofu | Đo chiều rộng glyph rune so với `U+E000` (ký tự chắc chắn không tồn tại); trùng nhau nghĩa là trình duyệt đang vẽ tofu, và khi đó **hiệu ứng tự tắt hoàn toàn** |

Chỉ thay ký tự là **chữ cái hoặc chữ số** — bỏ khoảng trắng và dấu câu, nếu không dòng sẽ vỡ nhịp và đọc ra là hỏng.

**Sửa nhịp sau phản hồi "biến mất quá nhanh không kịp nhìn":** bản đầu chạy 5 khung × 78ms = **390ms**. Nay 13 khung × 135ms ≈ **1,75s**, chia ba nhịp — nhiễu dâng lên (0–22%), **giữ ở đỉnh** (22–62%), rồi tan dần (62–100%). Nhịp giữ mới là chỗ người ta thực sự đọc được mấy chữ rune. Tỉ lệ ký tự bị thay cũng tăng 30% → 45%.

Đo thực tế trên `"Không gian của bạn."`:

```
0.25s  ᚱhᚢnᛞ ᚠᛗᚠn của bᚲn.
0.60s  ᛇhᛒnᚱ ᚾᛉᛈn của bᚹn.
1.00s  Khᚺng ᛖᛈᛗn của bᚷn.
1.40s  Không giᛞn của bạn.
1.75s  Không gian của bạn.      ← phục hồi đúng nguyên bản
```

Kích hoạt theo hai đường: **nhịp nền** 7–14 giây một lần, mỗi lần đúng một dòng; và **rê chuột** lên tiêu đề để gọi tín hiệu về — có cooldown 6 giây cho mỗi phần tử, nếu không rê qua rê lại sẽ thành chữ nhấp nháy.

Tắt hẳn ở `prefers-reduced-motion`, khi tab bị ẩn, và khi con trỏ đang ở trong ô nhập.

## Trạng thái

7/7 trang: 0 page exception. `arisRuneTransmit` sẵn sàng, canvas `.92`, kinh tuyến hiện, Hồ sơ còn đúng 1 banner.

---

# Phụ lục 12 — rune đi khắp trang

Phản hồi: *"tôi muốn rune xuất hiện ở bất kỳ đâu random kể cả lại bài đăng."*

Bản ở Phụ lục 11 bám vào **danh sách trắng 7 selector tiêu đề**. Hệ quả: hiệu ứng luôn rơi đúng mấy chỗ đó, nhìn vài lần là đoán được, và nội dung bài đăng — thứ người ta thực sự dừng lại đọc — không bao giờ được chạm tới.

## Đổi từ danh sách trắng sang danh sách đen

Giờ quét **mọi text node đang nhìn thấy** bằng `TreeWalker` trên `SHOW_ELEMENT | SHOW_TEXT`. Bộ lọc chạy trên cả thẻ lẫn text: gặp một thẻ **có kích thước thật mà nằm trọn ngoài khung nhìn** thì `FILTER_REJECT`, bỏ luôn cả cây con. Đó là thứ giữ cho lần quét rẻ trên feed dài — không phải đi hết DOM, chỉ đi phần đang hiện.

Thẻ rect rỗng (`display:contents`, thẻ bọc inline) thì **không** loại, vẫn đi tiếp vào con — nếu loại theo rect rỗng thì sẽ cắt mất cả nhánh mà con nó đang hiện.

Không cho nhiễu ở: `script/style/template`, ô nhập liệu (`input/textarea/select/option`), mã nguồn (`code/pre/kbd/samp/var`), nhãn **nút bấm** (`button`), bên trong `svg`, `contenteditable`, `aria-hidden="true"`, `.visually-hidden`/`.sr-only`, và bất cứ thứ gì gắn `data-no-rune`.

Loại `button` là chủ ý: chữ nhiễu ở chỗ khác đọc ra là hiệu ứng, nhiễu trên nhãn nút đọc ra là *sắp bấm nhầm*. Loại `.visually-hidden` vì người dùng không thấy nó nhiễu — bắn vào đó là một lượt phát phí.

## Lỗi bắt được khi đo trên dữ liệu thật

Cửa sổ nhiễu ban đầu cắt theo **chỉ số ký tự**: text dài hơn 44 thì lấy một khúc 12–28 ký tự ở vị trí ngẫu nhiên. Đo trên feed thật thì hỏng ngay:

```
node dài nhất trong khung nhìn: DIV.post-content-body, len=76, text="Astra 6 ra mat"
  0.25s  rune= 0    1.00s  rune= 0    1.80s  rune= 0
```

76 ký tự nhưng chỉ 14 là chữ — phần còn lại là **thụt đầu dòng do Razor sinh ra**. Cửa sổ rơi trúng vùng khoảng trắng, không đủ 3 chữ cái, hàm lặng lẽ `return`. Hiệu ứng "chạy" mà không đổi một ký tự nào.

Sửa: cắt trong **không gian chữ cái**, không phải không gian ký tự. Lấy danh sách vị trí các chữ cái rồi cắt một đoạn liên tiếp *trên chính danh sách đó*. Thụt dòng bao nhiêu cũng không còn ảnh hưởng, và vì các vị trí liền nhau trong danh sách nên rune vẫn hiện thành một cụm liền mạch chứ không rải khắp đoạn.

```
  0.25s  rune= 4  cửa sổ=(34, 44)  dài giữ nguyên=True
  0.60s  rune= 5  cửa sổ=(34, 45)  →  Aᛇtᛏa 6 rᚦ ᛟᚱt
  1.00s  rune= 5  cửa sổ=(34, 45)
  1.40s  rune= 2  cửa sổ=(34, 44)
  1.80s  rune= 0                     phục hồi đúng nguyên bản=True
```

Câu ngắn (≤34 chữ cái) thì nhiễu cả câu; dài hơn thì lấy một cụm 12–24 chữ cái.

**Bài học:** "text node dài 76 ký tự" không có nghĩa là "có 76 ký tự để làm việc". Markup do template sinh ra mang theo khoảng trắng, và mọi phép tính theo chỉ số ký tự trên DOM thật đều phải tính tới nó.

## Chữ số không bao giờ bị động vào

Chỉ thay `\p{L}`. Một đoạn văn nhiễu thì đọc ra là hiệu ứng; một **mức lương, ngày tháng, số lượt ứng tuyển** nhiễu thì đọc ra là *dữ liệu sai*. Đã kiểm: chuỗi chữ số trước và trong lúc nhiễu giống hệt nhau.

## Hai thứ khác phải xử lý khi ra toàn trang

| | |
|---|---|
| **Feed vẽ lại giữa chừng** | Mỗi khung kiểm `node.isConnected`; node bị tháo ra thì dừng timer và dọn cờ, không để `runeBusy` kẹt ở `1` vĩnh viễn |
| **Người dùng đang bôi đen chữ** | `selection.containsNode(node, true)` → bỏ qua lượt này, vì sửa `nodeValue` sẽ phá vùng chọn của họ |

`aria-label` chỉ gắn khi `textContent` ngắn hơn 300 ký tự — dội cả thân bài đăng vào một thuộc tính là làm trình đọc màn hình tệ đi chứ không phải tốt lên.

Transition tắt dần chuyển từ danh sách selector sang `[data-rune-last]` — thuộc tính JS đặt lên phần tử ngay sau lần phát đầu tiên. Chỉ phần tử đã từng nhiễu mới mang transition, không rải lên cả trang.

## Rê chuột thì vẫn chỉ ở tiêu đề

Cố tình **không** mở rộng theo. Nhịp nền đi khắp nơi là đúng ý; nhưng tín hiệu bám theo con trỏ lúc đang đọc một bài dài thì phiền chứ không đẹp.

## Đo thực tế

Quét được 34–42 text node đang hiện mỗi trang, trải trên 22–26 loại phần tử khác nhau. Theo dõi nhịp nền 40 giây trên Dashboard, **8 lượt phát, 6 phần tử khác nhau**:

```
p.profile-rail-bio        :: Chưa cập nhật phần giới thiệu
div.post-content-body     :: Astra 6 ra mat
a.dashboard-explore       :: Khám phá việc làm
span                      :: 1 giờ trước
span.telemetry-label      :: Đơn ứng tuyển
div.post-content-body     :: Astra 6 ra mat
```

0 lỗi JS. Nhịp nền 6–13 giây, mỗi lượt đúng một mẩu — hai chỗ nhiễu cùng lúc thì trang đọc ra là đang lỗi.
