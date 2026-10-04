# Nhật ký sửa V5 theo chỉ thị nano identity — phiên Claude tự thực thi

Ngày 19/09/2026, 00:00. **Lần này người dùng yêu cầu tôi tự sửa**, nên tôi sửa trực tiếp `docs/design-lab/aris-login-v5/index.html` thay vì chỉ viết brief. Bản trước khi tôi động vào được giữ nguyên tại `index_snapshot_pre_nano_identity_2330.html` (101.625 bytes, bản AGY 23:06). File sau khi sửa: 115.041 bytes.

Căn cứ: [V5-NANO-IDENTITY-DIRECTIVE.md](V5-NANO-IDENTITY-DIRECTIVE.md). Yêu cầu gốc của người dùng: card phải **là** hạt nano chứ không phải tấm phẳng; chuyển login → đăng ký thì **chính các hạt phải đổi vị trí để dựng lại card**; và cảnh phải **bùng nổ** hơn.

## Đã làm

### 1. Card sống lại — vỏ liền + hồn hạt

- Hạ `cardPlateMat.opacity` từ `0.72` → `0.52`: tấm phẳng lùi về vai trò nền đọc chữ.
- Thêm lớp **motes**: `THREE.Points` 300 hạt sprite tròn mềm (texture radial gradient tự sinh, additive blending). Sprite mềm không có cạnh nên chồng bao nhiêu cũng **không sinh lưới** — đây là điểm mấu chốt mà bản tile cứng trước đó không có.
- `refreshMoteField()` rải hạt theo **dart-throwing giữ khoảng cách tối thiểu** (blue-noise) trên đúng hình chữ nhật card, và **loại bỏ vùng chữ/control**: đọc `getBoundingClientRect()` của `.greeting-title`, `.field-input-translucent`, `.btn-submit-cta`, `.btn-social`, `.card-footer`… rồi chiếu sang toạ độ thế giới làm vùng cấm. Đo thực tế: 214/300 hạt được đặt, phần còn lại parked ngoài khung.
- Hạt **trôi liên tục** (sin hai tần số lệch pha), **dạt theo con trỏ**, và biên độ tăng khi đang gõ (`typingDamp`).
- Field được rải lại mỗi lần `computeCardStructureTargets` chạy → login và register có hai trường hạt riêng.

### 2. Viền: nét liền + hạt chạy dọc

- Lưu hẳn đường chu vi vào `rimPathX/rimPathY`, rồi cho 340 rim body **chảy dọc chu vi** (`rimFlow`, nội suy giữa hai điểm path liền kề).
- **Bỏ cách kéo dãn dị hướng.** Lý do kỹ thuật, tự tìm ra khi soi: cầu 8×6 segment bị scale `(1.656, 0.13, 0.13)` render ra **gai dựng đứng** như răng lược — chụp zoom 3× thấy rõ, và cô lập từng mesh mới xác định được thủ phạm. Thay bằng: `cardRimMesh` (LineLoop) lo nét liền, rim body thành **glint thưa** (1/6 số hạt, scale 0.62, opacity 0.42) chạy trên nét đó.

### 3. Morph login ↔ register do hạt dựng lại

- `MORPH_DURATION` 0.85 → **0.95**, chia ba nhịp bằng `morphDip`: **vỡ** (0 → 0.23) · **bay** (0.23 → 0.66) · **dựng** (0.66 → 1).
- Thêm `cardWeightEff = cardWeight * (1 - 0.80 * morphDip)` cho **vật liệu**: plate mờ đi và 768 facet + rim body **hiện trở lại** đúng lúc card tan.
- **Thứ tự dựng**: rim khởi hành trước (`lead = 0.10`), title (`0.20`), mặt card sau cùng (`0.28`), cộng jitter theo chỉ số → mắt đọc được dòng chảy thay vì cả khối trượt.
- **Sửa một sai lầm giữa chừng:** lần đầu tôi cho vị trí cũng theo `cardWeightEff`, kết quả là hạt bay về toạ độ chữ ARIS cũ và đọng thành hai cục lệch hai bên card. Đã đổi: vị trí vẫn bám card, còn nhịp vỡ là **xung bung xuyên tâm quanh chính card** (`lastCardCX/CY` + push 0.16–0.42 + xoáy nhẹ). Giờ card nở bung thành quầng vật liệu rồi tụ lại đúng biên mới.

### 4. Bùng nổ hơn

- **Giảm damping khi bay**: `dragDecay = exp(-(6.2 - 3.2 * flightLoose) * dt)`, với `flightLoose` = max(xung lắp ráp quanh 3.95s, `morphDip`) → hạt vọt quá đích rồi bị kéo về thay vì về đích ngoan ngoãn.
- **Vệt chuyển động**: khi tốc độ cao, instance được xoay theo vector vận tốc (`setFromUnitVectors`) và kéo dài tới 3.6×, dẹt lại 0.34 theo phương vuông góc. Thấy rõ ở frame 4.0s.
- **Xung sáng khi chữ ARIS khớp** (`snapFlash` tại 4.58s, decay mũ 2.4): cyan +3.6, cobalt +1.4 — cú nhấn mà cảnh đang thiếu.
- **Lớp bokeh gần camera**: 24 sprite lớn mờ (opacity 0.10) ở z = 1.7–3.0 → không gian có chiều sâu thay vì một mặt phẳng.

## Đo độc lập sau khi sửa

| Mục | Kết quả |
|---|---|
| FPS (tự đo 6 giây) | **60,2** |
| Tam giác khi settle | 27.298 (rim glint giờ vẫn sống nên cao hơn bản 98 tam giác) |
| Lỗi console / page error | **0**, cả ở lượt morph |
| Thứ tự Tab | brand → Bỏ qua → Phát lại → Tạm dừng → email → submit |
| Mobile | `scrollWidth` = 390 và 320, không tràn ngang |
| Reduced motion | trạng thái tĩnh có đủ plate + hạt + viền, không lỗi |
| Chữ ARIS lúc hold (animClock 5.41) | bốn chữ đọc rõ, không banding |
| Crop mặt card | không lưới, không mẫu lặp |

Ảnh và clip kiểm chứng nằm trong scratchpad của phiên; nếu cần lưu vào repo thì chụp lại bằng `validate_gate1.py` để có bộ bằng chứng chuẩn của đội.

## Còn nợ

1. **Mục 7b (vượt trần) vẫn chưa xong.** Đã có: cảnh phản ứng với con trỏ và với việc gõ, cú xung sáng, chiều sâu bokeh. **Chưa có**: art direction riêng thay cho mô-típ "hạt tụ thành chữ", và lớp cho lần xem thứ mười (intro rút ngắn cho người quay lại).
2. Chữ ARIS vẫn là hạt vụn, mép chưa sạch ở mức typography.
3. Chưa đụng auth thật — `_AuthLayout.cshtml` vẫn nguyên bản cũ. Muốn thấy trong `dotnet run` thì phải làm cổng 2.

## Lưu ý phối hợp

AGY đang sửa cùng file này. Tôi vừa ghi đè bản 23:06 của nó bằng bản 00:00. **Phải chốt một người cầm file** trước lượt sau, nếu không hai bên sẽ đạp lên nhau. Snapshot bản AGY vẫn còn nguyên nếu cần đối chiếu.

---

## Vòng 2 — sau khi người dùng test bản 00:00 (19/09, 00:30)

Phản hồi: *"card ngoài và cái mẫu bên trong đang thể hiện đó là fake"*, *"tốc độ chuyển đổi giữa các form quá nhanh không đọc được animation"*, *"mức độ ấn tượng tổng thể thấp quá thấp"*.

**Chẩn đoán cái "fake":** trong lúc vật liệu bung ra, **nội dung HTML vẫn đứng nguyên** — chữ, ô nhập, nút đều sắc nét và bất động giữa một đám hạt đang bay. Mắt lập tức hiểu rằng lớp 3D chỉ là phông nền dán sau một cái form. Panel cũ chỉ fade 0.18s rồi panel mới hiện ngay trong ~300ms, trong khi hạt bay tới 950ms.

**Đã sửa:**

- `MORPH_DURATION` 0.95 → **1.70s**: vỡ 0.39s · bay 0.73s · dựng 0.58s.
- **Nội dung tan theo vật liệu**: `.is-leaving` giờ mờ + lùi + **blur 7px**; panel mới bị giữ lại tới 60% quãng morph rồi mới **condense** ra khỏi vật liệu theo `contentCondense` — từng khối lệch nhau 70ms (heading → field → CTA → social → footer).
- **Thanh trên cùng cũng tan**: `.card-top-bar` nằm ngoài panel nên trước đó vẫn sắc nét giữa đám hạt — dấu vết "fake" cuối cùng. Thêm `.glass-auth-card.is-dissolving` xử lý nó, kèm reset an toàn nếu người dùng bấm liên tục.
- **Lần hiện card đầu tiên cũng condense** thay vì fade phẳng, nên phần thưởng cuối intro mạnh hơn.
- **Control ăn vào vật liệu**: input có well lõm (inset shadow + hairline trên), CTA có đúng một hairline sáng và bóng đổ màu accent, social nhẹ hơn một bậc.
- **Camera dolly trong intro**: lùi 1.75 đơn vị rồi đẩy vào, kết thúc **đúng vị trí gốc trước 6.4s** — cố ý, để phép chiếu màn hình ↔ thế giới không đổi khi đo card, tránh lệch giữa card 3D và card DOM. Parallax theo con trỏ đặt lên lớp bokeh chứ không lên camera, cùng lý do.
- Xung bung khi morph tăng từ 0.16–0.42 lên **0.22–0.55**.

**Đo lại:** 60,1 FPS lúc đứng yên, **60,9 FPS trong lúc morph**, 0 lỗi console, mobile 390 `scrollWidth` = 390.
