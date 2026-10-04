# Aris Orbit

Bộ SVG riêng của Aris Careers. Lưới 24 × 24, nét tròn 1.7, khối bo mềm,
khoảng mở trên đường viền và điểm quỹ đạo lấy cảm hứng từ chấm cam của logo Aris.
Lớp tô mặc định 10%, tăng lên 24% khi chọn. Mũi tên và ký hiệu trạng thái giữ hình
dễ nhận biết ở kích thước nhỏ.

## Xem và tải

Mở `/icons.html` khi chạy ứng dụng, hoặc mở trực tiếp
`ArisSkyve/wwwroot/icons.html` trong trình duyệt. Trang mẫu hỗ trợ nền sáng/tối,
kích thước 16/20/24/32 px, tìm theo tên, trạng thái đang chọn và tải từng SVG.
SVG tải xuống giữ màu của chế độ xem hiện tại và không cần CSS bên ngoài.

## Dùng trong giao diện

Hai layout `_AppLayout.cshtml` và `_AuthLayout.cshtml` đã tải các tài nguyên cần thiết:

1. `wwwroot/css/aris-line.css`
2. `wwwroot/lib/lucide/lucide.min.js`
3. `wwwroot/js/aris-icons.js`

```html
<button type="button" aria-label="Lưu việc làm" aria-pressed="false">
  <i data-lucide="bookmark" aria-hidden="true"></i>
</button>
```

Sau khi chèn nội dung động, gọi `lucide.createIcons()` như trước. Lớp tương thích
chọn bản vẽ Orbit cho các tên đã đăng ký; những tên khác, bao gồm logo Facebook,
tiếp tục lấy từ Lucide. Các class, kích thước và nhãn truy cập sẵn có được giữ lại.
Nhãn mô tả thao tác nên đặt trên nút/link, icon trang trí dùng `aria-hidden="true"`.

- `window.ArisIcons.primaryNames`: tên chính của các bản vẽ.
- `window.ArisIcons.names`: toàn bộ tên và alias tương thích.
- `.orbit-accent`: bật điểm nhấn cam cho một vùng; mặc định đã bật ở menu.
- `.is-lit`, `aria-current="page"`, `aria-pressed="true"`, `aria-selected="true"`:
  tăng lớp tô để phân biệt trạng thái chọn.

Chỉnh bản vẽ tại `aris-icons.js`, trong `ICONS`. Các tên cùng hình ngăn cách bằng
dấu phẩy. Dùng `p()` cho nét, `fill()` cho lớp mực, `dot()` cho điểm nhấn và
`solid()` cho chấm mang ý nghĩa nội dung. Không đổi tên icon đang được dùng trong
view. Giữ ký hiệu riêng cho các trạng thái lịch hẹn, micro và camera.
