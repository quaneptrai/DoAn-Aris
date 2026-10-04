# 03 — Jobs: danh sách, chi tiết, card

File: `Views/Jobs/Index.cshtml` (1.671 dòng), `Views/Jobs/Details.cshtml` (603), `Views/Jobs/_JobCardPartial.cshtml` (178), `Views/Shared/_RecommendedJobsPartial.cshtml` (227).

Đây là surface **tệ nhất so với tầm quan trọng**: nơi người dùng dành nhiều thời gian nhất trong một nền tảng tuyển dụng, mà lại gần như không có chất riêng.

## Hiện trạng đo được

- `Jobs/Index`: 1.671 dòng, chỉ **111 dòng CSS**, **1** `transition`, 3 `:hover`, 2 `transform`, **59** `style=""` inline, **0** `:focus-visible`, **0** skeleton, 22 lần nhắc `spinner/loading`.
- Lớp markup chủ đạo là Bootstrap trần: `rounded-pill` (35), `btn` (29), `form-control` (24), `bg-light` (12), `btn-primary` (9), `btn-outline-primary` (9), 6 `modal`.
- Cấu trúc đã hợp lý: Header → Candidate Search Row → nút lọc cho mobile → workspace 3 cột → rail lọc trái → kết quả + gợi ý AI → danh sách → "Load More".
- **Điểm cộng thật sự, giữ lấy:** có `<!-- Polite Screen Reader Live Region -->` và 12 thuộc tính `aria-`. Đây là view chăm a11y nhất trong app. Đừng làm mất khi dựng lại.
- `Jobs/Details`: 603 dòng, **1** transition, 15 inline style. `_JobCardPartial`: 178 dòng, 3 transition — card là chỗ duy nhất có chút chuyển động.

## Lỗi cụ thể

1. **Nhìn như form nội bộ, không như sản phẩm.** 1.671 dòng mà 1 transition: lọc, tìm, tải thêm — không thao tác nào có phản hồi chuyển động. Người dùng bấm xong không biết hệ thống có nghe không.
2. **Không có skeleton** dù có tới 22 chỗ nói về loading: lọc lại là danh sách biến mất rồi hiện ra, layout nhảy.
3. **Card công việc không có cấp bậc**: tên công ty, chức danh, lương, địa điểm, loại hình đều là pill xám giống nhau (`job-meta-pill`, `rounded-pill` 35 lần). Mắt không biết đọc gì trước.
4. **Trạng thái "đã lưu" / "đã ứng tuyển" không đủ mạnh** — đây là thông tin quan trọng nhất với người đang tìm việc, phải nhận ra trong một cái liếc.
5. **"Load More" là nút**, không phải dòng chảy: mỗi lần bấm là một cú giật.
6. **59 inline style** khiến card và rail không thể đồng bộ với phần còn lại của app.
7. **Chuyển Index → Details là cắt cảnh**: mất hoàn toàn ngữ cảnh card vừa bấm.

## Phải làm — mức tối thiểu

1. **Card công việc dựng lại theo cấp bậc**: logo → chức danh (đậm nhất) → công ty → 2–3 thẻ meta quan trọng nhất, phần còn lại lùi. Trạng thái đã lưu/đã ứng tuyển là dấu hiệu vật liệu, không phải một pill xám nữa.
2. **Skeleton danh sách** đúng hình dạng card, dùng khi lọc, tìm, và tải thêm.
3. **Lọc phản hồi tức thì**: chip lọc đang áp hiển thị rõ, bỏ từng chip được, số kết quả cập nhật có nhịp, giữ nguyên vị trí cuộn.
4. **Tải thêm theo dòng chảy** (nạp khi cuộn tới, giữ nút làm phương án dự phòng cho bàn phím), card mới vào không đẩy nội dung đang đọc.
5. **Empty state tử tế**: khi lọc không ra gì, đề xuất nới điều kiện nào — không phải một dòng chữ xám.
6. **Details**: bố cục hai cột có rail hành động dính (ứng tuyển/lưu), nội dung mô tả có nhịp đọc (thang chữ, độ dài dòng), và trạng thái sau khi ứng tuyển phải đổi rõ ràng ngay tại chỗ.
7. Gỡ 59 inline style về class; thêm `:focus-visible`; **giữ nguyên live region và các `aria-` đang có**.

## Một cử chỉ đặc trưng

**Card mở thành trang chi tiết.** Bấm vào card thì chính card đó giãn ra chiếm khung, logo và chức danh giữ nguyên vị trí rồi trượt về đúng chỗ của trang Details — không cắt cảnh. Quay lại thì thu về đúng card cũ, đúng vị trí cuộn. Đây là cử chỉ riêng của Jobs, không dùng ở surface khác.

## Vượt trần

- **Lọc là đối thoại, không phải form**: mỗi lần đổi điều kiện, hệ thống nói ngay còn bao nhiêu kết quả **trước khi** người dùng bấm áp dụng.
- **So sánh nhanh**: ghim 2–3 việc để xem cạnh nhau, vì đó là việc người tìm việc thật sự làm.
- **Card biết kể vì sao nó ở đây** ("khớp kỹ năng X, gần vị trí Y") — dữ liệu thật, không bịa điểm số.
- **Trạng thái đã xem** làm dịu card đã đọc để mắt tự đi tiếp, thay vì đọc lại từ đầu mỗi lần vào.

## Nghiệm thu riêng

- Clip: lọc → skeleton → kết quả mới, không nhảy layout, giữ vị trí cuộn.
- Clip: card → Details → quay lại, thấy rõ điểm neo được giữ.
- Ảnh 4 trạng thái: rỗng (không kết quả), skeleton, có dữ liệu, lỗi tải.
- **Ảnh xám** của một card: phải đọc được thứ tự chức danh → công ty → meta.
- Bằng chứng a11y còn nguyên: live region vẫn thông báo số kết quả, Tab đi hết rail lọc và danh sách, focus thấy rõ.
- Số đo: inline `style=""` 59 → ?, `transition` 1 → ?, skeleton 0 → ?
