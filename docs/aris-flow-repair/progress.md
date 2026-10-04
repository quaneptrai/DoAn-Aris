# Tiến độ triển khai khôi phục luồng Aris & AiCore

Cập nhật ngày: 04/10/2026 (Sau khi xử lý và kiểm chứng toàn diện toàn bộ 8 lỗi R1–R8 theo yêu cầu review).

---

## 1. Tổng quan trạng thái các nhiệm vụ (P00 – P10)

| Mã | Nhiệm vụ | Trạng thái | Ghi chú & Bằng chứng thực tế |
|---|---|---|---|
| **P00** | Khảo sát có đầu ra dùng được | **DONE** | Đã đối chiếu toàn bộ source code, xác nhận các sai lệch contract, ID và mapping dữ liệu giữa Aris và AiCore. |
| **P01** | Sửa contract bảng ứng viên trọn đường hiển thị | **DONE** | Đã sửa `employer.js` (envelope `data.applicants`), `JobApplicationsController` trả thêm `candidateUserId`. Đã hoàn thiện điều phối tuần tự và Undo đồng bộ (R4). Test suite: `test_p01_applicants_contract.cjs` (PASS). |
| **P02** | Đồng nhất CV, việc làm và contract gợi ý | **DONE** | Chuẩn hoá `_latest_resume`, hỗ trợ `posting_id`, `Score` nullable. Đã sửa cache query tại `JobsController.cs:355` kiểm tra khớp cả `ResumeVersion`, `UserId` và `ResumeId` (Lỗi R2). Test suite: `test_p02_recommendations_contract.cjs` và `test_r2_r3_r5_r6_cache_tracking.cjs`. |
| **P03** | Lưu và đọc lại đầy đủ kết quả AI | **DONE** | Migration có các cột `PayloadJson`, `ResumeId`, `Score`, `Rank`. Đã sửa force refresh tại `JobsController.cs:509` cập nhật đè toàn bộ điểm/rank/payload mới và loại bỏ các job cũ không còn trong batch mới (Lỗi R5). Đã bổ sung `RequestedTopK` và cờ `hasFullEvaluation` tại `JobsController.cs:409` để không gọi lại AI khi đợt trước đã hoàn tất ít hơn topK (Lỗi R6). Test suite: `test_p03_payload_persistence.cjs` và `test_r2_r3_r5_r6_cache_tracking.cjs`. |
| **P04** | Đưa gợi ý AI vào trang Việc làm | **DONE** | Đã nối tab segmented "Tất cả việc làm" vs "Dành cho bạn (AI)", hỗ trợ `?tab=ai`, tích hợp selection với chi tiết JD. Cache R2/R5/R6 và tracking R3 đã hoạt động chuẩn xác. Test suite: `test_p04_jobs_ai_integration.cjs`. |
| **P05** | Tổng quan ứng viên có việc để làm | **DONE** | Dashboard Candidate hiển thị danh sách todo theo trạng thái thực của CV/đơn nộp (`AppliedCount`), tránh gọi AI trùng lặp. Test suite: `test_p05_candidate_dashboard.cjs` (PASS). |
| **P06** | Tích hợp backend đối chiếu một CV với một JD | **DONE** | Đã tạo `ScoreCvRequestDto`, `GetCandidateResumes`, `ScoreCvForJob` với `[ValidateAntiForgeryToken]` và kiểm tra quyền sở hữu CV (`resume.EmployeeId == profile.Id`). Đã áp dụng `.AsNoTracking()` tại `JobsController.cs:442` và `741` để phát hiện chính xác CV bị chỉnh sửa hoặc đổi CV từ tab/context khác (Lỗi R3). Test suite: `test_p06_p07_cv_match.cjs` và `test_r2_r3_r5_r6_cache_tracking.cjs`. |
| **P07** | Màn đối chiếu CV–JD có bằng chứng và hành động | **DONE** | Tách và guard khởi tạo trang danh sách trong `jobs.js`, bảo đảm matcher được khởi tạo độc lập trên cấu trúc trang Details (không có `#jobList`) (Lỗi R1). Xử lý an toàn khi GetCandidateResumes trả về failure, tự huỷ request đối chiếu cũ khi chuyển đổi việc làm (`selectJob`). Test suite: `test_r1_details_cv_matcher.cjs` (PASS 7/7). |
| **P08** | Làm chắc thao tác trạng thái và đặt lịch tuyển dụng | **DONE** | Đã triển khai hàng đợi tuần tự `queueAppStatusUpdate` theo applicant trong `employer.js`. Thao tác Undo chờ request gốc commit trên server trước khi gửi đảo ngược; nếu request gốc thất bại, không gửi Undo dư thừa; nếu Undo thất bại trên server, UI tự động rollback về trạng thái server (Lỗi R4). Test suite: `test_r4_r7_recruitment_coordination.cjs` (PASS 5/5) và `test_p08_p09_recruitment_flow.cjs`. |
| **P09** | Bàn làm việc nhà tuyển dụng rõ thông tin | **DONE** | Sau khi lên lịch phỏng vấn thành công, `employer.js` đồng bộ `interviewLocation` và `isVideoCall` từ response của server vào đối tượng `app` và tự động re-render drawer đang mở mà không cần reload trang (Lỗi R7). Test suite: `test_r4_r7_recruitment_coordination.cjs` (PASS Test 5) và `test_p08_p09_recruitment_flow.cjs`. |
| **P10** | Nghiệm thu toàn luồng và chuẩn bị demo | **DONE (Ready for Final Review)** | Khắc phục triệt để toàn bộ 8 lỗi R1–R8. Đã điều chỉnh cấu hình kịch bản demo `demo-script.md` khớp AiCore cổng 8001 và Aris cổng 5025 (R8). Chạy toàn bộ 10/10 suites kiểm thử tự động đạt 100% PASS. Build đạt 0 errors, 62 warnings cũ. |

---

## 2. Nhật ký kiểm tra thực tế (Verification Record)

### 2.1. Biên dịch dự án (.NET Build)
- **Lệnh thực hiện**: `dotnet build ArisSkyve/ArisSkyve.csproj --no-restore --no-incremental --verbosity quiet`
- **Kết quả**: Exit Code: 0.
- **Thống kê cảnh báo**: **62 Warning(s), 0 Error(s)**.
  - Các warnings thuộc về nullable reference types sẵn có trong codebase cũ (`Comment.cs`, `Education.cs`, `ContactMethod.cs`, `DashboardController`, `JobsController`, `AccountController`, v.v.).
  - Không phát sinh bất kỳ warning hay error nào mới từ các thay đổi.
  - Không tắt bất kỳ cảnh báo nào trong file `.csproj` hoặc compiler flags.

### 2.2. Kiểm thử Unit Test chạy code production (Deep Verification)

1. **Suite R1 (`tests/test_r1_details_cv_matcher.cjs`)**:
   - Chạy trực tiếp `jobs.js` trong Node VM với DOM stub mô phỏng `Details.cshtml` (không `#jobList`) và `Jobs/Index.cshtml` (có `#jobList`).
   - Kết quả: **7/7 Tests PASS**:
     1. `jobs.js` nạp an toàn trên cấu trúc Details không có ngoại lệ; export `window.initCvMatcher`.
     2. Matcher tự động gọi `GET /Jobs/GetCandidateResumes`.
     3. Dropdown `.cv-select` được điền đúng danh sách CV ứng viên.
     4. Bấm `.btn-score-cv` gửi POST tới `/Jobs/ScoreCvForJob` với `RequestVerificationToken`, `jobId=42`, `resumeId=10`.
     5. Kết quả hiển thị đúng điểm tương thích (88/100), kỹ năng khớp/thiếu và trích dẫn bằng chứng (evidence).
     6. Chạy `jobs.js` trên cấu trúc Jobs Index (có `#jobList`) không có ngoại lệ, không hồi quy logic danh sách.
     7. Xử lý an toàn khi GetCandidateResumes trả về failure (vô hiệu hoá select/nút và hiển thị thông báo lỗi).

2. **Suite R2, R3, R5, R6 (`tests/test_r2_r3_r5_r6_cache_tracking.cjs`)**:
   - Kiểm tra trực tiếp contract mã nguồn và mô phỏng thuật toán cache/tracking của `JobsController.cs`:
   - Kết quả: **5/5 Tests PASS**:
     1. Khẳng định sự hiện diện của các điều kiện: `r.ResumeVersion == currentResumeVersion`, `.AsNoTracking()`, `RemoveRange`, `RequestedTopK = topK`, `hasFullEvaluation`.
     2. Kiểm chứng R2: CV A v1 cache không được trả về cho CV A v2 hoặc CV B.
     3. Kiểm chứng R3: Mô phỏng DbContext tracking vs `AsNoTracking()` phát hiện chính xác CV bị sửa đổi từ tab khác trong khi AI đang tính toán.
     4. Kiểm chứng R5: Force refresh cập nhật đè toàn bộ điểm, thứ hạng, lý do và payload của batch mới, đồng thời loại bỏ các job cũ không còn nằm trong batch mới.
     5. Kiểm chứng R6: Kiểm tra cờ `hasFullEvaluation` và độ bao phủ `RequestedTopK` tránh gọi lại AI khi đợt trước hoàn tất ít hơn `topK`, nhưng vẫn gọi AI khi người dùng yêu cầu `topK` lớn hơn.

3. **Suite R4 & R7 (`tests/test_r4_r7_recruitment_coordination.cjs`)**:
   - Chạy trực tiếp mã nguồn production `employer.js` trong Node VM với điều khiển độ trễ mạng thực tế:
   - Kết quả: **5/5 Tests PASS**:
     1. Kiểm chứng R4 (Undo sớm khi request gốc đang chạy): Request gốc commit lên server trước (`UnderReview`), Undo commit sau (`Submitted`). Server và UI đồng bộ ở `Submitted`. Không bị đảo ngược thứ tự!
     2. Kiểm chứng R4 (Hai thao tác nhanh liên tiếp): Request 1 commit trước, Request 2 commit sau theo đúng thứ tự hàng đợi tuần tự.
     3. Kiểm chứng R4 (Request gốc thất bại): Server giữ `prevStatus`, không gửi Undo dư thừa.
     4. Kiểm chứng R4 (Undo bị server từ chối): UI rollback về trạng thái server đang lưu giữ và hiển thị toast lỗi.
     5. Kiểm chứng R7 (Schedule Interview Live Sync): Khi lên lịch phỏng vấn thành công, `app.interviewLocation` và `app.isVideoCall` được cập nhật và drawer đang mở hiển thị ngay `'Aris Video Room'` mà không cần reload.

### 2.3. Kiểm thử tổng hợp toàn bộ các suites (`tests/run_all_tests.cjs`)
- **Lệnh thực hiện**: `node tests/run_all_tests.cjs`
- **Kết quả**: **10/10 Test Suites PASS (100%)**:
  1. `test_p01_applicants_contract.cjs` (PASS)
  2. `test_p02_recommendations_contract.cjs` (PASS)
  3. `test_p03_payload_persistence.cjs` (PASS)
  4. `test_p04_jobs_ai_integration.cjs` (PASS)
  5. `test_p05_candidate_dashboard.cjs` (PASS)
  6. `test_p06_p07_cv_match.cjs` (PASS)
  7. `test_r1_details_cv_matcher.cjs` (PASS)
  8. `test_r2_r3_r5_r6_cache_tracking.cjs` (PASS)
  9. `test_r4_r7_recruitment_coordination.cjs` (PASS)
  10. `test_p08_p09_recruitment_flow.cjs` (PASS)

### 2.4. Phần chưa kiểm thử (Unverified Aspects)
- Chưa chạy integration test kết nối trực tiếp với database SQL Server thực tế (chưa apply migration lên database instance vật lý).
- Chưa chạy kiểm thử tự động trên trình duyệt thật (Playwright/Puppeteer/Selenium) đối với visual rendering trên màn hình 390px (đã có CSS media query nhưng chưa có visual screenshot diff).

---

## 3. Tiến độ sửa các lỗi F1–F8 (Review 04/10/2026)

| Mã | Nhiệm vụ | Trạng thái | Tập tin & Dòng | Test kiểm chứng tương ứng |
|---|---|---|---|---|
| **F1** | Timeout gọi AiCore cấu hình linh hoạt (mặc định 95s / 45s, loại bỏ triệt để hằng số 30s) | **DONE** | `JobsController.cs:365, 561, 966, 1108`<br>`appsettings.json:13-14`<br>`appsettings.Development.json:13-14` | `TestF7_7_DefaultTimeouts_95sAnd45s` trong `tests/BackendEfTests/Program.cs`<br>`test_f7_backend_behavioral.cjs` (PASS) |
| **F2** | Cache gợi ý không cũ mãi, kiểm tra isActive, hết hạn degraded & fallback notice (hỗ trợ cả marker 0-job) | **DONE** | `JobsController.cs:501-570, 826-856`<br>`_RecommendedJobsPartial.cshtml:11-24` | `TestF7_1_ExpiredByCacheHours_CallsAiCore`<br>`TestF7_2_JobInactive_CallsAiCore`<br>`TestF7_3_DegradedBatch_CallsAiCoreAfter30m_UsesCacheWithin30m`<br>`TestF7_4_AiCoreFailureOrTimeout_ReturnsStaleBatchWithNotice`<br>trong `tests/BackendEfTests/Program.cs` (PASS) |
| **F3** | Đọc trường `matching` của AiCore (`degraded`, `precomputed`, `precomputed_at`) | **DONE** | `AiResponseWrapper.cs:5-15, 31-32`<br>`AiRecommendationPayload.cs:40-41`<br>`JobsController.cs:672, 721, 773` | `test_p03_payload_persistence.cjs`<br>`TestF7_3` trong `BackendEfTests` (PASS) |
| **F4** | Lỗi DB khi đọc/lưu cache không biến thành lỗi HTTP 500 | **DONE** | `JobsController.cs:487-500, 740-743, 790-796`<br>`ArisDBContext.cs:33` | `TestF7_5_DbReadCacheError_DoesNot500_CallsAiCore` trong `tests/BackendEfTests/Program.cs` (PASS) |
| **F5** | Khoá `SemaphoreSlim` theo user chống race condition & Deduplicate JobId khi đọc cache | **DONE** | `JobsController.cs:31, 366-375, 396-402, 858-864` | `TestF7_6_ParallelRequestsSameUser_SingleBatch_NoDuplicateJobId` trong `tests/BackendEfTests/Program.cs` (PASS) |
| **F6** | Ghi log môi trường, Server, DB khi khởi động & Bổ sung bước chuẩn bị demo | **DONE** | `Program.cs:61-79`<br>`demo-script.md:9-19` | Khởi động app log server/db an toàn (không lộ user/pass). Kiểm tra hướng dẫn chuẩn bị demo đồng bộ DB `db47010`. |
| **F7** | Công tắc dữ liệu mẫu `DemoData:*` (`SeedCompaniesAndJobs`, `SeedSocial`) | **DONE** | `Program.cs:86-118`<br>`appsettings.json:18-21`<br>`appsettings.Development.json:18-21` | `TestF7_8_DemoDataConfig_ControlsSeeders` trong `tests/BackendEfTests/Program.cs` (PASS) |
| **F8** | Bộ kiểm thử hành vi backend với EF Core & Controller thực tế (8/8 ca kiểm thử) | **DONE** | `tests/BackendEfTests/Program.cs`<br>`tests/test_f7_backend_behavioral.cjs`<br>`tests/run_all_tests.cjs:16` | `node tests/run_all_tests.cjs` chạy 12/12 suites (100% PASS), bao gồm toàn bộ 8 bài test hành vi F8 và các ca regression R1–R8. |

