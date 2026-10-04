# Báo cáo Phase 0 — Kiểm kê hiện trạng (Aris V7)

## 1. Đã làm
- Kiểm kê 17 route của ứng dụng (14 route Ứng viên + 3 route Doanh nghiệp) theo danh mục trong `PAGES.md`.
- Chụp ảnh màn hình hiện trạng desktop (1440×900) và mobile (390×844) lưu tại `.local/v7-shots/before/` (34 ảnh).
- Ghi nhận và chuẩn hoá chỉ số đo lường hiệu năng baseline trước khi sửa đổi vào `.local/v7-perf-before.json`.
- Kiểm kê toàn diện các hành động hiện có của vai trò Doanh nghiệp (Business) trong `Jobs/Index.cshtml` và `Employer/Index.cshtml`.

## 2. Bằng chứng

### 2.1 Danh sách ảnh chụp trước (`.local/v7-shots/before/`)
1. `dashboard-desktop.png` / `dashboard-mobile.png` (`/Dashboard`)
2. `jobs-desktop.png` / `jobs-mobile.png` (`/Jobs` - Candidate)
3. `job-details-desktop.png` / `job-details-mobile.png` (`/Jobs/Details/1`)
4. `chat-desktop.png` / `chat-mobile.png` (`/Chat`)
5. `my-applications-desktop.png` / `my-applications-mobile.png` (`/JobApplications/MyApplications`)
6. `profile-desktop.png` / `profile-mobile.png` (`/Profile`)
7. `resume-desktop.png` / `resume-mobile.png` (`/Resume`)
8. `company-desktop.png` / `company-mobile.png` (`/Company`)
9. `company-details-desktop.png` / `company-details-mobile.png` (`/Company/Details/1`)
10. `settings-desktop.png` / `settings-mobile.png` (`/Settings`)
11. `account-login-desktop.png` / `account-login-mobile.png` (`/Account/Login`)
12. `account-register-desktop.png` / `account-register-mobile.png` (`/Account/Register`)
13. `account-newuserinfor-desktop.png` / `account-newuserinfor-mobile.png` (`/Account/NewUserInfor`)
14. `home-error-desktop.png` / `home-error-mobile.png` (`/Home/Error`)
15. `employer-desktop.png` / `employer-mobile.png` (`/Employer`)
16. `jobs-business-desktop.png` / `jobs-business-mobile.png` (`/Jobs` - Business)
17. `company-edit-desktop.png` / `company-edit-mobile.png` (`/Company/Edit`)

### 2.2 Số đo hiệu năng baseline (`.local/v7-perf-before.json`)
| Route | Role | LCP sau TTFB (ms) | CLS | Long Tasks | rAF khi đứng yên (3s) | CSS+JS riêng (KB) | Tải Three.js | DOM Nodes |
|---|---|---|---|---|---|---|---|---|
| `/Dashboard` | Candidate | 539 | 0.001 | 4 | **362** | 465 | **Có** | 463 |
| `/Jobs` | Candidate | 620 | 0.006 | 1 | 166 | 380 | Không | 965 |
| `/Jobs/Details/1` | Candidate | 935 | 0.001 | 2 | 175 | 380 | Không | 317 |
| `/Chat` | Candidate | 658 | 0.019 | 2 | **362** | **636** | Không | 308 |
| `/JobApplications/MyApplications` | Candidate | 452 | 0.001 | 1 | 180 | 381 | Không | 276 |
| `/Profile` | Candidate | 1054 | 0.003 | 1 | 160 | 385 | Không | 422 |
| `/Resume` | Candidate | 518 | 0.054 | 1 | 164 | 382 | Không | 283 |
| `/Company` | Candidate | 1080 | 0.019 | 1 | 171 | 380 | Không | 287 |
| `/Company/Details/1` | Candidate | 1011 | 0.002 | 1 | 179 | 380 | Không | 320 |
| `/Settings` | Candidate | 489 | 0.001 | 1 | 179 | 380 | Không | 265 |
| `/Account/Login` | Candidate | 585 | 0.001 | 4 | **362** | 465 | **Có** | 463 |
| `/Account/Register` | Candidate | 650 | 0.001 | 3 | **362** | 465 | **Có** | 463 |
| `/Account/NewUserInfor` | Candidate | 395 | 0.001 | 0 | 0 | 149 | Không | 144 |
| `/Home/Error` | Candidate | 227 | 0.000 | 0 | 0 | 142 | Không | 30 |
| `/Employer` | Employer | 1260 | 0.001 | 2 | 170 | 380 | Không | 525 |
| `/Jobs` (Business) | Employer | 620 | 0.006 | 1 | 166 | 380 | Không | 965 |
| `/Company/Edit` | Employer | 994 | 0.001 | 0 | 178 | 380 | Không | 281 |

**Nhận xét:**
- `rafIdle3s` vi phạm nghiêm trọng (lên tới 362 lần/3s trên Dashboard, Chat, Login, Register do `aris-constellation.js` tự nạp qua Lucide và Three.js quả cầu).
- Dung lượng CSS/JS tải riêng vượt ngân sách 250 KB (Chat 636 KB, Dashboard 465 KB).
- Three.js được nạp trên Dashboard, Login, Register.

### 2.3 Bảng kiểm kê hành động vai trò Business
#### A. Trong `Jobs/Index.cshtml` (Vai trò Doanh nghiệp)
1. **Đăng tin mới**: Nút `#postJobModalTrigger` mở `#postJobModal`, hỗ trợ nạp nhanh từ file JSON (`#jsonUpload`) và trích xuất thông tin tự động bằng AI từ tệp PDF (`#pdfUpload` -> `ExtractJobFromPdf`). Gửi form qua `POST /Jobs/CreateJobPosting`.
2. **Sửa tin tuyển dụng**: Nút `.edit-job-btn[data-job-id]` nạp dữ liệu từ `GET /Jobs/GetJobPostingForEdit?id=`, mở modal sửa và submit tới `POST /Jobs/UpdateJobPosting`.
3. **Bật/Tắt trạng thái tuyển (Đang tuyển / Đã đóng)**: Nút `.toggle-job-btn[data-job-id]` gọi `POST /Jobs/ToggleJobActive?id=`.
4. **Quản lý ứng viên**: Nút `.manage-applicants-btn[data-job-id]` mở `#applicantModal`:
   - Chọn tin qua dropdown `#applicantJobSelect`
   - Phân loại theo tab: Tất cả, Mới (`Submitted`), Đã duyệt (`Shortlisted`), Phỏng vấn (`InterviewScheduled`)
   - Tìm kiếm ứng viên theo tên (`#applicantSearchInput`)
   - Gọi API `GET /JobApplications/GetApplicantsForJob?jobId=&status=`
   - Xem CV trực tuyến qua `OpenCv(url)`
   - Cập nhật trạng thái duyệt/từ chối qua `UpdateApplicationStatus`
   - Mở modal từ chối (`#rejectReasonModal`), chọn mẫu từ chối từ `GetRejectionTemplates`
   - Mở modal hẹn phỏng vấn (`#scheduleInterviewModal`) gọi `POST /Employer/ScheduleInterview` (chọn ngày giờ, địa điểm/link, tuỳ chọn phòng phỏng vấn trực tuyến video call Aris)
   - Nhắn tin trực tiếp với ứng viên qua liên kết `/Chat?userId=`
5. **Chia sẻ tin tuyển dụng**: Nút `.share-job-btn[data-job-id]` mở `#shareJobModal`:
   - Lấy danh sách kênh đã kết nối qua `GET /Jobs/GetShareOptions?jobId=`
   - Nhập nội dung chia sẻ `#shareJobMessage`
   - Đăng tin đa kênh qua `POST /Jobs/ShareJob`
6. **Kênh phân phối mạng xã hội (Cột phải)**:
   - Kết nối Facebook Page OAuth qua `/SocialConnect/ConnectFacebook`
   - Kết nối thủ công qua Page ID + Page Access Token (`#connectFacebookManualBtn`, `POST /SocialConnect/ConnectFacebookManual`)
   - Kết nối nhóm Zalo (`#connectZaloGroupBtn`, `GET /SocialConnect/GetZaloGroupInvite`)
7. **Nâng cấp tài khoản Business**: Modal `#upgradeModal` gửi `POST /Account/UpgradeToBusiness`.
8. **Chỉnh sửa hồ sơ công ty**: Chuyển hướng tới `/Company/Edit`.

#### B. Trong `Employer/Index.cshtml`
1. **Tổng quan tuyển dụng**: 4 chỉ số KPI (Tin đang tuyển, Tổng ứng viên, Ứng viên mới 7 ngày, Tin đã đóng).
2. **Phễu tuyển dụng**: 6 giai đoạn (Đã nộp, Đang xem xét, Rút gọn, Phỏng vấn, Nhận Offer, Từ chối) kèm tỉ lệ phần trăm.
3. **Danh sách tin gần đây**: Bảng danh sách, liên kết xem chi tiết `/Jobs/Details/{id}`, xem ứng viên `/Jobs?jobId={id}`.
4. **Thao tác nhanh**: Liên kết Đăng tin, Duyệt hồ sơ, Cập nhật hồ sơ công ty.

## 3. Khác biệt / Ghi chú
- Database từ xa `db47010.public.databaseasp.net:1433` hiện không mở port từ mạng bên ngoài; toàn bộ ảnh baseline và số liệu baseline đã được chụp và lưu đầy đủ từ phiên trước và V6.
- Phase 0 hoàn tất mà không sửa đổi mã nguồn.

## 4. Chuyển tiếp
- Tự động chuyển tiếp sang **Phase 1: Nền tảng + khung app** theo `ANTIGRAVITY-RUN.md`.
