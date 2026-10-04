# Aris Line V7 — tính năng cần backend mới

> Ngày 26/09/2026 chủ dự án cho phép thiết kế tính năng **cần backend mới**, với điều kiện ghi rõ. File này liệt kê **mọi** tính năng như vậy trong bộ thiết kế V7, kèm đề xuất API và dữ liệu.
> **Agent triển khai không tự làm mục nào ở đây.** Mỗi mục cần chủ dự án duyệt (đánh dấu ✅ vào cột "Duyệt"). Mục chưa duyệt → **ẩn** tính năng đó trên giao diện (không làm UI giả).
> Làm backend nghĩa là có **migration** — luật V7 cấm tạo migration trong lúc làm UI. Mục được duyệt sẽ làm ở **Phase B** riêng (xem `AGENT-PROMPT.md`), gom mọi thay đổi model lại, tạo migration **một lần** ở cuối, và chỉ chạy `dotnet ef migrations add` khi chủ dự án đã tắt app của họ (process của họ khoá `bin/Debug/net10.0/ArisSkyve.exe`).

> **QUYẾT ĐỊNH CỦA CHỦ DỰ ÁN (26/09/2026, qua Claude):** duyệt **mục 1–23**; **mục 24 (Xoá tài khoản) chưa duyệt** — cần chính sách dữ liệu bằng văn bản. Migration **chỉ được tạo** (kèm script SQL idempotent), **KHÔNG được áp vào DB** (`db47010` là SQL Server từ xa dùng chung). Thứ tự làm và cách kiểm thử: `ANTIGRAVITY-RUN.md`.

Quy ước API: MVC controller hiện có, trả `Json(new { success, … })` như các action đang có; cần `[Authorize]` + kiểm quyền sở hữu; POST có `[ValidateAntiForgeryToken]` nếu các action cùng controller đang dùng.

## Bảng tổng hợp

| # | Tính năng | Ở đâu | Ưu tiên | Chi phí | Duyệt |
|---|---|---|---|---|---|
| 1 | Tham số "Ai được xem" khi đăng bài | Bảng tin | P1 | Rất thấp (cột `IsPublic` **đã có**) | ✅ 26/09 |
| 2 | Tải thêm bài (phân trang) | Bảng tin | P1 | Thấp | ✅ 26/09 |
| 3 | "Được thích bởi [bạn bè]" | Bảng tin | P1 | Thấp | ✅ 26/09 |
| 4 | Thứ tự ảnh + tỉ lệ khung | Bảng tin | P1 | Thấp | ✅ 26/09 |
| 5 | Trả lời bình luận | Bảng tin | P1 | Thấp | ✅ 26/09 |
| 6 | Thích bình luận | Bảng tin | P1 | Thấp | ✅ 26/09 |
| 7 | Xoá bình luận | Bảng tin | P1 | Rất thấp | ✅ 26/09 |
| 8 | Lưu bài viết | Bảng tin | P1 | Thấp | ✅ 26/09 |
| 9 | Lưu việc làm | Việc làm | P1 | Thấp | ✅ 26/09 |
| 10 | Gợi ý kết bạn | Bảng tin | P1 | Trung bình | ✅ 26/09 |
| 11 | Thẻ người dùng (bạn chung) | Toàn app | P1 | Thấp | ✅ 26/09 |
| 12 | Bài mới realtime | Bảng tin | P2 | Trung bình | ✅ 26/09 |
| 13 | Tin 24 giờ | Bảng tin | P2 | Cao | ✅ 26/09 |
| 14 | Bình chọn | Bảng tin | P2 | Trung bình | ✅ 26/09 |
| 15 | Theo dõi công ty | Bảng tin, Công ty | P2 | Thấp | ✅ 26/09 |
| 16 | Đếm kết quả theo bộ lọc | Việc làm | P2 | Trung bình | ✅ 26/09 |
| 17 | Ẩn bài / Báo cáo bài | Bảng tin | P2 | Thấp | ✅ 26/09 |
| 18 | Nhắc tên (@) có thông báo | Bảng tin | P2 | Trung bình | ✅ 26/09 |
| 19 | Gắn việc làm vào bài (doanh nghiệp) | Bảng tin | P2 | Thấp | ✅ 26/09 |
| 20 | Hồ sơ công khai người khác | Hồ sơ | P2 | Trung bình | ✅ 26/09 |
| 21 | Đăng lại bài | Bảng tin | P3 | Trung bình | ✅ 26/09 |
| 22 | Trang theo #chủ đề | Bảng tin | P3 | Trung bình | ✅ 26/09 |
| 23 | Đăng xuất mọi thiết bị | Cài đặt | P3 | Thấp | ✅ 26/09 |
| 24 | Xoá tài khoản | Cài đặt | P3 | Cao (xoá dây chuyền) | ✗ chờ chính sách dữ liệu |

---

## Chi tiết

### 1. "Ai được xem" khi đăng bài
- Hiện trạng: `Post.IsPublic` có sẵn, nhưng `DashboardController.CreatePost` luôn đặt `IsPublic = true` và `Index` không lọc theo bạn bè.
- Thêm tham số `bool isPublic = true` vào `CreatePost`; `Index`/`GetPosts` chỉ trả bài `IsPublic || tác giả là bạn bè || tác giả là mình`. **Không cần migration.**

### 2. Tải thêm bài
- `GET /Dashboard/GetPosts?before={postId}&take=10` → `{ success, posts: [PostDto], hasMore }`.
- `PostDto` = đúng khuôn `data` mà `CreatePost` đang trả (`id, username, avatar, content, title, time, isArticle, media[{url,type}], likeCount, commentCount, isLiked`) + `createdAt` (ISO) + các trường của mục 3, 4, 8 khi có.
- Client: `IntersectionObserver` (README 7.6). `hasMore=false` → dòng "Bạn đã xem hết bài mới".

### 3. "Được thích bởi [bạn bè]"
- Thêm vào `PostDto`: `likedBy: [{ id, name, avatar }]` — tối đa 2 người **là bạn bè** của người xem đã thích, mới nhất trước. Một truy vấn gộp theo danh sách `postIds` (giống cách `LikedPostIds` đang làm).

### 4. Thứ tự ảnh + tỉ lệ khung
- Migration: `PostMedias.SortOrder int NOT NULL DEFAULT 0`; `Posts.AspectRatio nvarchar(8) NULL` (`'1:1' | '4:5' | '16:9'`).
- `CreatePost` nhận `aspectRatio` và lưu `SortOrder` theo thứ tự `mediaFiles` gửi lên. Client sắp xếp bằng `ArisMotion.sortable` trước khi gửi.

### 5. Trả lời bình luận
- Migration: `Comments.ParentCommentId int NULL` (FK tự tham chiếu, `ON DELETE NO ACTION`; chỉ 1 cấp: trả lời của trả lời gắn vào bình luận gốc).
- `AddComment(postId, content, parentCommentId?)`. `GetComments` trả thêm `parentCommentId`, `likeCount`, `isLiked`, `userId`.
- Thông báo cho tác giả bình luận gốc: "Lê Thu Hà đã trả lời bình luận của bạn".

### 6. Thích bình luận
- Migration: bảng `CommentLikes(CommentId, UserId, CreatedAt)`, khoá chính `(CommentId, UserId)`.
- `POST /Dashboard/ToggleCommentLike(commentId)` → `{ success, liked, likeCount }`.

### 7. Xoá bình luận
- `DELETE /Dashboard/DeleteComment/{id}` — người viết bình luận **hoặc** chủ bài được xoá. Giảm `Post.CommentCount` (và xoá luôn trả lời con nếu có mục 5). Client gọi sau 6 giây Hoàn tác.

### 8. Lưu bài viết
- Migration: `SavedPosts(UserId, PostId, CreatedAt)`, khoá `(UserId, PostId)`.
- `POST /Dashboard/ToggleSave(postId)` → `{ success, saved }`; `GET /Dashboard/Saved?before=&take=` (trang "Đã lưu" trong Hồ sơ). `PostDto.isSaved`.

### 9. Lưu việc làm
- Migration: `SavedJobs(UserId, JobPostingId, CreatedAt)`.
- `POST /Jobs/ToggleSave(id)` → `{ success, saved }`; `GET /Jobs/Saved`. Nút bookmark cạnh "Ứng tuyển"; phím S; chip lọc "Đã lưu".

### 10. Gợi ý kết bạn
- `GET /Friends/Suggestions?take=5` → `[{ id, name, avatar, headline, mutualCount, reason }]`. Nguồn: bạn của bạn bè (xếp theo `mutualCount`), cùng công ty/trường (`Profile.Education`). Loại: đã là bạn, đã gửi/nhận lời mời, đã bỏ qua.
- Migration: `DismissedSuggestions(UserId, SuggestedUserId, CreatedAt)`; `POST /Friends/DismissSuggestion(userId)`.

### 11. Thẻ người dùng (thẻ hover)
- `GET /Users/Card/{id}` → `{ id, name, avatar, headline, isOnline, friendStatus: 'none'|'pending_sent'|'pending_received'|'accepted', mutualCount, mutualSample: [{id,name,avatar}] }`. Client cache 5 phút theo id.

### 12. Bài mới realtime
- Khi `CreatePost` thành công: gửi SignalR `NewPost { postId, authorId, authorName, authorAvatar }` tới bạn bè của tác giả (dùng hub chat sẵn có, group theo userId như `ReceiveNotification`).
- Client gom lại, hiện nút "↑ N bài mới" (không tự chèn). Bấm → `GET /Dashboard/GetPosts?after={postIdMớiNhấtĐangCó}`.

### 13. Tin 24 giờ
- Migration: `Stories(Id, UserId, MediaUrl, MediaType, Caption nvarchar(80) NULL, LinkUrl NULL, LinkLabel NULL, CreatedAt, ExpiresAt)`; `StoryViews(StoryId, ViewerId, ViewedAt)`, khoá `(StoryId, ViewerId)`.
- `GET /Stories/Feed` → `[{ userId, name, avatar, isOrg, seen, items: [{ id, mediaUrl, caption, link: {url,label}?, createdAt }] }]` (của mình + bạn bè + công ty theo dõi, chưa hết hạn, nhóm theo người, người chưa xem hết lên trước).
- `POST /Stories` (multipart: `media`, `caption`, `linkUrl?`, `linkLabel?`) → `{ success, story }`. Ảnh ≤ 10 MB; video ngoài phạm vi V7.
- `POST /Stories/{id}/View` (gọi khi thanh tiến trình của tin đó bắt đầu chạy). `GET /Stories/{id}/Viewers` (chỉ chủ tin) → danh sách + số lượng.
- Trả lời tin = `ArisChat.sendMessage(ownerId, text)` kèm tham chiếu tin (thêm `storyId` vào tin nhắn: **thêm cột** `Messages.StoryId NULL` nếu muốn hiện ảnh tin trong chat).
- Job dọn dẹp: xoá file + bản ghi quá 48 giờ (dùng `BackgroundService` đơn giản — dự án chưa có hạ tầng hàng đợi).

### 14. Bình chọn
- Migration: `PostPolls(PostId PK/FK, Question nvarchar(140), EndsAt)`, `PollOptions(Id, PostId, Label nvarchar(60), SortOrder)`, `PollVotes(PollOptionId, UserId, CreatedAt)` + ràng buộc mỗi người 1 phiếu/bài (kiểm trong code hoặc bảng phụ `(PostId, UserId)` unique).
- `CreatePost` nhận `poll: { question, options[2..4], durationDays: 1|3|7 }`. `POST /Dashboard/Vote(postId, optionId)`; `DELETE /Dashboard/Vote(postId)` (rút phiếu). `PostDto.poll = { question, options:[{id,label,votes}], myOptionId, totalVotes, endsAt }`.

### 15. Theo dõi công ty
- Migration: `CompanyFollows(UserId, BusinessAccountId, CreatedAt)`.
- `POST /Company/ToggleFollow(id)` → `{ success, following, followerCount }`. Bài và tin 24h của công ty theo dõi vào Bảng tin; việc mới của công ty → thông báo.

### 16. Đếm kết quả theo bộ lọc
- `GET /Jobs/Facets?q&location&category&workMode` → `{ location: { 'TP.HCM': 12, … }, category: {…}, workMode: {…} }`. Mỗi nhóm đếm **bỏ qua bộ lọc của chính nhóm đó** (để biết chọn thêm sẽ ra bao nhiêu). Gọi lại mỗi khi bộ lọc đổi (debounce 180ms).

### 17. Ẩn bài / báo cáo
- Migration: `HiddenPosts(UserId, PostId, CreatedAt)`; `PostReports(Id, PostId, ReporterId, Reason nvarchar(40), Detail nvarchar(500) NULL, CreatedAt, Status)`.
- `POST /Dashboard/Hide(postId)` / `DELETE /Dashboard/Hide(postId)` (Hoàn tác). `POST /Dashboard/Report(postId, reason, detail)`; lý do: Spam · Lừa đảo tuyển dụng · Nội dung không phù hợp · Khác. Báo cáo cần hộp thoại chọn lý do (thay toast tạm trong reference).

### 18. Nhắc tên có thông báo
- Client gửi kèm `mentionIds: int[]` (id bạn bè đã chọn từ popover @) cùng `CreatePost`/`AddComment`/`EditPost`.
- Migration: `Mentions(Id, PostId NULL, CommentId NULL, MentionedUserId, CreatedAt)`. Tạo thông báo "Đặng Khoa đã nhắc đến bạn trong một bài viết". Hiển thị: server trả `mentions: [{ userId, name }]` để client tạo link chính xác (không dò tên bằng regex).

### 19. Gắn việc làm vào bài
- Migration: `Posts.JobPostingId int NULL` (FK). Chỉ tài khoản Business, chỉ việc của chính họ. `CreatePost` nhận `jobPostingId`. `PostDto.job = { id, title, salary, city, workMode, isActive }` → thẻ việc trong bài (reference `post-job`).

### 20. Hồ sơ công khai
- `GET /Profile/View/{id}` — bản chỉ đọc của `Profile/Index` (ẩn thông tin riêng: email, số điện thoại trừ khi người đó cho phép; ẩn tab CV/Đơn ứng tuyển). Nút "Xem hồ sơ" trên thẻ hover trỏ về đây.

### 21. Đăng lại bài
- Migration: `Posts.RepostOfId int NULL`. `POST /Dashboard/Repost(postId, content?)`. Bài đăng lại hiện "Đặng Khoa đã đăng lại" + bài gốc thu nhỏ bên trong (một cấp, không lồng tiếp).

### 22. Trang #chủ đề
- `GET /Dashboard/Tag?name=&before=` → các bài có hashtag. Cần bảng `PostTags(PostId, Tag)` được tách khi lưu bài.

### 23. Đăng xuất mọi thiết bị
- Đổi security stamp / xoá cookie phiên của người dùng; `POST /Account/SignOutEverywhere`. Kiểm cơ chế xác thực cookie hiện tại trước khi làm.

### 24. Xoá tài khoản
- `POST /Account/DeleteAccount` (xác nhận gõ "XOÁ"). Phải quyết định cùng chủ dự án: xoá hẳn hay ẩn danh hoá; xử lý tin nhắn, đơn ứng tuyển, tin tuyển dụng, bài viết, file đã tải lên (xem nơi lưu trong `DashboardController.UploadPostMediaAsync` và `Settings/UpdateAvatar`). **Không làm khi chưa có quyết định bằng văn bản.**
