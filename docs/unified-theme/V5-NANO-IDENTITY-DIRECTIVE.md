# Chỉ thị sửa hướng — card phải LÀ hạt nano, không phải tấm nhựa có hạt bay quanh

Viết 18/09/2026 23:30, sau khi người dùng xem bản 23:06. **Đây là chỉ thị ưu tiên cao hơn phần "một mặt phẳng duy nhất" mà tôi đưa ở [V5-CARD-UPGRADE-BRIEF.md](V5-CARD-UPGRADE-BRIEF.md).**

## Tôi sai ở đâu

Để chữa vệt seam, tôi bảo: khi settle thì cho 768 facet tan hết, thay bằng một mặt phẳng liền. AGY làm đúng thế — và kết quả là **giết mất ý nghĩa của cả cảnh**.

Kiểm chứng ở code, không phải cảm tính:

- `index.html:1728-1737` — khi `cardWeight → 1`: `facetFade = 1 - cardWeight * 1.05` và `rimBodyFade` tương tự → **toàn bộ 768 facet + 340 rim body có opacity 0 và `visible = false`**.
- `index.html:1714-1719` — chỉ còn `cardPlateMesh` (một `ShapeGeometry`) và `cardRimMesh` (một `LineLoop`).
- `index.html:2143` — `cardWeight` chỉ phụ thuộc `animClock`, nên sau khi settle nó **đứng yên ở 1.0 vĩnh viễn**.

Nghĩa là: ở trạng thái cuối, **không còn một hạt nano nào tồn tại trên card**. Cái người dùng nhìn thấy là một tấm phẳng tô màu. Vậy thì dựng 1.368 hạt để làm gì.

Và hệ quả thứ hai, nặng hơn: **morph login ↔ register không còn do hạt làm.** Vì `cardWeight` vẫn bằng 1 suốt quá trình morph, các hạt vẫn vô hình; thứ duy nhất xảy ra là `cardPlateMesh.geometry` bị `dispose()` rồi dựng lại ở kích thước mới (`index.html:1416-1420`). Card không được **xây lại**, nó chỉ bị **thay tấm**.

## Yêu cầu của người dùng, diễn lại cho chính xác

1. **Card phải giữ cảm giác được tạo nên từ hạt nano** — hạt vẫn sống, vẫn lọc, vẫn bắt sáng trên mặt card ở trạng thái cuối. Không phải tấm phẳng.
2. **Chuyển login → đăng ký: chính các hạt phải đổi vị trí để dựng lên card mới.** Người xem phải thấy dòng hạt di chuyển và xây lại biên card, không phải card tự giãn ra.
3. **Phải bung nổ hơn nhiều.** Cảnh hiện tại quá ngoan.

## Chỗ tôi chẩn đoán sai — và cách đúng

Vấn đề seam **không phải do dùng hạt**. Nó do dùng **tile cứng xếp thành lưới đều**: squircle có cạnh vát, đặt theo lưới 24×32, chồng mép, vật liệu trong suốt → mọi đường mép thẳng hàng thành lưới.

Bỏ hạt là chữa sai bệnh. Cách đúng là **đổi loại hạt và đổi cách phân bố**:

| Sai (bản 22:50) | Đúng |
|---|---|
| Tile squircle có cạnh vát, bevel bắt specular | **Sprite tròn mềm** (alpha gradient, không có cạnh) hoặc cầu nhỏ — chồng bao nhiêu cũng không sinh vạch |
| Phân bố theo lưới đều 24×32 | **Phân bố ngẫu nhiên có kiểm soát** (Poisson/blue-noise) — mắt không bắt được mẫu lặp |
| Phủ kín 100% mặt card | **Thưa**, để mặt nền lo phần đọc chữ |
| Đứng yên | **Luôn trôi chậm**, đó chính là "cảm giác hạt nano còn lọc" |

## Kiến trúc phải làm: vỏ liền + hồn hạt

**Lớp 1 — nền đọc chữ.** Giữ `cardPlateMesh`, nhưng hạ vai trò: nó chỉ là nền tối yên tĩnh để chữ đọc được. Giảm `opacity` từ `0.72` xuống khoảng **0.45–0.55**, không viền, không bóng đổ mạnh.

**Lớp 2 — hạt sống trên mặt card.** Ở trạng thái settle, giữ lại **200–320 hạt** (không phải 768) nằm trên mặt card, `z` nhỉnh hơn plate:

- Sprite tròn mềm, kích thước không đều (3 cỡ), độ sáng không đều.
- Phân bố blue-noise, **né vùng chữ và control**: tính vùng cấm từ `getBoundingClientRect()` của heading, input, CTA, social — mật độ hạt trong vùng đó giảm mạnh. Chữ không bao giờ nằm trên nền bận.
- Trôi chậm theo một dòng chung (0.02–0.05 đơn vị/giây), hạt ra khỏi biên thì vòng lại ở biên đối diện.
- Phản ứng thật: con trỏ đẩy nhẹ; gõ email thì dòng hạt quanh ô input dồn nhẹ về phía con trỏ; submit thành công thì một xung lan từ nút ra bốn góc.

**Lớp 3 — viền là dòng hạt chảy.** Giữ `cardRimMesh` làm nét mảnh bên dưới để đảm bảo cạnh không bao giờ đứt, nhưng cho **340 rim body chạy dọc chu vi** với vận tốc chậm và mật độ đủ dày. Cạnh card khi đó vừa liền vừa sống. Không để rim body đứng yên xếp hàng — đứng yên là ra chuỗi hạt, chạy là ra dòng chảy.

**Kết quả phải đạt:** crop 200% mặt card vẫn **không có lưới, không có mẫu lặp**, nhưng nhìn kỹ thì thấy hạt; nhìn 3 giây thì thấy chúng đang trôi.

## Morph login ↔ register: hạt phải xây lại card

Hiện tại `MORPH_DURATION = 0.85` chỉ đổi hình plate. Phải đổi thành ba nhịp, và **`cardWeight` phải trũng xuống rồi lên lại** thay vì đứng ở 1.0:

| Nhịp | Thời lượng | Việc xảy ra |
|---|---|---|
| **Vỡ** | 0 → 0.22s | `cardWeight` chạy 1.0 → **0.3**: plate mờ đi, 768 facet + 340 rim body **hiện trở lại** với opacity đầy. Card tan ngược thành đám hạt. |
| **Bay** | 0.22 → 0.62s | Swarm bay tới biên card mới. **Lệch pha theo khoảng cách**: hạt ở xa xuất phát trước, hạt gần trễ hơn — để mắt đọc được dòng chảy chứ không phải cả khối trượt. Hạt được kéo dài theo vector vận tốc (streak) trong nhịp này. |
| **Dựng** | 0.62 → 0.95s | Hạt lắng vào biên mới theo thứ tự **viền trước, mặt sau** (dựng khung rồi lấp mặt), `cardWeight` về 1.0, plate mới fade in dưới lớp hạt. |

Tổng ~0.95s, chấp nhận dài hơn 0.85s hiện tại vì đây là khoảnh khắc đáng xem nhất của màn hình này.

Ràng buộc: DOM form vẫn phải đổi đúng lúc và dùng được ngay; email đã gõ vẫn giữ; không được để người dùng bấm vào khoảng trống trong lúc card đang tan.

## Bung nổ hơn — cụ thể, không phải "thêm hiệu ứng"

Cảnh hiện tại ngoan vì mọi thứ chạy cùng tốc độ và không có cú nào. Bốn chỗ thêm dải động:

1. **Cú vỡ khi DNA bung ra chữ:** cho hạt **vọt quá đích rồi bị kéo về** (overshoot rồi settle), vận tốc đỉnh cao gấp 2–3 lần hiện tại, có hạt văng hẳn ra ngoài khung rồi mới bị hút về. Hiện `springK` (`:2295`) làm mọi thứ về đích quá ngoan.
2. **Vệt chuyển động:** trong các nhịp bay, kéo dài instance theo vector vận tốc (scale theo `|v|` dọc hướng bay). Rẻ, và đây là thứ tạo cảm giác tốc độ.
3. **Khoảnh khắc khớp:** khi chữ ARIS vào đúng vị trí, một **xung sáng lan từ tâm ra** (light sweep qua vị trí đèn), hạt nảy nhẹ một nhịp rồi đứng. Đây là "cú" mà cảnh đang thiếu.
4. **Chiều sâu:** thêm một lớp hạt gần camera cố tình **mờ nhoè** (bokeh) và một lớp rất xa — mắt mới thấy không gian thật thay vì một mặt phẳng.

Giữ nguyên các ràng buộc cũ: form dùng được từ paint đầu, `prefers-reduced-motion` cho ra trạng thái tĩnh đẹp, không WebGL vẫn dùng được, 60fps.

## Nghiệm thu bổ sung (cổng 1B)

1. **Clip 6 giây quay riêng mặt card ở trạng thái đứng yên** — phải thấy hạt đang trôi và bắt sáng. Nếu clip trông như ảnh tĩnh thì trượt.
2. **Crop 200% mặt card** — vẫn không được có lưới hay mẫu lặp.
3. **Clip morph login → register → login**, tốc độ 0.5× — phải thấy rõ ba nhịp vỡ / bay / dựng, và thấy chính các hạt đi tới chỗ mới.
4. **Clip intro** — phải thấy overshoot, vệt chuyển động và cú xung sáng khi chữ khớp.
5. **Ảnh vùng chữ** — chữ và input không nằm trên nền hạt dày; độ tương phản không giảm so với bản 23:06.
6. **FPS ≥ 55** đo thật trong lúc morph, không phải lúc đứng yên.
7. Reduced-motion: trạng thái tĩnh vẫn đẹp, không mất hạt hoàn toàn (hạt đứng yên vẫn là vật liệu).

## Ghi chú cho người chấm tiếp theo

Bài học của lượt này: **artifact và concept là hai trục khác nhau.** Bản 22:50 sai artifact (lưới kẻ ô) nhưng đúng concept (card làm từ hạt). Bản 23:06 sạch artifact nhưng mất concept. Cả hai đều chưa đạt. Lần tới chấm phải hỏi đủ hai câu: *nhìn có sạch không* và *nó còn là ý tưởng ban đầu không*.
