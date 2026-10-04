# Brief theo từng bề mặt — chỉ mục và phát hiện toàn cục

Đo ngày 18/09/2026 trên `ArisSkyve/Views` (31 file `.cshtml`, 11.581 dòng) và `wwwroot/css`. Mọi con số dưới đây đếm trực tiếp từ source, không ước lượng. Đây là phần chi tiết của [AGY-INSTRUCTION-WORLD-CLASS.md](../AGY-INSTRUCTION-WORLD-CLASS.md); đọc file đó trước để biết yêu cầu và cách chấm.

**Nhắc lại khung chấm:** mọi thứ trong bộ brief này là **mức tối thiểu**. Làm hết mà nhìn vẫn tầm thường thì vẫn là chưa đạt.

## Bảng đo toàn bộ view

| View | Dòng | CSS nhúng | `transition` | `:hover` | `:focus-visible` | hex cứng | token | `style=""` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `Chat/Index` | 1.770 | 702 | 3 | 10 | **0** | 38 | 34 | 20 |
| `Jobs/Index` | 1.671 | 111 | **1** | 3 | **0** | 6 | 12 | **59** |
| `Dashboard/Index` | 1.443 | 699 | 12 | 10 | **0** | 36 | 105 | 48 |
| `Profile/Index` | 917 | 99 | 3 | 2 | **0** | 18 | 5 | **63** |
| `Shared/_ChatWidget` | 911 | 446 | 2 | 6 | **0** | 40 | **0** | 6 |
| `Jobs/Details` | 603 | 136 | 1 | 1 | **0** | 7 | 14 | 15 |
| `Shared/_AuthLayout` | 603 | 509 | 8 | 6 | **0** | 42 | 35 | 3 |
| `Account/NewUserInfor` | 497 | 110 | 2 | **0** | **0** | 6 | 12 | 1 |
| `Interview/Room` | 417 | 171 | 1 | 2 | **0** | 14 | **0** | 0 |
| `Employer/Index` | 319 | 8 | **0** | 2 | **0** | 10 | 1 | 39 |
| `Settings/Index` | 265 | **0** | **0** | **0** | **0** | 0 | **0** | 14 |
| `Company/Details` | 238 | 4 | **0** | 1 | **0** | 1 | 1 | 23 |
| `Company/Edit` | 210 | **0** | **0** | **0** | **0** | 0 | **0** | 13 |
| `Company/Index` | 191 | 12 | 1 | 2 | **0** | 4 | 1 | 18 |
| `AppNavbar/Default` | 191 | **0** | **0** | **0** | **0** | 0 | 3 | 6 |
| `Jobs/_JobCardPartial` | 178 | 77 | 3 | 3 | **0** | 5 | 6 | 10 |
| `Account/Login` | 160 | **0** | **0** | **0** | **0** | 16 | **0** | 9 |
| `Account/Register` | 160 | **0** | **0** | **0** | **0** | 16 | **0** | 9 |
| **Tổng 31 view** | **11.581** | **3.268** | **41** | **53** | **0** | **270** | **244** | **401** |

## Bảy lỗi hệ thống — sửa một lần, mọi trang hưởng

1. **`:focus-visible` xuất hiện đúng 0 lần** trong toàn bộ view *và* trong `aris-theme.css`, `aris-tokens.css`, `site.css`. Nghĩa là người dùng bàn phím đang đi trong bóng tối, chỉ còn outline mặc định của trình duyệt ở những chỗ chưa bị ghi đè. Đây vừa là lỗi a11y vừa là dấu hiệu rõ nhất của giao diện chưa được chăm.
2. **`skeleton` xuất hiện 0 lần.** Không có một trạng thái tải nào được thiết kế; chỗ nào có tải thì dùng `spinner-border` của Bootstrap (61 lần). Không có skeleton thì không thể nói tới "loading đẹp".
3. **401 thuộc tính `style=""` viết thẳng trong markup** — nặng nhất ở `Profile/Index` (63), `Jobs/Index` (59), `Dashboard/Index` (48), `Employer/Index` (39). Đây là lý do không surface nào sửa được tập trung.
4. **270 mã hex cứng so với 244 lần dùng token**, mà 105 lần dùng token nằm gọn ở Dashboard. `_ChatWidget` 911 dòng dùng **0** token và 40 hex cứng; `Interview/Room` 0 token, 14 hex.
5. **118 lần `font-size: Npx`** rải khắp → không có thang chữ. Giao diện đắt tiền bắt đầu từ thang chữ có logic, không phải từ màu.
6. **47 thẻ `<img>` nhưng chỉ 17 `alt=` và 2 `loading="lazy"`.** Ảnh không lazy và không đặt kích thước là nguyên nhân trực tiếp của nhảy layout khi cuộn — thứ phá cảm giác cao cấp nhanh nhất.
7. **`_AppLayout.cshtml` nạp `lucide@latest` từ unpkg**: phụ thuộc runtime bên thứ ba, không ghim phiên bản, và `lucide.createIcons()` chỉ chạy một lần lúc `DOMContentLoaded` — nội dung nạp động sau đó sẽ mất icon. Đưa về asset cục bộ trong `wwwroot`, ghim phiên bản, và gọi lại sau mỗi lần render động.

Điểm cộng đang có, giữ lấy: `aris-tokens.css` đã có thang màu/khoảng cách/thời lượng tử tế, và `@media (prefers-reduced-motion: reduce)` đã có ở cả token lẫn theme. Vấn đề là chưa trang nào dùng nghiêm túc ngoài Dashboard.

## Luật phân bổ chuyển động — không dùng một loại quá nhiều lần

Đây là luật bắt buộc, không phải gợi ý. Lỗi kinh điển của các lượt trước là chọn một hiệu ứng (fade-up, stagger) rồi rải lên mọi thứ; kết quả là trang nào cũng "có animation" mà tổng thể vẫn nhạt, vì mắt học xong hiệu ứng đó trong ba giây rồi thôi.

**Tách làm hai tầng, đối xử ngược nhau:**

| Tầng | Nguyên tắc | Ví dụ |
|---|---|---|
| **Vi tương tác** (hover, focus, nhấn, bật/tắt, toast) | **Phải giống hệt nhau toàn app.** Đây là ngữ pháp, khác nhau là lỗi. | nâng 2px + đổi bóng khi hover card; focus ring; nhịp nhấn nút |
| **Cử chỉ đặc trưng** (chuyển động lớn định nghĩa một màn) | **Mỗi surface đúng một cái, và không trùng với surface khác.** | xem bảng dưới |

**Bảng phân bổ — mỗi dòng một cử chỉ, không được dùng lại ở dòng khác:**

| Surface | Cử chỉ đặc trưng duy nhất |
|---|---|
| Vỏ ứng dụng | thanh tiến trình điều hướng mảnh dưới navbar |
| Dashboard | hero vẽ cung quỹ đạo theo dữ liệu thật của người đang xem |
| Jobs | card mở rộng thành trang chi tiết, giữ điểm neo (shared element) |
| Profile | các lớp hồ sơ tách chiều sâu khi cuộn |
| Chat | tin nhắn trượt theo hướng người gửi + nhịp "đang gõ" |
| Employer | phễu tuyển dụng đổ đầy theo thứ tự giai đoạn |
| Settings | công tắc lưu tại chỗ, xác nhận ngay trong hàng |
| Company | logo "đóng dấu" lên cover khi thẻ vào khung |
| Interview Room | **gần như không chuyển động** — chỉ nhịp trạng thái kết nối |
| CV & Hồ sơ ứng tuyển | chip trạng thái di chuyển dọc đường tiến trình |
| Onboarding | đường nối giữa các bước được vẽ dần |

**Ba quy tắc kèm theo:**

1. **Một màn hình, một cử chỉ lớn.** Nếu một trang có hai thứ cùng đòi chú ý, ít nhất một trong hai đang thừa.
2. **Không stagger đại trà.** `stagger-in` chỉ dùng cho một nhóm duy nhất trên mỗi trang, không phải cho mọi khối (Dashboard đang dùng 9 lần).
3. **Không lặp vô hạn.** Mọi chuyển động phải kết thúc ở trạng thái nghỉ, trừ chỉ báo trạng thái đang diễn ra thật (đang tải, đang gọi). Vòng orbit xoay vĩnh viễn là tiếng ồn, và hiện đang có ở cả `_AuthLayout` lẫn Dashboard.

## Thứ tự đọc và làm

| # | Brief | Vì sao ở vị trí này |
|---|---|---|
| 1 | [01-shell-navbar-layout.md](01-shell-navbar-layout.md) | Nền chung: layout, navbar, toast, focus, skeleton, icon. Sửa trước thì mọi trang sau rẻ đi. |
| 2 | [02-dashboard.md](02-dashboard.md) | Trang chính sau đăng nhập, đang tốt nhất nhưng vẫn chưa đủ. |
| 3 | [03-jobs.md](03-jobs.md) | Surface tệ nhất so với tầm quan trọng: 1.671 dòng, 1 transition. |
| 4 | [04-profile.md](04-profile.md) | 63 inline style, 5 token, 0 transform. |
| 5 | [05-chat.md](05-chat.md) | Chat + widget: 2.681 dòng, widget không dùng token nào. |
| 6 | [06-employer.md](06-employer.md) | 0 transition, KPI card mặc định Bootstrap. |
| 7 | [07-settings.md](07-settings.md) | 0 CSS, 0 transition, 0 hover — Bootstrap trần. |
| 8 | [08-company.md](08-company.md) | Index/Details/Edit đều gần như không có chất riêng. |
| 9 | [09-interview-room.md](09-interview-room.md) | Công cụ tập trung, 0 token, cần ngoại lệ có kiểm soát. |
| 10 | [10-resume-applications.md](10-resume-applications.md) | Hai partial là nơi người dùng thấy kết quả lao động của mình. |
| 11 | [11-onboarding.md](11-onboarding.md) | `NewUserInfor` 497 dòng, 3 bước, 0 hover — ấn tượng thứ hai sau login. |

Phần đăng nhập/đăng ký thật nằm ở mục 4 của [AGY-INSTRUCTION-WORLD-CLASS.md](../AGY-INSTRUCTION-WORLD-CLASS.md), và các lỗi mức code của scene V5 nằm ở [V5-CARD-UPGRADE-BRIEF.md](../V5-CARD-UPGRADE-BRIEF.md).

## Cách dùng bộ brief này

Mỗi file có cùng bố cục: **hiện trạng đo được → lỗi cụ thể → phải làm (tối thiểu) → một cử chỉ đặc trưng → vượt trần → nghiệm thu riêng**.

Phần "phải làm" là sàn. Phần "vượt trần" mới là chỗ quyết định được nhận hay không. Mỗi surface nộp: ảnh trước/sau cùng viewport, ảnh xám, bốn trạng thái (rỗng/đang tải/lỗi/có dữ liệu), một clip ngắn của cử chỉ đặc trưng, và số đo token/hex trước–sau.
