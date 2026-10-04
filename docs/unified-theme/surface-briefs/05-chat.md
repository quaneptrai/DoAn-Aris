# 05 — Chat: trang nhắn tin và widget nổi

File: `Views/Chat/Index.cshtml` (1.770 dòng — view dài nhất app), `Views/Shared/_ChatWidget.cshtml` (911), `wwwroot/js/chat-client.js`. Backend dùng SignalR.

## Hiện trạng đo được

- `Chat/Index`: 702 dòng CSS nhúng, 34 token, 38 hex cứng, 3 `transition`, 10 `:hover`, 5 `transform`, 2 `@keyframes` (`msgPopoverIn`, `callToastIn`), 20 inline style, **0** `:focus-visible`, **0** skeleton.
- `_ChatWidget`: 911 dòng, 446 dòng CSS, **0 token**, **40 hex cứng**, 2 `transition`, 1 `transform`. Đây là file lệch hệ thiết kế nặng nhất trong app.
- Cấu trúc trang: `messenger-shell` → `conversation-pane` + `conversation-search` + `conversation-list` → khung tin nhắn → composer có preview đính kèm, emoji, nút gọi.
- Widget: `chat-launcher`, `chat-heads-container`, `chat-panel` (header/search/list/fullview), badge chưa đọc, một modal.

## Lỗi cụ thể

1. **Hai giao diện chat song song lệch nhau hoàn toàn**: trang dùng 34 token, widget dùng 0. Cùng một sản phẩm, hai bảng màu, hai kích thước chữ, hai kiểu bo góc. Người dùng gặp cả hai trong một phiên.
2. **Không có skeleton** cho danh sách hội thoại và lịch sử tin nhắn — vùng trắng rồi nội dung đổ vào.
3. **Tin nhắn đến không có hướng**: không phân biệt được bằng chuyển động ai gửi; `msgPopoverIn` là hiệu ứng popover chung.
4. **Trạng thái "đang gõ", "đã gửi", "đã nhận", "gửi lỗi"** — chỗ quan trọng nhất của một ứng dụng nhắn tin — chưa được thiết kế thành một hệ nhất quán.
5. **Cuộn không neo**: tin mới tới trong lúc đang đọc tin cũ sẽ đẩy nội dung.
6. **Widget 911 dòng với 40 hex cứng** là món nợ kỹ thuật sẽ kéo lùi mọi lần đổi theme sau này.

## Phải làm — mức tối thiểu

1. **Hợp nhất hệ**: widget và trang dùng chung token, chung component bong bóng tin nhắn, chung avatar, chung trạng thái. Nếu chia sẻ được cả markup qua partial thì càng tốt.
2. **Skeleton** cho danh sách hội thoại và cho khung tin nhắn khi mở hội thoại.
3. **Hệ trạng thái tin nhắn đầy đủ**: đang gửi → đã gửi → đã nhận → đã xem → lỗi (kèm hành động gửi lại ngay tại bong bóng). Mỗi trạng thái một dấu hiệu nhỏ, nhất quán hai nơi.
4. **Neo cuộn**: tin mới chỉ tự cuộn khi người dùng đang ở đáy; nếu không thì hiện nút "tin mới" thay vì nhảy.
5. **Bong bóng có cấp bậc**: tin của mình và của người khác khác nhau về nền và hướng, thời gian là metadata mờ, tin liên tiếp cùng người thì gộp nhóm.
6. **Composer**: preview đính kèm giữ chỗ theo tỉ lệ ảnh, trạng thái tải lên có tiến trình, gửi bằng Enter có phản hồi.
7. `:focus-visible` cho danh sách hội thoại, composer, nút gọi; điều hướng bàn phím đi được từ danh sách sang khung chat.

## Một cử chỉ đặc trưng

**Tin nhắn trượt theo hướng người gửi**, kèm nhịp "đang gõ" ba chấm thở đúng tiết tấu của hệ chuyển động chung. Tin của mình trượt vào từ phía composer; tin của người khác trượt từ phía avatar. Biên độ nhỏ, kết thúc dứt khoát. Không dùng lại cử chỉ này ở surface khác.

## Vượt trần

- **Cuộc gọi chuyển cảnh liền mạch**: từ bong bóng chat sang khung gọi là một phép giãn, không phải mở trang mới (nối với brief [09](09-interview-room.md)).
- **Hội thoại có ngữ cảnh nghề nghiệp**: khi chat với nhà tuyển dụng, một dải mỏng hiện tin tuyển dụng đang nói tới — dữ liệu thật, không bịa.
- **Widget nhớ trạng thái** (đang mở hội thoại nào, đã cuộn tới đâu) khi chuyển trang.
- **Tin chưa đọc có nhịp riêng** khi quay lại tab, một lần, rồi dừng.

## Nghiệm thu riêng

- Ảnh cạnh nhau của **widget và trang** sau khi sửa: phải nhìn ra ngay là cùng một sản phẩm.
- Clip: nhận tin khi đang cuộn lên giữa lịch sử — chứng minh không bị nhảy.
- Clip: gửi lỗi → gửi lại thành công ngay trong bong bóng.
- Ảnh 4 trạng thái: chưa có hội thoại, skeleton, đang chat, mất kết nối SignalR.
- Số đo: token trong `_ChatWidget` 0 → ?, hex 40 → ?, skeleton 0 → ?
