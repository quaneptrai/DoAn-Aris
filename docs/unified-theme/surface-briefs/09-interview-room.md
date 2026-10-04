# 09 — Interview Room (`Views/Interview/Room.cshtml`, 417 dòng)

Đây là surface **cố ý ít chuyển động nhất**. Ghi rõ điều đó ở đây để không ai đi "thêm animation cho đồng đều" — sự kiềm chế ở đúng chỗ cũng là một phần của đẳng cấp, và nó cũng phục vụ luật không lặp một loại animation.

## Hiện trạng đo được

- 417 dòng, 171 dòng CSS nhúng, **0 token**, 14 hex cứng, 1 `transition`, 2 `:hover`, 1 `transform`.
- **0** `aria-`, **0** `:focus-visible`, **0** skeleton, 0 inline style.
- Cấu trúc: `call-shell` → `call-header` (title, subtitle, `call-status-pill` + `dot`) → `video-stage` (`remote-placeholder`, `avatar-circle`) → `local-video-wrap` → `call-controls` (`call-btn`, `leave`).

## Lỗi cụ thể

1. **Lệch hoàn toàn khỏi hệ thiết kế**: 0 token, 14 hex tự chế. Phòng phỏng vấn là khoảnh khắc căng thẳng nhất của người dùng, mà nó lại trông như một sản phẩm khác.
2. **Trạng thái kết nối chỉ là một chấm và một chữ.** Đang kết nối / đã kết nối / chập chờn / mất kết nối / đối phương rời phòng — người dùng phải đoán.
3. **Không có trạng thái thiết bị**: mất quyền camera/mic, không tìm thấy thiết bị, đang bị tắt tiếng bởi phía kia. Đây là các lỗi xảy ra thật và thường xuyên.
4. **Nút điều khiển không có phản hồi rõ** khi bật/tắt mic/cam — thứ bắt buộc phải chắc chắn tuyệt đối.
5. **0 `aria-`** trong một màn thời gian thực: người dùng trợ năng không nhận được thông báo trạng thái.
6. `remote-placeholder` chỉ là avatar tròn — chưa xử lý trường hợp đối phương tắt camera cả buổi.

## Phải làm — mức tối thiểu

1. **Áp token và typography chung** — giữ nền tối của phòng gọi (đúng ngữ cảnh), nhưng dùng đúng thang màu/chữ/khoảng cách của hệ.
2. **Hệ trạng thái kết nối đầy đủ**, hiển thị một chỗ duy nhất, kèm chất lượng đường truyền nếu WebRTC cung cấp được. Mỗi trạng thái một màu semantic theo token, kèm chữ — không chỉ màu.
3. **Trạng thái thiết bị**: chưa cấp quyền, bị từ chối, không có thiết bị, đang tắt tiếng — mỗi cái có hướng dẫn thoát ra.
4. **Nút điều khiển chắc chắn**: trạng thái bật/tắt đọc được kể cả khi bỏ màu, vùng chạm ≥ 44px, phản hồi nhấn tức thì, không có độ trễ chuyển động.
5. **A11y thời gian thực**: `role="status"` cho thông báo trạng thái, `aria-pressed` cho nút bật/tắt, phím tắt cho tắt/bật mic có hướng dẫn.
6. **Placeholder khi tắt camera** tử tế: avatar lớn, tên, trạng thái — đủ để nhìn cả buổi.

## Một cử chỉ đặc trưng

**Nhịp trạng thái kết nối** — chỉ báo duy nhất được phép chuyển động trong phòng, thở rất nhẹ khi đang kết nối và đứng yên hẳn khi đã ổn định. Ngoài nó ra, phòng phỏng vấn **không có chuyển động trang trí nào**. Đây chính là điểm khác biệt của surface này.

## Vượt trần

- **Kiểm tra trước khi vào phòng**: màn tiền phòng thử cam/mic/âm lượng, báo rõ trước khi người khác nhìn thấy mình.
- **Ghi chú phỏng vấn ngay trong phòng** cho nhà tuyển dụng, lưu vào hồ sơ ứng viên thật.
- **Khôi phục mềm khi rớt mạng**: giữ phòng, đếm ngược kết nối lại, không đá người dùng ra ngoài.

## Nghiệm thu riêng

- Ảnh đủ các trạng thái: đang kết nối, đã kết nối, camera tắt, mất quyền thiết bị, mất kết nối, đối phương rời phòng.
- Clip bật/tắt mic và camera, thấy phản hồi tức thì và trạng thái đọc được khi ảnh chuyển xám.
- Chứng minh không có chuyển động trang trí nào khác trong phòng.
- Số đo: token 0 → ?, hex 14 → ?, `aria-` 0 → ?
