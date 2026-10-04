# Hợp đồng giao tiếp (Contracts) & Định danh hệ thống

Tài liệu thiết lập ngày 03/10/2026 trong khuôn khổ nhiệm vụ khôi phục luồng Aris & AiCore.

---

## 1. Luồng danh sách ứng viên (GetApplicantsForJob)

### Endpoint
- **Route**: `GET /JobApplications/GetApplicantsForJob?jobId={jobId}&status={status?}`
- **Controller**: `ArisSkyve.Controllers.JobApplicationsController.GetApplicantsForJob`
- **Auth & Quyền sở hữu**:
  - `[Authorize]`
  - Kiểm tra `user.Role == "Business"`
  - Kiểm tra `job.BusinessAccountId == user.Profile.Id` (Chỉ chủ sở hữu tin mới được truy cập, người khác nhận HTTP 200 `{ success: false, message: ... }` hoặc 404).

### Request & Response Contract
- **Input**: Query params `jobId` (int, bắt buộc), `status` (string, tuỳ chọn, thuộc `JobApplicationStatus.All`).
- **Response envelope** (JSON):
  ```json
  {
    "success": true,
    "jobTitle": "Senior Backend Engineer",
    "applicants": [
      {
        "id": 105,
        "fullName": "Nguyễn Văn A",
        "email": "vana@example.com",
        "avatar": "/uploads/avatars/abc.jpg",
        "jobTitle": "Backend Developer",
        "coverLetter": "Em quan tâm đến vị trí...",
        "resumeUrl": "/uploads/resumes/cv.pdf",
        "resumeName": "CV_NguyenVanA.pdf",
        "screeningAnswers": ["3 năm", "Có"],
        "status": "Submitted",
        "statusLabel": "Đã nộp",
        "statusNote": null,
        "appliedAt": "2026-10-01T08:30:00Z",
        "applicationCount": 1,
        "interviewAt": null,
        "interviewLocation": null,
        "isVideoCall": false,
        "interviewResponse": null
      }
    ]
  }
  ```
- **Lỗi / Quyền từ chối**:
  - Khi không có quyền: `{ "success": false, "message": "Bạn không có quyền xem tin tuyển dụng này." }`
  - Khi tin không tồn tại: HTTP 404 NotFound.

### Consumers
1. **`wwwroot/js/pages/employer.js`** (Bàn làm việc nhà tuyển dụng):
   - **Vấn đề đã thấy trong source**:
     - Gán `applicantsData = data || []` khiến `applicantsData` là object `{ success, applicants, ... }`, dẫn đến lỗi runtime `applicants.forEach is not a function`.
     - Đọc thẻ ứng viên: gọi `app.candidateName` và `app.avatarUrl`, trong khi contract trả `app.fullName` và `app.avatar`. Kết quả: tên hiển thị mặc định thành "Ứng viên" và avatar bị fallback.
     - Đọc drawer: gọi `app.candidateName`, `app.avatarUrl`, `app.phone` (không có trong contract).
     - Thiếu cancellation / sequence check khi người dùng chuyển giữa các tin tuyển dụng nhanh.
2. **`wwwroot/js/pages/jobs.js`** (Modal Quản lý ứng viên):
   - Đọc đúng `data.applicants`. Dùng `a.fullName`, `a.email`, `a.resumeUrl`, `a.statusLabel`, `a.id`.

---

## 2. Luồng gợi ý việc làm (AiCore ↔ Aris ↔ Giao diện Việc làm)

### Upstream Endpoint (AiCore)
- **Route**: `POST /recommend-jobs-for-employee`
- **Tập tin source**: `D:\ThucTap\AiCore\main.py`, hàm `recommend_jobs_for_employee`
- **Xác thực**: Header `X-AiCore-Key` qua `AiCoreKeyHandler`.
- **Input**:
  - Form hoặc JSON: `employee_id` (int, 1 đến 2147483647), `top_k` (int, 1 đến 50), `top_k_vector` (int, 1 đến 200).
- **Quy tắc chọn CV của AiCore**:
  - `_latest_resume`: Lấy TOP 1 CV thoả mãn `EmployeeId = ? AND VectorId IS NOT NULL AND LEN(VectorId) > 0` ORDER BY `LastUpdatedAt DESC, Id DESC`.
- **Response Contract**:
  - Thành công:
    ```json
    {
      "status": "success",
      "candidate": "Họ và tên",
      "recommendations": [
        {
          "job_id": "sha256_vector_hash",
          "posting_id": 327,
          "job_title": ".NET Software Engineer",
          "company": "FPT Software",
          "final_score": 85.5,
          "reason": "Phù hợp kỹ năng C# và EF Core",
          "advice": "Nên bổ sung kinh nghiệm Docker vào CV",
          "matched_skills": [".NET", "C#", "SQL Server"],
          "missing_skills": ["Docker", "Kubernetes"],
          "evidence": [
            { "cv_quote": "Kinh nghiệm 3 năm .NET", "job_quote": "Yêu cầu 2+ năm .NET C#" }
          ],
          "explanation_status": "grounded",
          "original_url": "https://..."
        }
      ]
    }
    ```
  - Khi chưa có CV: `{ "status": "no_cv", "candidate": "...", "message": "...", "recommendations": [] }`

### Aris Endpoint & Storage
- **Route**: `GET /Jobs/GetAiRecommendations?topK=3`
- **Controller**: `ArisSkyve.Controllers.JobsController`
- **Khác biệt & Sai sót trong source**:
  1. **Chọn CV lệch**: Aris dùng `_context.Resumes.FirstOrDefaultAsync(r => r.EmployeeId == profile.Id)`. Không có `OrderByDescending(LastUpdatedAt, Id)` và không kiểm tra `VectorId`.
  2. **Mất trường khi cache**: Entity `UserRecommendations` chỉ lưu `Id, UserId, JobId, MatchScore, Reason, CreatedAt, ResumeVersion`. Hoàn toàn mất `Advice`, `MatchedSkills`, `MissingSkills`, `Evidence`, `ExplanationStatus`. Khi cache hit, trang tải lại mất toàn bộ kỹ năng và lời khuyên!
  3. **Score nullability**: `JobRecommendationDTO.Score` là `double` không nullable, trong khi AiCore có thể trả `null`.
  4. **Nhận diện tin**: Dùng `OriginalUrl` hoặc `Title`, chưa tận dụng `posting_id` (SQL ID của `JobPostings`). Title có thể trùng giữa nhiều công ty.

---

## 3. Luồng đối chiếu đơn CV – JD (/score-cv-for-job)

### Upstream Endpoint (AiCore)
- **Route**: `POST /score-cv-for-job`
- **Tập tin source**: `D:\ThucTap\AiCore\api_v2.py`, hàm `score_cv_for_job`
- **Input (JSON)**:
  ```json
  {
    "employee_id": 7,
    "resume_id": 11,
    "posting_id": 327,
    "original_url": null
  }
  ```
  *(Cần `employee_id` hoặc `resume_id`; và `posting_id` hoặc `original_url`)*
- **Response**:
  - `status`: `"success"` hoặc `"no_cv"`
  - `candidate`: `{ "employee_id": 7, "resume_id": 11, "name": "Nguyễn Văn A" }`
  - `job`: `{ "posting_id": 327, "title": "...", "company": "...", "category": "...", "original_url": "..." }`
  - `final_score`: double (hoặc null nếu thiếu mô hình)
  - `score_breakdown`: `{ "semantic_score": ..., "cross_score": ..., "llm_score": ..., "base_score": ..., "llm_adjustment": ... }`
  - `reason`: string
  - `advice`: string
  - `matched_skills`: string[]
  - `missing_skills`: string[] ("Chưa thấy trong CV")
  - `evidence`: `{ "cv_quote": "...", "job_quote": "..." }[]`
  - `explanation_status`: `"grounded"` | `"unavailable"`
  - `meta`: `{ "algorithm": "v6", "llm_model": "...", "llm_ok": true, ... }`

### Aris Integration (Cần triển khai ở P06)
- **Route**: `POST /Jobs/ScoreCvForJob`
- **Quyền hạn**: `[Authorize]`, `[ValidateAntiForgeryToken]`.
- **Kiểm tra quyền**: Chỉ cho phép đối chiếu CV thuộc về chính `user.Profile.Id` của phiên đăng nhập; không cho phép truyền `resumeId` của người khác.

---

## 4. Bảng định danh & Ý nghĩa ID trong toàn hệ thống

| Tên biến / Trường | Ý nghĩa | Kiểu | Chú ý đặc biệt |
|---|---|---|---|
| `User.Id` | Khóa chính bảng `Users` | int | Tài khoản đăng nhập (Identity) |
| `Profile.Id` (`EmployeeId` / `BusinessAccountId`) | Khóa chính bảng `Profiles` | int | Ứng viên hoặc Doanh nghiệp. Khác với User.Id! |
| `Resume.Id` | Khóa chính bảng `Resumes` | int | Từng bản CV cụ thể của ứng viên. Một ứng viên có thể có nhiều CV. |
| `Resume.VectorId` | Khóa vector trong Pinecone | string | Chỉ những CV có VectorId hợp lệ mới được AiCore chấm gợi ý. |
| `JobPosting.Id` | Khóa chính bảng `JobPostings` | int | Trùng với `posting_id` trong AiCore. |
| `JobApplication.Id` | Khóa chính bảng `JobApplications` | int | Đại diện một lần ứng tuyển cụ thể. Thao tác tuyển dụng phải dùng ID này. |
| `AiCore job_id` | Hash SHA256 của URL trong Pinecone | string | **Không phải** ID SQL. Không ép kiểu về int! |

---

## 5. Cấu hình Timeout & Hiệu năng gọi AiCore

| Khóa cấu hình | Giá trị mặc định | Phạm vi áp dụng | Mục đích |
|---|---|---|---|
| `AiCore:RecommendTimeoutSeconds` | **95** | `JobsController.GetAiRecommendations` | Bao quát thời gian tính toán LLM thật (thường 26–33s, hạn chót AiCore là 90s). Tránh huỷ sớm request trước khi AiCore hoàn tất. |
| `AiCore:ScoreTimeoutSeconds` | **45** | `JobsController.ScoreCvForJob` | Đủ dài cho luồng đối chiếu đơn lẻ CV–JD (5–15s thông thường, tối đa ~35s khi máy bận). |

---

## 6. Quy tắc hợp lệ & Vòng đời Cache gợi ý việc làm (F2 / F3)

Một lô gợi ý đã lưu trong `UserRecommendations` chỉ được phép dùng **thay thế cho** việc gọi AiCore khi thỏa mãn **toàn bộ** các điều kiện sau:

1. **Thời hạn lưu (`RecommendationCacheHours`)**:
   - `CreatedAt` chưa quá cấu hình `AiCore:RecommendationCacheHours` (mặc định **24 giờ**, khớp với thời hạn kết quả tính sẵn của AiCore).
2. **Trạng thái bài đăng (`JobPostings.isActive`)**:
   - Toàn bộ các việc làm thật (`JobId > 0`) trong lô phải còn đang mở tuyển (`isActive == true`). Nếu có bất kỳ tin nào hết hạn (ví dụ qua ngày `Deadline`), toàn bộ lô bị coi là hết hạn và kích hoạt gọi lại AiCore.
3. **Lô suy giảm (`DegradedCacheMinutes`)**:
   - Nếu lô có chứa đánh dấu suy giảm từ AiCore (`matching.degraded` khác rỗng), thời hạn hiệu lực tối đa chỉ là `AiCore:DegradedCacheMinutes` (mặc định **30 phút**). Quá 30 phút bắt buộc gọi lại AiCore để lấy kết quả chuẩn đầy đủ.
4. **Bảo tồn điều kiện R2 & R6**:
   - Khớp định danh: `UserId`, `ResumeId`, và `ResumeVersion == LastUpdatedAt`.
   - Độ bao phủ: `RequestedTopK >= topK`.
5. **Marker hoàn tất 0 việc làm (`JobId == 0`)**:
   - Tuân thủ quy tắc 1 (chưa quá 24h) và quy tắc 3 (chưa quá 30m nếu degraded).

### Cơ chế dự phòng khi AiCore gặp sự cố (Fallback Cache)
- Khi gọi AiCore thất bại (HTTP lỗi, 503 Service Unavailable, timeout, mạng chập chờn):
  - Hệ thống sử dụng lại lô cache cũ nhất có sẵn (kể cả lô đã quá 24h) để hiển thị cho ứng viên thay vì quăng lỗi màn hình.
  - Thiết lập `ViewData["IsFallbackCache"] = true` và `ViewData["FallbackNotice"] = "Kết quả đã lưu lúc HH:mm dd/MM"`.
  - Giao diện `_RecommendedJobsPartial.cshtml` render thanh thông báo cảnh báo nhẹ màu cam để ứng viên biết dữ liệu đang xem là từ bản lưu trước đó.

---

## 7. Mở rộng Contract trường `matching` của AiCore V2 (F3)

### Định dạng đối tượng `matching` trong `AiResponseWrapper`
```json
{
  "status": "success",
  "recommendations": [ ... ],
  "matching": {
    "degraded": ["pinecone_sparse_fallback"],
    "precomputed": true,
    "precomputed_at": "2026-10-04T01:30:00Z"
  }
}
```

- `degraded` (`List<string>?`): Danh sách mã lỗi/nguyên nhân suy giảm. Giá trị `null` hoặc `[]` biểu thị kết quả đầy đủ chất lượng cao. Nếu danh sách không rỗng, danh sách lý do này được lưu vào `AiRecommendationPayload.Degraded` (cột `PayloadJson`) mà không cần thay đổi schema hay migration.
- `precomputed` (`bool?`): Cho biết kết quả có phải lấy từ kho tính sẵn hay không.
- `precomputed_at` (`string?`): Thời điểm tính sẵn.

---

## 8. Chống xung đột đồng thời & Khử trùng lặp bản ghi (F5)

1. **Khoá đơn luồng theo người dùng (`SemaphoreSlim`)**:
   - Quản lý qua `ConcurrentDictionary<int, SemaphoreSlim> _userLocks` trong tiến trình `JobsController`.
   - Bao bọc toàn bộ chuỗi: Kiểm tra cache → Gọi AiCore → Lưu cache.
   - Thời gian chờ khoá tối đa bằng `RecommendTimeoutSeconds` (95s).
   - Đảm bảo khi người dùng mở nhiều tab hoặc bấm đúp nút gợi ý, chỉ duy nhất 1 request thực sự gọi AiCore, request thứ hai chờ và tận dụng ngay kết quả vừa được ghi vào cache.
2. **Khử trùng lặp trên bộ nhớ khi đọc cache**:
   - Khi đọc từ bảng `UserRecommendations` (chưa có Unique Index trong DB), nhóm theo `JobId` và chỉ giữ lại bản ghi mới nhất:
     `OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id).First()`.

---

## 9. Công tắc điều khiển Dữ liệu mẫu Demo (`DemoData:*`) (F7)

| Khóa cấu hình | Mặc định (Production) | Mặc định (Development) | Chức năng |
|---|---|---|---|
| `DemoData:SeedCompaniesAndJobs` | `false` | `false` | Quyết định chạy `DbSeeder.SeedCompaniesAndJobsAsync`. Tắt trên DB cloud để không làm lẫn 2 công ty/tin giả vào 1.909 tin tuyển dụng thật. |
| `DemoData:SeedSocial` | `false` | `true` | Quyết định chạy `DemoSocialSeeder.SeedAsync` (người dùng mẫu, bài viết mạng xã hội). |

