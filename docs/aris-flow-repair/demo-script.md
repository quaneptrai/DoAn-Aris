# Kịch bản Demo Luồng Tuyển Dụng & Khớp AI Aris (5–10 Phút)

Tài liệu hướng dẫn thực hiện demo thực tế luồng tích hợp giữa **Aris** (`ArisSkyve`) và **AiCore** với tài khoản thử nghiệm.

---

## 1. Chuẩn bị môi trường & Tài khoản

### Các bước tiên quyết bắt buộc trước khi demo
1. **Xác nhận Aris và AiCore cùng DB**:
   - Khi Aris khởi động (`dotnet run`), kiểm tra dòng log: `Aris khởi động — Môi trường: ... | Server: ... | Database: ...`.
   - So khớp `Server` và `Database` với `SQL_SERVER` và `SQL_DATABASE` trong tệp `.env` của AiCore. Gợi ý AI chỉ hoạt động khi cả hai dịch vụ dùng chung một cơ sở dữ liệu (`employee_id` từ `Profiles.Id` và `posting_id` từ `JobPostings.Id`).
2. **Áp migration cho đúng DB đó**:
   - Chạy lệnh cập nhật database (`dotnet ef database update` tại thư mục `ArisSkyve`, chủ dự án tự chạy) để đảm bảo bảng `UserRecommendations` có đủ các cột `PayloadJson`, `ResumeId`, `Score`, `Rank`.
3. **Tính sẵn gợi ý cho tài khoản demo**:
   - Sau khi các tài khoản demo đã tạo/tải CV lên hệ thống: gọi API tính sẵn gợi ý của AiCore bằng:
     `POST http://localhost:8001/recommendations/precompute` với request body `{"all": true}`.
   - Nhờ đó, khi demo trang Gợi ý việc làm, kết quả trả về tức thì từ kho tính sẵn mà không phải chờ tính mới 26–33 giây.

### Khởi động dịch vụ & Tài khoản
1. **Khởi động AiCore**:
   - Thư mục: `D:\ThucTap\AiCore`
   - Lệnh: `uvicorn main:app --port 8001 --reload` (Khớp cấu hình `AiCore:BaseUrl` = `http://localhost:8001` trong `appsettings.json`)
2. **Khởi động Aris**:
   - Thư mục: `D:\Downloads\ArisThucTap-main\ArisThucTap-main\ArisSkyve`
   - Lệnh: `dotnet run` (Truy cập `http://localhost:5025` theo launch profile HTTP, hoặc `https://localhost:7196`)
3. **Tài khoản thử nghiệm**:
   - **Ứng viên (Candidate)**: Đăng ký tài khoản với vai trò "Ứng viên" hoặc sử dụng tài khoản mẫu: `candidate.demo@aris.vn` / `Demo@12345`
   - **Nhà tuyển dụng (Business)**: Đăng ký tài khoản với vai trò "Doanh nghiệp" hoặc sử dụng tài khoản mẫu: `employer.demo@aris.vn` / `Demo@12345`
   - *Lưu ý*: Nếu chạy trên DB mới hoặc môi trường phát triển chưa có dữ liệu, sử dụng trang Đăng ký (`/Account/Register`) để tạo hai tài khoản với các vai trò tương ứng mà không can thiệp trực tiếp vào DB dùng chung.

---

## 2. Kịch bản các bước Demo

### Bước 1: Ứng viên chuẩn bị CV & xem Dashboard
- **Thao tác**: Đăng nhập tài khoản Candidate → Truy cập `/Dashboard`.
- **Quan sát**:
  - Thẻ tóm tắt thông tin ứng viên hiển thị huy hiệu `Đơn nộp X`.
  - Danh sách việc cần làm (todos) hiển thị đúng trạng thái: nếu chưa có CV hiển thị "Tạo CV đầu tiên" dẫn tới `/Profile#resume`; nếu đã có CV hiển thị "Việc làm phù hợp CV" dẫn tới `/Jobs?tab=ai`.
  - Không có hiện tượng gửi request AI trùng lặp khi nạp trang.

### Bước 2: Khám phá Gợi ý Việc làm AI ("Dành cho bạn")
- **Thao tác**: Vào trang `/Jobs` → Chuyển sang tab **"Dành cho bạn (AI)"** (`#tabAiJobs`).
- **Quan sát**:
  - Hệ thống nạp danh sách việc làm gợi ý từ AiCore (hoặc cache DB nếu đã từng tính toán).
  - Mỗi thẻ gợi ý hiển thị: Tên công ty, vòng điểm tương thích (chuẩn thang điểm 100), lý do gợi ý, các thẻ kỹ năng khớp (matched skills), các thẻ kỹ năng chưa thấy trong CV (phrasing tôn trọng: "Chưa thấy trong nội dung CV đã lưu"), và lời khuyên phát triển hồ sơ (advice).
  - Nhấp vào một thẻ việc làm: Chi tiết JD hiển thị đầy đủ bên khung phải (`#jdInner`).

### Bước 3: Kiểm chứng Persistence & Khôi phục Cache
- **Thao tác**: Nhấn F5 (Reload) trang `/Jobs?tab=ai`.
- **Quan sát**:
  - Dữ liệu gợi ý được khôi phục ngay lập tức từ bảng `UserRecommendations` (`PayloadJson`).
  - Điểm số, kỹ năng khớp, kỹ năng thiếu, lời khuyên và thứ hạng (rank) được bảo toàn 100%, không bị biến thành null hay 0 điểm.

### Bước 4: Đối chiếu trực tiếp một CV với một JD cụ thể (CV-JD Matching)
- **Thao tác**: Tại trang chi tiết một việc làm (`/Jobs/Details/{id}`), quan sát khung **"Đối chiếu với CV của bạn"**.
- **Thao tác**: Chọn một CV trong dropdown selector (chỉ hiển thị các CV thuộc quyền sở hữu của ứng viên) → Bấm nút **"Phân tích mức phù hợp"**.
- **Quan sát**:
  - Trạng thái loading xuất hiện kèm spinner; vô hiệu hoá bấm lặp lại.
  - Sau khi AiCore hoàn tất chấm điểm, màn hình hiển thị:
    - Điểm tương thích theo thang chuẩn kèm màu phân hạng.
    - Nhận định tổng quan và lời khuyên cụ thể.
    - Kỹ năng khớp và kỹ năng cần bổ sung.
    - Trích dẫn bằng chứng thực tế (`evidence`): so sánh đối chiếu giữa `cv_quote` và `job_quote`.
  - Khi đổi sang CV khác, request cũ tự động bị huỷ bỏ (`AbortController`), không bao giờ ghi đè kết quả của CV trước lên CV sau.

### Bước 5: Nộp đơn ứng tuyển với CV đã chọn
- **Thao tác**: Nhấn nút **"Ứng tuyển ngay"** trên JD → Chọn CV vừa đối chiếu → Điền thư giới thiệu → Xác nhận nộp đơn.
- **Quan sát**:
  - Đơn ứng tuyển được lưu vào hệ thống kèm theo snapshot CV tại thời điểm nộp (`resumeUrl`).

### Bước 6: Nhà tuyển dụng xử lý đơn trên Bàn làm việc (Kanban Pipeline)
- **Thao tác**: Đăng xuất Candidate → Đăng nhập tài khoản Business → Truy cập `/Employer`.
- **Quan sát**:
  - Cột bên trái hiển thị danh sách tin tuyển dụng kèm số lượng ứng viên theo thời gian thực.
  - Chọn tin tuyển dụng vừa được nộp đơn: Bảng Kanban 6 cột hiển thị thẻ ứng viên trong cột **"Đã nộp"**.
  - Thẻ ứng viên hiển thị đúng họ tên (`fullName`), avatar, vị trí ứng tuyển, thời gian nộp và huy hiệu số lần nộp.
  - Sử dụng bàn phím: Nhấn `Tab` đến thẻ ứng viên, bấm `Enter` để mở ngăn chi tiết (Drawer).
  - Ngăn chi tiết (Slide-in Drawer) hiển thị đầy đủ thư giới thiệu, nút xem file CV snapshot, và nút nhắn tin trực tiếp. Bấm `Esc` để đóng drawer và con trỏ tự động quay lại thẻ ứng viên.

### Bước 7: Chuyển trạng thái ứng viên & Lên lịch phỏng vấn
- **Thao tác**: Kéo thả thẻ ứng viên hoặc nhấn phím `Alt + Mũi tên phải` để chuyển thẻ sang cột **"Đang xem xét"** → Thẻ chuyển vị trí ngay lập tức (optimistic UI), một thông báo Toast hiện ra cho phép bấm **"Hoàn tác"** nếu muốn rollback.
- **Thao tác**: Kéo thẻ sang cột **"Phỏng vấn"**: Modal hẹn phỏng vấn tự động mở ra.
- **Thao tác**: Chọn ngày giờ phỏng vấn (hệ thống chặn không cho chọn ngày quá khứ), nhập địa điểm/phòng họp trực tuyến → Nhấn **"Xác nhận lịch hẹn"**.
- **Quan sát**:
  - Thẻ ứng viên được ghim huy hiệu "Phỏng vấn".
  - Mở Drawer của ứng viên: Xuất hiện khối thông tin lịch phỏng vấn với ngày giờ và địa điểm rõ ràng.
  - Thao tác chuyển đổi tin tuyển dụng khác trong lúc gửi request: Đảm bảo dữ liệu tin cũ không bao giờ ghi đè lên tin mới nhờ cơ chế cô lập `jobIdAtOperation`.

---

## 3. Tổng kết & Cam kết bảo mật
- Mọi dữ liệu nhạy cảm (AiCore API Key) chỉ được quản lý tại backend máy chủ Aris thông qua `IHttpClientFactory` và `AiCoreKeyHandler`, không để lộ xuống trình duyệt.
- Cơ chế bảo vệ CSRF và xác thực quyền sở hữu (`resume.EmployeeId == profile.Id`) ngăn chặn tuyệt đối việc đánh giá trộm hoặc xem trộm hồ sơ người dùng khác.
