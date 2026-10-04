# 04 — Profile (`Views/Profile/Index.cshtml`, 917 dòng)

Hồ sơ là sản phẩm của người dùng trong một nền tảng nghề nghiệp. Hiện nó đang là trang có mật độ "viết tay" cao nhất và chất riêng thấp nhất.

## Hiện trạng đo được

- 917 dòng, chỉ 99 dòng CSS nhúng, **63** `style=""` inline — **cao nhất toàn app**.
- **5** lần dùng token so với **18** hex cứng. 3 `transition`, 2 `:hover`, **0** `transform`, **0** `:focus-visible`, **0** skeleton.
- 5 `spinner-border` (dùng cho tab CV và Applications nạp trễ), 14 nhánh `@if`, 10 `else`.
- Cấu trúc: cột trái (Identity Card, Bio, Location, Contact Methods, Business Account, CV Card, Featured Skills) → cột giữa (tab Posts / My CVs / Applications, composer trigger, danh sách bài) .
- Có class `card-aris` (11 lần) — dấu hiệu đã bắt đầu hệ component nhưng bỏ dở.

## Lỗi cụ thể

1. **Bảy card xếp dọc cột trái, tất cả cùng một trọng lượng.** Không có gì nói cái nào quan trọng. Danh tính, liên hệ, CV, kỹ năng — đọc như bảy ô ngang hàng.
2. **0 `transform` trên 917 dòng**: không một chuyển động vật lý nào. Đổi tab, mở chế độ sửa, tải CV — tất cả đều là nhảy trạng thái tức thì.
3. **63 inline style** nghĩa là mỗi khoảng cách, mỗi màu được quyết định tại chỗ. Không thể đồng bộ với hệ chung mà không dọn.
4. **Tab nạp trễ chỉ có spinner tròn**: vùng nội dung sụp xuống rồi bung ra, layout nhảy hai lần mỗi lần đổi tab.
5. **Ảnh đại diện và ảnh bìa không đặt kích thước** → nhảy layout khi tải, đúng chỗ dễ thấy nhất.
6. **Chế độ xem và chế độ sửa không phân biệt bằng vật liệu**, chỉ bằng việc input hiện ra — người dùng không chắc mình đang ở đâu.

## Phải làm — mức tối thiểu

1. **Phân cấp lại cột trái**: một khối danh tính lớn (ảnh, tên, chức danh, vị trí, hành động chính), rồi các khối phụ nhỏ hơn hẳn về trọng lượng thị giác. Không phải bảy card giống nhau.
2. **Skeleton cho tab CV và Applications** đúng hình dạng nội dung, thay cho spinner; vùng tab giữ nguyên chiều cao tối thiểu để không sụp.
3. **Chế độ sửa là một trạng thái vật liệu rõ**: nền vùng đang sửa đổi, hành động lưu/huỷ dính ở đáy vùng đó, và có phản hồi lưu tại chỗ (không chỉ toast góc màn).
4. Gỡ 63 inline style; thay 18 hex bằng token; hoàn thiện `card-aris` thành component thật để các surface khác dùng lại.
5. Ảnh đại diện/bìa đặt `aspect-ratio` + kích thước + `loading="lazy"`; có ảnh mặc định tử tế khi thiếu.
6. `:focus-visible` cho tab, nút sửa, và mọi control trong card.
7. Kỹ năng nổi bật: thẻ có cấp bậc (mức độ thành thạo nếu backend có), không phải một rừng pill xám.

## Một cử chỉ đặc trưng

**Các lớp hồ sơ tách chiều sâu khi cuộn**: ảnh bìa, khối danh tính và nội dung dịch chuyển với tốc độ khác nhau rất nhẹ, tạo cảm giác hồ sơ là một vật thể có bề dày chứ không phải danh sách card. Biên độ nhỏ (vài chục pixel), tắt hoàn toàn theo reduced-motion. Không dùng cử chỉ này ở surface khác.

## Vượt trần

- **Hồ sơ có "độ hoàn thiện" đọc được bằng vật liệu** — một vành hoặc một lớp sáng lấp dần quanh khối danh tính, thay cho thanh progress xám.
- **Chuyển chế độ xem → sửa là một phép biến hình**: chữ biến thành ô nhập ngay tại chỗ, giữ nguyên vị trí và cỡ chữ, không phải mở một form khác.
- **Ảnh đại diện có phản hồi chiều sâu** khi rê chuột (bóng và ánh sáng đổi rất nhẹ) — vật liệu giống ngôn ngữ của login, không phải copy hiệu ứng.
- **Bản xem như người khác thấy**: một công tắc để tự kiểm hồ sơ mình dưới mắt nhà tuyển dụng.

## Nghiệm thu riêng

- Ảnh trước/sau 1440 + 390, kèm **ảnh xám**: khối danh tính phải nổi rõ hơn hẳn các card phụ.
- Clip đổi tab với skeleton, không sụp chiều cao.
- Clip vào/ra chế độ sửa, thấy phản hồi lưu tại chỗ.
- Ảnh trạng thái: hồ sơ trống (người mới), hồ sơ đầy, lỗi tải tab.
- Số đo: inline `style=""` 63 → ?, token 5 → ?, hex 18 → ?, `transform` 0 → ?
