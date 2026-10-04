# Aris Line V7 — bản vẽ từng trang

> Đọc `README.md` trước (nguyên tắc, token, component, mẫu tương tác). File này nói **mỗi trang trông thế nào, làm được gì, gọi API nào**.
> Ký hiệu: **[CÓ API]** = endpoint đã có trong app · **[CẦN BACKEND]** = chưa có, xem `BACKEND.md`; không có API thì **ẩn** tính năng đó, không làm giả.
> Trang có bản tham chiếu chạy được (`reference/*.html`) → **bản tham chiếu là chuẩn**; mục ở đây chỉ bổ sung phần map sang app thật.

## Mục lục

| # | Trang | View | Kiểu (README 5.3) | Reference |
|---|---|---|---|---|
| 1 | [Bảng tin](#1-bảng-tin) | `Dashboard/Index` | C | `feed.html` |
| 2 | [Việc làm](#2-việc-làm) | `Jobs/Index`, `_JobCardPartial` | A | `jobs.html` |
| 3 | [Chi tiết việc làm](#3-chi-tiết-việc-làm-trang-riêng) | `Jobs/Details` | B | `jobs.html?job=1` (phần sheet) |
| 4 | [Ứng tuyển (hộp thoại)](#4-hộp-thoại-ứng-tuyển) | `JobApplications/GetApplyModal` | dialog | `jobs.html?apply=1` |
| 5 | [Tin nhắn](#5-tin-nhắn) | `Chat/Index` | A | `chat.html` |
| 6 | [Đơn ứng tuyển của tôi](#6-đơn-ứng-tuyển-của-tôi) | `JobApplications/MyApplications`, `_MyApplicationsPartial` | B | — |
| 7 | [CV của tôi](#7-cv-của-tôi) | `Resume/Index`, `_MyCvsPartial` | B | — |
| 8 | [Hồ sơ](#8-hồ-sơ) | `Profile/Index` | B | — |
| 9 | [Cài đặt](#9-cài-đặt) | `Settings/Index`, `SocialConnect/SelectFacebookPage` | B | — |
| 10 | [Tuyển dụng (doanh nghiệp)](#10-tuyển-dụng-doanh-nghiệp) | `Employer/Index` + phần Business của `Jobs/Index` | A | — |
| 11 | [Công ty](#11-công-ty) | `Company/Index`, `Details`, `Edit` | B | — |
| 12 | [Đăng nhập / đăng ký](#12-đăng-nhập--đăng-ký) | `Account/Login`, `Register`, `_AuthLayout` | D | — |
| 13 | [Thông tin người dùng mới](#13-thông-tin-người-dùng-mới) | `Account/NewUserInfor` | D | — |
| 14 | [Phòng phỏng vấn](#14-phòng-phỏng-vấn) | `Interview/Room` | D (tối) | cuộc gọi trong `chat.html?call=1` |
| 15 | [Lỗi](#15-trang-lỗi) | `Home/Error` | D | — |
| 16 | [Chat widget](#16-chat-widget) | `_ChatWidget` | popover | — |

Trang không có reference: dựng từ component trong `components.html` + bản vẽ dưới đây. **Trước khi code, vẽ lại wireframe bằng HTML tĩnh trong `.local/v7-mock/` và chụp ảnh cho chủ dự án duyệt** (điểm DỪNG trong `AGENT-PROMPT.md`).

---

## 1. Bảng tin

**View:** `Views/Dashboard/Index.cshtml` (867 dòng) · **ActiveNav:** `Home` · **Reference:** `feed.html` + `feed.css` + `feed-demo.js` (mọi tương tác; đầu file ghi rõ API).

### 1.1 Bố cục
```
Desktop ≥1100:  [rail] ─────── [ cột bài 560 ] ── 40px ── [ cột phụ 312, sticky ] ───────
                                 Tin 24h (hàng tròn)          Đặng Khoa · Hồ sơ
                                 Ô tạo bài thu gọn            Việc cần làm (3)
                                 (nút "N bài mới" dính)        ├ thẻ mời phỏng vấn
                                 Bài · Bài · Bài …            ├ thẻ lời mời kết bạn ×2
                                 "Bạn đã xem hết bài mới"      Gợi ý kết bạn
                                                              Việc phù hợp với bạn
                                                              ● 128 việc · 5 bạn online
768–1099:  một cột 560 căn giữa; "Việc cần làm" chèn sau bài 1, "Gợi ý kết bạn" sau bài 3 (thẻ cuộn ngang)
≤767:      thanh đầu "Aris" + nút Tạo bài (ẩn khi cuộn xuống) · tin 24h · bài tràn mép · tab bar
```

### 1.2 Dữ liệu
| Khối | Nguồn |
|---|---|
| 10 bài mới nhất, đã thích chưa | **[CÓ API]** `Dashboard/Index` → `ViewBag.Posts`, `ViewBag.LikedPostIds`. Render server-side lần đầu (không chờ JS) — mỗi bài đúng markup `postHtml()` của reference. |
| Tải thêm, bài mới realtime | **[CẦN BACKEND]** `GET /Dashboard/GetPosts?before=&take=` · SignalR `NewPost`. Chưa có → sau 10 bài hiện dòng kết thúc "Bạn đã xem hết bài mới", **không** hiện nút "N bài mới". |
| Việc cần làm: lời mời phỏng vấn | **[CÓ API]** `GET /JobApplications/GetInterviewInvitations`; nhận lời/từ chối `POST RespondToInterview(applicationId, accept)`. Server cũng có `ViewBag.UpcomingInterview`. |
| Việc cần làm: lời mời kết bạn | **[CÓ API]** `GET /Friends/GetPendingRequests`; `POST AcceptRequest(requestId)` / `DeclineRequest(requestId)`. |
| Việc cần làm: chưa có CV | `ViewBag.HasCv == false` → thẻ "Bạn chưa có CV. Tạo CV để ứng tuyển bằng một cú bấm." + nút "Tạo CV" (`POST /Resume/CreateBlank` rồi mở builder). |
| Việc phù hợp | **[CÓ API]** `ViewBag.RecentJobs` (3 việc) hoặc `GET /Jobs/GetAiRecommendations?topK=3`. |
| Số liệu trực tiếp | **[CÓ API]** `GET /Dashboard/GetLiveStats` → `{ activeJobCount, onlineFriendsCount }` mỗi 30 giây, `rollNumber`. |
| Gợi ý kết bạn, Tin 24h, Lưu, Bình chọn, Trả lời/Thích bình luận, Theo dõi công ty, Ẩn/Báo cáo, Đăng lại, Gắn việc làm vào bài, Ai được xem | **[CẦN BACKEND]** — ẩn tới khi có API. |

### 1.3 Tương tác (đủ danh sách — chi tiết hành vi trong `feed-demo.js`)
1. **Thích** — nút tim / nhấn đúp ảnh / phím L → lạc quan; tim đỏ `--like` nảy spring; dòng "Được thích bởi bạn và 45 người khác" lăn số. **[CÓ API]** `POST /Dashboard/ToggleLike(postId)` → `{ liked, likeCount }`: nếu khác trạng thái lạc quan → đồng bộ theo server.
2. **Bình luận nhanh** dưới bài: nút "Đăng" hiện khi có chữ; Enter gửi (bỏ qua IME). **[CÓ API]** `POST /Dashboard/AddComment(postId, content)` → `{ commentCount, comment }`; bình luận mới vào xem trước (FLIP) + nháy; "Xem tất cả N bình luận" lăn số.
3. **Modal bình luận** (nút bình luận / "Xem tất cả" / phím C): desktop ảnh | bình luận, mobile bottom sheet. Tải **[CÓ API]** `GET /Dashboard/GetComments?postId=` (skeleton 3 dòng). Cảm xúc nhanh chèn vào ô. Trả lời/thích bình luận **[CẦN BACKEND]**.
4. **Gửi cho bạn bè** (máy bay giấy): danh sách **[CÓ API]** `GET /Friends/GetFriends`; chọn nhiều + lời nhắn → gửi **[CÓ API]** `ArisChat.sendMessage(friendId, "lời nhắn\n" + linkBài)` cho từng người; toast "Đã gửi cho 2 người · Mở tin nhắn". "Sao chép liên kết" (clipboard). "Chia sẻ khác" (`navigator.share`).
5. **Menu …** — bài của mình: Sửa (tại chỗ, **[CÓ API]** `POST /Dashboard/EditPost(id, content, title)`), Xoá (+ Hoàn tác, **[CÓ API]** `DELETE /Dashboard/DeletePost/{id}` sau 6 giây), Sao chép liên kết. Bài người khác: Gửi cho bạn bè, Sao chép liên kết, Nhắn tin cho …, và các mục **[CẦN BACKEND]**.
6. **Tạo bài** (ô thu gọn, nút rail, phím N, `#compose`): 3 bước như reference. Gửi **[CÓ API]** `POST /Dashboard/CreatePost` (`multipart/form-data`: `content`, `title`, `mediaFiles[]` theo **thứ tự đã kéo-thả**) → `{ success, data }` → chèn đầu bảng tin bằng FLIP + nháy viền. Tỉ lệ khung chỉ ảnh hưởng hiển thị trước khi có **[CẦN BACKEND]** lưu tỉ lệ (tạm dùng 4:5 cho ảnh dọc, 1:1 cho vuông theo kích thước ảnh).
7. **Thẻ hồ sơ khi hover** tên/avatar: Nhắn tin (`/Chat/Index?userId=`), Kết bạn **[CÓ API]** `POST /Friends/SendRequest(userId)` (+ Hoàn tác → `CancelRequest`).
8. **Việc cần làm**: Nhận lời phỏng vấn → morph ✓ → thẻ đổi thành "Đã nhận lời · Thêm vào lịch" (tải file `.ics` tạo ở client, xem `icsUrl()`); Từ chối → gỡ + Hoàn tác, API gọi sau 6 giây. Lời mời kết bạn: Chấp nhận → "Đã là bạn bè · Nhắn tin"; Xoá → gỡ + Hoàn tác. Badge đếm lăn số.
9. Phím tắt J/K/L/C/S/←→/N/? (README 5.6). Kéo để làm mới trên mobile (chỉ khi có API tải bài mới).

### 1.4 Trạng thái
Đang tải lần đầu: server render sẵn — không skeleton. Không có bài (tài khoản mới): thẻ trống "Bảng tin của bạn còn trống…" + Tìm bạn bè / Xem việc làm + gợi ý (khi có API) — xem `?empty`. Lỗi thích/bình luận: README 7.1. Ảnh lỗi: nền `--field` + icon `image-off`.

### 1.5 Giữ / bỏ
- **Bỏ:** quả địa cầu 3D, `three.min.js`, `aris-earth*.js`, hero chào, chip thống kê hero, `aris-dashboard.js` (ô soạn cũ `#postForm`, `#postInput`… — thay bằng hộp tạo bài mới; grep view trước khi xoá tham chiếu).
- **Giữ:** hành vi `post-actions.js` trên trang Hồ sơ (class `.edit-post-btn`, `.delete-post-btn`, `[data-post-id]`, `.post-content-text`) — nhưng thay `confirm/alert` bằng mẫu Hoàn tác/toast (xem 8.4).

---

## 2. Việc làm

**View:** `Views/Jobs/Index.cshtml` (1.715 dòng `<style>` inline → chuyển ra `css/pages/jobs.css`), `_JobCardPartial.cshtml` · **ActiveNav:** `Jobs` · **Reference:** `jobs.html`.

### 2.1 Bố cục (ứng viên)
```
[rail] [ cột danh sách 440 (canvas) ][ sheet chi tiết ]
        Việc làm  128 việc đang tuyển    ┌ thanh gọn khi cuộn: logo · tiêu đề · [Ứng tuyển] ┐
        [ô tìm: Chức danh, kỹ năng…]    logo 56 · Tiêu đề 22 · Công ty · Quận, TP
        (Địa điểm ▾)(Ngành nghề ▾)(Hình thức ▾)   tag lương · hình thức · ngành · đăng lúc
        12 kết quả   Xoá bộ lọc    ⇅ Mới nhất   [Ứng tuyển] [chia sẻ]  Hạn nộp 26/11 · còn 61 ngày
        ▌hàng job đang chọn                     Mô tả · Yêu cầu · Quyền lợi
         hàng job …                              thẻ công ty ›
         skeleton khi tải thêm
Tablet: cột 360. Mobile: chỉ danh sách; chạm → chi tiết trượt từ phải, thanh Ứng tuyển cố định đáy.
```

### 2.2 Dữ liệu
- Trang đầu: **[CÓ API]** `Jobs/Index(q, location, category, workMode, sort)` render server-side (hàng job + chi tiết job đầu tiên).
- Lọc/sắp xếp/tải thêm: **[CÓ API]** `GET /Jobs/GetJobs?skip&take&q&location&category&workMode&sort` → HTML `_JobCardPartial` (hoặc JSON `{success:false}` khi hết). **Viết lại `_JobCardPartial` thành markup hàng job của reference** (`.a-row.job-row`, có `data-id`).
- Số đếm trong popover bộ lọc: **[CẦN BACKEND]** (facet count). Chưa có → ẩn số đếm, giữ phần còn lại.
- Xem trước chi tiết: **[CÓ API]** `GET /Jobs/Details/{id}` (trang đầy đủ) → lấy vùng `[data-job-detail]`. Trong `Jobs/Details.cshtml` bọc nội dung chi tiết bằng `<div data-job-detail>` để dùng lại (trang riêng + xem trước).
- Đã ứng tuyển chưa: **[CÓ API]** `GetApplyModal(jobId)` trả `application` (null nếu chưa).

### 2.3 Tương tác
Theo `jobs-demo.js`: chip lọc mở popover (đổi là ra kết quả, FLIP, số kết quả lăn); "Xoá bộ lọc"; sắp xếp (ghost ở dòng kết quả); empty state bỏ từng điều kiện; tải thêm bằng skeleton; chọn job → chi tiết đổi tại chỗ + URL `?job=`; J/K/↑↓; A = Ứng tuyển; thanh gọn khi cuộn chi tiết; Ứng tuyển → hộp thoại (mục 4) → xong thì logo bay vào rail "Ứng tuyển" (`flyTo`) + chip "Đã ứng tuyển · vừa xong" + hàng job ghi "· Đã ứng tuyển". Chia sẻ → popover: Sao chép liên kết · Gửi cho bạn bè (giống Bảng tin) · (Business) Đăng lên Facebook/Zalo qua `GetShareOptions/ShareJob`.
Lưu việc **[CẦN BACKEND]** — không hiện nút.

### 2.4 Doanh nghiệp (Role = Business) mở `Jobs/Index`
Trang này đổi thành **"Việc đã đăng"**: danh sách tin của mình (trên canvas: tiêu đề, trạng thái đang mở/đã đóng, số ứng viên, hạn) | sheet: chi tiết tin + nút "Sửa", công tắc "Đang tuyển" (**[CÓ API]** `ToggleJobActive(id)`, lạc quan), "Xem ứng viên (12)" → `Employer/Index?job=`. Nút primary pagehead "Đăng tin tuyển dụng" → hộp thoại soạn tin (mục 10.4). **Trước khi làm: đọc toàn bộ phần Business của `Jobs/Index.cshtml` hiện tại, liệt kê mọi hành động (tạo, sửa `GetJobPostingForEdit/UpdateJobPosting`, bật/tắt, chia sẻ, trích xuất từ PDF, quản lý ứng viên `?jobId=`…) vào báo cáo. Không được mất hành động nào.**

---

## 3. Chi tiết việc làm (trang riêng)

**View:** `Jobs/Details.cshtml` (612 dòng) · mở khi vào thẳng link `/Jobs/Details/{id}` hoặc từ tìm nhanh.
- Kiểu B, sheet rộng tối đa 760px căn trái trong `.a-page`, cột phải 300px (≥1100px): thẻ công ty (logo 44, tên, quy mô, "N việc đang tuyển", nút "Xem công ty") + "Việc tương tự" (3 hàng job, cùng ngành).
- Nội dung chính = đúng vùng `[data-job-detail]` của mục 2 (tiêu đề, tag, hành động, Mô tả/Yêu cầu/Quyền lợi). Thanh gọn khi cuộn (logo + tiêu đề + Ứng tuyển) dính đỉnh trang.
- Header trang: nút ‹ "Việc làm" (quay lại danh sách, giữ bộ lọc nếu đến từ đó: `history.back()` khi `document.referrer` cùng trang Việc làm).
- Mobile: thanh "Ứng tuyển" cố định đáy (README Bẫy 10.1!).
- Việc đã đóng (`isActive == false`): tag trạng thái "Đã ngừng tuyển" (`.a-status`), không có nút Ứng tuyển, gợi ý "Việc tương tự" lên đầu.

---

## 4. Hộp thoại ứng tuyển

**Nguồn:** `jobs-demo.js` `openApply`. **[CÓ API]** `GET /JobApplications/GetApplyModal?jobId=` → `{ resumes[], screeningQuestions[], application }`; gửi `POST /JobApplications/Apply?jobId=` body JSON `{ ResumeId, CoverLetter, ScreeningAnswers[] }`.

- Tiêu đề "Ứng tuyển"; thẻ việc (logo, tiêu đề, công ty · thành phố) nền `--field`.
- "Chọn CV gửi kèm": thẻ CV chọn một (thumbnail giấy, tên, "Cập nhật 3 ngày trước · Tạo bằng trình dựng CV" / "Tải lên 18/08 · PDF, 214 KB"), CV mới nhất chọn sẵn; chấm radio nảy spring. Không có CV → thay bằng thẻ trống "Bạn chưa có CV" + nút "Tạo CV" (mở builder tab mới) + "Tải CV lên" (nếu có API upload — hiện chưa có trong luồng này, xem `BACKEND.md`).
- **Câu hỏi sàng lọc** (reference chưa có — bổ sung): nếu `screeningQuestions` không rỗng, mỗi câu là một `.a-field` với `.a-textarea` 2 dòng, nhãn = câu hỏi, bắt buộc (lỗi khi trống: "Hãy trả lời câu hỏi này"). Đặt giữa "Chọn CV" và "Lời nhắn".
- "Lời nhắn cho nhà tuyển dụng (không bắt buộc)": textarea 3 dòng, đếm `0/500` lăn số.
- Chân: Huỷ · **Gửi hồ sơ** (`morphButton`). Thành công → thân hộp thoại co giãn sang màn "Đã gửi hồ sơ tới TechNova" (✓ tự vẽ) + "Xem đơn ứng tuyển" / "Xong". Lỗi → nút rung + toast, giữ nguyên dữ liệu đã nhập.
- Đã ứng tuyển rồi (`application != null`): không mở hộp thoại; nút trên trang là chip "Đã ứng tuyển · 12/09" + link "Xem đơn".

---

## 5. Tin nhắn

**View:** `Views/Chat/Index.cshtml` (1.772 dòng `<style>`; tự dựng `<head>` riêng, nạp Bootstrap CDN → phải chuyển sang `_AppLayout` và `~/lib/bootstrap`) · **ActiveNav:** `Network` · **Reference:** `chat.html` + `chat.css` + `chat-demo.js` (đầy đủ nhất trong các reference).

### 5.1 Map sang `chat-client.js` (giữ nguyên file này, chỉ thay phần giao diện gọi nó)
| Việc | Gọi |
|---|---|
| Danh sách hội thoại | **[CÓ API]** `GET /Chat/GetConversations` → `[{ userId, username, avatar, lastMessage, lastMessageAt, isMine, unreadCount, isOnline }]` |
| Mở hội thoại | `GET /Chat/GetMessages?userId=` → `{ messages: [{ id, senderId, content, imageUrl, isForwarded, sentAt, isRead, replyTo{…} }], partner{ id, username, avatar, isOnline } }` |
| Gửi | `ArisChat.sendMessage(receiverId, content, replyToMessageId, imageUrl)` |
| Chuyển tiếp · Thu hồi | `ArisChat.forwardMessage(receiverId, sourceMessageId)` · `ArisChat.deleteMessage(messageId)` |
| Đang gõ · Đã đọc · Online | `ArisChat.typing(receiverId)` (tối đa 1 lần/2 giây) · `markAsRead(otherUserId)` khi hội thoại đang mở và cửa sổ đang focus · `isOnline(userId)` |
| Nhận sự kiện | `ReceiveMessage`, `PresenceChanged`, `UserTyping`, `MessagesRead`, `MessageDeleted`, `ReceiveNotification`; `onreconnecting` / `onreconnected` → dải trạng thái kết nối |
| Ảnh | `POST /Chat/UploadChatImage` → url → `sendMessage(…, imageUrl)`; bong bóng ảnh hiện ngay với nét quỹ đạo tiến trình |
| Tìm người / bạn bè / lời mời | `GET /Chat/SearchUsers?q=` (`friendStatus: none | pending_sent | pending_received | accepted`) · Friends API (segmented "Đoạn chat · Bạn bè · Lời mời") |
| Gọi video | `VideoCallHub`: `JoinChatCall`, `SendChatSignal`, `LeaveChatCall`, `DeclineChatCall` — giữ logic WebRTC hiện có, chỉ đổi giao diện theo reference (lan tròn từ nút gọi, PiP kéo-thả bám góc, tự ẩn điều khiển, thẻ cuộc gọi đến) |

### 5.2 Hành vi phải có (đã chạy trong reference)
Gom nhóm tin (cùng người, < 5 phút, cùng ngày; bo 18/6px) · nhãn ngày dính theo từng ngày (`section.m-dayblock`) · vạch "Tin nhắn mới" · trả lời/trích dẫn (bấm trích dẫn → nhảy + nháy) · chuyển tiếp (dialog chọn người) · thu hồi (tin của mình) · sao chép · ảnh + lightbox · "đã xem" trượt · đang gõ · nút xuống cuối có badge · ngăn thông tin (View Transition) + tìm trong hội thoại + ảnh đã chia sẻ (lightbox bộ sưu tập ← →) · mất kết nối · mobile danh sách ↔ hội thoại · Enter gửi / Shift+Enter xuống dòng / bỏ qua IME (README 7.8) · Alt+↑/↓ đổi hội thoại.
**Giữ id/class mà `aris-messenger.js` dùng** (`[data-user-id]`, `#backToConversations`, `#threadActive`, `#userSearchInput`, `.messenger-shell`) hoặc viết lại file đó cùng lúc và ghi vào báo cáo.

---

## 6. Đơn ứng tuyển của tôi

**View:** `JobApplications/MyApplications.cshtml` + `_MyApplicationsPartial.cshtml` (cũng được chèn vào tab của Hồ sơ) · **ActiveNav:** `Applications` (mới) · **[CÓ API]** `MyApplications()`, `Withdraw(applicationId)`, `GetInterviewInvitations`, `RespondToInterview`.

### 6.1 Bố cục — "dòng quỹ đạo"
```
Đơn ứng tuyển   7 đơn · 2 đang chờ bạn phản hồi                         [Tìm việc khác]
(Tất cả 7)(Đang xử lý 4)(Phỏng vấn 1)(Kết thúc 2)        ← segmented, đếm lăn số
┌ logo · Frontend Developer (React) · TechNova ─────────────── Mời phỏng vấn ● ┐
│ ●───●───●───◐───○        Đã nộp 12/09 → Đang xem xét → Rút gọn → Phỏng vấn → Offer │
│ Phỏng vấn 14:00 thứ Ba 30/09 · Trực tuyến   [Nhận lời] [Từ chối]  [Thêm vào lịch] │
│ Ghi chú từ nhà tuyển dụng: "…"                                      Rút đơn …    │
└──────────────────────────────────────────────────────────────────────────────────┘
```
- Mỗi đơn là một `.a-card` (đối tượng) có **dòng tiến trình** 5 chấm nối bằng nét: Đã nộp → Đang xem xét → Rút gọn → Phỏng vấn → Offer. Chấm đã qua đặc brand, hiện tại có vòng (`◐`), chưa tới rỗng `--line-control`. Nét giữa các chấm đã qua **vẽ dần** khi thẻ lọt vào màn hình lần đầu (stroke-dashoffset, 480ms, một lần) — nét quỹ đạo của logo làm hình nét.
- Từ chối: dòng dừng ở bước cuối cùng đạt được, chấm cuối đổi thành ✕ màu danger, `.a-status--danger` "Không phù hợp" + lý do (`statusNote`) nếu có. Đã rút: toàn thẻ `--text-3`, trạng thái mặc định "Đã rút đơn".
- Mời phỏng vấn chờ phản hồi: dải hành động Nhận lời / Từ chối ngay trong thẻ (giống Bảng tin). Đã nhận lời: "Thêm vào lịch" (.ics) + nếu `isVideoCall` → nút "Vào phòng phỏng vấn" (`Interview/Room/{id}`) hiện từ 10 phút trước giờ hẹn, có chấm live accent khi phòng đang mở.
- Segmented lọc tại chỗ (FLIP), URL `?tab=`.
- **Rút đơn** (`.withdraw-application-btn`, giữ class) → **hộp xác nhận** (không hoàn tác được): "Rút đơn ứng tuyển Frontend Developer? Nhà tuyển dụng sẽ không còn thấy hồ sơ này." · Giữ đơn · Rút đơn (danger). Thành công → thẻ `removeFrom` + toast. Viết lại `application-actions.js`: bỏ `confirm/alert`, giữ selector.
- Trống: "Bạn chưa ứng tuyển việc nào. Việc phù hợp với hồ sơ của bạn:" + 3 hàng job.

---

## 7. CV của tôi

**View:** `Resume/Index.cshtml` + `_MyCvsPartial.cshtml` (cũng ở tab Hồ sơ) · **ActiveNav:** `Resume` (mới) · **[CÓ API]** `CreateBlank`, `RenameResume(resumeId, label)`, `DeleteResume(resumeId)`, `OpenCv(url)`; builder `wwwroot/cv-builder/` (**không sửa**).

- Header: "CV của tôi · 3 CV" + primary "Tạo CV mới" (→ `CreateBlank` → mở builder).
- Lưới thẻ CV (`auto-fill, minmax(220px, 1fr)`): hình thu nhỏ trang giấy tỉ lệ A4 (ảnh xem trước nếu có, không thì khung giấy với các vạch như `.cv-card__thumb`), tên CV (sửa **tại chỗ**: bấm tên hoặc nút bút → ô nhập cùng chỗ, Enter lưu, Esc huỷ; lạc quan), dòng phụ "Cập nhật 3 ngày trước · Tạo bằng trình dựng CV" / "Tải lên · PDF 214 KB", menu …: Mở, Đổi tên, Tải xuống, Xoá.
- Thẻ là `.a-card--interactive`; bấm thẻ = mở CV (builder hoặc `OpenCv`).
- **Xoá** = mẫu Hoàn tác (README 7.1): thẻ `removeFrom`, toast 6 giây, gọi `DeleteResume` khi hết giờ. Viết lại `resume-actions.js`: bỏ `prompt/confirm/alert`, giữ `.rename-resume-btn`, `.delete-resume-btn`, `.resume-card[data-resume-id]`, `.resume-label`.
- Thẻ "Tạo CV mới" dạng khung nét đứt ở cuối lưới (giống `.cm-add`).
- Trống: "Bạn chưa có CV nào. Tạo CV trong 5 phút từ hồ sơ có sẵn để ứng tuyển bằng một cú bấm." + Tạo CV.

---

## 8. Hồ sơ

**View:** `Profile/Index.cshtml` (950 dòng; tab Bài viết / CV / Đơn ứng tuyển nạp qua AJAX; modal thêm liên hệ; gọi AiCore `process-cv-full`) · **ActiveNav:** `Profile` (không mục rail nào sáng; mục "Tôi" trên tab bar mobile).

### 8.1 Bố cục
```
[rail] .a-page
  ┌ đầu hồ sơ (không phải hero) ───────────────────────────────────────────┐
  │ avatar 96 (bấm → đổi ảnh)  Đặng Khoa                          [Chia sẻ hồ sơ] │
  │                            Frontend Developer · TP.HCM                        │
  │                            ● Đang tìm việc · 124 bạn bè                       │
  └────────────────────────────────────────────────────────────────────────┘
  (Tổng quan)(Bài viết 12)(CV 3)(Đơn ứng tuyển 7)     ← .a-tabs + The Line, URL #tab
  Tổng quan:  mục lục dính bên phải (Giới thiệu · Mong muốn · Học vấn · Liên hệ)
     Giới thiệu     — đoạn văn, bấm "Sửa" → sửa tại chỗ (UpdateBio)
     Mong muốn công việc — chip vị trí/địa điểm/hình thức/mức lương (UpdatePreferences)
     Học vấn        — hàng: trường · ngành · năm
     Liên hệ        — hàng icon + giá trị + nút sao chép; "Thêm liên hệ" (AddContact, dialog)
```
- **Không ảnh bìa mặc định** (bỏ ảnh gradient Unsplash ở `Profile/Index.cshtml:13`). Nếu người dùng đã tải ảnh bìa (`UpdateCoverPhoto`): dải ảnh 3:1 bo 16 ở đầu trang, avatar **không đè** lên ảnh (đặt bên dưới).
- Avatar: bấm → chọn ảnh → xem trước ngay (lạc quan) → **[CÓ API]** `POST /Settings/UpdateAvatar` (multipart `avatar`) → lỗi thì trả ảnh cũ + toast. Cập nhật luôn avatar trên rail.
- Mỗi mục sửa tại chỗ (README 7.4): bút chì ghost cạnh tiêu đề mục, `morphButton` khi lưu. Tab Bài viết dùng markup bài của Bảng tin (thu gọn, không có hàng tin 24h).
- Tab CV / Đơn ứng tuyển: nhúng đúng partial của mục 6, 7 (đã viết lại).
- "Tải CV lên để tự điền hồ sơ" (AiCore `process-cv-full`): vùng thả tệp như `.cm-drop`, tiến trình bằng nét quỹ đạo, kết quả → danh sách trường được điền để người dùng **xác nhận từng mục** trước khi lưu.
- **Không có hồ sơ công khai của người khác** (`ProfileController.Index()` không nhận id) → thẻ hover chỉ dẫn tới Nhắn tin; nút "Xem hồ sơ" **[CẦN BACKEND]** (`Profile/View/{id}`).

### 8.2 Viết lại `post-actions.js`
Giữ selector (`.delete-post-btn`, `.edit-post-btn`, `[data-post-id]`, `.post-content-text`). Sửa bài: sửa tại chỗ theo `startEdit()` của `feed-demo.js`. Xoá: mẫu Hoàn tác. Bỏ `confirm/alert`, bỏ class Bootstrap/`rounded-pill`.

---

## 9. Cài đặt

**View:** `Settings/Index.cshtml` (310 dòng) + `SocialConnect/SelectFacebookPage.cshtml` · **ActiveNav:** `Settings`.

```
Cài đặt                                               mục lục dính: Tài khoản · Quyền riêng tư · Giao diện · Thông báo · Mẫu từ chối* · Kết nối mạng xã hội* · Vùng nguy hiểm
Tài khoản       Ảnh đại diện  [avatar 72] Đổi ảnh · Xoá      (UpdateAvatar)
                Tên hiển thị  [ô nhập]                         (UpdateUsername)
                Email         khoa@…  (chỉ đọc, đăng nhập bằng liên kết email)
Quyền riêng tư  Hiện trạng thái hoạt động  [công tắc]          (UpdateActiveStatus — lưu ngay)
Giao diện       (Sáng)(Tối)(Theo hệ thống)                     (localStorage; setTheme)
Mẫu từ chối*    danh sách mẫu (kéo-thả sắp xếp, sửa tại chỗ, xoá + Hoàn tác, "Thêm mẫu")   (Get/UpdateRejectionTemplates)
Kết nối*        Facebook Page · Zalo OA …                      (SocialConnect)
Vùng nguy hiểm  Đăng xuất khỏi mọi thiết bị [CẦN BACKEND] · Xoá tài khoản [CẦN BACKEND]
* chỉ Business
```
- Kiểu B, form theo mục, **thanh "Có thay đổi chưa lưu"** (README 7.4) cho Tên hiển thị + Mẫu từ chối; công tắc và giao diện lưu ngay.
- Giữ id JS hiện có hoặc viết lại script cùng lúc: `#avatarInput`, `#avatarPreview`, `#usernameInput`, `#saveUsernameBtn`, `#activeStatusToggle`, `#rejectionTemplateList`, `#addTemplateBtn`, `#saveTemplatesBtn`, `#templatesStatus`, `#avatarStatus`, `#usernameStatus` (các `*Status` thay bằng `.a-help`/`.a-error` dưới ô + toast).
- Mẫu từ chối dùng `ArisMotion.sortable(axis:'y')`.
- Bỏ nền tối cứng (`text-white`, `background: rgb…`) trong view hiện tại.

---

## 10. Tuyển dụng (doanh nghiệp)

**View:** `Employer/Index.cshtml` (316 dòng — hiện là **hàng 4 ô KPI + bảng**, bị cấm) · **ActiveNav:** `Employer` · **[CÓ API]** `GetApplicantsForJob(jobId, status)`, `UpdateApplicationStatus(applicationId, {Status, Note})`, `ScheduleInterview(applicationId, {ScheduledAt, Location, Note, IsVideoCall})`, `GetRejectionTemplates`, `ToggleJobActive`, `OpenCv`.

### 10.1 Bố cục — pipeline kéo-thả (kiểu A)
```
[rail] [ tin tuyển dụng (canvas, 300) ][ sheet: pipeline của tin đang chọn                                        ]
        Tuyển dụng                     Frontend Developer (React) · 42 ứng viên · còn 12 ngày   [Chia sẻ][Sửa tin]
        3 tin đang mở · 7 mới/7 ngày   ┌Đã nộp 12┐┌Đang xem 8┐┌Rút gọn 5┐┌Phỏng vấn 3┐┌Offer 1┐┌Từ chối 13┐
        [Đăng tin tuyển dụng]          │ thẻ ƯV  ││          ││         ││            ││        ││ (thu gọn) │
        ▌Frontend Developer   42  ●mới │ thẻ ƯV  ││          ││         ││            ││        ││           │
         QA Engineer          17       │ …       ││          ││         ││            ││        ││           │
         (Đã đóng) Kế toán     9       └─────────┘└──────────┘└─────────┘└────────────┘└────────┘└───────────┘
```
- Meta pagehead thay 4 ô KPI: "3 tin đang mở · 42 ứng viên · 7 mới trong 7 ngày" (số lăn khi đổi).
- Cột = `JobApplicationStatus`: `Submitted` Đã nộp · `UnderReview` Đang xem xét · `Shortlisted` Rút gọn · `InterviewScheduled` Phỏng vấn · `Offered` Offer · `Rejected` Từ chối (cột hẹp, thu gọn mặc định, bấm để mở). `Withdrawn` không có cột — hiện mờ ở cột cũ với nhãn "Đã rút đơn", không kéo được.
- **Thẻ ứng viên** (`.a-card`, 100% cột): avatar 32 + tên + `jobTitle` · "Nộp 3 ngày trước" · cờ "Ứng tuyển 2 lần" (`applicationCount > 1`, `.a-tag`) · lịch phỏng vấn nếu có (`interviewAt`, `interviewResponse`: Chờ phản hồi / Đã nhận lời / Đã từ chối). Mới (chưa xem) → chấm accent.
- **Kéo thẻ sang cột khác** = đổi trạng thái (lạc quan): thẻ bay theo con trỏ (`.is-dragging`), cột đích sáng nền `--brand-soft` khi thẻ ở trên, thả → thẻ vào cột (FLIP), số đếm 2 cột lăn, gọi `UpdateApplicationStatus`; lỗi → thẻ trượt về cột cũ + toast. Hoàn tác 6 giây trong toast ("Đã chuyển Lê Thu Hà sang Rút gọn · Hoàn tác").
  - Thả vào **Từ chối** → trước khi gọi API mở hộp thoại "Lý do từ chối" (mẫu từ `GetRejectionTemplates` dạng thẻ chọn một + ô sửa tự do) → gửi làm `Note`. Huỷ → thẻ về chỗ cũ.
  - Thả vào **Phỏng vấn** → hộp thoại "Hẹn phỏng vấn": ngày (input date), giờ, Trực tuyến qua Aris (công tắc `IsVideoCall`) / Địa điểm, Ghi chú → `ScheduleInterview`.
  - Bàn phím: focus thẻ, Alt+←/→ đổi cột (cùng luồng hộp thoại).
  - Kéo giữa cột: `sortable` chỉ cho một danh sách; pipeline cần bản mở rộng nhiều vùng thả — tự viết theo cùng quy tắc (bám con trỏ, FLIP, chặn click sau kéo, Alt+mũi tên), đặt trong `css/pages/employer.css` + `js/pages/employer.js`.
- **Bấm thẻ** → ngăn chi tiết trượt từ phải (như ngăn thông tin của Tin nhắn, 380px): thư giới thiệu, câu trả lời sàng lọc (từng câu hỏi + trả lời), CV (`resumeName` → mở `OpenCv`), email, lịch sử trạng thái (`statusNote`), hành động: Nhắn tin · Hẹn phỏng vấn · Chuyển trạng thái (menu) · Từ chối.
- Trống (chưa có ứng viên): "Chưa có ai ứng tuyển tin này. Chia sẻ tin lên Facebook, Zalo hoặc gửi cho bạn bè để có ứng viên sớm hơn." + Chia sẻ.

### 10.2 Tin tuyển dụng (cột trái)
Hàng tin: tiêu đề, số ứng viên, chấm accent nếu có ứng viên mới, tag "Đã đóng" (mờ). Menu …: Sửa · Bật/tắt tuyển (`ToggleJobActive`, lạc quan) · Chia sẻ (`GetShareOptions`/`ShareJob`, có kênh tự đăng Facebook/Zalo) · Xem trang tin.

### 10.3 Mobile
Danh sách tin → chạm → pipeline dạng **cột trượt ngang** (scroll-snap từng cột, segmented tên cột ở trên đi theo); kéo-thả thay bằng menu "Chuyển sang…" trên thẻ.

### 10.4 Soạn / sửa tin tuyển dụng
Hộp thoại lớn (hoặc trang) với các mục: Tiêu đề, Ngành, Hình thức, Địa điểm (nhiều), Lương (từ–đến / Thoả thuận), Hạn nộp, Mô tả / Yêu cầu / Quyền lợi (textarea tự giãn), Câu hỏi sàng lọc (danh sách kéo-thả sắp xếp). **Thả file PDF** tin tuyển dụng vào vùng đầu hộp thoại → **[CÓ API]** `ExtractJobFromPdf` → các ô tự điền **lần lượt** (mỗi ô nháy `highlight` khi được điền) để người dùng kiểm tra. Gửi `CreateJobPosting` / `UpdateJobPosting` (`GetJobPostingForEdit` để nạp). Sau khi đăng: hỏi "Chia sẻ tin này ngay?" với các kênh.

---

## 11. Công ty

**Views:** `Company/Index` (210 dòng), `Details` (239), `Edit` (210) · **ActiveNav:** `Companies`.

- **Danh sách** (`Index`): kiểu B. Ô tìm + chip lọc ngành/quy mô (lọc tại chỗ, FLIP). Hàng công ty (không phải lưới card lớn): logo 44, tên, ngành · quy mô · thành phố, "12 việc đang tuyển" (link), Theo dõi **[CẦN BACKEND]**. Thẻ hover logo/tên = thẻ công ty.
- **Chi tiết** (`Details`): đầu trang logo 72 + tên 22 + ngành · quy mô · website + hành động (Xem việc làm primary · Nhắn tin nhà tuyển dụng nếu có). Không ảnh bìa mặc định (có ảnh thật thì dải 3:1 như Hồ sơ). Tabs + The Line: Giới thiệu · Việc đang tuyển (N) (hàng job, bấm → `Jobs/Details` hoặc Việc làm `?job=`) · Hình ảnh (lưới ảnh + lightbox bộ sưu tập). Cột phải: thông tin nhanh (năm thành lập, quy mô, địa chỉ + nút sao chép).
- **Sửa** (`Edit`, Business): form theo mục + mục lục dính + thanh "Có thay đổi chưa lưu"; logo/ảnh bìa xem trước ngay; `POST Company/Edit` (`multipart`, `UpdateCompanyProfileDto`) — giữ `name` của field.

---

## 12. Đăng nhập / đăng ký

**Views:** `Account/Login.cshtml` (235), `Register.cshtml`, `_AuthLayout.cshtml` · kiểu D, **không rail**. Bỏ Three.js, `aris-auth-stage.js`, `aris-auth.css`.

```
                     (logo quỹ đạo 40 + "Aris")
                     Đăng nhập vào Aris
                     Nhập email, chúng tôi gửi liên kết đăng nhập — không cần mật khẩu.
                     [ Email                          ]
                     [        Gửi liên kết đăng nhập       ]   ← primary, block
                     ──────────── hoặc ────────────
                     [ G  Tiếp tục với Google        ]   ← secondary
                     [ f  Tiếp tục với Facebook      ]
                     Chưa có tài khoản? Đăng ký
                     (Development) Đăng nhập nhanh: [ứng viên mẫu] [doanh nghiệp mẫu]
```
- Một cột 400px căn giữa trên canvas. **Không có mật khẩu** (magic link) → không có ô mật khẩu, không có "thanh độ mạnh mật khẩu".
- Gửi **[CÓ API]** `POST Account/RequestMagicLink(email, returnUrl, returnView)`: `morphButton` → thành công: khối chuyển tại chỗ (co giãn chiều cao) sang "Kiểm tra hộp thư của bạn" + icon thư + "Đã gửi liên kết tới khoa@gmail.com. Liên kết có hiệu lực trong 15 phút." + "Mở Gmail" (nếu email @gmail.com) + "Gửi lại (sau 0:30)" đếm ngược + "Dùng email khác". `ConfirmMagicLink` lỗi/hết hạn → thông báo rõ + nút gửi lại.
- Google/Facebook: `GoogleLogin` / `FacebookLogin`. Logo nhà cung cấp là SVG chính thức đơn giản (ngoại lệ màu thương hiệu, chỉ trong nút này).
- Đăng nhập nhanh `QuickLogin/DirectLogin`: **chỉ hiện khi `Environment.IsDevelopment()`**, nhãn nhỏ `--text-3` "Chỉ có ở môi trường phát triển".
- Đăng ký: cùng khung, tiêu đề "Tạo tài khoản Aris", thêm chọn "Tôi tìm việc / Tôi tuyển dụng" (segmented) nếu luồng hiện tại có (`UpgradeToBusiness`) — kiểm view hiện tại trước.

## 13. Thông tin người dùng mới

**View:** `Account/NewUserInfor.cshtml` (498 dòng, tự dựng `<head>`) → dùng `_AuthLayout`. **[CÓ API]** `POST NewUserInfor(NewUserInforDTO)` — giữ nguyên `name` của mọi field.
- Nhiều bước trong một form (không tải lại trang): 1 Bạn là ai (tên, vị trí mong muốn) · 2 Học vấn (`EducationDTO`) · 3 Mong muốn công việc (chip chọn nhiều) · 4 Ảnh đại diện (tuỳ chọn).
- **Thanh tiến trình = nét quỹ đạo của logo** nằm ngang phía trên, vẽ dần tới bước hiện tại (stroke-dashoffset theo %, 480ms). Nhãn "Bước 2/4 · Học vấn".
- Chuyển bước: nội dung trượt ±24px + mờ (như hộp tạo bài), Tiếp/Quay lại; Enter = Tiếp; kiểm lỗi khi bấm Tiếp. Bước tuỳ chọn có "Bỏ qua". Cuối: "Vào Aris" → Bảng tin.

## 14. Phòng phỏng vấn

**View:** `Interview/Room.cshtml` (416 dòng, tự dựng `<head>`, Bootstrap CDN) → layout tối giản dùng chung token (nền tối cố định `#0E0F11` như cuộc gọi trong `chat.html?call=1`).
- Toàn màn: video người kia lớn (object-fit cover, bo 16, cách mép 8), video mình PiP 180×240 kéo-thả bám góc (hành vi y như reference chat). Thanh điều khiển nổi đáy: mic · camera · chia sẻ màn hình (nếu có) · tin nhắn · **Rời phòng** (danger-fill). Tự ẩn sau 3 giây không di chuột; hiện lại khi di chuột/chạm.
- Đầu: tên công ty + vị trí + đồng hồ thời lượng + chấm **live** accent (được `infinite`).
- Ngăn tin nhắn trượt từ phải 360px (dùng chat).
- Trạng thái: đang chờ người kia ("Đang chờ nhà tuyển dụng vào phòng…" + nét quỹ đạo), mất kết nối (dải cảnh báo + tự nối lại), không có quyền camera (hướng dẫn cấp quyền theo trình duyệt).
- Giữ nguyên logic WebRTC/SignalR (`VideoCallHub` Interview…).

## 15. Trang lỗi

**View:** `Home/Error.cshtml` → `_AppLayout` nếu đã đăng nhập (giữ rail), không thì `_AuthLayout`. Nội dung `.a-empty` căn giữa: icon `alert-triangle` · "Trang này không tồn tại" (404) / "Có lỗi phía máy chủ" (500) · câu giải thích · "Về Bảng tin" + "Thử lại" · mã yêu cầu (`RequestId`) nhỏ `--text-3` có nút sao chép. Không minh hoạ, không hố đen.

## 16. Chat widget

**View:** `_ChatWidget.cshtml` (908 dòng). README 5.7. Launcher 48px `--brand` icon `message-circle`, badge accent; popover 380×560 nở từ launcher, bên trong: header (tên + nút mở toàn trang `/Chat` + đóng), danh sách hội thoại ↔ hội thoại (trượt ngang như mobile Tin nhắn), composer Enter gửi (IME!). Ẩn trên `/Chat` và `Interview/Room`. Trên mobile ẩn hẳn (đã có tab Tin nhắn).
