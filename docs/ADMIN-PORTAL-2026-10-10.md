# Trang quản trị và yêu cầu hỗ trợ — 10/10/2026

Người dùng yêu cầu nút gửi yêu cầu ở trang phỏng vấn và trang quản trị có thể quản lý tài khoản. Họ xác nhận ba loại yêu cầu (credit, báo lỗi, hỗ trợ khác) và chỉ định đúng `xuanthangmuoi@gmail.com` (UserId16) cùng `tohkadangyeu@gmail.com` (UserId1) là Admin.

## Hành vi

- `/Employer/InterviewFlow` có nút **Gửi yêu cầu admin** → `/Employer/InterviewFlow/Support`. Form có loại, nội dung và số credit; người gửi xem 30 yêu cầu gần nhất của chính mình cùng phản hồi.
- `/Admin` có các mục Yêu cầu, Tài khoản, Phỏng vấn, Dịch vụ và Lịch sử quản trị. Hai admin nhận thông báo chuông; người gửi nhận thông báo khi có phản hồi. Không gửi email.
- Admin tìm/lọc/phân trang tài khoản; đổi Ứng viên/Nhà tuyển dụng, khóa/mở tài khoản; không xóa hồ sơ/CV/jobs/kết quả. Chuyển hồ sơ cá nhân thành doanh nghiệp giữ nguyên Profile.Id và các FK. Hai admin được bảo vệ khỏi khóa/hạ quyền; không cấp Admin cho email khác.
- Phỏng vấn: xem tổng bộ/câu/clip/lượt trên toàn hệ thống, dừng tạo video, đóng link nhận ứng viên. Dịch vụ: kiểm tra trạng thái, tạm dừng/mở lại gửi lượt dựng ảnh/video. Lượt đã gửi có thể hoàn tất/tính credit.
- Credit duyệt thêm chỉ bổ sung hạn mức trong ngày (hết hạn 00:00 Việt Nam), không nạp tiền/số dư nhà cung cấp. Chủ UserId16 vẫn unlimited; người khác300/ngày cộng khoản đã duyệt. Gateway có khóa quản trị riêng, journal chống cộng trùng; DB lưu trạng thái granting trước khi gọi để retry an toàn. UI duyệt lại giữ nguyên ngày/số lượng đã gửi.
- Sidebar/menu tài khoản và điều hướng mobile hiện Quản trị theo quyền thật trong DB. Admin giữ chức năng nhà tuyển dụng khi có hồ sơ doanh nghiệp. Cookie của tài khoản khóa bị từ chối ở request kế tiếp.

## Kiểm tra và schema

Build 0 lỗi/64 cảnh báo hiện có. Gateway21/21, Admin HTTP52/52, Chrome12/12, luồng phỏng vấn61/61. Chrome kiểm tra gửi form, duyệt credit, hạn mức thật, sidebar/mobile entry, viewport390px không tràn và0 page error. Render kiểm thử dùng dịch vụ giả; không gọi tạo media trả phí.

Migration `20261010152914_AddAdminSupport` chỉ thêm `Users.IsSuspended` mặc địnhfalse và hai bảng `SupportRequests`, `AdminAuditLogs` cùng FK/index. SQL idempotent reviewed `.local/admin-support-idempotent.sql`; SHA256 UTF8 `B1D1285225B7EFB42D29BE52041DE61DEEBA41EECA55535C4E089E0C84D62D1E`. Đã áp schema vào DB db47010; tại đó có16 users,1 kit,14 clip,0 request. Hai Role chưa đổi ở thời điểm chuẩn bị deploy.

Backup mới trước release: `.local/deploy-backups/admin-before-release-20261010-223809.zip`,1.510.311 byte,120 entries, có DLL/web.config/static endpoint metadata và CSS bị thay. Backup live đầy đủ116MB trước release phỏng vấn vẫn giữ. Gateway đã reload sau khi xác minh không có render; cả bốn nhóm dịch vụ healthtrue, pausedfalse. Khóa quản trị chỉ trong ignored config/settings, không gửi ra trình duyệt.

Trạng thái cuối production và revision sẽ được ghi sau khi deploy/xác minh. Không restart preview5029 hoặc AiCore. Không stage `tools/ProvisionEmployer` và `tools/provision-employer.ps1`.
