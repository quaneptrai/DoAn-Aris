# 01 — Vỏ ứng dụng: layout, navbar, toast, hệ phản hồi

File liên quan: `Views/Shared/_AppLayout.cshtml` (69 dòng), `Views/Shared/_Layout.cshtml` (51), `Views/Shared/Components/AppNavbar/Default.cshtml` (191), `wwwroot/css/aris-tokens.css`, `aris-theme.css`, `site.css`, `wwwroot/js/site.js`.

Đây là việc làm **trước tiên**. Mỗi thứ sửa ở đây trả cổ tức trên cả 20 bề mặt.

## Hiện trạng đo được

- Ba layout song song: `_Layout`, `_AppLayout`, `_AuthLayout` (603 dòng, 509 dòng CSS nhúng).
- `AppNavbar/Default.cshtml`: 191 dòng, **0** CSS riêng, **0** transition, **0** hover, 3 lần dùng token. Toàn bộ trạng thái navbar phụ thuộc `aris-theme.css`.
- `_AppLayout` nạp `https://unpkg.com/lucide@latest/dist/umd/lucide.js` — CDN, **không ghim phiên bản**, và `lucide.createIcons()` chỉ gọi một lần ở `DOMContentLoaded`.
- Toast toàn cục dùng `bg-success text-white` / `bg-danger text-white` / `bg-dark text-white` của Bootstrap, tức phản hồi hành động quan trọng nhất của app đang mang màu mặc định của framework.
- `:focus-visible`: **0** lần trong toàn bộ view và cả ba file CSS.
- `skeleton`: **0** lần.
- `prefers-reduced-motion` đã có: `aris-theme.css:691` (tắt animation toàn cục) và `aris-tokens.css:173` (hạ các token thời lượng về 0.01ms). Giữ nguyên cơ chế này, đừng rải thêm bản sao trong từng view.

## Lỗi cụ thể

1. **Không có ngôn ngữ focus.** Người dùng bàn phím không thấy mình đang ở đâu. Với một sản phẩm tuyển dụng, đây còn là rủi ro tuân thủ, không chỉ là thẩm mỹ.
2. **Không có hệ trạng thái tải.** Spinner Bootstrap xuất hiện 61 lần khắp nơi, mỗi chỗ một kiểu, không chỗ nào giữ được hình dạng nội dung sắp tới.
3. **Toast là điểm chạm cuối của mọi hành động** (ứng tuyển, lưu việc, đăng bài) mà lại là component mặc định — người dùng nhận phản hồi quan trọng nhất bằng giao diện rẻ nhất của trang.
4. **Icon phụ thuộc mạng ngoài và mất khi render động**, nên các danh sách nạp thêm sẽ thủng icon — lỗi nhìn thấy được, không phải lý thuyết.
5. **Ba layout dễ trôi lệch nhau**; đã thấy dấu hiệu: `_AuthLayout` tự nuôi 509 dòng CSS riêng.

## Phải làm — mức tối thiểu

1. **Hệ focus**: một quy tắc `:focus-visible` duy nhất trong `aris-theme.css`, dùng token màu và offset, áp cho link/button/input/tab/card có thể focus. Không dùng `outline: none` ở bất kỳ đâu mà không có thay thế.
2. **Hệ skeleton**: component `.aris-skeleton` (khối, dòng chữ, avatar tròn, thumbnail) với hiệu ứng chuyển pha nhẹ, tắt theo reduced-motion. Bắt buộc dùng ở Jobs, Profile (CV/Applications tab), Chat, Dashboard feed.
3. **Toast thiết kế lại**: một component riêng theo token, có biểu tượng trạng thái, tiêu đề ngắn + mô tả, thời lượng theo `--aris-duration-*`, xếp chồng nhiều toast không đè nhau, tự dừng khi hover, và có `role="status"` cho loại thông tin, `role="alert"` cho lỗi.
4. **Icon**: đưa lucide về `wwwroot/lib`, ghim phiên bản, và gọi `createIcons()` lại sau mỗi lần chèn HTML động (đã có nhiều chỗ trong `post-actions.js`, `application-actions.js`, `resume-actions.js`).
5. **Navbar**: trạng thái active phải đọc được ngay (không chỉ đổi màu chữ), hover có phản hồi, ô tìm kiếm toàn cục có trạng thái đang tìm/không kết quả, dropdown mở có chuyển động ngắn đúng hướng. Sticky khi cuộn với nền đổi độ đục — nhưng không nhảy chiều cao.
6. **Gom layout**: `_AuthLayout` dùng chung token/typography với `_AppLayout`; phần CSS riêng chỉ giữ thứ thật sự thuộc về sân khấu auth.
7. **Ảnh**: đặt `width`/`height` hoặc `aspect-ratio` và `loading="lazy"` cho mọi ảnh danh sách; đây là cách rẻ nhất để hết nhảy layout.

## Một cử chỉ đặc trưng

**Thanh tiến trình điều hướng mảnh chạy dưới navbar** khi chuyển trang hoặc nạp danh sách — cùng màu accent, dày 2px, kết thúc bằng một nhịp mờ dần. Nó biến mọi chuyển trang thành một chuyển động có chủ ý thay vì màn hình trắng.

## Vượt trần

- **Liên tục thị giác giữa các trang**: giữ navbar và khung nội dung đứng yên, chỉ nội dung đổi — chuyển trang mềm thay vì tải lại thô.
- **Focus ring thiết kế riêng** thay vì viền xanh mặc định: hai lớp, một sáng một tối để đọc được trên cả nền sáng lẫn nền tối.
- **Toast biết gộp**: ba hành động cùng loại liên tiếp thì gộp thành một dòng đếm, không xếp ba toast.
- **Sound-free haptics thị giác**: mọi hành động không thể hoàn tác đều có một nhịp xác nhận nhỏ tại đúng chỗ người dùng vừa bấm, không phải chỉ ở góc màn hình.

## Nghiệm thu riêng

- Video đi hết một vòng bằng **chỉ bàn phím**: Tab qua navbar → tìm kiếm → nội dung → toast, thấy rõ focus ở mọi bước.
- Ảnh skeleton của ít nhất 3 surface, cạnh ảnh nội dung thật để thấy skeleton đúng hình dạng nội dung.
- Ảnh 3 loại toast mới cạnh toast Bootstrap cũ.
- Chứng minh không còn request ra unpkg (tab Network trống phần đó) và icon vẫn đủ sau khi nạp thêm nội dung động.
- Đếm lại: `:focus-visible` > 0, `skeleton` > 0, số ảnh có `loading="lazy"` / tổng số `<img>`.
