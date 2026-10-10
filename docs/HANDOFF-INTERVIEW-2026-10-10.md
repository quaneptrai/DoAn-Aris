# Bàn giao phỏng vấn — 10/10/2026, Codex tiếp quản

## Trạng thái hiện tại

Người dùng đã yêu cầu tiếp tục công việc Claude và chuẩn bị tới production. Chính sách mới: `xuanthangmuoi@gmail.com` không giới hạn credit; người khác 300 credit/ngày, không có trần tháng. Danh tính chủ được kiểm tra read-only trong DB: UserId 16, Role Business. Không tiếp tục phần notebook Colab/Kaggle trong lượt này.

- Preview Embedded vẫn chạy ở `http://localhost:5029/Employer/InterviewFlow/1`, build `.local/stop-voice-final-build/ArisSkyve.dll`. Không restart hay thay dữ liệu preview này.
- Embedded dùng `ruby_wav_clean`, 6 cách đọc thuật ngữ đã thử, 9 clip có lời được ghép lại; 11 clip gồm listening và base-master. Âm lượng đã đo từ −14,0 tới −14,4 LUFS. Bản sao `.local/embedded-ruby-clean-voice`; đây là kết quả Claude, không phải lượt tạo mới của Codex.
- Giữ `ruby_eng` và `ruby_eng_clean` trên dịch vụ, không tự xóa/sửa. WAV riêng chỉ được gửi tới dịch vụ giọng đã được phép; ASR chạy trên máy.

## Gateway

`tools/InterviewGateway/` đã có gateway, kiểm thử, cấu hình mẫu, README và supervisor Windows. Task `Aris-InterviewGateway` đã đăng ký và chạy sau đăng nhập; tự khởi động/restart gateway và F2A khi cổng trống. 9router giữ Startup riêng, Tailscale service đã tự chạy.

Funnel có `/gw` → `127.0.0.1:8780`; root `/` của 9router/MuseFlow giữ nguyên. Health local/public đã báo LLM/video/TTS/FFmpeg đều sẵn sàng. Chỉ GET health, không tạo media thật hay tiêu credit trong lượt này.

Hạn mức bền vững tại `.local/interview-gateway-data/ledger.json`, không phải bảng mới trong DB. Aris lấy UserId từ DB, gửi SHA-256 của `aris:user:<UserId>` bằng key riêng của server; trình duyệt không quyết định danh tính. Mọi bộ của cùng tài khoản chia sẻ trần 300/ngày; đặt lại lúc 00:00 Việt Nam. Lỗi kết nối/5xx giữ khoản dự phòng vì nhà cung cấp có thể đã tính phí. Giá chưa biết bị từ chối với tài khoản có trần; chủ không giới hạn vẫn có thể duyệt.

**Cần reload gateway trước deploy:** cấu hình trên đĩa đã có ngoại lệ đúng UserId16, nhưng tiến trình đang chạy vẫn giữ cấu hình cũ từ trước khi đổi cách định danh. Automatic approval review từ chối lệnh dừng rộng nhiều gateway kèm thử nghiệm bằng key thật. Không vượt quyết định này; dùng probe giả/key riêng để kiểm tra Funnel. Việc restart gateway cùng migration/deploy chờ người dùng duyệt kết quả cụ thể.

## Kiểm thử

- Gateway 18/18, gồm báo giá hết hạn/đổi nội dung, đồng thời, giá null, credit chưa chắc, tách tài khoản, đổi ngày và khóa một tiến trình/sổ.
- Voice stability 41/41, có FFmpeg thật và media từ xa.
- Qua gateway: flow 61/61; credit selection 13/13; stop 32/32; Chrome 29/29; quota 8/8. Quota được chạy lại sau đổi sang UserId và đã đạt.
- Build Aris 0 lỗi; 64 cảnh báo nullable/unread tồn tại trong mã hiện tại. Log `.local/gateway-continuation-build.log`.

## Production còn chờ

DB `db47010` còn `MapCrawledCompanies` (chỉ cập nhật lịch sử, không đổi schema), `AddInterviewKits`, `ExtendInterviewFlow`. Đã tạo `.local/interview-release-idempotent.sql`; chưa áp dụng. Cấu hình ứng viên `.local/production-settings.interview.json` giữ nguyên các cấu hình cũ và thêm gateway/media; key thực chỉ nằm ở file ignored.

Thực hiện dry run của release được commit, sau đó xin duyệt bước cuối: restart đúng gateway, áp 2 migration phỏng vấn cùng lịch sử snapshot còn thiếu, backup live rồi deploy. Giữ App_Data và các dữ liệu production cũ. Không ship working tree còn dở, không broad stage/reset/clean; `tools/ProvisionEmployer` chưa thuộc release này.

Xem `docs/INTERVIEW-GATEWAY-RELEASE.md` và `tools/InterviewGateway/README.md` để tiếp tục.

## Xác minh cuối

- Regression toàn repo 20/20. Probe giả qua Funnel giữ kết nối không trả byte 180 giây, HTTP200 sau 180,1 giây; mount `/gw-probe` đã gỡ. Gateway thật thiếu key HTTP401, có key health đạt và renderer usage vẫn 0.
- Preview hiện tại đã khác bản sao Claude: 14 clip, thêm thinking/pass/fail; intro và transition khác byte bản sao, 9 clip còn lại của bản sao vẫn khớp; câu hỏi/avatar/kịch bản/cấu hình vẫn khớp. Có 1 phiên phỏng vấn. Đây là quan sát read-only, không phải lần phục hồi hay tạo lại trong lượt này.
- **Không restart preview 5029.** Helper từ chối snapshot phục hồi vì đã có lịch sử. File HTML/kết quả quan sát nằm ở `.local/embedded-gateway-takeover-20261010`, không có manifest đầy đủ và không được dùng để phục hồi. `.local/embedded-ruby-clean-voice` chỉ là snapshot lịch sử 11 clip, không đại diện toàn bộ dữ liệu hiện tại.

## Revision đã kiểm tra

Application release **`cf04fe9`** đã commit, không chứa credential thực. Web Deploy `-WhatIf` đã thành công với settings ứng viên: 17 file thêm, 4 file cập nhật, 0 file xóa, khoảng 6,4 MB. Chưa đổi website hay DB. Khi duyệt triển khai, chỉ định `-Commit cf04fe9 -SettingsFile .local/production-settings.interview.json`; script tự backup live trước sync. Báo cáo máy đọc được ở `.local/interview-release-result.json`.
