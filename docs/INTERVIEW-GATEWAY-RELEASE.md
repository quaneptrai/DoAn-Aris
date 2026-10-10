# Release phỏng vấn và gateway — đã lên production 10/10/2026

Application revision **`0ac45de`** (feature base `cf04fe9`) đã được triển khai tại https://thuctap.runasp.net, sau khi người dùng yêu cầu làm hết tới production. Hai health endpoint trả HTTP200. Không còn migration chờ trong DB `db47010`.

## Chính sách credit

- `xuanthangmuoi@gmail.com` (UserId16 trong DB): không giới hạn renderer credit.
- Tài khoản khác: 300 renderer credit/ngày, chung mọi bộ và avatar/video; không đặt trần tháng. Đặt lại lúc 00:00 giờ Việt Nam.
- Aris xác định UserId từ DB, gửi SHA-256 của `aris:user:<UserId>` tới gateway. Trình duyệt không quyết định danh tính. Key chỉ nằm phía server.
- Giá không xác định bị từ chối với tài khoản có hạn mức. Lỗi kết nối/5xx giữ khoản dự phòng vì nhà cung cấp có thể đã tính phí. Mỗi lượt tạo vẫn cần nhà tuyển dụng duyệt; nút dừng giữ clip đã gửi và dừng lượt tiếp theo.

## Bản đã triển khai

- Gateway Windows đã được restart đúng tiến trình sau khi xác nhận không có render; public budget đã xác minh UserId16 unlimited, tài khoản khác 300/300.
- Task `Aris-InterviewGateway` đang chạy, tự khởi động/restart gateway và F2A sau đăng nhập Windows. 9router giữ Startup riêng; Tailscale service Automatic. Máy cần bật, đăng nhập Windows và không ngủ khi xử lý yêu cầu mới.
- Funnel `/gw` → `127.0.0.1:8780`; root của MuseFlow/9router giữ nguyên. Các route gateway đều yêu cầu key; không mở API quản trị upstream.
- SQL reviewed `.local/interview-release-idempotent.sql` đã áp dụng: `MapCrawledCompanies` chỉ lịch sử snapshot; `AddInterviewKits` và `ExtendInterviewFlow` thêm 5 bảng phỏng vấn cùng các cột. Không xóa dữ liệu CV/chat/job cũ.
- Backup đầy đủ trước deploy: `.local/deploy-backups/live-20261010-210647.zip`, 116.445.542 byte, 1.100 entries, có DLL và web.config. Backup ban đầu mất khoảng 10 phút, đã hoàn tất bình thường. Bản core bổ sung `.local/deploy-backups/interview-core-20261010-211459.zip` cũng hợp lệ.
- Deploy: 17 file mới, 4 cập nhật, 0 xóa; giữ App_Data và file chỉ tồn tại trên server. Cấu hình gateway đã được đưa vào ignored `.local/production-settings.json` để lần deploy sau giữ đúng thiết lập; cấu hình trước đó có bản sao timestamped.

## Bộ Embedded và link thử

Người dùng đã cho phép cụ thể tải avatar và 14 clip chứa giọng lên kho Google Drive công khai mà Aris sử dụng, rồi tạo link thử. Automatic approval review từng chặn bước upload vì chưa rõ quyền gửi file tới kho này; sau câu trả lời **“Cho phép tải bản mẫu và tạo link thử”**, bước upload được phép và đã hoàn tất.

- Production kit1 thuộc UserId16: 6 câu hỏi, 14 clip, giọng `ruby_wav_clean`, giữ câu hỏi, đáp án, ý chính, trọng số, thời gian và lượt thu lại từ preview.
- Nhà tuyển dụng: https://thuctap.runasp.net/Employer/InterviewFlow/1
- Ứng viên: https://thuctap.runasp.net/InterviewKit/55c0c009559735d101212ed1
- Người thử mở link ứng viên, đăng nhập tài khoản riêng, cho phép microphone, trả lời và hoàn tất. Chủ xem kết quả trong bộ của mình. Đăng nhập ứng viên giữ ReturnUrl tới link mời.
- Không sao chép lịch sử phỏng vấn local. Không dùng quick-login hay tự ghi nhận chấp thuận quyền riêng tư thay người dùng.
- Preview 5029 giữ nguyên: 14 clip, 1 session. Không restart hoặc restore snapshot 11 clip cũ. Artifact `.local/embedded-production-source` chỉ chứa nội dung/media để chuyển, không phải snapshot khôi phục toàn bộ lịch sử.

## Kiểm tra

Gateway18, voice/media41, flow61, credit13, stop32, Chrome29, quota8 đều đạt; regression20/20. Build0 lỗi và64 cảnh báo hiện có. Các render kiểm thử dùng dịch vụ giả; lượt triển khai và chuyển clip không tạo video mới, renderer usage0.

Sau deploy: live/ready200, trang nhà tuyển dụng và Credits yêu cầu đăng nhập302, QuickLogin production404; JS/CSS trên website khớp source release sau chuẩn hóa CRLF. Gateway không key401, có key health xác nhận LLM/video/TTS/FFmpeg sẵn sàng. Các clip tải từ Drive đã kiểm SHA256 khớp nguồn.

Báo cáo ignored: `.local/interview-release-result.json`, `.local/interview-release-live-check.json`, `.local/embedded-production-result.json`, `.local/embedded-production-inspection.json`, `.local/embedded-production-live-check.json`. Bài kiểm tra thực tế bằng giọng nói/tài khoản trên máy khác vẫn do người thử thực hiện.

## Khôi phục

Rollback code bằng package live-backup trên, giữ các bảng mới; không chạy migration Down. Giữ App_Data và dữ liệu Drive. Trước khi điều khiển bất kỳ tiến trình nào, xác minh PID/command line; không dừng preview5029 hay runtime không thuộc gateway. Không đưa cấu hình/key/cookie vào Git hoặc log.

Phần notebook AiCore/Colab/Kaggle chưa được tiếp tục theo phạm vi người dùng đã chọn.

## Sửa tốc độ tải bộ sau khi chuyển mẫu

Revision `0ac45de` thêm `AsSplitQuery()` tại ba truy vấn có cả Questions và Videos. Với bộ Embedded, truy vấn JOIN cũ lặp avatar theo tổ hợp 6 câu × 14 clip; lần kiểm tra read-only chờ hơn 150 giây trước khi dừng. Truy vấn tách đã đọc/xác minh cùng dữ liệu trong 7,48 giây. Không thay câu hỏi, rubric, media, credit hay schema.

Build 0 lỗi; flow qua gateway chạy lại đạt 61/61. Bản sửa đã deploy: 3 file cập nhật, 0 thêm/xóa; live/ready HTTP200. Backup application trước sửa ở `.local/deploy-backups/interview-before-query-fix-20261010-213036.zip`; để rollback đầy đủ cả static endpoint metadata, dùng package live đầy đủ hoặc redeploy committed `cf04fe9` với production settings hiện tại.

Xác minh public: 14/14 video HTTP200, SHA256 khớp nguồn; request tua một đoạn HTTP206; avatar khớp. Link mời chuyển tới Login và giữ ReturnUrl. Production sample chưa có session tại thời điểm kiểm tra; thử giọng/ghi âm/chấm trên máy khác là bước nghiệm thu của người thử.

## Khôi phục Funnel khi tạo lại video (10/10/2026)

Nút tạo lại tất cả báo “Bộ xử lý âm thanh/video tạm thời không phản hồi” do đường Internet của Tailscale Funnel đóng kết nối ngay trong TLS handshake. IIS ghi SSL unexpected EOF; gateway không nhận được request. Gateway và FFmpeg trên máy vẫn hoạt động. Probe HTTPS thông thường từ chính máy đã đi qua MagicDNS/tailnet, nên bỏ sót lỗi đường công khai.

Đã restart riêng dịch vụ Windows Tailscale bằng quyền Administrator. Giữ nguyên hai mount root → 20128 và `/gw` → 8780. Sau restart, hai IP DNS công khai đều trả401 khi không có key; health có key200; tải video trống cùng âm thanh sine để ghép thật qua đường Internet trả200/MP420.086 byte trong644ms. Không dùng media người dùng hay nhà cung cấp trả phí cho bài kiểm tra này.

Xác minh từ chính IIS sau khi khôi phục web.config bình thường: Credits200/ok (22 tài khoản), Voices200/ok (89 giọng), QuoteAll200/ok cho10 clip/tổng10 renderer credit. Chỉ báo giá; chưa khởi động lượt render thay người dùng. Temporary stdout logging đã tắt bằng bản web.config gốc từ backup. Không sửa application, DB hoặc clip.

Báo cáo ignored: `.local/interview-media-outage-diagnostic.json` và `.local/interview-public-funnel-recovery.json`. Khi kiểm tra lần sau, dùng request từ hosting hoặc ép kết nối tới IP từ DNS công khai với đúng SNI; không dùng kết quả HTTPS qua MagicDNS trên máy này để kết luận Funnel Internet hoạt động. Probe im lặng180s trước đây chỉ xác minh đường tailnet, chưa chứng minh timeout đường Internet.
