# Aris Line — hệ thiết kế V7 (spec cho agent triển khai)

> **Người thiết kế:** Claude (phiên thiết kế V7, 25–26/09/2026). **Người triển khai:** agent khác, làm đúng theo tài liệu này.
> Tài liệu này là **luật + bản vẽ**. Chỗ nào tài liệu và code tham chiếu (`reference/`) khác nhau → **code tham chiếu đúng**, ghi lại chỗ khác nhau vào báo cáo.
> Thay thế hoàn toàn `docs/ui-redesign/06-AGENT-PROMPT-THEME-V6.md` (V6 chỉ còn giá trị lịch sử).

## Mục lục

0. [Cách dùng bộ tài liệu](#0-cách-dùng-bộ-tài-liệu)
1. [Vì sao làm lại](#1-vì-sao-làm-lại)
2. [Sáu nguyên tắc](#2-sáu-nguyên-tắc)
3. [Nền tảng: màu, tương phản, chữ, khoảng cách, icon, sáng/tối](#3-nền-tảng)
4. [Chuyển động](#4-chuyển-động)
5. [Khung app](#5-khung-app)
6. [Giải phẫu component](#6-giải-phẫu-component)
7. [Mẫu tương tác](#7-mẫu-tương-tác)
8. [Chữ và giọng văn](#8-chữ-và-giọng-văn)
9. [Danh sách cấm](#9-danh-sách-cấm)
10. [Bẫy kỹ thuật đã gặp — đọc kỹ](#10-bẫy-kỹ-thuật-đã-gặp)
11. [Hiệu năng](#11-hiệu-năng)
12. [Nghiệm thu](#12-nghiệm-thu)

Tài liệu đi kèm:
- [`PAGES.md`](PAGES.md) — bản vẽ **từng trang** của app, map sang view/controller/endpoint thật.
- [`BACKEND.md`](BACKEND.md) — các tính năng đánh dấu **[CẦN BACKEND]**: API/bảng dữ liệu cần thêm. Chỉ làm khi chủ dự án duyệt.
- [`AGENT-PROMPT.md`](AGENT-PROMPT.md) — lệnh giao việc, luật an toàn repo, các phase và điểm DỪNG.
- [`SESSION-STATE.md`](SESSION-STATE.md) — nhật ký phiên thiết kế (không cần đọc khi triển khai).

---

## 0. Cách dùng bộ tài liệu

### 0.1 Bản tham chiếu chạy được

Thư mục `docs/design-v7/reference/` là **bản thiết kế chạy được bằng HTML/CSS/JS thuần**. Mở thẳng bằng Chrome (không cần server):

| File | Là gì | Trạng thái để xem nhanh (thêm vào URL) |
|---|---|---|
| `components.html` | Mọi token, component, chuyển động, mẫu tương tác; bảng tương phản đo trực tiếp | — (có nút "Chạy lại" trên từng demo) |
| `feed.html` | Bảng tin kiểu Instagram (Dashboard) | `?post=1` modal bình luận · `?post=3` bài chữ · `?compose=sample` / `write` / `poll` · `?share` · `?menu` · `?edit` · `?keys` · `?story=0` · `?new` · `?empty` · `?still` (tắt "bài mới" tự đến sau 15 giây) |
| `jobs.html` | Việc làm master–detail + ứng tuyển | `?job=1` · `?apply=1` · `?location=Đà Nẵng&mode=Toàn thời gian` (không kết quả) |
| `chat.html` | Tin nhắn đầy đủ + gọi video | `?drawer=1&typing=1` · `?reply=1` · `?offline=1` · `?call=1` · `?ring=1` · `?requests=1` · `?empty` · `?userId=11` |

Nút **bình thí nghiệm** trên rail (chỉ có trong bản thiết kế) mở bảng "Mô phỏng": lỗi mạng, đang tải chậm, không có kết quả… **Không port nút này vào app.**

File nào port sang app, port thế nào → xem mục 5 của `AGENT-PROMPT.md`. Tóm tắt:

| Nguồn (`reference/`) | Đích trong app (`ArisSkyve/wwwroot/`) | Ghi chú |
|---|---|---|
| `line.css` | `css/aris-line.css` | Port **nguyên văn**. Không sửa token trong file trang. |
| `motion.js` | `js/aris-motion.js` | Port nguyên văn. |
| `shell.js` | `js/aris-shell.js` (+ tách `js/aris-palette.js`) | Bỏ dữ liệu mẫu (NOTIFS, PAL_DATA, renderAccount mẫu); nối API thật. |
| `feed.css`, `jobs.css`, `chat.css` | `css/pages/feed.css`, `jobs.css`, `chat.css` | Bỏ phần "Bảng demo". |
| `*-demo.js` | Viết lại thành JS thật của trang | Giữ **hành vi, thời lượng, class**; thay dữ liệu mẫu bằng API (ghi ở đầu mỗi file + `PAGES.md`). |
| `components.*` | Không port (hoặc làm trang nội bộ `/Styleguide`) | Dùng để đối chiếu. |

### 0.2 Công cụ soát

```powershell
# Chụp ảnh các cảnh của bản tham chiếu (từ thư mục gốc repo)
node docs/design-v7/tools/shoot.js .local/v7-shots '[{"name":"feed","url":"feed.html?still"},{"name":"feed-m","url":"feed.html?still","w":390,"h":844,"dpr":2,"mobile":true}]'
# Đo tương phản mọi cặp màu quan trọng, cả sáng và tối (exit 1 nếu có cặp không đạt)
node docs/design-v7/tools/contrast.js --fail
```

`shoot.js` in ra lỗi JS/console của từng cảnh — một cảnh có lỗi là **chưa đạt**.

### 0.3 Từ vựng

| Từ | Nghĩa |
|---|---|
| **canvas** | Nền app màu ấm (`--canvas`). Rail, danh sách, bộ lọc nằm trực tiếp trên canvas. |
| **sheet / tờ giấy** | Vùng làm việc chính màu trắng (`--surface`), bo 16px, cách mép 8px (`.a-sheet`). |
| **The Line** | Chỉ báo duy nhất màu brand trượt tới mục đang chọn (`.a-indicator` + `ArisMotion.indicator`). |
| **nét quỹ đạo** | Đường cong của logo Aris; dùng làm loader (`.a-loader`) thay spinner tròn. |
| **lạc quan (optimistic)** | Đổi giao diện ngay khi người dùng bấm, gọi API sau; lỗi thì trả lại. |
| **Hoàn tác** | Thao tác xoá/từ chối thực hiện ngay trên giao diện, API chỉ gọi khi hết 6 giây mà không bấm "Hoàn tác". |
| **[CẦN BACKEND]** | Tính năng đã thiết kế nhưng **chưa có API**. Không được làm UI giả — xem `BACKEND.md`. |

---

## 1. Vì sao làm lại

**Lời chủ dự án (giữ nguyên ý):**
- "UI hiện tại quá nặng và màu mè quá mức cần thiết. Layout, component sắp xếp quá cliché và xấu, nặng, khó render. UX thì phẳng, không có gì để tương tác. Background tốn nhiều công sức mà không tận dụng được gì."
- "Không được spam AI cliché, quá nhiều hero banner… cần đặc biệt, nhiều animation, đầy đủ, hiện đại."
- 26/09: "Mình muốn một trang web phải hiện đại với **nhiều hơn về các tương tác có thể có với hệ thống**, đồng thời trang đăng tin có thể design dựa theo **các trang social media tốt nhất hiện nay**." → chốt: **giữ nền gọn, tăng mạnh tương tác**; **Bảng tin học theo Instagram**; được thiết kế tính năng cần backend mới nếu ghi rõ.

**Đo được trong repo (baseline của agent V6, `.local/ui-v6/perf-baseline.txt`):**
- `/Chat` tải **636 KB** CSS/JS của dự án, 2 vòng `requestAnimationFrame` chạy khi đứng yên (362 lần gọi/3 giây). Nền là ảnh hố đen.
- Dashboard 465 KB + `three.min.js` 589 KB (quả địa cầu 3D).
- **`wwwroot/lib/lucide/lucide.min.js` bị chèn code** ở cuối file (sau `//# sourceMappingURL=…`): một IIFE tự nạp `/js/aris-constellation.js` (99 KB, vòng rAF starfield) vào **mọi trang có Lucide**. Gỡ `<script>` trong layout là KHÔNG đủ — phải gỡ đoạn chèn (xem `AGENT-PROMPT.md`, bước 0).
- `notification-client.js` tự chèn CSS nền vũ trụ (`#0e1730`, `rgba(47,111,237,.18)`) và chữ **tiếng Anh** ("No notifications yet", "Mark all as read", "5m ago").
- Footer: "Vũ trụ nghề nghiệp của bạn" (copy sáo rỗng, bỏ).

---

## 2. Sáu nguyên tắc

### 2.1 Canvas & Sheet
Nền app là canvas ấm (`#F6F5F2`). Vùng làm việc chính là **một tờ giấy trắng** bo 16px, cách mép 8px. Master–detail: **danh sách trên canvas, chi tiết trong sheet**.

- **Nên:** Tin nhắn: danh sách hội thoại trên canvas | hội thoại trong sheet. Việc làm: danh sách job trên canvas | chi tiết job trong sheet. Bảng tin: mỗi bài là một tờ giấy riêng.
- **Không nên:** bọc mọi khối trong card cùng padding ("card soup"); card nằm trong card; đổ bóng cho thứ nằm yên trên trang (bóng chỉ cho thứ **nổi**: popover, dialog, toast).

### 2.2 The Line
Mọi trạng thái "đang chọn / đang ở đâu" dùng **một** thanh chỉ báo màu brand, **trượt** (spring 320ms) tới mục được chọn: rail, tab, danh sách, mục lục. Nét quỹ đạo của logo là loader/tiến trình.

- **Nên:** đổi tab → vạch dưới trượt sang tab mới. Chọn hội thoại khác → vạch trái trượt xuống hàng mới. Rê chuột lên mục rail khác → vạch nhích 12% quãng đường về phía đó (xem trước).
- **Không nên:** tô nền màu brand cho mục đang chọn; mỗi mục một vạch riêng bật/tắt; spinner tròn.

### 2.3 Trực tiếp & vật lý (Direct & Physical)
Mọi thứ **mọc ra từ chỗ bấm**: hộp thoại nở từ nút gốc, popover nở từ nút, cuộc gọi video lan hình tròn từ nút gọi, ảnh phóng to từ thumbnail, tin 24h nở từ avatar. Phản hồi dùng spring. Danh sách đổi thứ tự bằng FLIP. Kéo-thả có quán tính và nhường chỗ.

- **Nên:** đóng hộp thoại → thu về đúng nút đã mở nó và trả focus về nút đó.
- **Không nên:** mọi thứ fade-in giữa màn hình; hộp thoại trượt từ trên xuống bất kể bấm ở đâu.

### 2.4 Màu yên lặng (Quiet color)
Trung tính ấm + **một** brand `#2F6FED` (hành động chính, lựa chọn) + **một** accent ember `#C9481F` **chỉ** cho "mới / chưa đọc / đang live". Màu trạng thái chỉ khi báo trạng thái thật. `--like` (đỏ hồng) là **ngoại lệ duy nhất**, chỉ cho trái tim "đã thích".

- **Nên:** badge chưa đọc = accent; nút "Ứng tuyển" = brand; "Đã nhận lời" = success.
- **Không nên:** gradient, glow, glass tràn lan, nền màu cho section, icon trong ô pastel, dùng accent để "làm đẹp".

### 2.5 Chữ tạo phân cấp
Be Vietnam Pro 400/500/600/700. UI 14px, chat 15px, đọc 15–16px, tiêu đề trang 22px. Phân cấp bằng **cỡ + độ đậm + màu chữ trung tính**, không bằng khung màu.

- **Không nên:** chữ in hoa giãn cách làm "eyebrow" trên tiêu đề; chữ gradient; tiêu đề màu brand.

### 2.6 Mọi đối tượng đều có hành động trực tiếp (bổ sung 26/09)
Chủ dự án muốn "nhiều tương tác hơn với hệ thống". Quy tắc: **mỗi đối tượng hiện trên màn hình phải làm được việc ngay tại chỗ**, không bắt người dùng mở trang khác. Và **mọi hành động đều có phản hồi nhìn thấy trong ≤ 100ms** (đổi trạng thái lạc quan, morph nút, số lăn…).

| Đối tượng | Hành động tại chỗ (tối thiểu) |
|---|---|
| Người (tên/avatar ở bất kỳ đâu) | Rê chuột → thẻ hồ sơ (Nhắn tin / Kết bạn / Xem hồ sơ). Chạm (mobile) → hồ sơ. |
| Công ty | Rê chuột → thẻ (Xem việc làm / Theo dõi*). |
| Việc làm (hàng, thẻ gắn trong bài) | Xem trước tại chỗ, Ứng tuyển trong dialog, Chia sẻ, phím J/K/A. |
| Bài viết | Thích (nhấn đúp ảnh), Bình luận, Gửi cho bạn bè, Lưu*, Sửa/Xoá/Ẩn*, Bình chọn*. |
| Bình luận | Thích*, Trả lời*, Xoá (của mình) + Hoàn tác. |
| Thông báo | Bấm → đánh dấu đã đọc + mở đúng chỗ; "Đánh dấu tất cả". |
| Lời mời (kết bạn, phỏng vấn) | Chấp nhận / Từ chối ngay trong thẻ, có Hoàn tác; phỏng vấn đã nhận → "Thêm vào lịch" (.ics). |
| Ứng viên (nhà tuyển dụng) | Kéo sang cột trạng thái khác; Từ chối → hỏi lý do (mẫu có sẵn); Hẹn phỏng vấn. |
| Tin nhắn | Trả lời/trích dẫn, chuyển tiếp, thu hồi, sao chép, xem ảnh lớn. |

(*) = **[CẦN BACKEND]**, xem `BACKEND.md`.

---

## 3. Nền tảng

Nguồn chuẩn: `reference/line.css` mục 1–2. Trang `components.html#mau` hiển thị mọi token với giá trị thật.

### 3.1 Màu — token ngữ nghĩa

Chỉ dùng **token ngữ nghĩa** dưới đây trong CSS trang. Primitive (`--n-*`, `--b-*`) chỉ dùng bên trong `line.css`. **CSS trang không được có mã hex/rgb** (trừ các ngoại lệ ghi ở 3.1.2).

| Token | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--canvas` | `#F6F5F2` | `#111214` | Nền app: rail, danh sách, bộ lọc |
| `--surface` | `#FFFFFF` | `#18191C` | Tờ giấy, card đối tượng, popover, dialog |
| `--surface-hover` | `#F9F8F6` | `#1D1E22` | Hover trên tờ giấy |
| `--field` | `#EFEDE8` | `#1F2024` | Ô tìm trên canvas, track segmented, tag |
| `--hover` / `--pressed` | đen 5% / 8% | trắng 5% / 8% | Lớp phủ trong suốt khi hover / nhấn |
| `--selected` | `#FFFFFF` | `#1F2024` | Hàng đang chọn trên canvas |
| `--line` · `--line-soft` · `--line-strong` | `#DDD9D0` · `#E7E4DD` · `#C8C3B8` | `#2A2C31` · `#232529` · `#3A3D44` | Viền card · chia mảnh · viền chip/card chọn được |
| `--line-control` | `#8E897F` | `#6E717A` | **Viền ô nhập, checkbox, radio, công tắc tắt** (≥ 3:1) |
| `--text` · `--text-2` · `--text-3` · `--text-4` | `#1C1B18` · `#46433D` · `#5F5B53` · `#7C776D` | `#EDEDEF` · `#BDBFC5` · `#9295A0` · `#767984` | Chữ chính · phụ · metadata · placeholder/icon phụ |
| `--brand` | `#2F6FED` | `#2A6DF5` | Nút chính, chỉ báo, checkbox bật |
| `--brand-hover` / `--brand-press` | `#255ED8` / `#1C4BB3` | `#1F62E6` / `#1A56CC` | Hover / nhấn nút chính |
| `--brand-text` | `#1C4BB3` | `#8FB2FA` | Link, chữ màu brand |
| `--brand-soft` · `--brand-soft-2` · `--brand-line` | `#EEF3FE` · `#E1EAFD` · `#C4D6FB` | `#172238` · `#1D2B47` · `#2C4170` | Nền chip chọn · nền chọn đậm · viền chip chọn |
| `--accent` · `--accent-text` · `--accent-soft` | `#C9481F` · `#A93C19` · `#FCEEE8` | `#D24719` · `#F29A78` · `#33201A` | **Chỉ** mới / chưa đọc / live |
| `--success` · `--warning` · `--danger` (+ `-soft`) | `#1B7C4D` · `#9A6310` · `#C8372F` | `#43B87F` · `#D9A24C` · `#EE6B61` | Trạng thái |
| `--danger-fill` | = `--danger` | `#E52719` | Nền nút nguy hiểm (chữ trắng) |
| `--on-status` | `#FFFFFF` | `#111214` | Chữ trên nền `--success`/`--warning` đặc |
| `--like` | `#E23A52` | `#FF5A70` | **Chỉ** trái tim "đã thích" |
| `--inverse` / `--on-inverse` / `--inverse-action` | `#1C1B18` / `#F6F5F2` / `#9DBAF7` | `#EDEDEF` / `#151618` / `#255ED8` | Toast, tooltip |
| `--bubble-me` / `--bubble-them` / `--bubble-text` | `#E1EAFD` / `#EFEDE8` / `#1C1B18` | `#1F2E4E` / `#232529` / `#EDEDEF` | Bong bóng chat |
| `--tone-1…6-bg/fg` | 6 cặp độ bão hoà thấp | 6 cặp tối | Nền + chữ viết tắt avatar/logo |
| `--scrim` | đen 36% | đen 56% | Lớp tối sau hộp thoại |
| `--focus` · `--ring` | brand | `#6897F8` | Vòng focus · viền chấm online (đổi theo nền chứa) |

#### 3.1.1 Luật dùng màu (kiểm bằng mắt trên mọi ảnh chụp)
1. Trong một khung nhìn, ngoài trung tính chỉ được có **brand**, **accent** (khi thật sự mới/chưa đọc/live), màu **trạng thái** (khi thật sự báo trạng thái) và **`--like`** (chỉ trái tim). Ảnh người dùng, logo công ty, emoji do người dùng gõ không tính.
2. **Mỗi vùng màn hình tối đa một nút primary.** Hành động phụ = secondary/ghost.
3. Badge đếm chưa đọc **luôn** là `.a-badge--accent`. Badge đếm thường (số việc…) = `.a-badge--muted`.
4. Tông avatar lấy theo tên bằng `toneOf(name)` — cùng tên luôn cùng màu. Không random.

#### 3.1.2 Ngoại lệ được phép dùng màu cứng (đã có trong reference)
- Nền tối cố định của **lightbox, tin 24h, gọi video, phòng phỏng vấn** (`#0E0F11`, chữ `#EDEDEF`): những màn này luôn tối ở cả hai theme.
- Lớp **tối dần trên ảnh** để đọc được chữ đè lên ảnh (story `.story__shade-t/b`, điều khiển cuộc gọi): `linear-gradient` từ đen 50% → trong suốt. Đây là **gradient chức năng duy nhất** được phép.
- Nút tròn trắng nổi trên ảnh (`.car__btn`, `.story__side`): `rgb(255 255 255 / .92)` + chữ `#1C1B18`.
- Ảnh SVG mẫu trong `feed-demo.js` / `chat-demo.js` (**không port**).

### 3.2 Tương phản (đã đo bằng `tools/contrast.js`, 26/09/2026)

Ngưỡng WCAG 2.2 AA: chữ thường ≥ 4.5:1; chữ ≥ 18px đậm, icon, viền control ≥ 3:1. **Chạy `node docs/design-v7/tools/contrast.js --fail` sau mọi lần sửa token; phải exit 0.**

| Chữ / đồ hoạ | Nền | Dùng cho | Ngưỡng | Sáng | Tối |
|---|---|---|---|---|---|
| `--text` | `--canvas` | Chữ chính trên nền app | 4.5:1 | 15.80 | 16.03 |
| `--text` | `--surface` | Chữ chính trên tờ giấy | 4.5:1 | 17.22 | 15.03 |
| `--text-2` | `--surface` | Chữ phụ, nội dung dài | 4.5:1 | 9.86 | 9.56 |
| `--text-3` | `--canvas` | Metadata trên nền app | 4.5:1 | 6.20 | 6.27 |
| `--text-3` | `--surface` | Metadata trên tờ giấy | 4.5:1 | 6.76 | 5.88 |
| `--text-3` | `--field` | Metadata trên ô nhập / tag | 4.5:1 | 5.78 | 5.45 |
| `--text-4` | `--surface` | Placeholder, icon phụ (đồ hoạ) | 3:1 | 4.45 | 4.05 |
| `--text-4` | `--field` | Placeholder trong ô tìm (đồ hoạ) | 3:1 | 3.81 | 3.75 |
| `--on-brand` | `--brand` | Chữ trên nút chính | 4.5:1 | 4.55 | 4.56 |
| `--on-brand` | `--brand-hover` | Chữ trên nút chính khi hover | 4.5:1 | 5.72 | 5.32 |
| `--brand-text` | `--surface` | Link trên tờ giấy | 4.5:1 | 7.76 | 8.30 |
| `--brand-text` | `--canvas` | Link trên nền app | 4.5:1 | 7.12 | 8.85 |
| `--brand-text` | `--brand-soft` | Chip / mục đang chọn | 4.5:1 | 6.98 | 7.50 |
| `--brand` | `--surface` | Chỉ báo "The Line", viền focus (đồ hoạ) | 3:1 | 4.55 | 3.85 |
| `--brand` | `--canvas` | Chỉ báo trên nền app (đồ hoạ) | 3:1 | 4.17 | 4.11 |
| `--line-control` | `--surface` | Viền ô nhập, checkbox, radio (đồ hoạ) | 3:1 | 3.48 | 3.60 |
| `--line-control` | `--canvas` | Viền control trên nền app (đồ hoạ) | 3:1 | 3.19 | 3.84 |
| `#FFFFFF` | `--accent` | Số trên badge chưa đọc | 4.5:1 | 4.74 | 4.51 |
| `--accent-text` | `--accent-soft` | Tag "Mới" | 4.5:1 | 5.54 | 7.10 |
| `--accent-text` | `--canvas` | Giờ của tin chưa đọc | 4.5:1 | 5.75 | 8.63 |
| `--success` | `--success-soft` | Trạng thái thành công | 4.5:1 | 4.59 | 6.24 |
| `--success` | `--surface` | Chữ thành công | 4.5:1 | 5.20 | 7.03 |
| `--warning` | `--warning-soft` | Trạng thái cảnh báo | 4.5:1 | 4.50 | 6.96 |
| `--danger` | `--danger-soft` | Trạng thái lỗi | 4.5:1 | 4.50 | 5.43 |
| `--danger` | `--surface` | Chữ lỗi, mục menu nguy hiểm | 4.5:1 | 5.19 | 5.79 |
| `#FFFFFF` | `--danger-fill` | Nút nguy hiểm | 4.5:1 | 5.19 | 4.53 |
| `--on-status` | `--success` | Nút Nhận cuộc gọi | 4.5:1 | 5.20 | 7.50 |
| `--on-status` | `--warning` | Kết quả tìm đang chọn (chat) | 4.5:1 | 5.04 | 8.23 |
| `--on-inverse` | `--inverse` | Toast, tooltip | 4.5:1 | 15.80 | 15.49 |
| `--inverse-action` | `--inverse` | Nút hành động trong toast | 4.5:1 | 8.86 | 4.89 |
| `--bubble-text` | `--bubble-me` | Bong bóng chat của mình | 4.5:1 | 14.26 | 11.52 |
| `--bubble-text` | `--bubble-them` | Bong bóng chat đối phương | 4.5:1 | 14.72 | 13.13 |
| `--like` | `--surface` | Tim đã thích (đồ hoạ) | 3:1 | 4.23 | 5.82 |
| `--tone-1-fg` | `--tone-1-bg` | Chữ viết tắt avatar tông 1 | 4.5:1 | 7.70 | 7.84 |
| `--tone-2-fg` | `--tone-2-bg` | Chữ viết tắt avatar tông 2 | 4.5:1 | 7.34 | 8.37 |
| `--tone-3-fg` | `--tone-3-bg` | Chữ viết tắt avatar tông 3 | 4.5:1 | 7.29 | 8.50 |
| `--tone-4-fg` | `--tone-4-bg` | Chữ viết tắt avatar tông 4 | 4.5:1 | 7.53 | 8.02 |
| `--tone-5-fg` | `--tone-5-bg` | Chữ viết tắt avatar tông 5 | 4.5:1 | 8.05 | 8.14 |
| `--tone-6-fg` | `--tone-6-bg` | Chữ viết tắt avatar tông 6 | 4.5:1 | 6.95 | 8.46 |

Kết quả: **39/39 cặp đạt.**

> Bảng trên là **nguyên văn** kết quả `node docs/design-v7/tools/contrast.js` chạy ngày 26/09/2026. Nếu số của bạn khác → token đã bị sửa; chạy lại script và dán kết quả vào báo cáo. Một số cặp đã phải **sửa token** trong phiên thiết kế để đạt: brand tối (`#4F86F7` → `#2A6DF5`), accent tối (`#E8683D` → `#D24719`), success sáng (`#1D8452` → `#1B7C4D`), thêm `--line-control`, `--danger-fill`, `--on-status`.

### 3.3 Chữ

Font: **Be Vietnam Pro** (Google Fonts, `wght@400;500;600;700`, `display=swap`) — hỗ trợ đủ dấu tiếng Việt. Body `line-height: 1.5`. Bỏ Plus Jakarta Sans / Inter / Space Grotesk.

| Cỡ | Độ đậm | Line-height | Dùng cho |
|---|---|---|---|
| 28 | 600 | 1.25, `letter-spacing -.02em` | Số lớn trong trang tổng quan (hiếm) |
| 22 | 600 | 1.25, `-.015em` | Tiêu đề trang (`.a-pagehead__title`, `.jobs-list__title`) |
| 18 | 600 | 1.35 | Tiêu đề dialog lớn, tiêu đề bài dạng bài báo, tiêu đề trang trên mobile |
| 16 | 600 | 1.4 | Tiêu đề mục trong trang chi tiết (`.jd-section h2`), tiêu đề dialog |
| 15 | 400 | 1.6–1.7 | Nội dung đọc dài, tin nhắn chat, mô tả công việc, bài viết chữ |
| 14 | 400/500/600 | 1.5 | Mặc định UI: nút, ô nhập, danh sách, tên người (600) |
| 13 | 400/500 | 1.45 | Metadata, chip, nút nhỏ |
| 12 | 500 | 1.4 | Tag, trạng thái, chú thích, giờ |
| 11 | 500/600 | 1.2 | Nhãn rail, badge |

Luật: số đếm/tiền/giờ dùng `.a-num` (`font-variant-numeric: tabular-nums`) để không nhảy khi lăn số. Câu mô tả trong empty state dùng `text-wrap: balance` (đã có trong `.a-empty__text`). Không `text-transform: uppercase` cho nhãn. Không cắt dấu: tiêu đề `line-height ≥ 1.25`.

### 3.4 Khoảng cách · bo góc · độ nổi · lớp

| Nhóm | Giá trị |
|---|---|
| Khoảng cách (lưới 4px) | `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 20 · `--s-6` 24 · `--s-8` 32 · `--s-10` 40 · `--s-12` 48 |
| Bo góc | `--r-xs` 6 (tag, tooltip) · `--r-sm` 8 (nút, ô nhập, menu item) · `--r-md` 12 (card, popover, menu) · `--r-lg` 16 (sheet, dialog, bài viết) · `--r-full` (chip, avatar, badge) · 10 (hàng danh sách, logo 40) |
| Bóng | `--shadow-1` hàng đang chọn · `--shadow-2` hover card nổi, nút tròn trên ảnh · `--shadow-3` popover, dialog, toast, phần tử đang kéo |
| Lớp (`z-index`) | `--z-sticky` 20 · `--z-rail` 40 · `--z-pop` 60 · `--z-modal` 80 (dialog +1, xác nhận +3) · `--z-toast` 90 · `--z-call` 100 (lightbox, tin 24h, cuộc gọi) |
| Khung | `--rail-w` 72px · `--tabbar-h` 60px · sheet cách mép 8px |
| Điểm gãy | mobile `≤ 767px` · tablet `768–1099px` · desktop `≥ 1100px` |

### 3.5 Icon

- Chỉ **Lucide 0.344.0** (`wwwroot/lib/lucide`, sau khi đã gỡ đoạn chèn). Nét `stroke-width: 1.75` cho toàn app (`svg.lucide` trong `line.css`). Màu = `currentColor`.
- Cỡ: 14 (chip) · 16 (nút sm, menu, ô tìm) · 18 (nút thường, toast) · 20 (rail) · 24 (hành động bài viết, header mobile).
- **Tên icon phải tồn tại trong 0.344.** Đã gặp: `square-plus` và `circle-play` **không có** → dùng `plus-square`, `play-circle`. Tương tự các tên đổi ở bản mới hơn: dùng `more-horizontal` (không phải `ellipsis`), `check-circle-2` (không phải `circle-check`), `bar-chart-3`. Kiểm bằng cách: `lucide.icons['PlusSquare']` trong console.
- Icon được thêm động (SignalR, AJAX) phải gọi `lucide.createIcons()` sau khi chèn — `AppNavbar/Default.cshtml` đã có `MutationObserver` làm việc này; **giữ lại** khi chuyển sang rail.
- Emoji **chỉ** trong nội dung người dùng và bộ chọn cảm xúc nhanh (bình luận, tin 24h). Không dùng emoji làm icon giao diện.

### 3.6 Sáng / tối

- Thuộc tính `data-theme="light|dark"` trên `<html>`. Lưu `localStorage['aris-theme']`. Lần đầu: theo `prefers-color-scheme`.
- Script chặn nhấp nháy **phải nằm trong `<head>` trước mọi CSS** (copy nguyên từ reference):
  ```html
  <script>
    (function () {
      try {
        var t = localStorage.getItem('aris-theme');
        if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.dataset.theme = t;
      } catch (e) { document.documentElement.dataset.theme = 'light'; }
    })();
  </script>
  ```
- Đổi theme: `ArisMotion.setTheme(next, nútĐãBấm)` — vòng tròn lan từ nút (View Transitions). Sau đó cập nhật icon nút theme (`window.syncThemeIcon()` trong shell).
- Dark là **than chì trung tính**, không sao, không glow, không tím.

---

## 4. Chuyển động

### 4.1 Token

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--d-1` | 120ms | Hover, đổi màu, nhấn |
| `--d-2` | 200ms | Fade nhỏ, nhãn nút |
| `--d-3` | 320ms | Chỉ báo, collapse, thanh ẩn/hiện, khung đổi cỡ |
| `--d-4` | 480ms | Vẽ dấu ✓ |
| `--e-out` | `cubic-bezier(.2,.8,.2,1)` | Mặc định cho mọi thứ **vào** |
| `--e-in` | `cubic-bezier(.4,0,1,1)` | Thứ **ra** / đóng |
| `--e-in-out` | `cubic-bezier(.65,0,.35,1)` | Đổi theme, đóng tin 24h |
| `--e-spring` | `linear(…)` (xem `line.css`) | Phản hồi vật lý: chỉ báo, nút nảy, badge, ✓ |

JS dùng hằng tương ứng: `ArisMotion.EASE_OUT / EASE_IN / EASE_IN_OUT / SPRING`.

### 4.2 Primitive (`wwwroot/js/aris-motion.js` = `reference/motion.js`)

Demo từng hàm: `components.html#chuyen-dong`.

| Hàm | Khi dùng | Thuộc tính | Thời lượng · easing | Reduced-motion |
|---|---|---|---|---|
| `flip(container, mutate, {selector, duration, enter})` | Lọc, sắp xếp, thêm/bớt phần tử | transform (từ vị trí cũ); phần tử mới opacity + scale .97 | 300ms out; mới 220ms | Chỉ chạy `mutate()` |
| `removeFrom(container, el)` | Xoá một mục | opacity + scale .96, rồi `flip` | 160ms in + 300ms | Xoá ngay |
| `rollNumber(el, to)` | Số thay đổi (đếm, lượt thích, ký tự, %) | translateY từng chữ số | 360ms spring, lệch 40ms/chữ số | Đổi chữ ngay |
| `morphButton(btn, state, {hold})` | Nút gửi dữ liệu: `idle → loading → success/error` | nhãn trượt lên; loader/✓ hiện | nhãn 200ms; ✓ vẽ 480ms; success giữ 1400ms; error rung 320ms rồi idle | Đổi trạng thái không animation |
| `shake(el)` | Lỗi nhập, thao tác không hợp lệ, vượt giới hạn | translateX ±5 tắt dần | 320ms | Không |
| `pulse(el, scale)` | Đích vừa nhận thứ gì (flyTo, lưu) | scale 1 → 1.14 → 1 | 380ms spring | Không |
| `indicator(ind, target, {axis, inset, instant})` | The Line: rail, tab, danh sách, mục lục | transform translate + scale | 320ms spring (CSS); lần đầu tức thì | Tức thì |
| `segment(root, btn)` | Segmented control | transform + width của thumb | 320ms spring | Tức thì |
| `expand/collapse/toggle(el)` | Mở rộng tại chỗ | `grid-template-rows` 0fr↔1fr + opacity | 320ms out | 1ms |
| `stagger(els, {max, step})` | **Chỉ** khi danh sách vừa tải/đổi hẳn | opacity + translateY 6px | 240ms out, lệch 30ms, tối đa 6 | Không |
| `pop(el, origin)` / `unpop(el)` | Popover, menu, thẻ hover | opacity + scale .94, `transform-origin` = tâm nút | 180ms out / 110ms in | Hiện/ẩn ngay |
| `openDialog(dlg, scrim, origin)` / `closeDialog` | Mọi hộp thoại | dịch 55% quãng từ nút + scale .86 (desktop); translateY 100% (mobile) | mở 280ms out; đóng 180ms in; scrim 200/160ms | Hiện/ẩn ngay |
| `flyTo(src, target)` | Đưa vật đi nơi khác (ứng tuyển → rail "Ứng tuyển") | bản sao bay cung, nhỏ dần tới 22% | 620ms, đích `pulse` | Chỉ `pulse` đích |
| `highlight(el)` | Nhảy tới một mục (trích dẫn, bình luận mới) | nền `--brand-soft-2` tắt dần | 1100ms | 1ms |
| `toast(msg, {tone, action, duration})` | Xác nhận, lỗi không chặn, Hoàn tác | vào opacity + translateY 12 + scale .98 | vào 320ms spring; ra 180ms; tự đóng 4s (6s nếu có nút); vuốt ngang để đóng | Không animation |
| `setTheme(next, origin)` | Đổi sáng/tối | clip-path vòng tròn (View Transition) | 520ms in-out | Đổi ngay |
| `sortable(container, {selector, axis, ignore, onChange})` | Đổi thứ tự bằng kéo-thả / Alt+mũi tên | phần tử kéo bám con trỏ; khác FLIP | FLIP 220ms; thả spring 340ms | Không animation, kéo vẫn chạy |
| `stickyHeader(header)` | Viền dưới header dính khi đã cuộn | opacity viền | 200ms | 1ms |
| `initTooltips()` | `[data-tip]` (+ `data-kbd`) | opacity + dịch 4px | trễ 450ms khi rê chuột; ngay khi focus bàn phím; 140ms | Không animation |

Shell (`aris-shell.js`) có thêm: `openLightbox(items, index, caption)` (ảnh phóng từ thumbnail 360ms, chuyển ảnh 120/220ms), `openPopover/closePopover`, `openPalette`, `initToc`, `initials`, `orgInitials`, `toneOf`, `avatarHtml`.

### 4.3 Luật

1. **Mỗi chuyển động phải trả lời được "nó giúp người dùng hiểu điều gì?"** (vật đi đâu, cái gì mới, cái gì đang chọn, việc đã xong chưa).
2. Mặc định chỉ animate `transform`, `opacity`, `clip-path`. **Ngoại lệ được phép** (ngắn, một lần, phần tử nhỏ): chiều cao khi một thẻ đổi nội dung (`todoSwap`, "Xem thêm", ẩn bài: ≤ 340ms), độ rộng thanh % bình chọn (640ms), kích thước khung xem trước và độ rộng hộp tạo bài giữa các bước (300–320ms). Không có ngoại lệ nào khác.
3. `infinite` **chỉ** cho: loader quỹ đạo khi đang tải, skeleton shimmer, chấm "đang gõ", chấm live (`.side-live__dot`, chấm đang gọi), vòng tin 24h đang tải (≤ 420ms). Xong việc thì dừng.
4. **Không có vòng `requestAnimationFrame` chạy khi trang đứng yên.** (`rafIdle3s = 0`.)
5. Không reveal-on-scroll đại trà, không parallax, không tilt, không spotlight theo chuột, không con trỏ tuỳ biến, không ripple.
6. `prefers-reduced-motion: reduce`: `ArisMotion.animate()` tự bỏ qua; CSS rút mọi duration về 1ms (đã có trong `line.css` mục 19). Thanh tiến trình tin 24h **vẫn chạy** (nó là bộ đếm giờ, không phải trang trí).
7. Mọi animation WAAPI trên phần tử **có con `position: fixed`** không được giữ `fill: 'forwards'/'both'` sau khi chạy xong — xem Bẫy 10.1.

### 4.4 Chuyển trang

- `@view-transition { navigation: auto; }` (trong `line.css`): chuyển trang cùng origin crossfade 220ms. Rail có `view-transition-name: app-rail` nên đứng yên khi chuyển trang.
- Không có trang trắng: trang mới cần dữ liệu thì hiện khung + skeleton ngay.

---

## 5. Khung app

Reference: phần `.a-rail` trong mọi file `reference/*.html` + `shell.js`.

### 5.1 Desktop (≥ 768px): rail trái 72px

Thay **toàn bộ** navbar ngang hiện tại (`Views/Shared/Components/AppNavbar/Default.cshtml`) bằng rail. Giữ `AppNavbarViewComponent` (nó cung cấp `Active`, `Role`, `AvatarUrl`, `UserId`, `IncludeChatWidget`) — chỉ đổi view `Default.cshtml`.

**Thứ tự mục** (trên → dưới), theo vai trò:

| Ứng viên (Role ≠ Business) | Doanh nghiệp (Role = Business) | `ViewData["ActiveNav"]` | Link |
|---|---|---|---|
| Bảng tin `home` | Bảng tin `home` | `Home` | `Dashboard/Index` |
| Việc làm `briefcase` | Tuyển dụng `gauge` | `Jobs` / `Employer` | `Jobs/Index` / `Employer/Index` |
| Tin nhắn `message-circle` (+ badge accent chưa đọc) | Tin nhắn | `Network` | `Chat/Index` |
| Ứng tuyển `file-check` | Việc đã đăng `briefcase` | `Applications` (**mới**) / `Jobs` | `JobApplications/MyApplications` / `Jobs/Index` |
| CV `file-text` | — | `Resume` (**mới**) | `Resume/Index` |
| Công ty `building-2` | Công ty của tôi `building-2` | `Companies` | `Company/Index` / `Company/Edit` |

- `ActiveNav` mới: sửa `ViewData["ActiveNav"]` trong `MyApplications.cshtml` (`"Jobs"` → `"Applications"`) và `Resume/Index.cshtml` (`"Profile"` → `"Resume"`). Profile, Settings không có mục rail → không mục nào sáng (chỉ báo ẩn).
- **Chân rail** (dưới → trên cùng nhóm, căn đáy): Tạo bài viết `plus-square` (`data-action="compose"`, phím N) · Tìm nhanh `search` (`data-action="palette"`, Ctrl K) · Thông báo `bell` (+ badge accent) · Giao diện `moon/sun` · Avatar (mở menu tài khoản: Hồ sơ, CV (ứng viên) / Hồ sơ doanh nghiệp (Business), Cài đặt, ─, Đăng xuất màu danger — form POST `Account/Logout` kèm AntiForgeryToken như hiện tại).
- Nhãn rail 11px dưới icon 20px, ô 54px cao. Mục đang ở: chữ `--text` + nền `--hover` + **chỉ báo trái** (The Line). Rê chuột mục khác: chỉ báo nhích 12% về phía đó.
- Tooltip cho nút chân rail (`data-tip`, `data-kbd`), hiện bên phải.
- Rail `position: sticky; top: 0; height: 100dvh`. `<main>` ngay cạnh rail.
- **Bỏ footer** ("Vũ trụ nghề nghiệp…"). Bỏ `aris-cosmos.css`, `aris-warp-transition.*`, `aris-constellation.js`, `aris-tokens.css`, `aris-theme.css` khỏi layout (không xoá file — xem `AGENT-PROMPT.md`).

### 5.2 Mobile (≤ 767px): thanh tab dưới 5 mục

`Bảng tin · Việc làm (Business: Tuyển dụng) · Tin nhắn · Thông báo · Tôi`. Mục đang ở: icon màu brand, không chỉ báo. Thanh **ẩn khi cuộn xuống, hiện khi cuộn lên** (`.a-rail.is-hidden`, 320ms). `Thông báo` mở **bottom sheet toàn cao** danh sách thông báo (không có trang thông báo riêng). `Tôi` → `Profile/Index`. Nội dung chừa `padding-bottom: calc(60px + safe-area)`.

Các trang có thanh đầu riêng trên mobile: Bảng tin (logo "Aris" + nút Tạo bài), trang chi tiết (nút ‹ quay lại).

### 5.3 Bốn kiểu trang

| Kiểu | Trang | Cấu trúc |
|---|---|---|
| **A. Master–detail toàn cao** | Tin nhắn, Việc làm, Tuyển dụng (pipeline) | `height: 100dvh`; cột danh sách trên canvas cuộn riêng; sheet chi tiết cuộn riêng. Mobile: danh sách → chạm → chi tiết trượt từ phải phủ toàn màn. |
| **B. Trang cuộn có header dính** | Hồ sơ, Công ty (chi tiết, sửa), Ứng tuyển, CV, Cài đặt | `.a-page` + `.a-pagehead` (sticky, viền dưới hiện khi đã cuộn qua `stickyHeader`) + nội dung + mục lục dính `.a-toc` bên phải (≥ 1100px) |
| **C. Bảng tin** | Dashboard | Cột bài 560px + cột phụ 312px, cả cụm căn giữa trên canvas; cuộn cả trang. `< 1100px` bỏ cột phụ, các mô-đun chèn giữa bảng tin. |
| **D. Tập trung** | Đăng nhập/Đăng ký, Thông tin người dùng mới, Phòng phỏng vấn, Lỗi | Không rail. Auth: một cột 400px căn giữa trên canvas. Phỏng vấn: nền tối toàn màn. |

### 5.4 Command palette (Ctrl/⌘ K, `/`)

Reference: `shell.js` phần "Command palette". Trong app:
- Nguồn: **hành động tĩnh** (Tạo bài viết `N`, Tạo CV, Xem đơn ứng tuyển, Đổi giao diện, Cài đặt; Business: Đăng tin tuyển dụng, Mở bảng tuyển dụng) + **tìm trực tiếp** `GET /Search/Global?q=` (debounce 250ms, `AbortController` huỷ yêu cầu cũ) trả `{ jobs[], companies[], people[] }` → nhóm "Việc làm" (`/Jobs/Details/{id}`), "Công ty" (`/Company/Details/{id}`), "Mọi người" (`/Chat/Index?userId={id}`).
- Chưa gõ: hiện hành động + **mục mở gần đây** (lưu 6 mục cuối trong `localStorage['aris-palette-recent']`).
- Phím: ↑/↓ di chuyển (vệt nền trượt, không nhảy), Enter mở, Esc đóng và trả focus. Chữ khớp tô `--brand-text` đậm (so khớp không dấu: "da nang" khớp "Đà Nẵng").
- Lỗi mạng: dòng "Chưa tìm được — kiểm tra kết nối" + vẫn hiện hành động tĩnh.
- Thay thế ô tìm `#globalSearchInput` của navbar cũ (đoạn script trong `Default.cshtml` bị bỏ cùng navbar).

### 5.5 Thông báo

- Desktop: nút chuông trên rail mở **popover 360px** nở từ nút (`openPopover(..., 'right')`). Mobile: bottom sheet.
- Giữ `ArisNotifications.init({ bellBtn, badge, list })` và API (`GET /Notifications/GetNotifications` → `{ notifications: [{ id, content, link, isRead, actorAvatar, createdAt }] }`, `POST MarkAsRead?id=`, `POST MarkAllAsRead`, sự kiện `ReceiveNotification` qua `ArisChat`). **Viết lại phần hiển thị** trong `notification-client.js`:
  - Bỏ `injectStyles()` (CSS vũ trụ). Markup mỗi mục = `.a-row.notif` (+ `.is-unread`) có `.notif__bar` (vạch accent co lại khi đọc) — xem `shell.js` `renderNotifs`.
  - Chữ tiếng Việt: tiêu đề "Thông báo", nút "Đánh dấu đã đọc", trống: "Chưa có thông báo nào. Lời mời phỏng vấn, kết bạn và trạng thái đơn ứng tuyển sẽ hiện ở đây.", thời gian: "Vừa xong / 5 phút / 3 giờ / Hôm qua / 3 ngày / 12/09".
  - Badge đếm `.a-badge--accent`, "99+" khi > 99. Thông báo mới qua SignalR: badge `pulse`, mục mới chèn đầu bằng `flip`.
  - Id giữ nguyên: `#notifBellBtn`, `#notifBadge`, `#notifList` (đặt trên phần tử mới của rail/popover).

### 5.6 Toast, focus, bàn phím chung

- Toast: `ArisMotion.toast`; vùng góc dưới trái cạnh rail (desktop), trên thanh tab (mobile). **Giữ `window.showToast(message, type)`** (đã có bản tương thích trong `motion.js`) — code nghiệp vụ cũ gọi hàm này. Bỏ `#globalToastContainer` Bootstrap.
- Skip link "Đến nội dung chính" → `#mainContent` (giữ). Mọi thứ bấm được có `:focus-visible` 2px `--focus`.
- Phím tắt không bao giờ chạy khi đang gõ trong `input/textarea/select/[contenteditable]` hoặc khi có Ctrl/⌘/Alt (trừ tổ hợp dành riêng).

| Phím | Ở đâu | Làm gì |
|---|---|---|
| Ctrl/⌘ K, `/` | Mọi trang | Tìm nhanh |
| N | Mọi trang (không có dialog mở) | Tạo bài viết |
| J / K, ↓ / ↑ | Việc làm, Bảng tin, Tin nhắn (Alt+↑/↓) | Mục sau / trước |
| A | Việc làm | Ứng tuyển việc đang xem |
| L · C · S · ← → | Bảng tin | Thích · bình luận · lưu · chuyển ảnh |
| ? | Bảng tin | Danh sách phím tắt |
| Esc | Mọi nơi | Đóng lớp trên cùng (lightbox > tin 24h > xác nhận > dialog > popover), trả focus |
| Enter / Shift+Enter | Ô chat, ô bình luận | Gửi / xuống dòng (bỏ qua khi đang ghép chữ tiếng Việt) |

### 5.7 Chat widget (`_ChatWidget.cshtml`)

Nút tròn 48px góc dưới phải (trên thanh tab ở mobile — hoặc ẩn trên mobile vì đã có tab Tin nhắn), badge accent chưa đọc; bấm → popover 380×560 nở từ nút, bên trong là bản thu nhỏ của Tin nhắn (danh sách ↔ hội thoại). **Ẩn trên `/Chat`**. Giữ toàn bộ JS nghiệp vụ, chỉ đổi markup/style theo `chat.css`.

---

## 6. Giải phẫu component

Mọi class dưới đây đã có trong `line.css`. Demo sống: `components.html`. Mỗi component: **markup mẫu → biến thể → trạng thái → chuyển động → a11y → không được**.

### 6.1 Nút `.a-btn`
```html
<button class="a-btn a-btn--primary" type="button">Ứng tuyển</button>
<button class="a-btn a-btn--secondary a-btn--sm" type="button"><i data-lucide="calendar-plus"></i>Thêm vào lịch</button>
<button class="a-btn a-btn--ghost a-btn--icon" type="button" aria-label="Tuỳ chọn" data-tip="Tuỳ chọn"><i data-lucide="more-horizontal"></i></button>
```
- Kiểu: `--primary` (brand) · `--secondary` (surface + viền `--line-strong`) · `--ghost` · `--danger` (`--danger-fill`) · `--danger-ghost`. Cỡ: `--sm` 32 · mặc định 36 · `--lg` 44 · `--icon` vuông · `--block` rộng 100%.
- Trạng thái: hover (đổi nền 120ms) · nhấn (scale .97, 60ms) · focus-visible (vòng 2px) · disabled (opacity .45, `cursor: not-allowed`) · `data-state="loading|success"` (qua `morphButton`).
- A11y: nút chỉ có icon **bắt buộc** `aria-label` (+ `data-tip` trên desktop). Loading đặt `aria-busy="true"` (morphButton tự làm).
- Không được: pill cho mọi nút; 2 nút primary cạnh nhau; nút primary màu khác brand; đổi chiều rộng nút khi loading.

### 6.2 Ô nhập `.a-field` `.a-input` `.a-textarea` `.a-select` `.a-search`
```html
<div class="a-field">
  <label class="a-label" for="email">Email</label>
  <input class="a-input" id="email" type="email" aria-invalid="true" aria-describedby="email-err">
  <span class="a-error" id="email-err"><i data-lucide="alert-circle"></i>Email thiếu phần tên miền, ví dụ khoa@gmail.com</span>
</div>
```
- Cao 40 (`.a-input--lg` 44). Viền `--line-control`; hover đậm hơn; focus: viền brand + vòng 3px brand 22%. Lỗi: `aria-invalid="true"` → viền danger; dòng `.a-error` có icon + **cách sửa**.
- Nhãn luôn hiện phía trên. Không dùng placeholder thay nhãn. Trường không bắt buộc ghi "(không bắt buộc)" màu `--text-3`; không đánh dấu `*` đỏ.
- `.a-search`: ô tìm trên canvas (nền `--field`, không viền, icon 16 trái; focus → nền surface).
- Kiểm tra lỗi **khi rời ô** (blur) hoặc khi gửi, không kiểm tra từng phím. Gửi lỗi → `shake` ô đầu tiên lỗi + focus vào nó.

### 6.3 Công tắc · checkbox · radio
`.a-switch` (36×20, núm trượt spring) · `.a-check-input[type=checkbox|radio]` (18px, ✓ nảy spring) · `.a-check-row` (nhãn + control, cao ≥ 32, cả hàng bấm được). Viền khi tắt = `--line-control`. Công tắc **lưu ngay** khi gạt (lạc quan + toast lỗi thì gạt lại), không cần nút Lưu.

### 6.4 Chip · tag · trạng thái · badge
- `.a-chip` (bấm được, 30px, `aria-pressed`): bộ lọc. Đang chọn: nền `--brand-soft`, viền `--brand-line`, chữ `--brand-text`. Chip lọc có `chevron-down` khi mở popover; hiện giá trị đã chọn ("TP.HCM +1").
- `.a-tag` (chỉ đọc, 22px): thuộc tính. `.a-tag--new` = "Mới" (accent).
- `.a-status` (chấm + chữ): `--info` `--success` `--warning` `--danger`. Map trạng thái đơn ứng tuyển: Đã nộp → mặc định · Đang xem xét → info · Vào danh sách rút gọn → info · Mời phỏng vấn → success · Nhận offer → success · Từ chối → danger · Đã rút đơn → mặc định.
- `.a-badge` (18px, số): `--accent` chưa đọc · `--muted` đếm thường. `.a-dot` chấm chưa đọc không số.

### 6.5 Avatar · logo · vòng tin
- Người = `.a-avatar` tròn (`--16/24/28/32/36/40/44/56/72/96`), ảnh `img` bên trong hoặc chữ viết tắt `initials(name)` (2 từ cuối: "Nguyễn Minh Anh" → "MA"), tông `toneOf(name)`. Online: `data-online="true"` (chấm success, viền `--ring` = màu nền chứa).
- Tổ chức = `.a-logo` vuông bo (`--28/32/36/44/56`), chữ `orgInitials(name)` ("TechNova" → "TN", "GreenLeaf Foods" → "GF").
- Có tin 24h chưa xem: bọc `.sring` (vòng brand 2px, khe trắng 2px); đã xem `.sring.is-seen` (xám).
- Ảnh avatar lỗi → về chữ viết tắt (không dùng ảnh mặc định xám, không dùng `ui-avatars.com`).

### 6.6 Segmented · tabs · chỉ báo
```html
<div class="a-seg" role="tablist"><span class="a-seg__thumb"></span>
  <button class="a-seg__btn" role="tab" aria-selected="true">Đoạn chat</button> …</div>
<div class="a-tabs" role="tablist"><span class="a-indicator" data-axis="x" data-inset="12"></span>
  <button class="a-tab" role="tab" aria-selected="true">Tổng quan</button> …</div>
```
Gọi `ArisMotion.segment(root, btnĐangChọn, {instant:true})` / `indicator(ind, tabĐangChọn, {instant:true})` lúc tải; khi đổi thì gọi lại không `instant`. Gọi lại với `instant` khi `resize`. `.a-indicator` phải là **con trực tiếp** của container `position: relative`.

### 6.7 Hàng danh sách `.a-row`
Cao ≥ 56 (tin nhắn 64–72, job 84). Hover: lớp `--hover`. Đang chọn `aria-selected="true"`: nền `--selected` + `--shadow-1` + chỉ báo trái. Chưa đọc `.a-row--unread`: dòng phụ đậm `--text`, giờ `--accent-text`. Danh sách chọn được: `role="listbox"`, hàng `role="option"`, roving `tabindex` (0 cho hàng đang chọn, −1 còn lại), ↑/↓ di chuyển.
Thông báo `.a-row.notif` + `.notif__bar`: vạch accent `scaleY(1)` khi chưa đọc, co về 0 (320ms) khi đọc.

### 6.8 Sheet · card
`.a-sheet` (vùng làm việc, bo 16) · `.a-card` (đối tượng, bo 12, padding 16) · `.a-card--interactive` (hover nhích 1px + bóng hiện bằng opacity pseudo-element). Card chỉ cho **đối tượng** (một việc, một CV, một ứng viên), không cho section.

### 6.9 Popover · menu · tooltip
- `.a-pop` (bo 12, `--shadow-3`) mở bằng `openPopover(pop, nút, 'right'|'bottom'|'bottom-end'|'top')`: tự căn trong màn hình, nở từ nút, Esc/bấm ra ngoài đóng + trả focus. Chỉ một popover mở một lúc.
- Menu: `.a-menu__item` (36px, icon 16 `--text-3`), `.a-menu__sep`, `.a-menu__label`, `--danger`. `role="menu"` → focus mục đầu khi mở; ↑/↓ di chuyển.
- Tooltip `[data-tip]` (+ `data-kbd="Ctrl K"`, `data-tip-side`): chỉ cho nút icon và phím tắt; không chứa thông tin quan trọng duy nhất.
- Thẻ hồ sơ khi hover (`#hovercard` trong `feed-demo.js`): trễ 480ms vào, 240ms ra; di chuột vào thẻ thì giữ; chỉ `pointerType` chuột/bút; tự quản lý ẩn/hiện (không qua `openPopover`, xem Bẫy 10.6).

### 6.10 Hộp thoại · bottom sheet · xác nhận
```html
<div class="a-scrim" id="xScrim" hidden></div>
<div class="a-dialog" id="x" role="dialog" aria-modal="true" aria-labelledby="xTitle" hidden>
  <div class="a-dialog__head"><h2 class="a-dialog__title" id="xTitle">…</h2><button … data-close aria-label="Đóng">…</button></div>
  <div class="a-dialog__body">…</div>
  <div class="a-dialog__foot"><button class="a-btn a-btn--ghost">Huỷ</button><button class="a-btn a-btn--primary">Lưu</button></div>
</div>
```
- Desktop: 480px mặc định (trang tự đặt rộng hơn), cao tối đa `min(640px, 100dvh − 48px)`, thân cuộn. **Mobile: luôn là bottom sheet tràn ngang** (có tay nắm) — `line.css` dùng `width: 100% !important` để thắng độ rộng riêng của trang (Bẫy 10.4).
- Mở `openDialog(dlg, scrim, nútGốc)`; đóng: nút ×, Esc, bấm scrim → `closeDialog` (thu về nút gốc + trả focus). Focus vào ô đầu tiên khi mở; Tab không ra khỏi hộp thoại.
- **Xác nhận** chỉ cho thao tác **không hoàn tác được**: xoá tài khoản, bỏ bài đang soạn, rút đơn ứng tuyển. Nút an toàn ("Tiếp tục soạn", "Giữ tài khoản") được focus sẵn. Xoá tài khoản: gõ "XOÁ" để bật nút.
- Nếu JS nghiệp vụ cũ gọi `bootstrap.Modal` / sự kiện `*.bs.modal` → giữ cơ chế Bootstrap, chỉ đổi style (class `.a-dialog` bên trong `.modal-dialog`) và animation.

### 6.11 Toast
Nền `--inverse`, chữ `--on-inverse`, bo 10, tối thiểu 260px. Icon theo `tone` (success/danger). Tối đa 1 nút hành động (`--inverse-action`: "Hoàn tác", "Thử lại", "Xem"). Tự đóng 4s / 6s có nút; rê chuột dừng đếm; vuốt ngang > 80px đóng. `role="status"` (lỗi: `role="alert"`). Nhiều toast xếp chồng, cái cũ dồn bằng FLIP.

### 6.12 Đang tải · trống · lỗi
- **Skeleton** `.a-skel` đúng hình nội dung thật (hàng job, bài viết, bình luận, tin nhắn). Không spinner giữa trang.
- **Nét quỹ đạo** `ArisMotion.loaderSvg()`: trong nút đang gửi, kéo-để-làm-mới, ảnh đang tải lên.
- **Trống** `.a-empty`: icon 24 `--text-4` + tiêu đề 15/600 + câu giải thích **vì sao trống** + tối đa 1 nút. Trống do bộ lọc → đưa chip "bỏ từng điều kiện" (xem `jobs-demo.js` `emptyHtml`).
- **Lỗi**: nói chuyện gì xảy ra + "Thử lại"; **giữ nguyên** dữ liệu người dùng đã nhập / bộ lọc đang chọn.
- Mất kết nối realtime (SignalR `onreconnecting`): dải mỏng đầu vùng chat "Đang kết nối lại…" + nét quỹ đạo; `onreconnected` → "Đã kết nối lại" 2s rồi ẩn.

### 6.13 Lightbox
`openLightbox([imgThumb…] | [{src, alt, caption, thumb}], index, caption)`. Nền tối cố định, ảnh ≤ 88vw × 82dvh. Nhiều ảnh: ‹ › (desktop), ← →, vuốt (mobile), đếm "2 / 5". Đóng: × / Esc / bấm nền → ảnh thu về đúng thumbnail của ảnh đang xem (thumbnail không còn trên màn → mờ dần). DOM tự tạo khi mở lần đầu.

### 6.14 Mục lục dính `.a-toc`
```html
<nav class="a-toc" data-toc aria-label="Mục lục"><span class="a-indicator" data-axis="y"></span>
  <a href="#gioi-thieu">Giới thiệu</a> <a href="#kinh-nghiem">Kinh nghiệm</a> …</nav>
```
`initToc(toc)` (tự chạy với `[data-toc]`): mục đang chiếm phần trên màn hình sáng lên + chỉ báo trượt; bấm → cuộn mượt tới mục, cập nhật hash. Mục tiêu cần `scroll-margin-top: 84px`. Nằm trong grid → cần `align-self: start` (đã có; Bẫy 10.5). Ẩn khi < 1100px.

### 6.15 Header trang `.a-pagehead`
Sticky, nền canvas, cao 68 (mobile 56). Trái: tiêu đề 22/600 + meta 13 `--text-3` ("128 việc đang tuyển"). Phải: hành động của trang (tối đa 1 primary). Viền dưới hiện khi đã cuộn (`stickyHeader`). **Không** mô tả dài, không hero.

### 6.16 Kéo-thả
`ArisMotion.sortable(container, { selector: '.item', axis: 'x'|'y', ignore: '.nút-xoá', onChange })`. Mục kéo được thêm `.a-drag` (con trỏ grab, `touch-action: none`). Đang kéo: `.is-dragging` (bóng `--shadow-3`, z-index 3). Bàn phím: Alt + mũi tên. Kéo **giữa các cột** (pipeline) → xem `PAGES.md` Tuyển dụng.

---

## 7. Mẫu tương tác

### 7.1 Lạc quan + Hoàn tác

| Thao tác | Cách làm |
|---|---|
| Thích bài, thích bình luận, lưu, theo dõi, gạt công tắc, bình chọn | **Lạc quan**: đổi giao diện ngay (+ animation), gọi API sau. Lỗi → trả lại trạng thái cũ, `shake` nút, toast lỗi. Không khoá nút khi đang chờ. |
| Gửi bình luận, gửi tin nhắn | Hiện ngay trong danh sách (tin nhắn: trạng thái "Đang gửi" mờ); lỗi → mục đó hiện "Chưa gửi được · Thử lại". |
| Xoá bài, xoá bình luận, xoá lời mời kết bạn, từ chối phỏng vấn, ẩn bài, bỏ gợi ý | **Hoàn tác**: `removeFrom` ngay, toast 6s "Đã xoá … · Hoàn tác". API gọi khi hết 6s (hoặc khi toast bị đóng bằng ×). Hoàn tác → chèn lại đúng vị trí (`flip`) + `highlight`. Rời trang trong 6s → gọi API ngay (`pagehide`). |
| Ứng tuyển, lưu hồ sơ, đổi tên, hẹn phỏng vấn, đăng bài | **Không lạc quan**: `morphButton` loading → success/error; đóng dialog khi success. |
| Xoá tài khoản, rút đơn ứng tuyển, bỏ bài đang soạn | **Xác nhận** trước (6.10). |

### 7.2 Master–detail (Việc làm, Tin nhắn, Tuyển dụng)
- Chọn mục: chỉ báo trượt + chi tiết **đổi tại chỗ** (ra 120ms / vào 220ms), không tải lại trang; URL đồng bộ bằng `history.replaceState` (`?job=12`, `?userId=11`) để F5 và chia sẻ link vẫn đúng.
- Desktop tự chọn mục đầu tiên; mobile không tự chọn — chạm mới mở chi tiết (trượt từ phải, nút ‹ quay lại).
- Chi tiết cuộn quá 150px → thanh gọn trên đầu sheet (tên + hành động chính) trượt xuống.
- Phím J/K (↑/↓) đổi mục; mục được cuộn vào tầm nhìn (`block: 'nearest'`).

### 7.3 Lọc & tìm
Đổi bộ lọc là **ra kết quả ngay** (không nút "Áp dụng"), danh sách đổi bằng `flip`, số kết quả `rollNumber`. Popover bộ lọc hiện **số kết quả cho từng lựa chọn** (tính theo các bộ lọc khác). Ô tìm debounce 180–250ms. Bộ lọc + từ khoá đồng bộ vào URL. "Xoá bộ lọc" hiện khi có ít nhất một điều kiện.

### 7.4 Form lưu thay đổi (Hồ sơ, Cài đặt, Công ty)
- Sửa bất kỳ ô nào → **thanh "Có thay đổi chưa lưu"** trượt lên đáy màn hình (surface + `--shadow-3`): "Bạn có 3 thay đổi chưa lưu · Huỷ · Lưu thay đổi". Ctrl/⌘ S = Lưu.
- Lưu: `morphButton`; xong → thanh trượt xuống + toast "Đã lưu thay đổi.". Lỗi từng ô → ô đó hiện `.a-error`, thanh vẫn ở lại.
- Rời trang khi còn thay đổi → `beforeunload` hỏi. Không autosave trừ công tắc (lưu ngay, 6.3).
- Sửa **tại chỗ** cho trường đơn lẻ (giới thiệu bản thân, tên CV, bài viết): chữ → ô nhập cùng vị trí; Esc huỷ, Ctrl+Enter lưu.

### 7.5 Realtime
| Sự kiện | Phản hồi |
|---|---|
| Tin nhắn mới (`ReceiveMessage`) | Hàng hội thoại nhảy lên đầu bằng `flip` + badge accent `pulse`; badge rail Tin nhắn lăn số. Đang mở đúng hội thoại → tin trượt vào đáy; đã cuộn lên → nút "↓ Tin nhắn mới" có badge. |
| Đang gõ (`UserTyping`) | 3 chấm (`infinite` được phép), tự tắt sau 4s không có tín hiệu mới; gửi `Typing` tối đa 1 lần/2s. |
| Online (`PresenceChanged`) | Chấm online bật/tắt (scale), dòng "Đang hoạt động". |
| Đã xem (`MessagesRead`) | Avatar "đã xem" nhỏ **trượt** xuống tin mới nhất (không nhảy). |
| Thông báo (`ReceiveNotification`) | Badge chuông `pulse` + lăn số; popover đang mở → mục mới chèn đầu. |
| Bài mới [CẦN BACKEND] | Nút "↑ N bài mới" (avatar người đăng) dính đầu bảng tin; bấm → cuộn lên + chèn bài bằng `flip` + nháy viền. Không tự chèn làm xô nội dung đang đọc. |

### 7.6 Cuộn vô hạn
`IntersectionObserver` với `rootMargin: 600px` (bảng tin) / `200px` (danh sách job) trên phần tử canh ở cuối. Đang tải: 1–3 skeleton đúng hình. Mục mới: `stagger`. Hết: dòng kết thúc có ý nghĩa ("Bạn đã xem hết bài mới" + dấu ✓ tự vẽ khi lọt vào màn hình). Lỗi: "Không tải thêm được · Thử lại" tại chỗ skeleton.

### 7.7 Nhắc tên & chủ đề
Gõ `@` + chữ trong ô soạn bài/bình luận/sửa bài → popover gợi ý bạn bè (tối đa 5, so khớp không dấu theo đầu từ), ↑/↓ + Enter/Tab chọn, Esc đóng (không đóng dialog). Chèn `@Họ Tên ` . Khi hiển thị: `@Họ Tên` và `#chủđề` thành link `--brand-text` 500; `@tên` có thẻ hover. [CẦN BACKEND] để lưu mention/hashtag có cấu trúc — trước đó chỉ hiển thị bằng regex tên bạn bè.

### 7.8 Bộ gõ tiếng Việt (bắt buộc)
Mọi chỗ "Enter để gửi": bỏ qua khi `e.isComposing || e.keyCode === 229`. Không được gửi nửa chữ đang ghép (Unikey/EVKey/bàn phím điện thoại). Kiểm thử bằng Telex: gõ "chúc mừng" rồi Enter → gửi đúng "chúc mừng".

---

## 8. Chữ và giọng văn

- **Xưng hô:** "bạn" với người dùng; tên người dùng khi chào tên (không "Xin chào, Khoa! 👋" đầu trang).
- **Câu ngắn, cụ thể:** người dùng làm được gì, bao nhiêu, bước tiếp theo. Có số thì ghi số ("128 việc đang tuyển", "Còn 61 ngày").
- **Nhãn nút = động từ + đối tượng:** "Gửi hồ sơ", "Nhận lời", "Thêm vào lịch", "Đánh dấu đã đọc". Không "OK", "Submit", "Xác nhận" chung chung.
- **Viết hoa kiểu câu** (chỉ chữ đầu + tên riêng): "Việc cần làm", không "Việc Cần Làm".
- **Thời gian:** "Vừa xong · 5 phút · 3 giờ · Hôm qua · 3 ngày · 12/09 · 12/09/2025" (khác năm). Tooltip `title` trên giờ = đầy đủ "26 tháng 9, 2026 lúc 14:32".
- **Tiền:** "25–35 triệu", "Thoả thuận". **Số lớn:** dấu chấm ngăn nghìn "3.000".
- **Lỗi:** chuyện gì + cách sửa: "Email thiếu phần tên miền, ví dụ khoa@gmail.com". Không "Đã xảy ra lỗi" trơn. Không đổ lỗi người dùng.
- **Trống:** vì sao + bước tiếp: "Bạn chưa có CV nào. Tạo CV trong 5 phút từ hồ sơ có sẵn để ứng tuyển bằng một cú bấm."
- **Cấm:** "Khám phá tiềm năng", "Nâng tầm sự nghiệp", "Hành trình của bạn bắt đầu từ đây", "Vũ trụ nghề nghiệp", "Trải nghiệm đẳng cấp", "Unlock", "Empower", dấu chấm than hàng loạt, ✨🚀 trong giao diện, trộn tiếng Anh ("Apply now", "just now").

---

## 9. Danh sách cấm

Thấy mình đang làm một trong các thứ dưới đây → dừng, làm cách khác.

**Bố cục:** hero banner (tiêu đề to + mô tả + 2 CTA) ở bất kỳ trang workspace nào · hàng 4 ô KPI đầu trang · bento lấp chỗ trống · lưới "3 ô tính năng icon tròn" · card soup, card lồng card · cột phụ chỉ để trang trí (cột phụ Bảng tin được phép vì **toàn bộ** là việc bấm được) · ảnh bìa stock/gradient mặc định, avatar đè mép ảnh bìa · căn giữa nội dung workspace (chỉ căn giữa empty state và trang auth).

**Màu & hiệu ứng:** gradient (trừ lớp tối chức năng trên ảnh, 3.1.2) · chữ gradient · glow (`box-shadow`/`text-shadow` phát sáng, viền neon) · glassmorphism (`backdrop-filter` tối đa 3 chỗ: chưa cần chỗ nào trong V7) · nền màu cho section · **icon trong ô vuông/tròn nền pastel** · **viền trái màu trên card bo góc** · **chữ in hoa giãn cách làm eyebrow** · nền canvas/WebGL/particle/starfield/quả cầu/hố đen · Three.js.

**Chuyển động:** `infinite` trang trí · reveal-on-scroll đại trà · parallax · tilt 3D · spotlight theo chuột · con trỏ tuỳ biến · ripple · animate `width/height/top/left/margin/box-shadow` (trừ ngoại lệ 4.3.2) · vòng rAF khi đứng yên.

**Nội dung:** emoji làm icon · copy sáo rỗng (mục 8) · UI giả (số liệu bịa như "1.234 người đang xem", nút cho tính năng chưa có backend) · chữ tiếng Anh trong giao diện.

**Kỹ thuật:** thêm thư viện JS/CSS mới (chỉ CSS thuần, WAAPI, View Transitions, IntersectionObserver) · hex/rgb trong CSS trang (trừ 3.1.2) · `<style>` inline trong view · 2 bản Bootstrap · `!important` ngoài các chỗ đã có trong `line.css`.

---

## 10. Bẫy kỹ thuật đã gặp

Các lỗi **thật** đã gặp khi dựng bản tham chiếu. Agent triển khai gần như chắc chắn gặp lại nếu không đọc mục này.

### 10.1 Animation giữ `transform` làm hỏng `position: fixed`
Phần tử có animation transform đang "giữ" trạng thái cuối (`fill: forwards/both`, hoặc CSS `animation-fill-mode: both`) trở thành **khối chứa** của con `position: fixed` → con bị ghim theo phần tử đó thay vì màn hình. Đã gặp: thanh "Ứng tuyển" cố định ở đáy (mobile) nằm tụt xuống cuối nội dung vì `.jd-swap-in { animation: … both }`. **Cách làm đúng:** animation vào dùng fill `backwards`; gỡ class khi `animationend`; WAAPI có `fill: 'forwards'` thì `getAnimations().forEach(a => a.cancel())` ngay sau khi xong (xem `closeDialog`, `closeMobileDetail`).

### 10.2 `scroll-snap` + `padding` làm lệch vị trí đầu
Vùng cuộn ngang có `scroll-snap-type` và `padding` nhưng thiếu `scroll-padding-inline` → trình duyệt tự cuộn lệch đúng bằng padding lúc tải (avatar đầu bị che, nút ‹ hiện sai). **Luôn** đặt `scroll-padding-inline` = padding (`.stories__track`, `.hscroll`).

### 10.3 Tên icon Lucide không tồn tại
Icon sai tên → `<i>` trống, **không có lỗi console**. Kiểm mọi tên với bản 0.344 (3.5).

### 10.4 Dialog mobile bị hở mép phải
CSS trang đặt `width: min(560px, calc(100vw - 32px))` cho dialog của mình → thắng quy tắc bottom sheet `width: 100%` của `line.css` (cùng độ ưu tiên, nạp sau). Đã sửa trong `line.css` bằng `width: 100% !important` trong media mobile. **Không** xoá `!important` đó.

### 10.5 `position: sticky` trong grid không dính
Phần tử sticky là con của grid bị giãn hết chiều cao hàng → không có chỗ để "dính", các mục bên trong bị giãn cách xa nhau. Cần `align-self: start` (+ `align-content: start` nếu chính nó là grid). Đã sửa cho `.a-toc`; áp dụng cho mọi cột phụ sticky (`.feed-side` đã có `align-items: start` ở grid cha).

### 10.6 Popover dùng chung bị "tranh" ẩn/hiện
`unpop()` đặt `hidden = true` **sau** animation 110ms. Nếu trong lúc đó lại mở chính popover ấy (thẻ hover chuyển từ người này sang người khác) → vừa mở xong đã bị ẩn. Thẻ hover tự quản lý bằng **token** (`hcTok`): chỉ ẩn nếu token không đổi (`feed-demo.js` `showHc/hideHc`).

### 10.7 FLIP cần giữ nguyên phần tử
`flip()` so vị trí **cùng một phần tử DOM** trước/sau. Nếu render lại bằng `innerHTML`, mọi phần tử là mới → không có gì trượt, chỉ fade. Cập nhật danh sách bằng cách **giữ phần tử cũ, thêm/bớt/đổi chỗ** (xem `jobs-demo.js` `render`, `feed-demo.js` `patchPreviews`).

### 10.8 Bộ gõ tiếng Việt và Enter
Xem 7.8. Thiếu kiểm `isComposing` → gửi chữ nửa vời.

### 10.9 Grid item và `text-overflow`
Chữ `white-space: nowrap` trong grid item không có `min-width: 0` / `grid-template-columns: minmax(0, 1fr)` → đẩy cột rộng ra thay vì cắt "…". Đã gặp ở dòng meta của hàng job.

### 10.10 `dblclick` trên điện thoại
Dùng 2 lần `pointerup` cách nhau < 320ms và < 40px thay vì `dblclick` (xem `wireCarousel`). Bỏ qua nếu con trỏ đã di > 10px (đang vuốt carousel).

### 10.11 Click sau khi kéo
Kéo-thả xong trình duyệt vẫn bắn `click` → mở nhầm mục. `sortable()` chặn click ngay sau khi kéo (capture phase). Code kéo-thả tự viết phải làm tương tự.

### 10.12 Màu trong animation JS
WAAPI không tự đổi màu theo theme giữa chừng. Cần màu từ token → đọc `getComputedStyle(document.documentElement).getPropertyValue('--brand-line')` ngay trước khi chạy (xem `ringFlash`).

---

## 11. Hiệu năng

Đo bằng `.local/ui-v6/perf.js` (agent V6 đã viết), desktop 1440×900, đã đăng nhập, tắt cache.

| Chỉ số | Ngân sách mỗi trang |
|---|---|
| Có tải `three` | Không |
| `rafIdle3s` (rAF trong 3 giây đứng yên) | **0** |
| CSS + JS của dự án (không tính `/lib/`, chưa nén) | ≤ 250 KB (Chat hiện 636 KB). Lõi: `aris-line.css` ≤ 60 KB; `aris-motion.js` + `aris-shell.js` + `aris-palette.js` ≤ 70 KB |
| CLS | ≤ 0.05 (ảnh luôn có `aspect-ratio` hoặc width/height) |
| LCP sau TTFB | ≤ 1000 ms |
| Task > 50ms | ≤ 2 |
| Nút DOM | ≤ 3000 (bảng tin: gỡ bài đã cuộn qua xa nếu > 60 bài) |
| Lỗi JS | 0 |

Và mọi chỉ số **tốt hơn hoặc bằng** baseline của V6.

---

## 12. Nghiệm thu

### 12.1 Mỗi trang (ghi ✓/✗ + ảnh trong báo cáo)
1. Ảnh chụp **sáng + tối + mobile 390×844** đặt cạnh ảnh reference tương ứng (`tools/shoot.js`); khác biệt phải có lý do.
2. Mọi tương tác liệt kê trong `PAGES.md` của trang đó chạy được — **quay GIF hoặc chụp từng bước** cho các tương tác chính.
3. Loading / trống / lỗi đều có (giả lập bằng DevTools: Slow 3G, Offline).
4. Bàn phím: Tab đi hết được, focus luôn nhìn thấy, Esc đóng đúng lớp, phím tắt của trang chạy.
5. Reduced motion (DevTools → Rendering → Emulate): không animation nào chạy, mọi trạng thái cuối vẫn đúng.
6. Không có chữ tiếng Anh, không có hex trong CSS trang, không `<style>` inline, không icon trống.
7. Số đo hiệu năng (mục 11).

### 12.2 Lệnh toàn cục (dán kết quả vào báo cáo)
```powershell
node docs/design-v7/tools/contrast.js --fail                                   # tương phản: exit 0
rg -n "three(\.min)?\.js|aris-(constellation|cosmos|earth|gargantua|warp|auth-stage)|black-hole" ArisSkyve/Views ArisSkyve/wwwroot/js/aris-shell.js   # không còn tham chiếu
rg -n "<style" ArisSkyve/Views -g "*.cshtml"                                   # không còn style inline
rg -n "#[0-9A-Fa-f]{3,8}\b|rgba?\(" ArisSkyve/wwwroot/css/pages                # chỉ các ngoại lệ 3.1.2
rg -n "background-clip:\s*text|0 0 [0-9]+px .*(2F6FED|brand)" ArisSkyve/wwwroot/css  # không chữ gradient, không glow
rg -n "infinite" ArisSkyve/wwwroot/css ArisSkyve/wwwroot/js                    # chỉ các trường hợp 4.3.3, giải thích từng dòng
rg -n "aris-constellation|Living Cosmos" ArisSkyve/wwwroot/lib/lucide/lucide.min.js   # phải rỗng
dotnet build ArisSkyve/ArisSkyve.csproj -c Debug -o .local/v7-build --nologo   # build ra thư mục riêng
```
