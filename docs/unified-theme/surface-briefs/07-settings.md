# 07 — Settings (`Views/Settings/Index.cshtml`, 265 dòng)

Trang trần nhất trong toàn bộ ứng dụng — và là trang dễ ghi điểm nhất, vì kỳ vọng đang ở đáy.

## Hiện trạng đo được

- 265 dòng, **0 dòng CSS**, **0** `transition`, **0** `:hover`, **0** `transform`, **0** hex, **0** token, **0** `aria-`, **0** `:focus-visible`, **0** skeleton.
- 14 `style=""` inline, 5 card Bootstrap (`card`, `bg-white`, `shadow-sm`, `rounded-4`).
- Năm khối: Account Details, Privacy, Rejection Templates (doanh nghiệp), Social Channels (doanh nghiệp), Session & Logout.

Nói cách khác: trang này **hoàn toàn là Bootstrap mặc định**. Không một dòng nào thuộc về Aris.

## Lỗi cụ thể

1. **Không có phản hồi cho bất kỳ thao tác nào.** Đổi cài đặt xong không biết đã lưu chưa — đây là loại lỗi làm người dùng mất tin vào cả sản phẩm.
2. **Năm card ngang hàng**: mục nguy hiểm (đăng xuất, phiên đăng nhập) trông y hệt mục vô hại (tên hiển thị).
3. **Không phân tách người dùng thường và tài khoản doanh nghiệp** ngoài việc ẩn/hiện, nên trang lúc dài lúc ngắn mà không giải thích.
4. **Không có trạng thái nguy hiểm**: các hành động không hoàn tác được không có cảnh báo riêng về mặt thị giác.
5. 0 `aria-` trong một trang toàn form — người dùng trợ năng gần như không dùng được.

## Phải làm — mức tối thiểu

1. **Bố cục hai cột trên desktop**: điều hướng mục bên trái (dính khi cuộn), nội dung bên phải; một cột trên mobile với tiêu đề mục dính.
2. **Lưu tại chỗ**: mỗi hàng cài đặt tự lưu và xác nhận ngay trong hàng đó (dấu tích ngắn rồi mờ đi), hoặc nếu giữ nút Lưu thì phải có trạng thái "có thay đổi chưa lưu" rõ ràng và chặn rời trang.
3. **Phân tầng rủi ro**: nhóm nguy hiểm (đăng xuất mọi thiết bị, xoá dữ liệu) tách hẳn xuống cuối, dùng màu và viền cảnh báo theo token semantic đã có (`--aris-danger*`), có bước xác nhận.
4. **Áp token và component chung**: đây là trang tốn ít công nhất để đạt được sự nhất quán vì chưa có gì để gỡ bỏ.
5. **A11y**: `label` gắn đúng `for`, mô tả phụ bằng `aria-describedby`, `:focus-visible`, trạng thái lưu thông báo qua `role="status"`.
6. Mục doanh nghiệp: nêu rõ đây là phần dành cho tài khoản tuyển dụng thay vì lặng lẽ xuất hiện.

## Một cử chỉ đặc trưng

**Công tắc lưu tại chỗ**: gạt công tắc → nó chuyển trạng thái với một nhịp vật lý ngắn, một dấu tích nhỏ hiện ngay cạnh trong khoảng một giây rồi mờ. Không toast góc màn cho việc nhỏ. Cử chỉ này thuộc riêng Settings.

## Vượt trần

- **Tìm trong cài đặt**: ô tìm lọc thẳng các hàng, cuộn tới và đánh dấu hàng khớp.
- **Nhật ký phiên đăng nhập** hiển thị thiết bị và thời điểm dưới dạng danh sách có thể thu hồi từng phiên — dữ liệu thật từ backend, không bịa thiết bị.
- **Xem trước quyền riêng tư**: đổi một tuỳ chọn thì hiện ngay ai sẽ thấy gì.

## Nghiệm thu riêng

- Clip: gạt hai công tắc khác nhau, thấy xác nhận tại chỗ; tải lại trang chứng minh đã lưu thật.
- Ảnh trước/sau 1440 + 390, kèm ảnh xám: nhóm nguy hiểm phải tách khỏi phần còn lại ngay cả khi bỏ màu.
- Clip Tab bằng bàn phím đi hết trang, focus thấy rõ ở mọi control.
- Số đo: token 0 → ?, `transition` 0 → ?, `aria-` 0 → ?
