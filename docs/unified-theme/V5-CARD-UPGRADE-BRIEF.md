# Chỉ dẫn nâng cấp V5 cho agent thực thi — nguyên nhân gốc, mức sửa, cách nghiệm thu

Viết ngày 18/09/2026 bởi phiên Claude làm **review kỹ thuật + cố vấn thiết kế**. Người viết **không sửa** `docs/design-lab/aris-login-v5/index.html`; file đó vẫn nguyên trạng 95.635 bytes, `NUM_BODIES = 750`. Mọi số dòng dưới đây trỏ vào bản đó.

Đọc trước: [SESSION-HANDOFF.md](../SESSION-HANDOFF.md), [V5-REFERENCE-REVIEW.md](V5-REFERENCE-REVIEW.md), [AGY-HANDOFF.md](AGY-HANDOFF.md). Tài liệu này **không thay** hai file đó; nó bổ sung phần còn thiếu: *vì sao* card và wordmark xấu ở mức code, và sửa ở đâu.

Người dùng đã nói thẳng về lượt trước: **design xấu, y hệt đợt trước, animation không có gì đặc biệt.** Ba lỗi P0 dưới đây là lý do kỹ thuật cụ thể của nhận xét đó — không phải chuyện thẩm mỹ mơ hồ, và không sửa được bằng cách đổi màu hay thêm glow.

## Đích cuối — hai vế, không chọn một

Người dùng nêu lại yêu cầu ngày 18/09/2026: output phải là **một project có animation đẳng cấp ngang tầm page login**, **đồng thời sửa và nâng cấp chính hai trang đăng nhập/đăng ký**.

Nghĩa là tài liệu này chỉ là **chặng 1** của ba chặng, và chặng sau không được bỏ:

1. **Polish V5 trong lab** — phần còn lại của file này. Đây là chỗ chốt chất lượng vật liệu và chuyển động, làm ở prototype vì rẻ và không đụng backend.
2. **Đưa V5 đã polish vào auth thật** — `Account/Login.cshtml`, `Account/Register.cshtml`, `_AuthLayout.cshtml`. Theo lượt đọc source gần nhất, layout thật đang dùng `.auth-orbit-svg`/`orbitSpin`/`.auth-glass-card`, **không** có scene V5. Đổi màu, font và viền của form hiện có **không** tính là đạt. Giữ antiforgery, `returnUrl`, validation, OAuth thật; không bê `simulateOAuth` hay response chấp nhận giả từ lab sang production.
3. **Lan ngôn ngữ chuyển động sang phần còn lại** — Dashboard trước (hero/artwork nhận diện, feed/composer/card có phản hồi), rồi Jobs/Profile/Company/CV/Employer/Chat/Interview theo `PLAN.md`. Cùng màu, cùng vật liệu, cùng chiều sâu, cùng nhịp chuyển động. "Đã đổi shared CSS" không phải bằng chứng hoàn tất.

Chặng 1 xong trước, nhưng đừng thiết kế chặng 1 theo kiểu chỉ chạy được trong file HTML rời: mọi thứ dựng ở đây phải mang sang Razor được, không phụ thuộc thư viện ngoài kéo về runtime của ứng dụng ASP.NET.

---

## P0-1. Wordmark ARIS bị chia băng sáng/tối — lỗi mapping, không phải lỗi màu

**Triệu chứng** (xem `evidence/v5-reference-review/02-aris.png`): nửa trên các chữ là hạt chrome sáng, nửa dưới là mảnh cobalt tối, cắt ngang gần như một đường thẳng. Chữ R và S không đọc ra hình.

**Nguyên nhân gốc.** Chỉ số body quyết định *nhóm vật liệu*: `0..159` = title mesh (chrome, hình cầu), `160..359` = rim mesh (chrome, hình cầu), `360..749` = surface mesh (facet cobalt, squircle) — `index.html:912-915`, mesh dựng ở `:1537-1614`.

Nhưng `computeArisGlyphTargets()` lấy mẫu pixel glyph theo **thứ tự scanline** (quét `y` rồi `x`, `:1238-1249`) rồi gán tuần tự `pIdx = Math.floor(i * step)` (`:1263-1265`). Vậy body chỉ số nhỏ luôn rơi vào các hàng pixel trên cùng. Nhóm vật liệu bị **đồng biến với toạ độ Y** → banding.

**Sửa.** Cắt tương quan giữa chỉ số body và thứ tự scanline bằng một bước nhảy nguyên tố cùng nhau với `NUM_BODIES` (bijection: không body nào trùng chỗ, không mẫu nào bị bỏ):

```js
const shuffleStride = 577;            // phải coprime với NUM_BODIES
const shuffled = (i * shuffleStride) % NUM_BODIES;
const pIdx = Math.floor(shuffled * step) % numActive;
```

Kiểm lại điều kiện coprime mỗi khi đổi `NUM_BODIES` (750 = 2·3·5³ và 1368 = 2³·3²·19 đều coprime với 577).

Kèm theo, cho wordmark chút phù điêu thay vì mặt phẳng tuyệt đối: `wordTargetZ[i]` đang cứng `0.0` (`:1274`), biên độ nhỏ (±0.013) là đủ bắt sáng mà chữ vẫn đọc được.

---

## P0-2. Mặt card đọc như chăn bông — khe hở hình thoi là do hình học facet

**Triệu chứng** (`03-login.png`): lưới ô vuông/hình thoi lặp đều khắp mặt card, đúng thứ mà comment trong code tuyên bố đã tránh (`:900` "no LED dot grid").

**Nguyên nhân gốc.** Facet là squircle vát góc, bán kính góc `size * 0.22` (`:1505-1519`). Ở `:1322-1328` mỗi ô được scale để **vừa đúng** khoảng cách ô, lại còn trừ thêm khe:

```js
targetFacetScaleX = (cellDistX * 0.982) / baseOuterSize;   // chừa 1.8% seam
```

Ô vuông vát góc đặt cạnh nhau, lại nhỏ hơn ô lưới 1.8% → **bốn góc bị cắt luôn để hở nền**, và các lỗ hổng đó xếp thành mạng hình thoi đều tăm tắp. Lưới lại chỉ 15×26 = 390 ô phủ 88%×90% chiều card (`:1322-1325`, `:1495-1496`) nên mỗi ô rất to, khe rất rõ, và mặt sáng hụt so với viền.

**Sửa, theo thứ tự tác động:**

1. **Cho facet chồng mép**, đừng chừa seam: hệ số `0.982` → khoảng `1.14–1.18`. Góc vát của ô này che khe của ô kia.
2. **Phủ kín card**: `0.88`/`0.90` → `0.985`, sửa ở cả `cellDist*` lẫn `nX`/`nY` (`:1495-1496`), nếu không mặt sáng sẽ nổi thành một hình chữ nhật nhỏ hơn viền.
3. **Tăng mật độ, giảm kích thước ô**: lưới 24×32 = 768 ô. Ô nhỏ thì seam còn lại rơi xuống dưới ngưỡng nhìn thấy.
4. **Hạ tương phản giữa các ô.** `:1601-1612` đang gán màu theo `Math.sin` biên độ lớn giữa chrome và cobalt sâu — chính nó vẽ ra hoa văn caro. Đổi sang một gradient dọc rất nhẹ cộng ánh xiên nông; chênh lệch giữa hai ô kề nhau phải gần như không thấy.
5. **Độ đục và chất liệu**: `opacity 0.08` ở trạng thái card (`:2057`) quá mỏng để thành mặt, nhưng vì tương phản ô cao nên hoa văn vẫn lộ — nghịch lý hiện tại. Sau khi làm dịu màu, nâng lên khoảng `0.15–0.18`, `metalness ≈ 0.20–0.28`, `roughness ≈ 0.30–0.38` để ra satin, không phải nhựa mờ.

**Không** đắp một panel CSS đục lên toàn card để giấu vấn đề — ràng buộc này Codex đã chốt và tôi giữ nguyên. `.glass-auth-card` phải tiếp tục `background: transparent` (`:158-175`); mặt card là vật liệu 3D thật.

### ⚠⚠ ĐÃ BỊ THAY THẾ MỘT PHẦN — đọc [V5-NANO-IDENTITY-DIRECTIVE.md](V5-NANO-IDENTITY-DIRECTIVE.md) trước

Hướng "một mặt phẳng duy nhất" ở dưới chữa được vệt seam nhưng **làm mất luôn ý nghĩa của cả cảnh**: ở trạng thái settle không còn hạt nano nào tồn tại, và morph login ↔ register chỉ là thay tấm chứ không phải hạt dựng lại card. Chỉ thị mới thay thế phần này: **vỏ liền + hồn hạt**. Phần dưới giữ lại để hiểu cơ chế seam.

### ⚠ Đính chính sau lượt thử 18/09 22:50 — năm bước trên là CHƯA ĐỦ

Lượt đầu làm theo đúng năm bước trên đã cho ra kết quả **tệ hơn**: mạng hình thoi biến mất, thay bằng một **lưới kẻ ô xanh** phủ toàn mặt card (xem [gate1-verdict-20260918.md](gate1-verdict-20260918.md), ảnh `evidence/gate1-v5-polished/03-login-card-center-crop.png`).

**Vì sao:** chồng mép + vật liệu `transparent: true` + `depthWrite: false` ⇒ dải chồng nhau bị blend **hai lần**, và cạnh vát của squircle bắt specular. Kết quả là một vạch sáng đúng tại mọi đường seam. Làm dịu màu không cứu được, vì nguyên nhân nằm ở **alpha và hình học**. Đây là thiếu sót của brief này, không phải của người thực thi.

**Hướng đúng — đổi cách tiếp cận, không chỉnh thêm tham số:**

- Ở trạng thái settle, mặt card là **một mesh phẳng bo góc duy nhất**, vật liệu đục (hoặc alpha thấp nhưng `depthWrite: true`), **không bevel, không lặp**.
- 768 facet chỉ sống trong lúc morph: khi `cardWeight → 1` chúng mờ về 0 **đúng lúc** mặt phẳng hiện lên. Người xem vẫn thấy vật liệu nano tụ thành card; cái đọng lại là một mặt thật.
- Muốn giữ vân vật liệu thì làm bằng **normal/roughness rất nhẹ trên chính mặt phẳng đó**, không phải bằng hàng trăm hình chồng nhau.
- Viền xử lý cùng nguyên tắc: một đường bo góc duy nhất ở trạng thái settle, rim body tan vào nó (cách này chắc hơn việc kéo dãn 340 hạt cho chạm nhau).
- **Đích kiểm:** crop 200% giữa mặt card không thấy **bất kỳ** lưới, seam hay hoa văn lặp lại nào.

Nếu vẫn muốn giữ hướng tile: bỏ bevel, tắt `transparent` khi settle (đục + `depthWrite: true`), và giữ `opacity` trong khoảng 0.15–0.18 như brief yêu cầu — **0.38 là quá cao**.

---

## P0-3. Viền là chuỗi hạt — thiếu tiếp tuyến, không phải thiếu số lượng

**Triệu chứng**: rim đọc như 200 chấm rời quanh card, giống trang trí dán lên.

**Nguyên nhân gốc.** Rim body là hình cầu, ở trạng thái card chỉ bị **thu nhỏ đều**: `rimScale = 0.50` áp cho cả ba trục (`:2212-2217`). Cầu thu nhỏ vẫn là chấm.

**Sửa.** Cho mỗi rim body **kéo dài theo tiếp tuyến chu vi và dẹt theo phương vuông góc** khi `cardWeight → 1`:

1. Trong `computeCardStructureTargets`, tách phần tính điểm trên chu vi (`:1421-1484`, chuỗi `if` lồng 8 tầng) thành hàm `perimeterPoint(s)`. Chuỗi hiện tại không tái sử dụng được nên không lấy được tiếp tuyến.
2. Lưu `rimAngle[i] = atan2(p(s+ds).y - p(s-ds).y, p(s+ds).x - p(s-ds).x)` vào một `Float32Array(NUM_PERIMETER_CELLS)` khai báo cạnh `targetFacetScaleX` (`:920-921`), cùng `rimSegLen = totalPerimeter / NUM_PERIMETER_CELLS`.
3. Trong vòng lặp mô phỏng, thay `dummy.scale.set(rimScale, rimScale, rimScale)` bằng scale bất đẳng hướng + xoay quanh Z, nội suy theo `cardWeight` để lúc bay vẫn là hạt:

```js
const along  = 1.0 * (1 - cardWeight) + (rimSegLen * 1.30 / (BODY_RADIUS * 2.0)) * cardWeight;
const across = 1.0 * (1 - cardWeight) + 0.20 * cardWeight;
dummy.rotation.set(rotX * (1 - cardWeight), rotY * (1 - cardWeight), rimAngle[rimIdx] * cardWeight);
dummy.scale.set(along, across, across);
```

Mục tiêu nghiệm thu: ở 1440px, cạnh card là **một nét liền dày 1–2px**, còn thấy gốc nano lúc morph, không đọc ra từng hạt khi đứng yên.

---

## P1. Mật độ body: 750 là trần chất lượng của cả ba lỗi trên

750 body phải gánh cùng lúc chuỗi xoắn kép, bốn chữ cái, tiêu đề card, viền và mặt card. Chữ thưa, ô lưới to, viền rời đều là cùng một giới hạn. Đề xuất ngân sách:

| Nhóm | Hiện tại | Đề xuất |
|---|---|---|
| `NUM_BODIES` | 750 | 1368 |
| `NUM_TITLE_CELLS` | 160 | 260 |
| `NUM_PERIMETER_CELLS` | 200 | 340 |
| `NUM_SURFACE_CELLS` | 390 | 768 (24×32) |

**Tăng số lượng thì phải giảm kích thước hạt — hai việc này là một gói.** Lượt 18/09 22:50 nâng lên 1.368 body nhưng giữ nguyên `BODY_RADIUS = 0.028` (`:1538`), kết quả là hạt chồng lộn xộn, nét chữ lồi lõm, trông như kẹo ngọc trai chứ không mịn hơn. Với ngân sách 1.368, bán kính nên về khoảng **0.018–0.020** và giảm specular; mục tiêu là **mép nét chữ sạch**, không phải nhiều hạt hơn.

Body là `InstancedMesh`, chi phí thêm chủ yếu nằm ở vòng lặp JS mỗi frame chứ không phải draw call. **Nhưng phải đo, không được suy đoán**: báo cáo FPS thực đo và `window.getRenderStats()` (`:2304-2313`) trước/sau. Nếu desktop tụt dưới 55fps thì hạ ngân sách rồi đo lại, đừng giữ số đẹp trong tài liệu.

---

## Bẫy ràng buộc — đổi số ở một chỗ sẽ vỡ chỗ khác

Đây là phần dễ mất thời gian nhất, đọc kỹ trước khi gõ:

1. **`computeDnaTargets()` hard-code 750** (`:1173-1176`: `numStrandA = 280`, `numStrandB = 280`, `numRungs = 19`, `bodiesPerRung = 10`). Nâng `NUM_BODIES` mà quên chỗ này thì mọi body dư **giữ target (0,0,0)** → một cục đen ở tâm màn hình suốt cảnh DNA. Tính theo tỉ lệ `NUM_BODIES`, và rải phần dư bằng `r = k % numRungs; b = Math.floor(k / numRungs)` để không body nào bị bỏ sót.
2. **`baseOuterSize = 0.056` (`:1326`) là giá trị chép tay của hình học facet** `createSquircleGeometry(0.046, 0.018, 0.005)` (`:1564`, tức `0.046 + 2×0.005`). Đổi kích thước facet mà không đổi hằng số này thì scale mặt card sai tỉ lệ. Nên khai báo một hằng chung dùng ở cả hai nơi.
3. **Vòng gán màu surface hard-code `i % 15`** (`:1604`) đúng bằng `cols` của lưới. Đổi lưới phải đổi cả đây, nếu không hoa văn màu lệch khỏi hình học.
4. **`skipIntro()` (`:1755-1761`) chép lại các hằng vật liệu của trạng thái card** (`0.38`, `0.08`, `metalness 0.05`, `roughness 0.16`), trùng với `:2057-2064`. Sửa một chỗ quên chỗ kia thì nút **Bỏ qua giới thiệu** cho ra card khác với đường animation bình thường. Tốt nhất gom thành một hàm `applyCardMaterialState(weight)` dùng chung.
5. **Mọi mảng mới theo body phải đúng độ dài** `NUM_BODIES` (hoặc `NUM_PERIMETER_CELLS` cho rim) vì morph login↔register nội suy theo chỉ số (`:2040-2050`). `rimAngle` được tính lại trong `computeCardStructureTargets` nên khi morph nó nhảy một nhịp — chấp nhận được vì card đổi kích thước, nhưng phải kiểm bằng mắt lúc bấm Đăng ký.

---

## P1. Nội dung card: bớt chữ trước khi bàn tới spacing

Ở trạng thái login, trước ô email người dùng phải đọc năm mẩu chữ chồng vai trò nhau:

| Dòng | Vị trí | Xử lý |
|---|---|---|
| `Aris Studio` + logo | `:674-681` | Trùng brand ở header trang (`:63-87`). Hạ xuống mức metadata: nhỏ hơn, màu `--text-muted`, bỏ `drop-shadow` xanh. |
| Badge `ĐĂNG NHẬP NHANH` | `:680`, style `:250-263` | Nền xanh đặc + viền + in hoa đang cạnh tranh với H1 ngay dưới. Chuyển sang chip viền mảnh chữ `--text-sub`, hoặc bỏ hẳn ở mode login. |
| H1 `Đăng nhập` | `:687` | **Giữ.** Đây là neo duy nhất của khối. |
| Subline `Cơ hội tiếp theo bắt đầu từ đây.` | `:688` | Giữ, nhưng là dòng duy nhất ở cấp phụ. |
| `Nhập email để nhận liên kết đăng nhập.` | `:690` | Bỏ. Trùng nội dung với label, CTA và `Không cần mật khẩu.` (`:720`). Nếu cần giữ ý "không mật khẩu", gộp thành **một** dòng helper duy nhất dưới CTA. |

Register cũng vậy: bỏ `:764`, gộp `:810`. Sau khi bớt chữ mới chỉnh nhịp: các field sát nhau thành một nhóm, khoảng thở lớn hơn giữa *nhóm field → CTA → divider → social → footer*, chứ không giãn đều mọi thứ.

Về chất liệu control: input là mặt lõm yên tĩnh, **một** accent duy nhất là CTA, social nhẹ hơn input một bậc. Không thêm glow cho mọi control. Khi mặt card đã liền và đủ đục (P0-2), hạ bớt `text-shadow` đang rải khắp (`:229`, `:266`, `:272`, `:279`, `:288`, `:297`) — hiện chúng đang bù cho nền trong suốt và làm chữ bẩn.

---

## P2. Mobile

Header `Bỏ qua giới thiệu / Phát lại / Tạm dừng` (`:650-663`) chiếm hai dòng ở 390px. Rút nhãn (ví dụ `Bỏ qua`), hoặc đưa **Phát lại** vào nhóm phụ, giữ **Bỏ qua** và **Tạm dừng** dễ chạm. Card phải cuộn tự nhiên; không thu nhỏ toàn bộ chữ/input để nhét vừa màn hình.

---

## Nghiệm thu — cổng kiểm, không phải bản tự thuật

Báo cáo phải nêu rõ build nào đang được chụp, và chụp cùng viewport cho cặp trước/sau.

1. **Frame ARIS (~5s, 1440×900):** không còn dải sáng/tối cắt ngang; bốn chữ A, R, I, S đều đóng nét, đọc được ở kích thước thật.
2. **Card sẵn sàng (1440×900):** crop vùng giữa card phóng 200% — **không** thấy mạng hình thoi lặp lại; mặt đọc liền, seam nếu còn chỉ là vân rất nhẹ.
3. **Cạnh card:** nét liền 1–2px, không đọc ra hạt rời khi đứng yên.
4. **Hiệu năng:** FPS thực đo ≥ 55 trên desktop trong 10 giây liên tục, kèm `getRenderStats()`. Nêu máy và trình duyệt. Không tuyên bố 60fps nếu chưa đo.
5. **Không exception** khi focus, gõ, submit, email sai, trạng thái chờ, đã chấp nhận, gửi lại, lỗi hồi phục được. Chấp nhận request **không phải** là đăng nhập thành công.
6. **Reduced motion, bàn phím, 320/390px và desktop thường:** không cắt control chính, artwork không chắn input.
7. **Clip 12–20 giây** đi hết DNA → ARIS → Login → Register → Login.
8. **Bỏ qua giới thiệu** phải cho ra đúng card như đường animation bình thường (xem bẫy số 4).

Đạt 1–3 mới xét tới phần tích hợp vào auth thật. Một báo cáo viết tốt không thay được kết quả render đẹp.

**Luật bắt buộc từ lượt này trở đi:** Trước khi nộp bất kỳ báo cáo nào, người thực hiện BẮT BUỘC phải mở trực tiếp các ảnh vừa chụp ra nhìn và viết một đoạn nói rõ mình thấy gì bằng mắt trên ảnh (mặt card crop 200% có còn lưới/seam hay bất kỳ hoa văn lặp lại nào không, chữ có sắc nét không, viền có thành nét liền không, mobile header có đè lên logo không). Báo cáo thiếu đoạn quan sát trực quan bằng mắt này sẽ bị **TỪ CHỐI NGAY LẬP TỨC**.

---

## Ranh giới

**Ở chặng 1** chỉ sửa prototype trong `docs/design-lab/aris-login-v5/`. Giữ nguyên Razor/app source, auth, database và server 5025. Chặng 2 mới chạm vào view auth thật, và phải báo trước khi bắt đầu chặng đó chứ không tự nối tiếp. Mô phỏng trạng thái xác thực; không gửi email, không gọi OAuth thật. Giữ các prototype cũ (v2/v3/v4) và các file `index_snapshot_v5_*.html`. Chưa deploy, chưa tích hợp vào source ở giai đoạn này.
