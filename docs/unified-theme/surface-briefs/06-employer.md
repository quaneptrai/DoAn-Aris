# 06 — Employer (`Views/Employer/Index.cshtml`, 319 dòng)

Bảng điều khiển của bên trả tiền. Hiện là một trang Bootstrap mặc định có số.

## Hiện trạng đo được

- 319 dòng, **8 dòng CSS**, **0** `transition`, 2 `:hover`, **0** `transform`, **0** `:focus-visible`, **0** skeleton.
- **39** `style=""` inline, 10 hex cứng, **1** lần dùng token.
- Cấu trúc: Header Banner → 4 KPI card → lưới chính → phễu tuyển dụng (stage cards) + danh sách tin tuyển dụng → cột phải (Quick Actions, Best Practices).
- KPI lấy dữ liệu thật: `Model.ActiveJobCount`, `Model.TotalApplicants`, `Model.NewApplicantsLast7Days`, `Model.ClosedJobCount` — hiển thị bằng `<h3>` trần trong card `bg-white shadow-sm`.
- Có class `hover-card` (3 lần) nhưng không có `transition` nào → hover đổi đột ngột.

## Lỗi cụ thể

1. **Bốn KPI card giống hệt nhau**, không cái nào được ưu tiên, không cái nào bấm được sang danh sách tương ứng. Con số đứng một mình không nói được gì: 12 ứng viên là nhiều hay ít?
2. **Phễu tuyển dụng — thứ đáng giá nhất trang — đang là mấy card xếp ngang**, không đọc ra hình phễu, không thấy tỉ lệ rơi giữa các bước.
3. **`hover-card` không có transition** → đây đúng nghĩa là hiệu ứng làm dở dang.
4. **39 inline style trên 319 dòng**: mật độ cao nhất app tính theo tỉ lệ.
5. Không có skeleton, không có empty state cho nhà tuyển dụng mới (chưa đăng tin nào) — đúng lúc cần thuyết phục nhất.

## Phải làm — mức tối thiểu

1. **KPI có ngữ cảnh**: nhãn rõ, so sánh với kỳ trước **nếu backend có dữ liệu** (không có thì thôi, không vẽ mũi tên giả), và bấm được sang danh sách đã lọc sẵn.
2. **Phễu vẽ thành phễu**: mỗi bước có bề rộng theo số lượng, tỉ lệ chuyển tiếp giữa hai bước hiện rõ, bấm vào một bước ra danh sách ứng viên ở bước đó.
3. **Danh sách tin tuyển dụng** dùng chung component card với Jobs (đừng dựng loại card thứ hai), thêm trạng thái tin (đang chạy/sắp hết hạn/đã đóng) đọc được trong một liếc.
4. Gỡ 39 inline style; áp token; `hover-card` có transition đúng thang thời lượng chung.
5. Empty state cho tài khoản chưa có tin, kèm hành động chính rõ ràng.
6. `:focus-visible` cho mọi card bấm được và nút hành động nhanh.

## Một cử chỉ đặc trưng

**Phễu đổ đầy theo thứ tự giai đoạn** khi trang vào khung nhìn: từng bậc phễu nhận số của mình lần lượt từ trên xuống, con số đếm lên trong khoảng rất ngắn rồi dừng. Chạy một lần mỗi phiên, không lặp. Không dùng cử chỉ này ở surface khác.

## Vượt trần

- **Phễu bấm được để so sánh hai tin tuyển dụng** cạnh nhau.
- **Cảnh báo có ích**: tin sắp hết hạn, ứng viên chờ phản hồi quá lâu — đặt ngay trong phễu chứ không phải một hộp thông báo riêng.
- **Khối "việc cần làm hôm nay"** thay cho Best Practices tĩnh: dựa trên dữ liệu thật của tài khoản.

## Nghiệm thu riêng

- Ảnh trước/sau 1440 + 390, kèm ảnh xám: phễu phải là trọng tâm, KPI là hàng phụ.
- Clip phễu đổ đầy (một lần), và chứng minh nó không chạy lại khi cuộn qua lại.
- Ảnh trạng thái: chưa có tin nào, có dữ liệu, lỗi tải.
- Số đo: inline `style=""` 39 → ?, token 1 → ?, `transition` 0 → ?
