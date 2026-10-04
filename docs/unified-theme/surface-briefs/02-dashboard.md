# 02 — Dashboard (`Views/Dashboard/Index.cshtml`, 1.443 dòng)

Surface được chăm nhất hiện nay, và vẫn chưa đủ. Đây là trang người dùng thấy ngay sau đăng nhập, nên nó phải gánh việc chứng minh rằng chất lượng của màn login không dừng ở cửa.

## Hiện trạng đo được

- 699 dòng CSS nhúng trong view, **105** lần dùng token — surface duy nhất dùng hệ token nghiêm túc.
- 12 `transition`, 10 `:hover`, 15 `transform`, 2 `@keyframes` (`heroOrbitSpin`, `likeHeartbeat`), 9 lần dùng `stagger-in`.
- **48** thuộc tính `style=""` inline, **0** `:focus-visible`, **0** skeleton.
- Dữ liệu là thật, không bịa: `ViewBag.ActiveJobCount`, `ViewBag.AppliedCount`, `ViewBag.Posts`, `ViewBag.RecentJobs`, `ViewBag.UpcomingInterview`, `ViewBag.HasCv`. **Giữ nguyên tính chất này** — không thêm số liệu trang trí.
- Cấu trúc: hero "Career Atelier" + artwork orbit + metric pill → lưới 3 cột (248px / 1fr / 280px) → rail hồ sơ + shortcut → composer → feed bài viết → rail phải.

## Lỗi cụ thể

1. **Artwork hero là một vòng orbit xoay** (`heroOrbitSpin`) — cùng mô-típ với vòng orbit ở `_AuthLayout` mà người dùng đã bác. Nó không nói gì về nghề nghiệp, không phản ứng với dữ liệu của chính người đang xem, và xoay vô hạn nên thành tiếng ồn thị giác.
2. **Metric pill là hạt dữ liệu rời**: một chấm màu và một con số, không cho biết xu hướng, không bấm được vào đâu, không giải thích ý nghĩa.
3. **`stagger-in` áp cho 9 khối theo thứ tự DOM cố định**, không theo thứ tự người dùng thật sự nhìn, và chạy lại mỗi lần tải trang — người vào 10 lần/ngày sẽ thấy phiền.
4. **Composer chưa có trạng thái thật**: không skeleton khi đang đăng, phản hồi sau khi đăng phụ thuộc toast mặc định, ảnh đính kèm không có khung giữ chỗ nên layout nhảy.
5. **Feed không có skeleton và không có nhịp cuộn**: bài viết xuất hiện cùng lúc, thumbnail không đặt kích thước.
6. **48 inline style** khiến không thể chỉnh hệ thống từ một chỗ.

## Phải làm — mức tối thiểu

1. **Hero**: thay vòng xoay vô hạn bằng artwork **có trạng thái**, phản ứng với dữ liệu thật của người đang xem (có CV chưa, đã ứng tuyển bao nhiêu, có lịch phỏng vấn sắp tới không). Chuyển động phải kết thúc ở trạng thái nghỉ, không quay mãi.
2. **Metric**: mỗi con số kèm nhãn rõ, xu hướng nếu backend đã có dữ liệu, và bấm được sang đúng trang lọc sẵn. Nếu không có dữ liệu xu hướng thì đừng vẽ mũi tên giả.
3. **Skeleton** cho feed, rail hồ sơ và danh sách việc gợi ý, đúng hình dạng nội dung.
4. **Composer**: trạng thái rỗng/đang gõ/đang tải ảnh/đang đăng/lỗi; khung giữ chỗ cho media theo tỉ lệ; nút đăng chỉ bật khi hợp lệ.
5. **Feed**: card vào theo nhịp khi cuộn tới (IntersectionObserver), like có phản hồi optimistic và hoàn tác được khi lỗi, ảnh đặt `aspect-ratio` + `loading="lazy"`.
6. Gỡ 48 inline style về class dùng token; thêm `:focus-visible` cho mọi control trong feed và shortcut.
7. Lưới 3 cột phải gãy đúng ở 1024/768/390: rail phải xuống dưới, rail trái thành hàng shortcut ngang, không ép thu nhỏ chữ.

## Một cử chỉ đặc trưng

**Hero "nạp quỹ đạo"**: khi vào trang, artwork vẽ một cung quỹ đạo từ vị trí hiện tại của người dùng (hồ sơ, CV, số hồ sơ đã nộp) tới mốc kế tiếp, kết thúc đúng ở nút hành động chính. Vào lại trong ngày thì chỉ chạy đoạn cuối. Cử chỉ này vừa là trang trí vừa là thông tin — đó là khác biệt giữa animation và hiệu ứng.

## Vượt trần

- **Hero đổi theo thời điểm và tiến trình**: người chưa có CV thấy một quỹ đạo khác người đang chờ phỏng vấn. Cùng một khung hình, khác nội dung.
- **Feed có nhịp đọc**: bài dài tự tách khối, ảnh mở rộng mềm khi bấm, không nhảy sang trang khác cho một thao tác xem.
- **Rail hồ sơ là một vật thể**, không phải card phẳng: độ hoàn thiện hồ sơ hiển thị bằng vật liệu (một vành sáng lấp dần) thay vì thanh progress xám.
- **Trở lại vị trí cũ** khi quay về từ Jobs/Profile — giữ scroll và trạng thái tab.

## Nghiệm thu riêng

- Ảnh trước/sau ở 1440 và 390, kèm **ảnh xám** chứng minh phân cấp: hero → hành động chính → feed, không phải ba khối ngang nhau.
- Clip cử chỉ hero cho hai hồ sơ khác nhau (có CV / chưa có CV) để thấy nó phản ứng theo dữ liệu.
- Ảnh 4 trạng thái của feed: rỗng, skeleton, có dữ liệu, lỗi tải.
- Clip like + đăng bài cho thấy phản hồi tại chỗ và hoàn tác khi lỗi.
- Số đo: inline `style=""` từ 48 → bao nhiêu; `:focus-visible` > 0; ảnh có `loading="lazy"`.
- Không có số liệu nào xuất hiện trên màn mà không có nguồn từ `ViewBag`/model thật.
