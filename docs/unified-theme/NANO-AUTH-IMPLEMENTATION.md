# Login/Register dựng hoàn toàn bằng hạt nano — nhật ký triển khai

Ngày 19/09/2026. Phiên này **có sửa source** (khác các phiên trước chỉ viết plan), theo yêu cầu trực tiếp của người dùng: *"bạn tự fetch trang lusion.com đi xem so sánh với trang hiện tại của mình tự update lại"*.

Phạm vi sửa: **chỉ hai file tĩnh trong `wwwroot`**.

| File | Trước | Sau |
|---|---|---|
| `wwwroot/js/aris-auth-stage.js` | 1.323 dòng | ~1.800 dòng, viết lại engine |
| `wwwroot/css/aris-auth.css` | 712 dòng | 910+ dòng (thêm mục 9, 10, 11) |

**Không đụng:** `_AuthLayout.cshtml`, `Account/Login.cshtml`, `Account/Register.cshtml`, controller, backend, database, `docs/design-lab/aris-login-v5/`. Lý do kỹ thuật: project không bật `AddRazorRuntimeCompilation`, nên sửa Razor sẽ bắt buộc rebuild và restart server đang chạy của người dùng. Toàn bộ thay đổi nằm ở static file nên chỉ cần refresh.

Bản gốc đã lưu tại `%TEMP%/aris-auth-stage.backup.js` và `%TEMP%/aris-auth.backup.css`.

---

## 1. Yêu cầu của người dùng trong phiên này

Nêu dần qua nhiều lượt, tất cả đều đã làm:

1. Đối chiếu với `https://lusion.co/` và nâng trang login lên ngang tầm.
2. **Form đăng nhập/đăng ký phải được tạo từ các hạt nano**, chuyển đổi element bằng cách di chuyển hạt.
3. **Chậm lại** tốc độ chuyển đổi.
4. **Nâng chất lượng stage đầu**.
5. Bỏ hạt đi thì vẫn thấy hộp nút Google/Facebook → **toàn bộ component bên trong phải do hạt tạo**, không để người dùng nhận ra hộp CSS.
6. Các đoạn trong mỗi vòng DNA mô phỏng **một vũ trụ nhỏ**, theo ảnh tham chiếu Andromeda: đĩa bầu dục nghiêng, nhân sáng, sao lấp lánh.
7. **Bỏ nền mờ** sau form, **tăng glow** hạt cho giống hành tinh, **chữ tĩnh cũng phải viết bằng các hành tinh con**.

## 2. Đối chiếu lusion.co — quan sát có kiểm chứng

Đã tải markup trang chủ (59.671 bytes) và đọc cấu trúc. Đây là quan sát DOM, **không phải** đọc shader của họ.

| Quan sát | Áp dụng |
|---|---|
| Đúng một `<canvas id="canvas">`, toàn bộ UI nằm trong `<div id="ui">` chồng lên | Đúng mô hình ta đang dùng — giữ |
| `preloader-percent-digit-num`, hiển thị `0 0 0 0 0 0` | Mỗi chữ số là một phần tử riêng để roll độc lập |
| `header-menu-link-text` + `...-text-clone` | Hover = hai bản text chồng nhau trong khung `overflow:hidden` |
| `home-reel-title-line-1/2`, `...-title-line` | Tiêu đề **tách sẵn theo dòng** để mask-reveal, không fade cả khối |
| `scroll-nav-cross`, `end-section-content-cross` | Một hệ dấu trang trí lặp lại thành ngôn ngữ nhận diện |
| `header-right-sound-btn`, `PLAY`/`MUTE` | Có thiết kế âm thanh |
| `theme-color: #ffffff`, favicon mặc định bản light | **Trang chủ Lusion là nền sáng.** "Ngang tầm Lusion" ≠ "tối hơn" |

Điều rút ra: đẳng cấp đó không đến từ một hiệu ứng lớn, mà từ chỗ **mọi phần tử trong DOM đều được thiết kế để chuyển động**. Bản cũ của ta có đúng một hoạt cảnh mở đầu rồi im.

**Chưa làm theo Lusion** (nêu rõ để không nhận công): preloader đếm %, hover clone-and-roll cho link, con trỏ tuỳ biến, sound toggle. Xem §7.

## 3. Hiện trạng trước khi sửa — nguyên nhân gốc

| Vấn đề | Bằng chứng |
|---|---|
| Con trỏ chỉ xoay cả nhóm, không có lực cục bộ | `aris-auth-stage.js:1064-1074` cũ: `cardGroup.rotation.y = currentPointer.x * tiltStrength` |
| Cảnh tắt hẳn sau intro | `evidence/live-login/03_settled_login_card.png` |
| Không env map, không post-processing → vật liệu phẳng | grep `envMap|PMREM|EffectComposer` = 0 kết quả |
| Hạt đọc ra confetti | `SphereGeometry(0.016, 8, 6)` ở bán kính 0.016 |
| Hạt xếp thành khung chữ nhật quanh card | `evidence/live-login/05_register_mode_morphed.png` |

## 4. Engine mới — những gì thực sự thay đổi

### 4.1 Hình học lấy từ DOM thật

`rebuildNanoPaths()` đo `getBoundingClientRect()` của từng control trong panel đang hiển thị, đổi sang toạ độ world, rồi rải hạt theo:

- **viền** (`sampleRoundedRect`, lấy mẫu đều theo độ dài cung, bán kính góc đọc từ `borderTopLeftRadius`)
- **mặt** (lưới phân tầng có jitter tất định — lưới trơn đọc ra như bản in tram, random thuần thì lỗ chỗ)
- **chữ** (§4.4)

`PATH_SPEC` hiện gồm: khung card, hai vạch divider hai bên nhãn, hai nút social, ô email, nút chính.

**Lỗi nghiêm trọng đã sửa trong quá trình làm:** phép chiếu ban đầu dùng camera đang sống. Camera lùi lúc intro (`z = base + 2.1`) nên mọi outline bị phóng to đúng hệ số `cameraZ / cameraBaseZ` = 1,375× và không còn nằm trên control. Nay `screenToPlane()` dùng **tư thế tham chiếu cố định** `(0, 0, cameraBaseZ)`, và camera **không parallax khi ở trạng thái nghỉ** — chỉ parallax lúc intro, khi DOM đang ẩn.

`layoutSignature()` chạy mỗi 250ms, so chuỗi rect; đổi layout (font load, đổi mode, scroll, resize) thì tự đo lại.

### 4.2 Không còn bề mặt CSS nào

CSS mục 10 và 11 chuyển giao toàn bộ phần nhìn cho hạt:

```
background / border / box-shadow của .auth-input-field, .btn-social-item,
.btn-auth-primary  →  transparent
hairline của .auth-divider::before/after            →  transparent
nền + backdrop-filter của .auth-glass-card          →  transparent
text của mọi phần tử đã rasterise (.nano-glyph)     →  transparent
```

Giữ lại trong CSS đúng ba thứ mà hạt **không được phép** chịu trách nhiệm: vùng bấm, màu selection, và **focus ring thật**. Phản ứng của hạt là tăng cường, không phải affordance trợ năng.

`.webgl-fallback` khôi phục lại toàn bộ nền/viền/gradient, vì khi đó không còn gì vẽ các control nữa.

### 4.3 Vật liệu và ánh sáng

- **Env probe dựng bằng code**, không tải HDR runtime: vỏ cầu gradient + tấm key rộng trên trái + tấm cobalt dội dưới phải + vệt ice phía sau, đưa qua `PMREMGenerator.fromScene`.
- `outputEncoding = sRGBEncoding`, `ACESFilmicToneMapping`, exposure 1.00.
- Ba vật liệu (bạc gương / cobalt / ice phát sáng) **xen kẽ theo chỉ số** `body % 3`. Đây là cách chặn lỗi banding của bản trước: chỉ số quyết định vật liệu, nên nếu chỉ số tương quan với vị trí thì chữ sẽ bị chia nửa sáng nửa tối.
- **Glow cộng sáng** bằng instanced quad cho hai trong ba nhóm — đóng vai trò bloom mà không cần render target thứ hai. **Hạt chữ không có glow**: quầng sáng gấp 7 lần thân hạt biến chữ thành vệt nhoè.
- Hai lớp point ở chiều sâu khác nhau, trôi khác tốc độ, làm lớp nền thứ ba.
- Vignette + grain động là overlay DOM (CSS mục 9.2), không tốn pass GPU nào.

### 4.4 Chữ viết bằng hạt

Mỗi phần tử text một dòng được rasterise bằng **chính font computed của nó** (`fontStyle/fontWeight/fontSize/fontFamily`, cả `textAlign` và `letterSpacing`), supersample ×2, rồi lấy mẫu độ phủ với bước `fontSize × 2 / 11` — chữ nhỏ cần lưới dày hơn, nếu không nét sẽ rã thành chấm rời.

DOM text **không bị xoá**, chỉ tô trong suốt: screen reader, bôi đen, dịch trang, tìm kiếm trong trang đều còn nguyên.

Phần tử **nhiều dòng bị bỏ qua có chủ ý** (`rect.height > fontSize × 1.85`): tái tạo wrapping ở đây là đoán mò, và chữ không đọc được tệ hơn chữ hiện bằng DOM.

**Lỗi ngân sách đã sửa:** ban đầu path chữ chấm điểm theo *số mẫu* (hàng trăm) còn path hình học chấm theo *đơn vị world* (một chữ số) — chữ nuốt gần như toàn bộ hạt và các control biến mất. Nay cả hai quy về **"số hạt mong muốn" tính theo pixel**: viền 1 hạt/5px, mặt 1 hạt/8,5×8,5px, chữ 1 hạt/mẫu.

### 4.5 Tương tác — lực cục bộ thật

Bỏ hẳn `cardGroup.rotation`. Mỗi hạt có vị trí + vận tốc, tích phân theo `dt` có chặn:

- lực lò xo về đích + damping (ζ ≈ 0,62 — thiếu tắt dần một chút, nên có quán tính, rời chuột không snap)
- lực đẩy hướng tâm trong bán kính hữu hạn quanh con trỏ
- thành phần tiếp tuyến tỉ lệ tốc độ con trỏ → có wake cong
- **hệ số nhượng bộ theo loại hạt**: trường tự do 1,35 — viền/mặt control 0,55 — **hạt chữ 0,10**. Con trỏ đứng trên form không được phép xé nát chữ người ta đang đọc. Lỗi này đã phát hiện qua ảnh `11_register_settled.png` và sửa.
- focus/hover một control thì path đó tăng `energy`: hạt to hơn, sáng hơn, đẩy nhẹ ra trước.
- gõ phím thì `typingDamp` hạ lực xuống 0,18.

### 4.6 Hoạt cảnh mở đầu — 5 nhịp, chậm hơn hẳn

| Nhịp | Thời gian | Nội dung |
|---|---|---|
| 1. Ignition | 0 → 1,10s | Hạt bay vào từ ngoài khung, nén thành lõi |
| 2. DNA | 1,10 → 3,85s | Chuỗi xoắn kép quay chậm, **mỗi vòng chứa một thiên hà** (§4.7) |
| 3. ARIS | 3,85 → 6,55s | Xoắn kép rã thành chữ, lệch pha theo chỉ số nên chữ hiện dần |
| 4. Build | 6,55 → 9,60s | Chữ rã ra bay thành **chính các outline của form**, có vòng cung ra ngoài giữa đường; DOM chỉ hiện sau khi outline đã vẽ xong |
| 5. Settled | 9,60s+ | Trạng thái sống: hạt vẫn chảy dọc outline, mặt control thở, cảnh không bao giờ "hết hiệu ứng" |

Morph Login↔Register: **0,45s → 1,15s**, có stagger theo hạt và vòng cung giữa đường, DOM cũ rời trước, DOM mới vào sau khi hạt đã tới.

Toàn bộ chuỗi chạy **một lần mỗi phiên** (`sessionStorage`); lần sau vào lại trong cùng phiên thì nhảy thẳng tới nhịp 4. Nút Bỏ qua và Phát lại luôn có.

### 4.7 Vũ trụ nhỏ trong mỗi vòng DNA

Dựng theo ảnh Andromeda người dùng đưa. Ba đĩa, mỗi đĩa nằm trong một vòng của chuỗi xoắn:

- **Nghiêng mạnh** (`galTilt` ≈ 0,26–0,38 rad) nên chiếu ra thành hình bầu dục dài tỉ lệ ~1:3, cộng góc quay trên màn hình (`galPA`) để nằm chéo.
- **Nhân**: 17% số hạt, phân bố ellipsoid có bề dày — không phải vòng phẳng.
- **Đĩa**: 4 nhánh xoắn, cộng gờ bán kính `sin(r × 14)` để các nhánh tách thành dải sáng xen dải tối.
- **Quầng**: sao rời rạc ngoài đĩa, **to hơn và nhấp nháy** — đây là phần "lấp lánh".
- **Hai vệ tinh** lệch khỏi tâm, như M32 và M110.
- **Quay vi sai**: trong nhanh ngoài chậm; quầng gần như đứng yên.
- Các đĩa **giữ nguyên hướng** trong khi chuỗi xoắn quay quanh chúng — nếu quay theo, mỗi vòng hình bầu dục sẽ bị dẹt rồi phồng hai lần một vòng, mất hẳn cảm giác thiên hà.

## 5. Bằng chứng

Ảnh trong `docs/unified-theme/evidence/nano-lusion/`, chụp bằng `scratchpad/verify_nano.py` trên `http://localhost:5025` thật, Chrome headless 1440×900.

| File | Nội dung |
|---|---|
| `01_ignite` → `05_settled` | Năm nhịp của hoạt cảnh mở đầu |
| `06_pointer_topleft`, `07_pointer_bottomright` | **Cùng một cảnh, hai vị trí con trỏ** — phân bố hạt khác nhau cục bộ, không phải cả cảnh bị xoay |
| `08_field_focused`, `09_typed` | Ô email được focus: outline tăng năng lượng |
| `10_morph_midflight` | Giữa chừng Login→Register: hạt đang bay, DOM text đã rời |
| `11b_register_settled_4s`, `12b_login_settled_4s` | Hai chiều chuyển đổi đã ổn định |
| `13_mobile_dna`, `14_mobile_settled` | 390×844 |
| `15_reduced_motion` | `prefers-reduced-motion: reduce` |

Kiểm tra chức năng trong cùng lượt chạy: **0 page exception, 0 console error/warning**; email mang sang được giữa hai mode (`ungvien.test@aris.vn`); URL đồng bộ `/Account/Register`; Back/Forward còn hoạt động.

## 6. Hiệu năng — số đo thật và giới hạn của nó

3.120 → **5.700 hạt** (1.900 × 3 mesh; mobile 1.080 × 3), cầu 14×10 segment, 5 instanced mesh.

| | median | p95 | max |
|---|---|---|---|
| Nghỉ | 16,7ms | 33,4ms | 37,3ms |
| Quét con trỏ liên tục | 16,7ms | 34,0ms | 37,5ms |

**Đọc con số này cho đúng:** median 16,7ms = đúng 60fps. p95 33ms nghĩa là có khung hình rơi. Nhưng phép đo chạy trong **Chrome headless với ANGLE/SwiftShader**, tức là phần lớn dựng hình bằng CPU — đây là cận dưới bi quan, **không phải** số của máy thật có GPU. Chưa đo trên GPU thật, chưa đo trên thiết bị di động thật. Cần đo lại trước khi kết luận về hiệu năng.

## 7. Còn lại / chưa làm

1. **Chưa đo hiệu năng trên GPU thật** (§6). Nếu máy yếu, chỗ cần hạ đầu tiên là `PER_MESH` và số segment của `SphereGeometry`.
2. **Chữ nhiều dòng vẫn do DOM vẽ** (§4.4). Trên mobile, subline có thể xuống dòng và khi đó nó hiện bằng chữ thường, không phải bằng hạt. Muốn xử lý triệt để thì phải tự tách dòng.
3. **Placeholder của ô email** vẫn là chữ DOM — không rasterise được qua `::placeholder`.
4. Bốn thứ của Lusion chưa làm: preloader đếm %, hover clone-and-roll, con trỏ tuỳ biến, sound toggle.
5. **Nút "Vào nhanh" và khay "Truy cập thử nghiệm"** vẫn hiện trên trang đăng nhập. Đây là vấn đề tin cậy và an toàn nếu build production còn bật; cần bọc `IWebHostEnvironment.IsDevelopment()` **cả ở controller**, không chỉ ẩn ở view. Chưa làm vì nằm trong Razor/controller, ngoài phạm vi static file của phiên này.
6. Ba nút Bỏ qua/Phát lại/Tạm dừng đã nhẹ đi và thu thành icon dưới 560px, nhưng vẫn nằm hàng trên cùng.
7. Tương phản chữ khi mặt control ở dày nhất chưa đo bằng công cụ; mới đánh giá bằng mắt qua ảnh.

## 8. Ranh giới đã giữ

Không đụng antiforgery, `returnUrl`, validation, magic link, OAuth Google/Facebook. Không thêm thư viện tải từ CDN ngoài. Không reset thay đổi chưa commit nào đang có trong working tree. Không build, không restart, không commit. Không sửa `docs/design-lab/aris-login-v5/`.

---

## 9. Đợt cập nhật Supernova & Khắc phục tương phản chữ form (19/09/2026)

Theo phản hồi trực tiếp: *"sửa lại chữ các form đang hơi khó nhìn, animation đầu các vòng xoay cuộn vào đến cuối thì bùng nổ tạo ra ADN, tăng độ sáng lúc nổ mô phỏng supernova"*.

### 9.1 Sửa triệt để chữ form khó nhìn
- **Nguyên nhân cũ**: Việc tô chữ DOM trong suốt (`color: transparent !important`) và dùng các hạt nano để vẽ chữ nhỏ khiến chữ bị hạt hoá (rasterized), cộng với việc bỏ nền kính card khiến chữ nằm đè trực tiếp lên nền sao chuyển động gây chói và mất nét.
- **Giải pháp dứt điểm**:
  - Gỡ bỏ `color: transparent !important` ở mọi class typography (`.nano-glyph`, headings, labels, button labels).
  - Tách bạch vai trò: Chữ được render 100% bằng native DOM typography với font antialiasing sắc nét (`-webkit-font-smoothing: antialiased`), đạt chuẩn tương phản cao WCAG AAA/AA (`#FFFFFF` cho tiêu đề, `#E2E8F0` cho label, `#CBD5E1` cho mô tả, `#94A3B8` cho placeholder).
  - Khôi phục nền kính card quang học sâu (`.auth-glass-card`): `background: rgba(8, 14, 28, 0.82)` kết hợp `backdrop-filter: blur(24px) saturate(190%)` và viền 1px tinh tế (`rgba(255, 255, 255, 0.12)`).
  - Toàn bộ ngân sách hạt nano được tập trung vào viền khung card, viền các ô input/button và trường năng lượng tương tác breathing xung quanh, không làm nhiễu typography.

### 9.2 Vũ điệu Supernova Detonation & Sinh thành ADN
- **Giai đoạn 1 — T_VORTEX (0 → 1.55s)**: 4 vòng tích tụ (accretion rings) đồng tâm với độ nghiêng không gian 3D cuộn xoáy tròn vào tâm điểm (singularity) với gia tốc góc tăng dần, bán kính co lại siêu nhỏ ($r < 0.12$).
- **Giai đoạn 2 — T_SUPERNOVA (1.55s → 2.10s)**: Vụ nổ siêu tân tinh (Supernova blast) phát nổ từ lõi, sóng xung kích lan tỏa đẳng hướng đẩy các hạt văng mạnh ra ngoài.
- **Tăng vọt độ sáng mô phỏng Supernova**:
  - `renderer.toneMappingExposure` tăng đột biến từ 1.00 lên **3.50** (white-hot cosmic exposure surge).
  - Đèn chủ lực `keyLight.intensity` tăng vọt lên **6.15**, `cobaltLight.intensity` lên **7.10**.
  - Tăng độ mờ và scale hạt phát quang (`GLOW.mat.opacity` $\times 2.85$) tạo hiệu ứng lóe sáng toàn màn hình.
- **Giai đoạn 3 — T_DNA (2.10s → 4.80s)**: Sóng xung kích phân rã được từ trường điều hòa hút về, kết tinh thành chuỗi xoắn kép ADN 3D tự quay, bên trong chứa các đĩa thiên hà Andromeda.
- **Giai đoạn 4 & 5 — ARIS & Settled (4.80s → 10.40s+)**: ADN chuyển dịch mượt sang biểu tượng ARIS rồi phân rã định hình thành các viền hạt nano của form đăng nhập.

### 9.3 Bộ bằng chứng nghiệm thu (`docs/unified-theme/evidence/supernova-auth/`)
Kiểm thử tự động bằng Playwright trên môi trường live `http://localhost:5025`:
- `01_vortex_coiling.png`: Các vòng tích tụ cuộn tròn xoáy vào tâm.
- `02_supernova_flash.png`: Bùng nổ Supernova với độ sáng cosmic exposure lóe trắng toàn cảnh.
- `03_dna_crystallization.png`: Hạt kết tinh thành chuỗi xoắn kép ADN 3D.
- `04_aris_wordmark.png`: Chuyển hoá sang logo ARIS.
- `05_settled_form_high_contrast.png`: Form đăng nhập hoàn chỉnh với chữ rõ nét 100%, nền kính tương phản cao.
- `06_input_focus_contrast.png`: Trạng thái focus và gõ email mượt mà, viền sáng rõ.
- `07_register_mode_contrast.png`: Chuyển đổi mượt mà sang form Tạo tài khoản.
- `08_direct_register_contrast.png`: Route trực tiếp `/Account/Register`.
- `09_mobile_390x844.png`: Giao diện di động sắc nét, cân đối.

---

## 10. Đợt đại tu thẩm mỹ & Đẳng cấp thủ công thẻ đăng nhập / đăng ký (19/09/2026)

Theo phản hồi trực tiếp: *"sửa lại ngay cái card đăng ký đăng nhập trông quá sơ sài"*.

### 10.1 Các khuyết điểm "sơ sài" đã được triệt tiêu
1. **Khung card đơn điệu**: Trước đây là một hộp phẳng viền 1px mỏng với một hàng chấm hạt bao quanh như hàng rào dây thép.
   * **Nâng cấp**:
     - Thân card đa tầng kính obsidian sâu `linear-gradient(180deg, rgba(13, 21, 42, 0.90) 0%, rgba(7, 12, 26, 0.95) 100%)` với `backdrop-filter: blur(32px) saturate(210%)`.
     - Viền phản xạ kép: `border: 1px solid rgba(255, 255, 255, 0.13)` và viền trên specular `border-top: 1px solid rgba(255, 255, 255, 0.32)`.
     - Hào quang khuếch tán nền (ambient backlight aura) qua `::before` với blur 14px và chùm tia specular sáng trên đỉnh `::after`.
     - Hạt nano quanh card được giải phóng khỏi hàng rào 1px cứng nhắc, chuyển thành trường hạt **hào quang vũ trụ nhấp nhô sống động (celestial breathing aura)** bao bọc lấy thẻ.
2. **Thiếu bản sắc và badge nhận diện**:
   * Bổ sung **Brand Status Pill** trên cùng: `ARIS CAREER STUDIO / SECURE ACCESS` với đèn xanh nhấp nháy thời gian thực (`live radar pulse dot`).
3. **Nút mạng xã hội rẻ tiền**:
   * Thiết kế lại thành các khối kính mờ cao cấp với viền phản xạ ánh sáng nổi (`inset 0 1px 0 rgba(255, 255, 255, 0.18)`), hiệu ứng di chuột ánh xanh cobalt và nâng nổi 3D.
4. **Đường phân cách & Trường nhập liệu**:
   * Divider hairline chuyển màu mờ dần ra hai biên, nhãn trung tâm được đóng gói thành chip kính sang trọng.
   * Ô email bổ sung **icon phong bì SVG tinh tế** bên trái phát sáng xanh cobalt khi focus, cùng badge bảo mật `🔒 Passwordless` trên thanh tiêu đề trường.
5. **Nút hành động chính (Primary CTA)**:
   * Chuyển từ khối màu phẳng sang gradient cobalt hoàng gia `#2563EB → #1D4ED8 → #1E40AF`, dập nổi ánh sáng viền trong, bóng đổ trường sâu và hiệu ứng quét sáng ánh kim (`shimmer sheen sweep`) khi hover.
6. **Khay truy cập thử nghiệm (Demo Tray)**:
   * Trước đây là dòng text liên kết thô sơ đặt cạnh nhau bằng dấu chấm `·`.
   * Nay được tái cấu trúc thành **Ngăn kéo bảng điều khiển nhà phát triển (Developer Console Drawer)** với 3 nút pill kính tinh xảo: `⚡ Vào nhanh`, `👤 Ứng viên`, `🏢 Tuyển dụng`.
## 11. Giải phóng form khỏi hộp Card — Dựng từ Vành đai Tiểu hành tinh (Asteroid Belt) & Các dải sáng nhỏ (Streaming Light Ribbons) (19/09/2026)

Theo phản hồi trực tiếp: *"vẫn thế cái form đăng ký đăng nhập vẫn bị bó trong card trong khi tôi bảo là nó được làm từ các tiểu hành tinh các dải sáng nhỏ nhỏ cơ mà"*.

### 11.1 Giải phóng hoàn toàn form khỏi hình hộp (Unboxed Celestial Form)
* **Nguyên nhân gốc của cảm giác "bị bó trong card"**:
  - Dù CSS đã có lúc giảm nền, trong WebGL Three.js vẫn chạy `buildPlate()` tạo ra một phiến kính 3D bo góc (`cardPlateMesh` và `cardThicknessMesh`) với shader phản xạ góc tối `PlateFragmentShader` nằm ngay sau form.
  - Đồng thời các hạt ngoài cùng vẫn bám theo đường biên chữ nhật của thẻ HTML, tạo thành một hàng rào chấm bao quanh như một cái hộp.
* **Giải pháp triệt để**:
  - Tắt hoàn toàn `cardPlateMesh.visible = false` và `cardThicknessMesh.visible = false` cả lúc khởi tạo và trong vòng lặp `updateMaterialState()`. Phiến hộp chữ nhật 3D hoàn toàn biến mất.
  - Trong CSS (`aris-auth.css`), `.nano-stage-ready .auth-glass-card` được thiết lập `background: transparent !important; border: none !important; box-shadow: none !important;`. Form đăng nhập/đăng ký hoàn toàn mở, trôi nổi tự do giữa không gian sâu không trọng lượng.

### 11.2 Vành đai Tiểu hành tinh 3D nghiêng (3D Inclined Asteroid Belt)
* Thay thế toàn bộ hình học viền hộp bằng **quỹ đạo vành đai tiểu hành tinh 3D**:
  - Sử dụng phương trình elip không gian nghiêng một góc $\approx 25^\circ$ (`tilt = 0.44 rad`), vành đai uốn lượn sâu vào trục Z sau lưng đỉnh form và vươn ra phía trước ở đáy form.
  - **Động học quỹ đạo Kepler**: Vận tốc quay vi sai giữa các tầng thiên thể (`orbitSpeed = (0.016 + (1.0 - d) * 0.014) * bodyFlow[i]`), các tiểu hành tinh vành trong di chuyển nhanh hơn vành ngoài, có độ rộng vành thực tế (`radialBand = 0.88 + d * 0.38`).
* **Phân bố kích thước thiên văn học (Power-Law Distribution)**:
  - **60% Bụi sao / Stardust siêu mịn** (size $0.35 - 0.70$): Tạo nền bụi vũ trụ mờ ảo liên tục.
  - **28% Tiểu hành tinh đá** (size $0.85 - 1.65$): Các thiên thể rắn chắc chuyển động quỹ đạo với chất liệu bạch kim và ngọc bích cobalt.
  - **12% Tiểu hành tinh / Thiên thể phát sáng** (size $2.20 - 3.40$): Các quả cầu hành tinh lớn phát quang với quầng hào quang mềm mại (`GLOW.mesh2`).

### 11.3 Các dải sáng nhỏ (Streaming Light Ribbons)
* **Chuyển hóa hạt quang thành các dải lụa ánh sáng**:
  - Tại `writeInstances()`, thay vì hiển thị các quầng sáng tròn tĩnh, `GLOW.mesh` phân tích vector vận tốc tức thời $(v_x, v_y)$ của từng hạt dọc theo quỹ đạo hoặc viền control:
    - Góc xoay `streakAngle = Math.atan2(vy, vx)`.
    - Độ kéo dài dải sáng tỉ lệ thuận với vận tốc: `streakLen = gs * min(3.4, 1.4 + speed * 22.0)`.
    - Bề ngang thanh mảnh: `streakWid = gs * max(0.30, 0.52 - speed * 2.5)`.
  - Hàng trăm vệt sáng kéo dài đan xen, chuyển động liên tục tạo thành **các dải sáng nhỏ uốn lượn** như những sợi tơ ánh sao dẫn lối quanh các nút tương tác và tiểu hành tinh.
  - Các hạt mặt trong control được tiết chế độ chói (`gs *= 0.22`), chống lóa và đảm bảo chữ luôn nổi bật trên nền sao.

### 11.4 Tương phản quang học & Độ bền công năng
* Các nút `Google`, `Facebook` và ô `Địa chỉ email` được trang bị lớp kính đen obsidian trong mờ (`rgba(11, 18, 35, 0.88)` kết hợp `backdrop-filter: blur(14px)`), giữ vững độ tương phản WCAG AAA cho logo và chữ kể cả khi có sao băng hay dải sáng quét ngang.
* Hệ thống nút bấm, autofocus, chuyển đổi trạng thái đăng nhập/đăng ký vẫn giữ 100% khả năng tương tác native DOM và khả năng truy cập (a11y).

### 11.5 Tinh chỉnh quang thông: Hạ độ chói, giữ hào quang êm dịu (19/09/2026)
Theo phản hồi: *"Hạ độ chói của các hành tinh một tí, vẫn có ánh sáng hào quang như này nhưng hạ xuống 1 tí"*:
* **Lõi phát quang (Glow Texture Gradient)**: Điều chỉnh tâm texture từ trắng gắt `rgba(255, 255, 255, 1.0)` sang ánh xanh băng dịu `rgba(235, 245, 255, 0.85)` và phân rã mềm hơn ở các stop ngoài.
* **Cường độ tự phát sáng (Emissive Intensity)**: Hạ `emissiveIntensity` của các khối cầu tiểu hành tinh từ `0.62` xuống `0.45`, giúp giữ nguyên hình khối 3D bề mặt thiên thể mà không phát quang quá chói.
* **Bán kính hào quang (Planetary Corona Scale)**: Giảm tỷ lệ quầng sáng quanh các tiểu hành tinh lớn từ `gs * 1.65` xuống `gs * 1.22`.
* **Độ mờ quang học tổng thể (Resting Opacity)**: `baseWant` giảm từ `0.32` xuống `0.22`, giữ cho các dải sáng và hào quang thiên thể êm dịu, thơ mộng, không gây chói mắt và tôn vinh typography.

### 11.6 Ngân hà rực rỡ, Triệt tiêu viền cứng CSS & Dựng nút từ các Hành tinh con (Child Planets) (19/09/2026)
Theo phản hồi: *"Điều chỉnh lại còn xưa hơn bản cũ, chủ đề là ngân hà các hành tinh thì tôi muốn cái hành tinh xung quanh phải sáng hơn tí, các button không có border rõ rệt mà được làm từ các hành tinh con"*:

#### 1. Nguyên nhân các phiên bản trước tạo cảm giác "cũ" / "lạc quẻ"
* **Hàng rào chấm cơ học dày đặc**: Trước đây, các nút được lấy mẫu viền cách nhau mỗi 5px, dẫn đến hàng trăm chấm nhỏ li ti xếp khít nhau như viền nét đứt (dashed stroke) của CSS thời kỳ đầu, mất đi vẻ thiên văn tự nhiên.
* **Viền CSS thô cứng**: Thuộc tính `border: 1px solid rgba(...)` tạo ra các khung hộp chữ nhật cổ điển, tương phản lệch tông với chủ đề ngân hà và các dải sáng 3D.
* **Độ sáng thiên hà bị giảm quá mức**: Việc hạ sáng ở lượt trước làm giảm đi vẻ tráng lệ, huyền ảo của các hành tinh lớn và bụi sao trong không gian sâu.

#### 2. Kiến trúc Hành tinh con (Child Planets / Satellite Planetoids)
* **Thuật toán `sampleButtonMoons(w, h, r, count)`**:
  - Không rải hạt dày đặc mà gán số lượng hành tinh con rời rạc, cân đối cho từng nút (`btn-social`: 16 vệ tinh, `auth-input`: 22 vệ tinh, `btn-auth-primary`: 26 vệ tinh, `btn-demo-link`: 10 vệ tinh).
  - Khoảng cách giữa các thiên thể con được giãn đều (~28-35px), ôm cong mượt mà theo góc bo của nút, có độ thở tự do (`orbitOffset`).
* **Động học quỹ đạo 3D sống động**:
  - Các hành tinh con quay đều quanh nút tương ứng với vận tốc vi sai `(0.016 + bodyFlow * 0.012) * path.flow` và uốn lượn hình sin trên trục $Z$ (`zOrbit = sin(...) * 0.024`).
  - Khi người dùng rê chuột (hover) hoặc chọn vào trường nhập (focus), quỹ đạo các hành tinh con lập tức gia tốc gấp đôi, tạo phản hồi xúc giác thiên văn trực quan.
* **Hình thái & Thể tích 3D**:
  - Kích thước khối cầu 3D được tăng cường (`scale = Math.max(1.45, bodySize * 1.70)`), giúp mắt thường nhận diện rõ ràng đây là các quả cầu hành tinh có hình khối, phản xạ ánh sáng PBR và quầng hào quang khí quyển riêng biệt (`coronaScale = gs * 1.50`).

#### 3. Xóa bỏ hoàn toàn viền CSS (Zero Border Buttons)
* Loại bỏ triệt để `border`, `outline` trên mọi thành phần giao diện: `.btn-social-item`, `.auth-input-field`, `.btn-auth-primary`, `.btn-demo-link`, `.auth-divider`.
* Nền nút chuyển sang lớp sương mù vũ trụ trong suốt (`rgba(15, 23, 42, 0.35)` đối với mạng xã hội, `rgba(11, 18, 36, 0.45)` đối với ô nhập). Ranh giới của nút giờ đây hoàn toàn được định hình và bao bọc bởi chuỗi hành tinh con 3D bay quanh.

#### 4. Thắp sáng Ngân hà & Các hành tinh bao quanh
* **Cường độ tự phát sáng (Emissive)**: Nâng `emissiveIntensity` của các hành tinh từ `0.45` lên `0.85` với các gam màu starlight trắng kim, sapphire xanh thẫm và xanh băng.
* **Tâm hào quang (Core Gradient)**: Lõi phát sáng rực rỡ trắng tinh khôi `rgba(255, 255, 255, 1.0)`, phân lớp ra quầng lam ngọc mềm mại.
* **Hệ thống chiếu sáng 3D**: Tăng công suất `keyLight` (1.65), `cobaltLight` (1.35) và phơi sáng camera (exposure: 1.12).
* **Trường sao sâu (Deep Starfield)**: Tăng mật độ và độ rạng ngời của các tầng sao bụi (380 & 520 điểm sao) tạo nên một vũ trụ lung linh, sâu thẳm và sống động.


---

# Phụ lục — lượt sửa tối 19/09/2026 (độ sáng + chòm sao)

## Trạng thái tìm thấy khi bắt đầu lượt này

Source đã bị sửa tiếp sau phiên trước: `aris-auth-stage.js` mtime 18:18, `aris-auth.css` mtime 18:20 (phiên trước kết thúc ~15:00). Người sửa đã đổi hướng:

- Thêm CSS mục 10 **"CELESTIAL UNBOXED AUTH FORM (NO CARD BOX SILHOUETTE)"** — bỏ hẳn khung card.
- Thêm CSS mục 11 **"TYPE INTEGRITY — REAL DOM FONTS NEVER MADE TRANSPARENT"**, và trong JS có đoạn chủ động `classList.remove('nano-glyph')` với chú thích *"so DOM typography remains 100% native"* → **tính năng viết chữ bằng hạt đã bị gỡ bỏ có chủ ý**.
- Đổi `PATH_SPEC` sang mô hình `isButton` + `moonCount`: mỗi control chỉ có 10–26 "hành tinh con" bay quanh, mặt control quay lại dùng nền CSS.
- Toàn bộ phần hạt còn lại (5.191 thân) dồn vào một **vành đai thiên thạch nghiêng** bao quanh form.

Đây là lý do người dùng thấy *"form đang bị thiếu gì đó"*: phần hạt dựng nên chính các control và chữ đã không còn, hạt chỉ còn là vành đai nền.

Người dùng chốt trong lượt này: **giữ nguyên form không viền**, nhưng thiết kế lại nút và chữ cho tinh hơn, hạt phải trông **như các chòm sao** chứ không phải bi nhựa, và vẫn còn chói.

## Đã sửa

### Độ sáng — bốn nguyên nhân cụ thể

| Nguyên nhân | Trước | Sau |
|---|---|---|
| Exposure ACES clip thành trắng phẳng | 1.12 (flash ×2.50) | 0.86 (flash ×1.45) |
| Mọi thân hạt tự phát sáng, không còn mặt tối | `emissiveIntensity` 0.85 | 0.72 với vật liệu mờ hơn hẳn |
| Quầng sáng | opacity 0.55 | 0.24 |
| 12% số hạt ở cỡ 2.20–3.40 (~680 đốm cháy trắng) | | 5.5% ở cỡ 1.60–2.15 |

### Vành đai cắt ngang qua chữ

Bán kính trong của vành đai là `0.598 × chiều cao card`, nghiêng 0.44 rad nên chiếu xuống còn `≈0.54` — chỉ nhỉnh hơn mép card ở `0.50`. Vì vậy nó cắt qua badge phía trên và dòng TLS phía dưới. Đã mở rộng: `radialBand` 0.88+d·0.38 → **1.16+d·0.44**, hệ số `ry` 0.68 → **0.74**.

Trên màn hẹp, card gần như chiếm hết viewport nên vành đai tính theo card rơi hết ra ngoài màn hình (ảnh mobile lượt đầu chỉ còn một mảng ở đáy). Nay ở `isNarrow` vành đai **tính theo viewport** (`rx = 0.46·visW`, `ry = 0.52·visH`) và đọc thành hai rèm sao hai bên.

### Hạt: từ bi nhựa sang sao

- Sprite vẽ lại: **lõi cứng nhỏ** (bán kính 0.13) + quầng mờ rộng + **hai vệt nhiễu xạ** ngang/dọc. Đây là thứ làm một điểm sáng đọc ra là *sao* thay vì *quả cầu được chiếu sáng*.
- Vật liệu bỏ hẳn chất kim loại: `metalness` 0.95/0.85/0.20 → **0.06/0.04/0.02**, `roughness` 0.12/0.20/0.05 → **0.62/0.70/0.55**, `envMapIntensity` 2.0/1.6/1.5 → **0.45/0.35/0.30**. Ánh sáng giờ do sprite mang, không do phản chiếu.
- `BODY_RADIUS` 0.0092 → **0.0060** (mobile 0.0108 → 0.0074).

### Chòm sao cho từng control

Thêm `LINKS` — một `LineSegments` nối các hạt liền kề **cùng một control** và khép vòng, opacity 0.17, cộng sáng. Vì các hạt của một control được gán tuần tự quanh viền nó, chỉ số liền nhau là hàng xóm trên viền. Kết quả: mỗi nút/ô nhập là một chòm sao có đường nối — tức là **control có biên mà không cần hộp CSS nào**, đúng yêu cầu giữ form không viền.

Số hạt mỗi control tăng để chòm sao đủ đọc: social 16→40, ô email 22→54, nút chính 26→62, pill demo 10→18.

### Nút và chữ — CSS mục 12

Nút cũ là tấm nhựa mờ: `backdrop-filter: blur(14px)` + nền gradient đặc + bo 14px. Nay:

- **Social**: nền `rgba(146,186,255,0.030)`, viền tóc `rgba(178,212,255,0.16)`, bỏ blur, bo 11px, weight 500.
- **Ô email**: nền trời đêm `rgba(6,12,26,0.38)`, một viền tóc, inset rất nhẹ; focus có viền cyan + ring 3px.
- **Nút chính**: bỏ gradient đặc, dùng `rgba(64,124,255,0.30)` + **viền sáng** `rgba(160,200,255,0.46)` + inset highlight + toả `0 0 34px -14px`. Vẫn là hành động chính nhưng phát sáng từ cạnh chứ không tô đầy.
- **Chữ**: tiêu đề weight 600 / 31px / tracking −0.018em; các nhãn nhỏ thành **small caps giãn chữ 0.17em**; divider 0.20em. Ở kích thước này tracking mới đọc ra là có chủ ý, còn tăng weight chỉ đọc ra là nặng.

## Hiệu năng

Quad glow nâng lên 11× từng làm median tụt xuống **32.8ms (30fps)** do overdraw cộng sáng. Hạ về **8.4×** thì trở lại **median 16.7ms (60fps)**, p95 33.4ms — cùng mức với bản trước khi sửa. Vẫn đo trong Chrome headless/SwiftShader, tức cận dưới bi quan.

## Bằng chứng lượt này

`evidence/nano-lusion/20_audit_login.png`, `21_audit_register.png`, `22_audit_mobile.png`. 0 page exception, 0 console error; email mang sang được, URL đồng bộ.

## Chưa làm

- Chữ vẫn là font DOM thường (bản trước có tuỳ chọn viết bằng hạt, đã bị gỡ ở lượt 18:18; người dùng lượt này không yêu cầu khôi phục).
- Form Đăng ký vẫn **chưa có dòng đồng ý Điều khoản & Chính sách bảo mật** — thiếu sót thật cho một form tạo tài khoản, nhưng phải sửa Razor nên chưa động tới.
- Nút "Vào nhanh" và khay "Truy cập thử nghiệm" vẫn hiện ở trang đăng nhập.

## Bổ sung — mỗi control là một chòm sao có hình riêng

Yêu cầu tiếp theo của người dùng: *"sửa cái box button mỗi cái là một chòm sao hình riêng lúc lướt qua"*.

Trước đó các moon rải **đều** quanh viền và nối liên tiếp → vẫn đọc ra là một cái hộp viền chấm. Đã đổi:

- **Khoảng cách bất quy tắc**: `bodyU = (k+0.5)/n + (hash-0.5)·0.92/n`. Seed lấy từ chỉ số path (`1013 + p·7919`) nên Google, Facebook, ô email và nút chính **không bao giờ ra cùng một hình**.
- **Sao neo**: cứ 4–6 sao có một sao sáng to (`scale ×2.15`), còn lại nhỏ hơn hẳn (`×0.95`). Một chòm sao được đọc qua vài ngôi sáng với các ngôi mờ xen giữa, không phải qua một hàng chấm đều nhau.
- **Lệch khỏi viền**: mỗi sao đẩy ra/vào theo hướng tâm control (`±0.036` với sao neo, `±0.016` với sao thường) nên hình không dán vào hình chữ nhật.
- **Đường nối có độ sáng riêng từng đoạn** (vertex color + additive): lúc nghỉ chỉ hiện mờ bộ khung giữa các sao neo; **lúc lướt chuột qua**, phần còn lại của hình được vẽ dần theo một mặt sóng chạy vòng quanh (`reveal = (energy·1.55 − u·0.85)·2.2`), chứ không bật sáng cùng lúc.

Biên độ hover đã siết (hệ số `energy` 0.55 → 0.30) sau khi ảnh đầu cho thấy đường nối cắt ngang dòng "Chưa có tài khoản?".

Hiệu năng sau thay đổi: median **16.7ms**, p95 **17.0ms** (trước đó p95 33ms) — tốt hơn cả bản trước khi sửa.

Bằng chứng: `23_rest_asterism.png`, `24_hover_primary_early.png`, `25_hover_primary_full.png`, `26_hover_google.png`.

## Bổ sung — bỏ badge, icon riêng, phông vũ trụ

Cả badge lẫn icon đều do `enhanceAuthDom()` trong JS chèn vào chứ không nằm trong Razor, nên sửa được mà không phải build lại.

**Bỏ badge.** Khối chèn `.auth-brand-badge` ("ARIS CAREER STUDIO / SECURE ACCESS") đã gỡ; thêm lệnh xoá phòng khi còn sót từ lần render trước, và một rule CSS `display: none` dự phòng. Tiêu đề nhờ đó lên cao hơn và form cân giữa hơn.

**Icon.** Bộ cũ là glyph outline stock ở stroke 2–2.2 cộng ba emoji ⚡👤🏢 — chính chỗ đó đọc ra rẻ tiền. Bộ mới vẽ theo ngôn ngữ của trang, nét 1.15–1.3:

| Chỗ | Trước | Sau |
|---|---|---|
| Ba pill demo | emoji ⚡ 👤 🏢 | sao chổi / sao bốn cánh / hành tinh có vành |
| Ô email | phong bì stroke 2 | phong bì nét 1.25, bo mềm hơn |
| Passwordless | ổ khoá stroke 2.2 | ổ khoá nét 1.3, có chấm lõi |
| TLS | khiên stroke 2.2 | khiên nét 1.25, thêm dấu tích |
| Nút chính | mũi tên stroke 2.5 trong Razor | mũi tên nét 1.45, có vùng riêng, trượt 3px khi hover |

Logo Google và Facebook **giữ nguyên** — đó là nhãn hiệu chính thức, không được vẽ lại.

Icon "Ứng viên" bản đầu là 5 chấm nối nét kiểu chòm sao hình người; ở 14px nó nhoè thành một cục nên đã đổi sang **sao bốn cánh**, giữ được hình ở kích thước đó.

**Phông.** `Space Grotesk` cho toàn bộ chữ hiển thị (tiêu đề, nhãn, nút, chrome), `Inter` giữ lại **chỉ cho giá trị ô email** — chỗ người dùng cần phân biệt l với 1, O với 0.

Chọn Space Grotesk vì một lý do cứng: **Orbitron, Sora và Outfit đều không có subset tiếng Việt**, dùng chúng thì mọi dấu sẽ rơi về font khác ngay giữa từ. Đã kiểm tra bằng cách tải `fonts.googleapis.com/css2` cho từng họ và đếm khối `unicode-range` vietnamese. Xác minh tại runtime: `document.fonts.check('600 31px "Space Grotesk"', 'Đăng nhập ứng viên tuyển dụng')` → `true`, và 12 face đã `loaded` (4 weight × 3 subset).

`@import` đặt ở **dòng đầu** `aris-auth.css` — đặt ở cuối file thì trình duyệt bỏ qua.

**Hiệu năng:** phép đo trên máy này không ổn định giữa các lượt chạy — median dao động 16.7–33ms cho cùng một build, có lượt idle nhanh sweeping chậm rồi lượt sau ngược lại. Đây là Chrome headless dùng SwiftShader (dựng hình bằng CPU) nên nhiễu lớn; **chưa kết luận được** về fps, cần đo trên GPU thật.

Bằng chứng: `23_rest_asterism.png`, `27_crop_controls.png`, `22_audit_mobile.png`. 0 page exception, 0 console error.
