# Phỏng vấn video AI: tầng web và các tầng dưới

**Tầng web (Aris)** chạy toàn bộ buổi phỏng vấn. Nhà tuyển dụng nhập tham số, duyệt kịch bản, tạo hoặc tải video, rồi gửi link. Ứng viên phỏng vấn ngay trên Aris và được chấm theo đáp án của doanh nghiệp.

**Các tầng dưới** gồm mô hình ngôn ngữ, dịch vụ tạo video và studio dựng video trên máy. Chúng nằm sau lớp trừu tượng `IInterviewEngine`. Người dùng web không thấy tên dịch vụ, URL, key hay model. Lỗi hiện trên web luôn là câu chung chung; chi tiết chỉ ghi vào log server.

## Luồng trên web

`/Employer/InterviewFlow` (chỉ tài khoản doanh nghiệp):

1. **Tham số**
   - Tên bộ, nhân vật, bối cảnh.
   - Avatar mặc định miễn phí, tải ảnh lên hoặc tạo ảnh từ mô tả/ảnh tham chiếu có duyệt credit. Bộ mới bật sẵn avatar mặc định.
   - Điểm đạt (%).
   - Câu hỏi, gồm đáp án đúng (bắt buộc), ý chính, số giây chuẩn bị, số giây trả lời, số lần làm lại.
2. **Kịch bản**
   - Bấm "Viết kịch bản" để có lời cho mở đầu, từng câu hỏi, chuyển câu và kết thúc. Lời câu hỏi luôn giữ nguyên văn câu hỏi của doanh nghiệp.
   - Nhà tuyển dụng sửa rồi duyệt.
   - Khi đổi câu hỏi, lời của câu đó tự đặt lại và kịch bản cần duyệt lại.
3. **Video** gồm 7 ô chung (mở đầu, đang nghe, đang suy nghĩ, chuyển câu, phản ứng tốt, phản ứng chưa đạt, kết thúc) và mỗi câu hỏi một ô. Có ba cách lấp ô:
   - **Tạo tự động từng video:** cần kịch bản đã duyệt. Aris báo giá trước, nhà tuyển dụng bấm "Duyệt & tạo (N credit)", Aris tạo ở nền rồi trang tự cập nhật. Mỗi báo giá dùng được đúng một lần.
   - **Tạo tất cả:** nút "Tạo tất cả N video", "Tạo N video còn thiếu" hoặc "Tạo lại tất cả video".
     - Aris báo giá cả loạt (tổng credit, credit mỗi video, danh sách từng ô). Nhà tuyển dụng duyệt một lần bằng nút "Duyệt & tạo tất cả (N credit)".
     - Video được tạo lần lượt, xong video nào thì hiện ngay trong ô. Có thanh tiến độ và nút "Dừng sau video đang tạo"; trang báo kết quả khi xong.
     - Mã duyệt của dịch vụ chỉ sống vài phút, nên mỗi video được báo giá lại ngay trước khi tạo. Nếu giá cao hơn giá đã duyệt thì cả loạt dừng, không tạo thêm.
     - Mỗi bộ chỉ có một lượt tạo tại một thời điểm.
   - Bộ mới luôn bắt đầu không có video. Chưa duyệt thì không có video nào được tạo.
   - **Tải lên** từng ô.
   - **Nhập gói** `.zip` từ studio, xem phần dưới.
4. **Ứng viên**
   - Tạo hoặc đóng link `/InterviewKit/{mã}`. Ứng viên đăng nhập rồi phỏng vấn, mỗi tài khoản làm một lần.
   - "Phỏng vấn thử" chạy giống ứng viên nhưng hiện điểm từng câu.
   - Kết quả của ứng viên gồm điểm, câu trả lời, trạng thái từng ý kèm đoạn trích và nhận xét.

Trình phát: mở đầu → (câu hỏi → chuẩn bị → trả lời trong lúc video "đang nghe" lặp → "đang suy nghĩ" khi chấm → phản ứng → chuyển câu) × N → kết thúc.
- Trả lời bằng giọng nói (nhận dạng giọng nói của trình duyệt, `vi-VN`) hoặc gõ.
- Ứng viên chỉ biết video phản ứng nào sẽ phát. Đáp án, ý chính và điểm không bao giờ gửi về trình duyệt của ứng viên.

## Lớp trừu tượng và cấu hình server

`IInterviewEngine` (`Infrastructure/Services/InterviewEngine.cs`) là cửa duy nhất ra các dịch vụ. Cấu hình nằm ở mục `InterviewEngine` của server; không có trang web nào đọc hay sửa được.

```json
{
  "InterviewEngine": {
    "Llm":   { "BaseUrl": "http://127.0.0.1:20128/v1", "ApiKey": "…", "Model": "ag/gemini-3.8-flash-high", "TimeoutSeconds": 120 },
    "Video": { "BaseUrl": "http://127.0.0.1:8000/v1", "ApiKey": "…", "Model": "veo-3.1-lite-8s-landscape", "ModelWithImage": "veo-3.1-lite-i2v-6s-landscape", "AccountId": null }
  }
}
```

- `Llm` là API tương thích OpenAI (`/chat/completions`). `Video` là dịch vụ có `generation/preview` → mã duyệt → `chat/completions` kèm `X-Flow-Approval`. Mã duyệt của dịch vụ chỉ nằm trên server; trình duyệt chỉ nhận mã báo giá của Aris.
- **Thiếu `Llm` hoặc `Llm` lỗi:** kịch bản dùng mẫu có sẵn, chấm điểm dùng so khớp ý chính theo từ khóa. Phỏng vấn vẫn chạy.
- **Thiếu `Video`:** tắt tạo tự động; vẫn tải video lên hoặc nhập gói được.
- **Điểm từ mô hình:** mỗi ý chỉ được tính khi đoạn trích thật sự có trong câu trả lời. Câu trả lời được coi là dữ liệu, không phải lệnh.
- **Development:** dùng file git-ignored `ArisSkyve/appsettings.InterviewEngine.local.json`. File này không bị copy vào bin hay publish (`appsettings.*.local.json`). Biến môi trường và command line được ưu tiên.
- **Production:** đặt `InterviewEngine__Llm__BaseUrl`, `InterviewEngine__Llm__ApiKey`, `InterviewEngine__Llm__Model`, `InterviewEngine__Video__…` trong `.local/production-settings.json` để script deploy ghi vào `web.config`. Server chỉ gọi được địa chỉ công khai. Dịch vụ chỉ chạy ở localhost trên máy chủ dự án thì server không tới được, nên server sẽ dùng chế độ dự phòng.

## Gói phỏng vấn (.zip)

Studio và web không gọi nhau. Studio chỉ xuất file, nhà tuyển dụng tải file lên (`Infrastructure/Services/InterviewPackage.cs`):

```json
{ "format": "aris-interview-package", "version": 1, "title": "…", "persona": "…", "scene": "…",
  "questions": [{ "id": "q1", "question": "…", "answer": "…", "keyPoints": ["…"], "prepSeconds": 10, "answerSeconds": 60, "retakes": 1 }],
  "clips": [{ "kind": "intro|question|listening|thinking|transition|pass|fail|outro", "questionId": "q1", "file": "clips/…mp4" }] }
```

- Mỗi video tối đa 50 MB, cả gói tối đa 400 MB, tối đa 200 câu hỏi.
- Nhập ở trang danh sách sẽ tạo bộ mới. Nhập trong một bộ chỉ được khi câu hỏi khớp đúng thứ tự và nội dung.
- **26Flow 0.7.1** (`D:\Downloads\museflow-main\museflow-main`): node "Video theo trạng thái" có nút **Xuất gói phỏng vấn (.zip)**. Ánh xạ: `ask` → `question`, `react_good` → `pass`, `react_bad` → `fail`.

## Dữ liệu

Migration `AddInterviewKits` gồm `InterviewKits` (tham số, ảnh nhân vật, kịch bản JSON, mã link), `InterviewKitQuestions`, `InterviewKitVideos` (một video mỗi ô, file nằm trong collection `interviews` của kho media) và `InterviewKitSessions` (lượt phỏng vấn, câu trả lời và kết quả chấm dạng JSON).

## Kiểm tra (10/10/2026)

- **HTTP Aris, 51 kiểm tra** (scratch `interview-run-e2e.mjs`, kèm hai dịch vụ giả `fake-services.mjs`):
  - Tham số, ảnh và yêu cầu có đáp án.
  - Kịch bản: thay lời diễn đạt lại bằng câu hỏi nguyên văn, sửa và duyệt.
  - Video: báo giá → duyệt → tạo nền, cùng body và mã duyệt, mỗi báo giá dùng một lần; tải lên; nhập gói (bộ mới, gói không khớp, gói hỏng).
  - Ứng viên: không thấy đáp án, chỉ biết phản ứng, làm một lần, không vào được trang của nhà tuyển dụng.
  - Chấm điểm: đoạn trích bịa bị loại; dịch vụ lỗi thì dùng chế độ dự phòng.
  - Xóa bộ thì xóa luôn file video.
  - Không trang hay JSON nào lộ tên, URL, key hay model dịch vụ.
- **Tạo tất cả video, 24 kiểm tra HTTP** (`interview-batch-e2e.mjs`): báo giá tổng, mỗi video được báo giá lại ngay trước khi tạo, giá tăng thì dừng, dừng giữa chừng, không tạo chồng, báo kết quả. Thêm **11 kiểm tra trên Chrome** (`interview-batch-ui.cjs`): hộp duyệt một video và tất cả video đều hiện credit, thanh tiến độ, video hiện ngay trong ô.
- **Chrome, 11 kiểm tra** (`interview-player-e2e.cjs`): ứng viên làm hết buổi (gõ câu trả lời, làm lại, đồng hồ, video "đang nghe" lặp), lần sau báo đã làm, phỏng vấn thử hiện điểm, kết quả hiện trong bộ.
- **26Flow:** `tests/quiz-package.test.cjs`, cả bộ 387/387. Gói do 26Flow xuất nhập được vào Aris (9 video).
- **Dịch vụ thật ở máy** (9router, F2A): viết kịch bản, báo giá video (không tạo) và chấm điểm đều chạy.

## Khi deploy

- Chạy migration `AddInterviewKits` trên DB dùng chung (cần chủ dự án duyệt).
- Chạy tiếp `ExtendInterviewFlow` để lưu tùy chọn dựng video, mã/trọng số câu hỏi và bản ghi âm. File SQL review nằm ở `.local/InterviewFlowPort.sql`; chỉ có hai migration phỏng vấn. Không dùng `database update` để vô tình chạy migration khác đang chờ.
- IIS mặc định chặn request lớn hơn khoảng 28,6 MB. Gói lớn cần `requestLimits maxAllowedContentLength` trong `web.config`; nếu không thì tải từng video.
- Mỗi lượt tạo video tốn credit của tài khoản dịch vụ trên server, với mọi doanh nghiệp. Nên đặt hạn mức trước khi mở rộng.

Phiên bản cũ nhúng engine MuseFlow cùng proxy vào Aris đã được gỡ ngày 10/10/2026; bản lưu nằm ở `.local/museflow-in-aris-archive-20261010/` (git-ignored).

## Port đầy đủ từ 26Flow 0.7.1 (10/10/2026)

Đã đưa vào code và kiểm tra với dịch vụ giả trong DB tạm:

1. **Avatar:** ảnh mặc định miễn phí, lưu và mở lại vẫn tích đúng lựa chọn; tải ảnh lên hoặc tạo từ mô tả/ảnh tham chiếu. Tạo ảnh luôn duyệt credit riêng, báo giá dùng một lần và ràng buộc doanh nghiệp/bộ câu hỏi. Lưu lại ảnh mặc định không làm mất duyệt kịch bản hay xóa bộ biểu cảm.
2. **Video:** từng ô riêng, năm biểu cảm hoặc một video gốc. Các ô dẫn xuất dùng chung video gốc và không tính thêm credit tạo video. Chọn độ dài theo lời thoại và model; dừng khi giá mới tăng hoặc cấu hình thay đổi.
3. **TTS:** danh sách giọng có tìm kiếm, lọc giới tính/vùng, nghe thử và nhân bản từ file. Ghép video lặp/cắt theo âm thanh, chuẩn hóa hai lượt −14 LUFS. Giữ nguyên câu hỏi dài trong kịch bản TTS.
4. **Ứng viên:** chọn micro, đo mức âm lượng, ghi âm bằng MediaRecorder, nghe lại câu hỏi/bản ghi, tải file và chép lời. Lưu âm thanh thất bại thì cho thử lại trước khi gửi câu trả lời. Ghi âm được giữ riêng trên server, không đưa vào kho công khai.
5. **Điều phối/chấm:** bổ sung tối đa theo thiết lập, chuyển câu hoặc kết thúc sớm. Trọng số từng ý và câu; câu chưa trả lời tính 0. Phản ứng cuối theo tổng điểm. Các đoạn ghi âm bổ sung được giữ cùng kết quả ban đầu.
6. **Kết quả:** Đúng/Một phần/Sai, nghe các bản ghi, chấm lại với đáp án hiện tại, xuất CSV/JSON. Chấm lại giữ bản ghi âm và số lần trả lời/bổ sung. Chỉ chủ bộ phỏng vấn truy cập được kết quả/âm thanh.
7. **Câu hỏi:** CSV/TSV/JSON/TXT, ghép đáp án theo mã, bộ mẫu và thời gian/lần làm lại hàng loạt. Tối đa 200 câu; JSON hỗ trợ mảng trọng số và ý chính có trọng số.
8. **Tùy chọn:** tự duyệt khi người dùng bấm tạo và giá không vượt hạn mức mỗi video/tổng lượt đã lưu; chất lượng video; xuất demo MP4.

TTS, STT và FFmpeg cần cấu hình trên server. Hiện cấu hình dịch vụ thật mới có LLM và video; avatar dùng chung kết nối video và model ảnh mặc định đã xác nhận có trong danh sách model thật. Xem kết quả kiểm tra clip thật và số dư trong `.local/embedded-real-clip-check.json`; avatar tạo mới và TTS/STT thật chưa được kiểm chứng.

```json
{
  "InterviewEngine": {
    "Avatar": { "Model": "gemini-3.1-flash-image-landscape" },
    "Tts": { "BaseUrl": "https://your-audio-service", "ApiKey": "…", "Model": "your-tts-model" },
    "Stt": { "BaseUrl": "https://your-transcription-service", "ApiKey": "…", "Model": "your-stt-model" },
    "FfmpegPath": "C:\\tools\\ffmpeg.exe"
  }
}
```

Dịch vụ giọng đọc hỗ trợ `/api/v1/voices` (GET danh sách, POST nhân bản) và `/v1/audio/speech`; chép lời dùng `/v1/audio/transcriptions`. Khóa chỉ nằm trên server. File giọng mẫu tối đa 10 MB; ảnh tối đa 4 MB. Mẫu FFmpeg thử nằm trong `.local/interview-tools`, không được publish tự động.

Kiểm tra bản cuối: **60/60 HTTP**, **29/29 Chrome**, build không lỗi, EF xác nhận model khớp migration. Đo âm thanh của video ghép thật bằng FFmpeg: **−14,06 LUFS**, thời lượng **3,00 giây** bằng bản giọng thử. Các kiểm tra dùng dịch vụ giả và media tổng hợp, không khẳng định đã chạy TTS/STT thật.

```powershell
dotnet build ArisSkyve/ArisSkyve.csproj --configuration InterviewPort
node tests/InterviewFlowTests/fake-services.mjs
# Trong shell khác:
powershell -File tests/InterviewFlowTests/start-test-server.ps1 -Port 5029
node tests/InterviewFlowTests/flow-e2e.mjs http://localhost:5029
node tests/InterviewFlowTests/browser-e2e.cjs http://localhost:5029
```

Bản thử dùng DB tạm, seed tài khoản `port.owner@example.test` và `port.other@example.test` chỉ khi `E2E:SeedInterviewAccounts=true` trong Development. Đăng nhập thử qua `/Account/QuickLogin?email=port.owner@example.test`. Kiểm tra DB dùng chung bằng tiện ích chỉ đọc `tools/InterviewDatabase`; tiện ích không có chức năng áp dụng migration.

Credit có ba chế độ lưu theo bộ: tự chọn, tổng số dư và luân phiên tài khoản, hoặc dùng cố định một tài khoản. `/Employer/InterviewFlow/Credits` chỉ cho nhà tuyển dụng đọc danh sách tài khoản video cùng số dư; khóa, cookie và email tài khoản dịch vụ không trả về trình duyệt. Luân phiên bỏ qua tài khoản hết credit hoặc bị tắt video, và thử tài khoản kế tiếp nếu báo giá cho biết tài khoản thiếu tiền/đang bận. Không tự gửi lại một lượt tạo video đã lỗi; báo giá mới vẫn phải nằm trong mức đã duyệt. Đây là dùng chung nhóm tài khoản, không chuyển credit giữa các tài khoản gốc.

Bộ Embedded hiện có 6 câu + 7 trạng thái dùng chung = 13 ô video. Con số này tăng theo số câu; giới hạn hiện tại là 200 câu, tương ứng 207 ô, và thời gian trả lời được đặt độc lập với thời lượng clip. Mỗi câu Embedded có 60 giây chuẩn bị và 300 giây trả lời; các clip nghe/suy nghĩ lặp khi ứng viên trả lời.

Ngày 10/10/2026: sửa ánh xạ Fast I2V 4/6 giây của F2A tại `D:/F2A/flow2api/src/services/generation_handler.py` để bỏ hậu tố `relaxed` không còn là cấu hình hoạt động; bản sao trước sửa lưu tại `.local/f2a-generation_handler-before-fast-fix.py`. Tài khoản thử vẫn bị từ chối quyền Fast 6 giây, nên cấu hình video riêng của Aris chuyển sang Omni 1.1 Flash, model đã có các lượt thành công trong 26Flow. Cấu hình kết nối cũ được sao lưu riêng trong `.local/interview-engine-before-omni.json`; không đưa file này vào Git.

Kiểm tra bổ sung: `node tests/InterviewFlowTests/credit-e2e.mjs http://localhost:5030` — 12/12, gồm tổng credit, phân quyền, luân phiên, tài khoản cố định, bỏ qua thiếu tiền/phiên không khả dụng, và lỗi có số dư không đổi. Kiểm thử upload/model của F2A — 11/11. Chrome thật tại 5029 xác nhận 22 tài khoản, chế độ luân phiên, 6 câu Embedded, avatar mặc định và giải thích 13 ô; không có lỗi JavaScript.

Clip mở đầu Embedded đã tạo thật thành công bằng Omni 6 giây: báo giá 10 credit, số dư tài khoản #2 giảm từ 1.940 xuống 1.930. Hai lần từ chối trước đó (ánh xạ Fast và quyền truy cập Fast) không giảm credit. 12 clip còn lại chưa gửi tạo; cần người dùng bấm duyệt giá để tiếp tục. Phiên Aris thật giữ tại cổng 5029; phiên kiểm thử 5030 đã dừng.

Báo giá thật cho 12 clip còn thiếu sau khi sửa fallback phiên đăng nhập: **113 credit**. Chỉ báo giá, chưa gửi tạo. Clip mở đầu đọc lại HTTP 200, MP4 1.279.093 byte, 6,02 giây, H.264 1280×720 và AAC stereo. Tổng số dư sau clip là 27.022 credit trên 22 tài khoản. Runtime cuối dùng `.local/credit-stable-build`, nhật ký `.local/credit-5029.stdout.log`; trình khởi động `.local/start-embedded-preview.ps1` đã trỏ đúng bản này. DB vẫn là tạm; nếu khởi động lại, khôi phục bằng `.local/restore-embedded-credit.mjs` từ bản sao tham số/kịch bản và clip đã lưu, trước khi cho người dùng tiếp tục.

## Cập nhật 10/10 tối (Claude, sau phiên Codex)

- **Chép lời không cần STT riêng:** khi không có dịch vụ chép lời, server gửi bản ghi âm cho LLM (Gemini qua 9router). WebM/Ogg/M4A từ trình duyệt được FFmpeg đổi sang MP3 16 kHz mono trước khi gửi. Kiểm tra thật: bản ghi WebM/Opus được chép đúng nguyên văn trong 6–12 giây.
- **Avatar với dịch vụ thật:** F2A không báo trước giá ảnh (`estimated_credits: null`), nên báo giá avatar trước đây luôn lỗi 500. Giờ báo giá có chi phí "chưa rõ". Hộp duyệt nói rõ điều đó, và avatar không bao giờ được tự duyệt.
- **Đọc số an toàn:** giá, mã câu do LLM trả, số dư trong thông báo lỗi và phiên bản gói không còn làm sập request khi gặp `null` hoặc chuỗi. Tài khoản không đọc được số dư bị bỏ khỏi danh sách và luân phiên credit.
- **Tiến độ tạo video:** endpoint theo dõi tiến độ chỉ đọc bản chụp danh sách clip đã tạo, có khóa. Trước đây đọc cùng lúc với luồng tạo nền có thể ngẫu nhiên lỗi 500.
- **Cấu hình ở máy** (`appsettings.InterviewEngine.local.json`): thêm `Tts` (dịch vụ giọng đọc đang chạy qua tunnel, model `avibi-tts-pro-1.0`) và `FfmpegPath` (bản FFmpeg trong `.local/interview-tools`). URL tunnel có thể đổi.
- **Kiểm tra với dịch vụ giả:** `flow-e2e` 61/61, chạy hai lần liên tiếp; `credit-e2e` 13/13 (bỏ phụ thuộc file `.local`, chạy được từ clone sạch); `browser-e2e` 29/29.
- **Kiểm tra với dịch vụ thật, không tạo video trả phí:**
  - 87 giọng, nghe thử được; LLM viết kịch bản.
  - 8 đoạn lời thoại TTS thật được ghép vào video gốc tải lên: −14,2 đến −14,6 LUFS, độ dài khớp lời đọc.
  - Chép lời WebM bằng Gemini; chấm điểm thật.
  - Báo giá avatar thật trả chi phí "chưa rõ".
- **Chưa làm thật vì tốn credit, chờ chủ dự án duyệt:** tạo video biểu cảm hoặc video gốc, tạo ảnh avatar mới, 12 clip còn lại của bộ Embedded.
- **Khi deploy:** server production cần FFmpeg để ghép giọng (hoặc dùng chế độ từng ô với giọng của model video), dịch vụ TTS ở địa chỉ công khai, và chạy 2 migration phỏng vấn trên DB dùng chung.

## Dừng tạo video và giữ giọng Ruby

Nút **Dừng tạo video** nằm trong thanh cố định ở đầu bộ phỏng vấn, dùng được cho tạo một clip và cả batch. Dừng hủy các báo giá/batch chờ duyệt; khi batch đang báo giá lại, nó kiểm tra lệnh dừng trước khi gửi lượt tạo tiếp theo. Video đã gửi sang dịch vụ vẫn có thể bị tính credit và hoàn tất: Aris giữ kết quả, lưu clip rồi chuyển sang `stopped`. Tải lại trang hoặc mở tab khác vẫn theo dõi được việc đang chạy và nút dừng. Lỗi gửi lệnh dừng được báo rõ, không giả báo đã dừng.

Giọng `native` do model video sinh riêng cho từng clip, nên không bảo đảm cùng giọng. TTS dùng Voice ID/tốc độ/cao độ đã lưu cho mỗi clip nói; chọn giọng và lọc/tìm kiếm không làm mất lựa chọn. Từ điển `PronunciationOverrides` nhận mỗi dòng `thuật ngữ = lời đọc`; chỉ đổi đầu vào tổng hợp giọng, không sửa câu hỏi, đáp án hay nội dung chấm. Người dùng có thể nghe thử nguyên câu chứa thuật ngữ mà không cần tạo video.

Embedded ở `http://localhost:5029/Employer/InterviewFlow/1` đã được chuyển sang TTS `ruby_eng` và một video gốc xuyên suốt. Video gốc là bản sao nguyên byte của intro đã có, không phát sinh lượt tạo video. Cả 6 clip cũ giữ nguyên SHA-256 và âm thanh cũ; chưa ghép lại bằng Ruby vì người dùng yêu cầu dừng tạo video. Build đang dùng `.local/stop-voice-final-build`, bản sao khôi phục đầy đủ `.local/embedded-ruby-current`. Khôi phục vào preview rỗng bằng `node .local/embedded-stop-snapshot.mjs restore http://localhost:5029 .local/embedded-ruby-current`; thao tác chỉ lưu form/kịch bản và tải clip có sẵn, không gọi AI, TTS hay render. Tiện ích từ chối sao lưu/khôi phục khi có lịch sử hoặc link mời cần bảo toàn mà HTTP chưa thể phục hồi chính xác.

Kiểm tra thay đổi: `stop-e2e.mjs` **32/32** với đúng 2 lượt render giả và 0 render thật; `voice-stability` **32/32** hoàn toàn offline. Chrome bản test và bản thật xác nhận nút dừng cố định, giữ giọng khi tìm kiếm, đủ 6 câu, không lỗi JS và không gọi render/TTS nghe thử. Build thành công; NU1900 chỉ báo không truy cập được nguồn kiểm tra lỗ hổng NuGet.

Ruby đang có lời mẫu tham chiếu chép sai, chứa cụm “on the action” người dùng nghe bị đệm. Phân tích offline và ASR mẫu tham chiếu công khai chưa cho transcript đủ chính xác; chưa sửa metadata giọng và chưa khẳng định đã loại tiếng đệm. Kiểm tra tự động từ chối gửi WAV riêng lên dịch vụ ASR ngoài; phương án được duyệt chỉ gửi lại mẫu công khai của chính dịch vụ về cùng nơi đang lưu nó. Không gửi WAV riêng tới ASR Avibi, không tạo TTS mới hoặc nhân bản giọng.


## Giọng sạch, thuật ngữ và ghép lại Embedded (10/10 ~18:20, Claude)

- **Nguyên nhân tiếng đệm "on the action":** lời mẫu lưu cùng giọng `ruby_eng` bị chép sai ("…timment analyis on the action"). Giọng đọc đọc luôn phần lời mẫu không khớp audio ở đầu câu. Thử 6 câu của kịch bản: 4/6 câu bị đệm. `ruby_eng` để nguyên, không sửa.
- **Giọng mới `ruby_wav_clean`:** người dùng cho phép tải WAV của họ lên dịch vụ giọng đọc.
  - Lời mẫu là đúng câu trong file, chép lời trên máy bằng faster-whisper; audio không gửi tới dịch vụ nào khác.
  - Kết quả: 6/6 câu sạch, bắt đầu từ 0 s, tiếng Việt rõ.
  - Để so sánh còn tạo `ruby_eng_clean` từ mẫu gốc với lời mẫu đúng: sạch nhưng đọc tiếng Việt lơ lớ, nên không dùng.
- **Cách đọc thuật ngữ của bộ Embedded:** chọn bằng nhiều lượt chép lời trên máy.
  - `volatile = vola-tile`, `UART = you-art`, `RTOS = ar-toss`, `mutex = mew-tex`, `semaphore = sem-a-phore`, `C = see`.
  - SPI, I2C và Watchdog timer đã đọc đúng, không cần đặt.
- **Ghép lại 9 clip có lời** (mở đầu, 6 câu, chuyển câu, kết thúc) từ video gốc.
  - Mỗi clip có báo giá `local-` 0 credit; chỉ gọi TTS, không gọi dịch vụ video.
  - Clip listening và video gốc giữ nguyên từng byte.
  - Kết quả: −14,0 đến −14,4 LUFS; câu nào cũng bắt đầu từ 0 s, không còn câu thừa.
- **Lỗi âm lượng câu ngắn:** với audio dưới 3 giây, `loudnorm` luôn chạy linear và giới hạn mức tăng theo đỉnh âm, nên câu ngắn có đỉnh cao bị nhỏ (đo được −17,2 LUFS).
  - Sửa trong `MixAsync`: thêm `apad=whole_dur=3` trước `loudnorm`. Câu ngắn thành 3 s, thêm khoảng lặng ở cuối.
  - `voice-stability` có thêm kiểm tra ghép thật bằng FFmpeg, nay đạt 34/34; code cũ cho −23,8 LUFS và trượt. `flow-e2e` 61/61.
- **Preview 5029:** đã khởi động lại bằng build mới, vẫn đường dẫn `.local/stop-voice-final-build`.
  - Dữ liệu được khôi phục từ `.local/embedded-ruby-clean-voice`, đây là bản sao hiện tại.
  - `.local/embedded-ruby-current` là trạng thái trước khi ghép lại.

## Khẩu hình, biểu cảm và giọng xuyên suốt

Ba chế độ giọng có mục đích khác nhau:

| NarrationMode | Hình ảnh | Lời nói và khẩu hình | Giọng giữa các clip |
| --- | --- | --- | --- |
| `native` | `independent` | Tạo cùng video từ lời thoại trong prompt | Có thể khác nhau |
| `native-converted` | `independent` | Tạo cùng video, sau đó đổi âm sắc và giữ nhịp nói | Dùng giọng đích đã được chuẩn bị trên máy xử lý |
| `native-tts` | `independent` | Video tạo lời nói cùng khẩu hình; giọng TTS đã chọn thay vào đúng các đoạn miệng cử động | Một Voice ID, cách đọc thuật ngữ, cao độ đã lưu |
| `tts` | `independent`, `expressions`, `shared` | Ghép giọng đọc riêng với hình lặp/cắt; **không có bước khớp môi từng từ** | Một Voice ID/tốc độ/cao độ đã lưu |

Trên web, `native-converted` có nhãn **Khớp môi + một giọng xuyên suốt**. Lựa chọn này chỉ mở khi yêu cầu chỉ đọc `GET /Employer/InterviewFlow/ConversionVoices` trả về ít nhất một giọng sẵn sàng. Danh sách giọng cho chế độ này lấy từ máy xử lý, không lấy các giọng TTS làm bằng chứng rằng chúng đã dùng được cho đổi giọng. Trang tự kiểm tra trạng thái và tải danh sách; không tự tạo video, TTS nghe thử hoặc nhân bản giọng. Nghe thử/nhân bản ở chế độ TTS vẫn chỉ chạy khi người dùng bấm nút.

Máy xử lý cần có bộ đổi giọng hoạt động và mẫu tham chiếu tương ứng với Voice ID được quản trị viên chuẩn bị. Để dùng Ruby, cần chuẩn bị mẫu Ruby đã được phép sử dụng ở máy này và đăng ký giọng đích; chỉ giữ Voice ID `ruby_wav_clean` trong dữ liệu TTS chưa đủ. Chưa có mẫu/bộ đổi giọng thì lựa chọn vẫn bị khóa. Không gửi ghi âm riêng tới dịch vụ ngoài; việc cho phép một lần tải mẫu lên dịch vụ TTS không tự cho phép gửi mẫu tới dịch vụ khác. Tên dịch vụ, model, đường dẫn mẫu, URL và key không hiển thị trong giao diện người dùng.

Quản trị viên có thể cấu hình riêng `InterviewEngine:Video:NativeModel` và `NativeModelWithImage` cho các chế độ tạo lời nói cùng video; bỏ trống sẽ dùng `Model`/`ModelWithImage` hiện tại. Điều này cho phép giữ cấu hình dựng hình câm cũ trong khi chọn model có âm thanh cho các clip cần khớp môi. Model, danh mục thời lượng và báo giá thực tế phải được xác nhận từ dịch vụ; không suy ra một model có tiếng chỉ vì tên của nó có chữ "video". Veo 3.1 Lite/Fast image-to-video hiện hỗ trợ 4/6/8 giây trong danh mục F2A; câu cần 8 giây không tự bị nâng sang Quality đắt hơn. Mỗi lựa chọn model/thời lượng vẫn cần báo giá và duyệt credit trước khi gửi lượt tạo.

`native-converted` giữ `Speed = 1`, `Pitch = 1` để tránh sửa nhịp nói đã tạo cùng khẩu hình. Các video nghe, suy nghĩ, hài lòng và khích lệ được tạo riêng bằng prompt biểu cảm, không lấy hình của clip nói hoặc một video gốc cho tất cả trạng thái. Câu dài hơn thời lượng được hỗ trợ cần chia thành các đoạn có lời thoại trước khi tạo; không được âm thầm bỏ từ, đổi câu hỏi hoặc quay về ghép TTS. Phần `PronunciationOverrides` chỉ thay chữ ở đầu vào tổng hợp lời nói trong prompt/TTS, giữ nguyên câu hỏi, đáp án, nội dung chấm và lời thoại hiển thị.

Đổi chế độ và lưu tham số sẽ dựng lại prompt rồi yêu cầu duyệt lại kịch bản. Các video cũ giữ nguyên cho đến khi người dùng tạo lại theo quy trình báo giá → duyệt credit → tạo video. Trước khi thay video của Embedded cần sao lưu đầy đủ bằng tiện ích snapshot; không cần tạo lại cả bộ để đánh giá một clip thử. Đổi giọng phải kiểm tra độ lệch thời lượng và giữ nguyên thời gian của hình, sau đó chuẩn hóa âm lượng khoảng −14 LUFS. Không dùng `MixAsync(video, null)` cho clip nói vì đường này xóa âm thanh; không dùng vòng lặp video của TTS cho đường đổi giọng.

Kiểm tra tự động với dịch vụ giả xác nhận quy trình, phân quyền, prompt, lựa chọn giọng và xử lý thời gian. Nó không chứng minh video thật khớp môi từng từ hoặc giống Ruby: cần người dùng duyệt giá một clip, xem/nghe kết quả và đối chiếu thuật ngữ. Chỉ tạo thêm biểu cảm/cả bộ sau khi clip thử đạt và chi phí tiếp theo được duyệt. Không khẳng định bộ Embedded hiện tại đã được chuyển hoặc kiểm chứng chế độ mới.

### Clip thử thật (12/10/2026, Claude)

- Áp bản vá lip-sync của Codex vào repo. Runtime OpenVoice chuyển từ TEMP sang `.local/voice-conversion-runtime` (git-ignored). Gateway thật ở 8780 đã có khối `voiceConversion`; health trả `ready: true`, giọng `ruby_wav_clean`, mất khoảng 18–21 s trên CPU. Timeout health phía Aris tăng từ 30 lên 120 s.
- **Sửa chọn model:** F2A chỉ có `veo-3.1-lite/fast-i2v-4s/6s`; bản 8 giây có ảnh chỉ có ở `quality-i2v-8s`. Bản vá trước gọi `veo-3.1-fast-i2v-8s` (không tồn tại) cho câu dài hơn 6 s. Nay câu dài lên Quality như code cũ, giá vẫn hiện trong báo giá. `voice-stability` 59/59.
- **Veo Fast bị từ chối:** tài khoản #1 nhận 403 `PUBLIC_ERROR_MODEL_ACCESS_DENIED` với `veo-3.1-fast-i2v-6s-landscape`. Không bị trừ credit. Preview bỏ `NativeModelWithImage` và dùng Omni 1.1 Flash (model mặc định `ModelWithImage`).
- **Câu 1 Embedded bằng Omni 6 s + đổi giọng Ruby:** báo giá 10 credit, tạo xong sau khoảng 120 s.
  - Gateway: đổi giọng hoàn tất, lệch thời lượng 2 ms. Clip 6,10 s, H.264 1280×720, AAC 48 kHz, −14,4 LUFS.
  - Lời nói từ 1,15 s đến 4,73 s. Khung hình vùng mặt: miệng mở/khép thay đổi trong khoảng có lời, khép khi im lặng.
  - Chưa chép lời được trên máy (không có faster-whisper); chưa gửi audio ra dịch vụ ngoài. Nội dung câu, cách đọc thuật ngữ và độ giống Ruby cần người dùng nghe.
  - File: `.local/lipsync-trial/question-1-lipsync.mp4`, ảnh khung `mouth-sheet.png`, nhật ký `trial.log`.
- Preview 5029 chạy build `.local/lipsync-build` với nội dung `.local/lipsync-preview-content`; bộ Embedded đã ở `independent` + `native-converted`. Chuyển chế độ bằng `.local/embedded-lipsync-mode.mjs` (không gọi dịch vụ trả phí). Các clip khác vẫn là clip cũ.

## Khớp môi + giữ giọng đọc TTS (`native-tts`, 12/10/2026)

Nhãn trên web: **Khớp môi + giữ giọng đọc TTS đã chọn**. Dùng khi cần cả khẩu hình khớp lời lẫn đúng giọng TTS (Ruby, cách đọc thuật ngữ) cho mọi clip.

1. Model video tự đọc câu thoại (prompt giống `native`), nên miệng chỉ cử động khi có lời.
2. Aris tạo giọng TTS **trước** khi gửi lượt tạo video trả phí; TTS lỗi thì không gửi lượt tạo.
3. Gateway `POST /media/fit-voice` (multipart `video` + `audio`, cần key) tách lời nói gốc, dò các cụm lời bằng `silencedetect` ở cả hai bên rồi:
   - số cụm bằng nhau: khớp từng cụm; khác nhau hoặc có cụm lệch nhịp quá mức: khớp cả khoảng lời;
   - đổi nhịp TTS bằng `atempo` (giữ cao độ), giới hạn 0,5–2 lần; ngoài khoảng đó hoặc video không có lời thì từ chối, không đoán;
   - cắt mỗi đoạn đúng độ dài đích, đặt đúng thời điểm, chuẩn hóa −14 LUFS; video copy nguyên gói, audio đúng số mẫu của bản gốc nên tiếng không trôi lệch hình.
4. Tốc độ TTS cố định 1 (nhịp lấy từ video); cao độ, giọng và cách đọc thuật ngữ vẫn chỉnh được. Các ô im lặng có video biểu cảm riêng, không tiếng.
5. Cần TTS và máy xử lý media (`InterviewEngine:Media`). Thiếu một trong hai thì lựa chọn bị tắt và server từ chối khi lưu/báo giá.

Kiểm tra: `speech-fit.test.mjs` 7/7 (cụm lời tổng hợp rơi đúng chỗ, lệch ≤ 60 ms; MD5 luồng video không đổi; −14 LUFS; video không lời bị từ chối), gateway tổng 40/40, `voice-stability` 68/68 (TTS trước lượt trả phí), flow-e2e 63/63, Chrome 47/47.

Thử với dữ liệu thật, không tạo video mới: clip câu 1 (Omni, nhịp lời gốc giữ nguyên sau đổi giọng) + TTS `ruby_wav_clean` thật có cách đọc thuật ngữ. Gateway khớp cả khoảng, nhịp ×1,27. Kết quả: MD5 video trùng bản gốc, 6,10 s, lời 1,18–4,71 s so với 1,15–4,72 s gốc, −14,0 LUFS. File `.local/lipsync-trial/question-1-native-tts.mp4`.
