# 10 — CV và Hồ sơ ứng tuyển

File: `Views/Resume/Index.cshtml` (35 dòng), `Views/Resume/_MyCvsPartial.cshtml` (105), `Views/JobApplications/MyApplications.cshtml` (36), `Views/JobApplications/_MyApplicationsPartial.cshtml` (151), `wwwroot/js/resume-actions.js`, `application-actions.js`, `wwwroot/cv-builder/` (HTML/JS độc lập).

Đây là nơi người dùng thấy **kết quả lao động của chính mình**: CV đã làm, đơn đã nộp. Cảm giác ở hai màn này quyết định họ có quay lại không.

## Hiện trạng đo được

| File | Dòng | CSS | `transition` | `:hover` | token | hex | `style=""` |
|---|---:|---:|---:|---:|---:|---:|---:|
| `Resume/_MyCvsPartial` | 105 | 15 | 1 | 1 | **0** | 1 | 13 |
| `JobApplications/_MyApplicationsPartial` | 151 | 12 | 1 | 2 | 1 | 2 | 14 |
| `Resume/Index` | 35 | 0 | 0 | 0 | 0 | 0 | 3 |
| `JobApplications/MyApplications` | 36 | 0 | 0 | 0 | 0 | 0 | 3 |

- Hai trang bọc chỉ 35–36 dòng, nội dung thật nằm trong partial nạp trễ — hiện dùng `spinner-border`, **0 skeleton**.
- `_MyApplicationsPartial` có `border-success-subtle` và badge trạng thái Bootstrap; `_MyCvsPartial` có `resume-thumb`.
- CV builder là ứng dụng HTML/JS riêng dưới `wwwroot/cv-builder/` — **đây là ngoại lệ được phép** về mật độ chuyển động, nhưng vẫn phải dùng cùng token màu/chữ để không như sản phẩm khác.

## Lỗi cụ thể

1. **Trạng thái đơn ứng tuyển là badge Bootstrap.** Với người tìm việc, đây là thông tin quan trọng nhất trong toàn bộ sản phẩm — "đang chờ", "đã xem", "mời phỏng vấn", "từ chối" — mà đang được thể hiện bằng component mặc định.
2. **Không thấy tiến trình.** Một đơn đi qua nhiều bước, nhưng giao diện chỉ cho biết bước hiện tại, không cho biết đang ở đâu trên đường.
3. **Thumbnail CV không có tỉ lệ cố định** → lưới nhảy khi ảnh tải; CV chưa có ảnh xem trước thì trống trơn.
4. **Không skeleton** trong khi cả hai đều là nội dung nạp trễ — đúng chỗ cần skeleton nhất.
5. **0 token ở `_MyCvsPartial`**, tiếp tục mạch lệch hệ thống.
6. Không có empty state thuyết phục cho người chưa có CV/chưa nộp đơn — trong khi đó là thời điểm cần dẫn dắt nhất.

## Phải làm — mức tối thiểu

1. **Trạng thái đơn thành một hệ riêng**: mỗi bước một màu semantic theo token + nhãn chữ + vị trí trên đường tiến trình. Đọc được cả khi bỏ màu.
2. **Đường tiến trình cho mỗi đơn**: đã nộp → đã xem → phỏng vấn → kết quả, hiện rõ bước hiện tại và các bước đã qua. Chỉ vẽ các bước backend thật sự có dữ liệu.
3. **Skeleton** cho cả hai partial, đúng hình dạng (thumbnail CV theo tỉ lệ giấy, dòng thông tin đơn).
4. **Thumbnail CV tỉ lệ cố định** + ảnh thay thế tử tế khi chưa render được; hành động (sửa, nhân bản, tải về, xoá) hiện khi hover và **luôn hiện trên mobile**.
5. **Empty state dẫn dắt**: chưa có CV → một lối vào CV builder rõ ràng; chưa nộp đơn → gợi ý việc phù hợp thật từ dữ liệu.
6. **Xoá phải hoàn tác được** (hoặc xác nhận rõ) — đây là dữ liệu người dùng tốn công tạo.
7. Áp token cho CV builder ở mức màu/chữ/nút để nó không như sản phẩm thứ hai.

## Một cử chỉ đặc trưng

**Chip trạng thái di chuyển dọc đường tiến trình**: khi đơn đổi trạng thái (hoặc khi thẻ vào khung nhìn lần đầu), chip trượt từ bước trước tới bước hiện tại rồi dừng hẳn. Một lần, không lặp. Cử chỉ này thuộc riêng nhóm CV/Hồ sơ ứng tuyển.

## Vượt trần

- **Dòng thời gian của một đơn**: mở thẻ ra thấy mốc thời gian thật của từng bước, kèm việc cần làm tiếp theo.
- **So sánh CV**: hai phiên bản cạnh nhau, đánh dấu khác biệt — vì người dùng thật sự sửa CV nhiều lần.
- **Nhắc việc có ích**: đơn quá X ngày chưa phản hồi thì gợi ý hành động, dựa trên dữ liệu thật.
- **Xuất CV có xem trước đúng bản in**, không phải tải về rồi mới biết hỏng.

## Nghiệm thu riêng

- Ảnh 4 trạng thái mỗi màn: rỗng, skeleton, có dữ liệu, lỗi tải.
- **Ảnh xám** của danh sách đơn: vẫn phân biệt được các trạng thái khác nhau.
- Clip chip trạng thái chạy, và clip xoá CV có hoàn tác.
- Chứng minh lưới không nhảy khi thumbnail tải (so sánh hai frame).
- Số đo: token 0/1 → ?, skeleton 0 → ?, inline `style=""` 13/14 → ?
