# Bàn giao phỏng vấn — production đã triển khai 10/10/2026

## Trạng thái

Đã hoàn tất release application `0ac45de` (feature base `cf04fe9`) lên https://thuctap.runasp.net. Người dùng đã cho phép làm hết tới production và cho phép riêng tải bộ Embedded chứa giọng/avatar lên Google Drive công khai để tạo link thử.

- Chủ `xuanthangmuoi@gmail.com`, UserId16: unlimited renderer credit; các tài khoản khác300/ngày, không trần tháng, reset00:00 Việt Nam.
- Gateway đã reload, budget đã xác minh. Task Windows `Aris-InterviewGateway` đang chạy; Tailscale Automatic; 9router Startup riêng. Funnel `/gw` được thêm, root MuseFlow/9router giữ nguyên.
- DB `db47010` đã áp SQL reviewed: snapshot history và 2 migration phỏng vấn. Read-only check pending[]; 5 bảng mới cùng các cột đầy đủ.
- Backup live đầy đủ116.445.542 byte/1.100 entries; deploy17 thêm/4 sửa/0 xóa; live/ready200. `.local/production-settings.json` đã giữ cấu hình gateway để redeploy sau không làm mất thiết lập.

## Link kiểm thử

- Ứng viên: https://thuctap.runasp.net/InterviewKit/55c0c009559735d101212ed1
- Chủ xem/sửa/kết quả: https://thuctap.runasp.net/Employer/InterviewFlow/1
- Bộ production có6 câu và14 clip từ preview, giữ rubric, timing, trọng số và giọng `ruby_wav_clean`. Upload có quyền riêng của người dùng; không tạo clip mới, không sao chép lịch sử local, không tiêu renderer credit.
- Người ở máy khác cần đăng nhập tài khoản riêng, cho phép microphone rồi trả lời/hoàn tất. Kiểm tra thực tế giọng đọc/thu âm/chấm bằng tài khoản của họ vẫn còn bước người dùng nhờ họ thực hiện.

## Preview và dữ liệu riêng

**Không restart preview5029.** Nó dùng InMemory, hiện14 clip và1 phiên phỏng vấn. Snapshot `.local/embedded-ruby-clean-voice` chỉ11 clip/0 phiên nên không đại diện dữ liệu hiện tại. `.local/embedded-production-source` chỉ nội dung/media chuyển sang production, không phải bản khôi phục lịch sử.

Giữ `ruby_eng` và `ruby_eng_clean`, không tự sửa/xóa. WAV riêng chỉ gửi tới dịch vụ giọng đã được cho phép; ASR chạy local. Quyền upload public mới chỉ áp cho avatar và14 clip bản mẫu mà người dùng vừa duyệt.

## Kiểm thử và khôi phục

Gateway18/18; voice41/41; flow61/61; credit13/13; stop32/32; Chrome29/29; quota8/8; regression20/20. Build0 lỗi/64 cảnh báo hiện có. Các bài render dùng giả. Smoke production kiểm health, bảo vệ đăng nhập, QuickLogin bị chặn, nội dung JS/CSS và hạn mức gateway.

Backup rollback `.local/deploy-backups/live-20261010-210647.zip`, có DLL/web.config. Không rollback DB bằng Down; giữ App_Data/Drive và dữ liệu cũ. Chỉ điều khiển đúng tiến trình đã kiểm PID/command line. `tools/ProvisionEmployer` và `tools/provision-employer.ps1` vẫn chưa thuộc commit release, không broad-stage/reset/clean.

Chi tiết ở [INTERVIEW-GATEWAY-RELEASE.md](INTERVIEW-GATEWAY-RELEASE.md), cùng các báo cáo ignored trong `.local`. Không tiếp tục notebook Colab/Kaggle hay thay đổi dịch vụ AiCore trong lượt này.

## Sửa tốc độ tải bộ sau khi chuyển mẫu

Revision `0ac45de` thêm `AsSplitQuery()` tại ba truy vấn có cả Questions và Videos. Với bộ Embedded, truy vấn JOIN cũ lặp avatar theo tổ hợp 6 câu × 14 clip; lần kiểm tra read-only chờ hơn 150 giây trước khi dừng. Truy vấn tách đã đọc/xác minh cùng dữ liệu trong 7,48 giây. Không thay câu hỏi, rubric, media, credit hay schema.

Build 0 lỗi; flow qua gateway chạy lại đạt 61/61. Bản sửa đã deploy: 3 file cập nhật, 0 thêm/xóa; live/ready HTTP200. Backup application trước sửa ở `.local/deploy-backups/interview-before-query-fix-20261010-213036.zip`; để rollback đầy đủ cả static endpoint metadata, dùng package live đầy đủ hoặc redeploy committed `cf04fe9` với production settings hiện tại.

Xác minh public: 14/14 video HTTP200, SHA256 khớp nguồn; request tua một đoạn HTTP206; avatar khớp. Link mời chuyển tới Login và giữ ReturnUrl. Production sample chưa có session tại thời điểm kiểm tra; thử giọng/ghi âm/chấm trên máy khác là bước nghiệm thu của người thử.

## Khôi phục Funnel khi tạo lại video (10/10/2026)

Nút tạo lại tất cả báo “Bộ xử lý âm thanh/video tạm thời không phản hồi” do đường Internet của Tailscale Funnel đóng kết nối ngay trong TLS handshake. IIS ghi SSL unexpected EOF; gateway không nhận được request. Gateway và FFmpeg trên máy vẫn hoạt động. Probe HTTPS thông thường từ chính máy đã đi qua MagicDNS/tailnet, nên bỏ sót lỗi đường công khai.

Đã restart riêng dịch vụ Windows Tailscale bằng quyền Administrator. Giữ nguyên hai mount root → 20128 và `/gw` → 8780. Sau restart, hai IP DNS công khai đều trả401 khi không có key; health có key200; tải video trống cùng âm thanh sine để ghép thật qua đường Internet trả200/MP420.086 byte trong644ms. Không dùng media người dùng hay nhà cung cấp trả phí cho bài kiểm tra này.

Xác minh từ chính IIS sau khi khôi phục web.config bình thường: Credits200/ok (22 tài khoản), Voices200/ok (89 giọng), QuoteAll200/ok cho10 clip/tổng10 renderer credit. Chỉ báo giá; chưa khởi động lượt render thay người dùng. Temporary stdout logging đã tắt bằng bản web.config gốc từ backup. Không sửa application, DB hoặc clip.

Báo cáo ignored: `.local/interview-media-outage-diagnostic.json` và `.local/interview-public-funnel-recovery.json`. Khi kiểm tra lần sau, dùng request từ hosting hoặc ép kết nối tới IP từ DNS công khai với đúng SNI; không dùng kết quả HTTPS qua MagicDNS trên máy này để kết luận Funnel Internet hoạt động. Probe im lặng180s trước đây chỉ xác minh đường tailnet, chưa chứng minh timeout đường Internet.
