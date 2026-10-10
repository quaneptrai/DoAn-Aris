# Release phỏng vấn và gateway

Release đưa flow phỏng vấn lên Aris: nhập câu hỏi/đáp án, avatar, kịch bản và duyệt giá, tạo/ghép video, ghi âm/chấm câu trả lời, kết quả và xuất dữ liệu. IIS gọi một gateway riêng; media được xử lý bằng FFmpeg trên máy Windows, không cần cài FFmpeg trên hosting.

## Chính sách đã được người dùng chọn

- Tài khoản `xuanthangmuoi@gmail.com` (UserId16) không giới hạn renderer credit.
- Các tài khoản khác 300 renderer credit/ngày, chung mọi bộ và avatar/video; không đặt trần tháng. Usage lưu bền vững tại gateway, đặt lại lúc 00:00 giờ Việt Nam.
- Danh tính lấy từ DB, key chỉ dùng giữa Aris và gateway. UI hiển thị credit còn lại. Không xác định được giá thì tài khoản có hạn mức chưa thể tạo; không coi null là miễn phí.
- Mỗi lượt vẫn cần nhà tuyển dụng duyệt; stop dừng lượt tiếp theo và giữ clip đã gửi đi. Lượt gửi rồi có thể vẫn bị tính phí.

## Những gì đã chuẩn bị

- Task sau đăng nhập: `Aris-InterviewGateway`, khởi động/restart gateway/F2A; dùng dịch vụ đang chạy sẵn khi cổng đã mở.
- Public root: `https://yfecam.tailb611d2.ts.net/gw`; tất cả route cần key, không proxy API quản trị. Root 9router cho MuseFlow vẫn giữ.
- File cấu hình: ignored `tools/InterviewGateway/config.local.json` và `.local/production-settings.interview.json`. Không khóa nào vào Git/trình duyệt/log.
- SQL idempotent: `.local/interview-release-idempotent.sql`. Read-only check xác nhận DB chưa có bảng phỏng vấn mới. `MapCrawledCompanies` chỉ ghi lịch sử snapshot; 2 migration phỏng vấn tạo 5 bảng và thêm tham số, không xóa hay sửa dữ liệu CV/chat/job cũ.
- Preview Embedded 5029 và bản sao 11 clip giữ nguyên; chưa tự đưa bộ này vào DB production.

## Kiểm tra trước triển khai

Gateway 18/18; giọng/media 41/41; flow 61/61; phân phối credit 13/13; dừng 32/32; Chrome 29/29; quota 8/8. Build thành công với 0 lỗi và 64 cảnh báo trong code hiện tại. Toàn bộ các lượt render trong kiểm thử dùng dịch vụ giả.

## Bước cuối cần duyệt

Cấu hình ngoại lệ UserId16 trên đĩa cần được nạp lại bằng restart đúng tiến trình gateway. Chưa thực hiện vì automatic approval review đã từ chối lệnh dừng rộng nhiều gateway và dùng key thật cho probe public; thử nghiệm thay thế chỉ dùng server giả với key riêng. Không dừng preview Embedded hoặc các dịch vụ không thuộc gateway.

Sau khi duyệt: kiểm tra không có render đang chạy, restart đúng gateway, xác minh owner unlimited/user khác 300, áp SQL đã review, chạy read-only schema check, backup live và deploy revision đã commit với settings ứng viên. Kiểm tra health live/ready, đăng nhập và trang phỏng vấn. Giữ App_Data/Drive files. Không tạo video thật để smoke test.

Rollback code bằng package live-backup mới được script deploy lưu, giữ các bảng mới vì migration chỉ thêm và code cũ không dùng chúng. Không dùng migration Down để rollback release. Không thay notebook AiCore hay dịch vụ đang chạy cho nó.

## Xác minh cuối

- Regression toàn repo 20/20. Probe giả qua Funnel giữ kết nối không trả byte 180 giây, HTTP200 sau 180,1 giây; mount `/gw-probe` đã gỡ. Gateway thật thiếu key HTTP401, có key health đạt và renderer usage vẫn 0.
- Preview hiện tại đã khác bản sao Claude: 14 clip, thêm thinking/pass/fail; intro và transition khác byte bản sao, 9 clip còn lại của bản sao vẫn khớp; câu hỏi/avatar/kịch bản/cấu hình vẫn khớp. Có 1 phiên phỏng vấn. Đây là quan sát read-only, không phải lần phục hồi hay tạo lại trong lượt này.
- **Không restart preview 5029.** Helper từ chối snapshot phục hồi vì đã có lịch sử. File HTML/kết quả quan sát nằm ở `.local/embedded-gateway-takeover-20261010`, không có manifest đầy đủ và không được dùng để phục hồi. `.local/embedded-ruby-clean-voice` chỉ là snapshot lịch sử 11 clip, không đại diện toàn bộ dữ liệu hiện tại.

## Revision đã kiểm tra

Application release **`cf04fe9`** đã commit, không chứa credential thực. Web Deploy `-WhatIf` đã thành công với settings ứng viên: 17 file thêm, 4 file cập nhật, 0 file xóa, khoảng 6,4 MB. Chưa đổi website hay DB. Khi duyệt triển khai, chỉ định `-Commit cf04fe9 -SettingsFile .local/production-settings.interview.json`; script tự backup live trước sync. Báo cáo máy đọc được ở `.local/interview-release-result.json`.
