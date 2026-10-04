# 11 — Onboarding (`Views/Account/NewUserInfor.cshtml`, 497 dòng)

Ấn tượng thứ hai, ngay sau màn đăng nhập. Người dùng vừa xem một hoạt cảnh 3D xong thì rơi vào một form ba bước không có lấy một `:hover`.

## Hiện trạng đo được

- 497 dòng, 110 dòng CSS nhúng, 12 token, 6 hex cứng, 2 `transition`, **0** `:hover`, **0** `transform`, **0** `:focus-visible`, **0** skeleton.
- Ba chặng: **STAGE 1 Về bạn** (vị trí, nhánh Sinh viên / Đi làm) → **STAGE 2 Mục tiêu công việc** → **STAGE 3 Quyền riêng tư & Hoàn tất** (có Summary Card).
- Có stepper thị giác (`step-node`, `step-circle`, `step-label`), form dùng `form-control-lg` / `form-select-lg`, có `feedback-invalid` (3 lần).
- 9 nhánh `else` — logic rẽ nhánh theo vai trò đã có sẵn.

Cấu trúc nội dung ở đây **tốt hơn phần lớn app**: có chặng, có tóm tắt, có rẽ nhánh. Vấn đề nằm ở chỗ nó không có sự sống.

## Lỗi cụ thể

1. **Stepper không chuyển động.** Ba chấm đổi màu tức thì — người dùng không cảm thấy mình đang tiến.
2. **0 `:hover` trên toàn bộ 497 dòng**: các lựa chọn (thành phố phổ biến, vai trò, mục tiêu) không phản hồi khi rê chuột, nên không rõ cái gì bấm được.
3. **Chuyển chặng là nhảy**: nội dung biến mất và xuất hiện, mất cảm giác liên tục, và nếu chặng sau dài hơn thì trang giật.
4. **Lỗi hợp lệ hiện thô** (`feedback-invalid`) mà không dẫn người dùng tới ô sai, không cuộn tới, không focus.
5. **Summary Card chỉ liệt kê** — đây là lúc nên cho người dùng thấy họ vừa tạo ra một hồ sơ trông ra sao.
6. Không có trạng thái "đang lưu" khi hoàn tất — bấm xong không biết chuyện gì đang xảy ra.

## Phải làm — mức tối thiểu

1. **Stepper sống**: bước hiện tại rõ ràng, bước đã xong có dấu hoàn thành, đường nối giữa các bước thể hiện tiến độ; quay lại bước trước được.
2. **Chuyển chặng có hướng**: chặng mới vào theo chiều tiến, chặng cũ ra theo chiều ngược; khung giữ chiều cao tối thiểu để không giật.
3. **Mọi thứ bấm được phải phản hồi**: thẻ thành phố, thẻ vai trò, thẻ mục tiêu — hover, chọn, và trạng thái đã chọn đọc được cả khi bỏ màu.
4. **Xử lý lỗi tử tế**: cuộn tới ô sai, focus vào nó, nêu rõ sai gì và sửa thế nào; không cho sang chặng sau mà không nói lý do.
5. **Trạng thái hoàn tất**: nút có trạng thái đang lưu, chặn bấm đúp, và chuyển sang Dashboard có cảm giác liền mạch chứ không phải tải lại thô.
6. `:focus-visible` cho mọi control; toàn bộ luồng đi được bằng bàn phím.
7. Áp nốt token (12 lần dùng hiện tại là chưa đủ) và bỏ 6 hex cứng.

## Một cử chỉ đặc trưng

**Đường nối giữa các bước được vẽ dần**: khi hoàn tất một chặng, đoạn đường từ bước vừa xong tới bước kế tiếp được vẽ ra rồi dừng, bước kế tiếp sáng lên. Một lần cho mỗi bước, không lặp. Cử chỉ này thuộc riêng Onboarding.

## Vượt trần

- **Summary Card là bản xem trước hồ sơ thật**: người dùng thấy ngay hồ sơ của mình sẽ trông thế nào với nhà tuyển dụng, ngay trước khi bấm hoàn tất.
- **Nội dung thích ứng theo nhánh**: sinh viên và người đi làm thấy hai bộ câu hỏi thật sự khác nhau, không phải cùng form ẩn bớt.
- **Lưu tạm và quay lại sau** mà không mất dữ liệu đã nhập.
- **Chuyển tiếp sang Dashboard giữ điểm neo**: hồ sơ vừa tạo xuất hiện đúng chỗ ở rail trái, không phải một trang mới không liên quan.

## Nghiệm thu riêng

- Clip đi hết ba chặng, thấy stepper tiến và chuyển chặng có hướng, không giật chiều cao.
- Clip trường hợp nhập sai: hệ thống đưa người dùng tới đúng ô.
- Ảnh hai nhánh (sinh viên / đi làm) để chứng minh nội dung thật sự khác.
- Clip hoàn tất → Dashboard, thấy liên tục thị giác.
- Số đo: `:hover` 0 → ?, `:focus-visible` 0 → ?, token 12 → ?, hex 6 → ?
