# LỆNH CHẠY TỰ ĐỘNG — Antigravity triển khai toàn bộ Aris V7

> Chủ dự án (26/09/2026) giao **toàn bộ** việc triển khai V7 cho **Antigravity** chạy **tự động** trên máy của họ.
> File này **bổ sung và thắng** `AGENT-PROMPT.md` ở những điểm ghi dưới đây. Mọi luật khác của `AGENT-PROMPT.md` giữ nguyên.
> Thiết kế: `README.md` (hệ thiết kế) · `PAGES.md` (từng trang) · `BACKEND.md` (API mới) · `reference/*.html` (bản chạy được — **chuẩn về hình và hành vi**).

---

## 1. Quyết định đã có — KHÔNG hỏi lại

| Việc | Quyết định của chủ dự án |
|---|---|
| Người làm | Antigravity, model **Gemini 3.8 Flash (High)**, chế độ **/boost** (nhiều agent) |
| Cách chạy | **Tự động hoàn toàn**, tự duyệt quyền. Không chờ ai duyệt giữa các phase. |
| Phạm vi | **Tất cả** phase của `AGENT-PROMPT.md` (0 → 7) **+ Phase B**: backend mục **1–23** của `BACKEND.md`. Mục **24 (Xoá tài khoản) KHÔNG làm** — ẩn trên giao diện. |
| Migration | **Chỉ tạo** (+ script SQL idempotent). **KHÔNG áp vào DB.** DB `db47010` là SQL Server **từ xa, dùng chung** với app thật của chủ dự án. |
| Sao lưu | Đã có bản sao toàn bộ `ArisSkyve/` (kể cả bin/obj/node_modules) + `git-status.txt` + `git-diff.patch` tại `.local/v7-backup/pre-antigravity-20260926-1116/`. **Không sửa, không xoá thư mục này.** |

---

## 2. Điều chỉnh so với `AGENT-PROMPT.md`

### 2.1 "DỪNG" → "CHECKPOINT" (không chờ)
Mỗi chỗ `AGENT-PROMPT.md` ghi **DỪNG**:
1. Ghi báo cáo `docs/design-v7/reports/phase-<số>.md` theo mẫu mục 7 của `AGENT-PROMPT.md` (ảnh, lệnh, số đo, khác biệt với reference, việc chưa làm được).
2. Cập nhật `docs/design-v7/reports/PROGRESS.md` (mục 5 dưới đây).
3. **Làm tiếp phase sau ngay**, không chờ.

### 2.2 Duyệt mock (Phase 4, 5, 6) → tự soát
Vẫn dựng mock HTML tĩnh trong `.local/v7-mock/<trang>.html` trước khi sửa view, chụp sáng/tối/mobile, **tự soát** theo `README.md` §12.1 và danh sách cấm §9, sửa mock cho đạt, ghi vào báo cáo phase, rồi mới sửa view. Không chờ người duyệt.

### 2.3 Thứ tự làm
```
Phase 0  Kiểm kê (không sửa)
Phase 1  Nền tảng + khung app (bước 0 Lucide, aris-line.css, motion, shell, palette, rail, thông báo)
Phase 2  Tin nhắn · Việc làm · Chi tiết việc làm · Hộp thoại ứng tuyển
Phase 3  Bảng tin
Phase 4  Đơn ứng tuyển · CV · Hồ sơ · Cài đặt
Phase 5  Tuyển dụng (pipeline) · Việc đã đăng · Công ty
Phase 6  Đăng nhập · Người dùng mới · Phòng phỏng vấn · Lỗi · Chat widget
Phase 7  Rà soát toàn app (README §12.2, hiệu năng trước/sau, danh sách file không còn dùng)
Phase B  Backend mục 1–23 (luật mục 3) + nối UI đã dựng sẵn
Phase F  Báo cáo cuối + ĐIỂM DỪNG CỨNG: xin chủ dự án áp migration
```
Ở Phase 2–6, tính năng ghi **[CẦN BACKEND]** (mục 1–23 đã duyệt): **dựng luôn giao diện + JS** theo reference, nhưng đặt sau **cờ tính năng** `window.ArisFeatures.<tên>` (mục 3.4). Khi cờ tắt → phần đó **ẩn hoàn toàn**, không nút chết, không UI giả. Phase B chỉ còn phải làm API và bật cờ. Mục 24 (Xoá tài khoản) không dựng.

---

## 3. Luật riêng cho Phase B (backend)

### 3.1 Được sửa gì
Trong Phase B (và **chỉ** Phase B) được: thêm entity mới trong `Domain/Entities/`, thêm `DbSet` vào DbContext, thêm controller/action mới hoặc action mới trong controller có sẵn, thêm DTO, thêm **tối đa vài dòng đăng ký service** trong `Program.cs`. **Không** sửa action/route/DTO đang có theo cách phá tương thích; **không** sửa `appsettings*.json`; **không** sửa migration cũ.

### 3.2 CHỈ THÊM BẢNG MỚI — không thêm cột vào bảng có sẵn (bắt buộc)
Lý do: migration **chưa được áp** vào DB. Thêm một property vào entity có sẵn (vd. `Comment.ParentCommentId`) làm EF chọn cột đó trong **mọi** truy vấn cũ → lỗi `Invalid column name` → app thật **sập** ngay khi chủ dự án build lại. Vì vậy mọi dữ liệu mới nằm trong **bảng mới**; bảng cũ giữ nguyên schema.

Thay các cột ghi trong `BACKEND.md` bằng bảng phụ 1–1:

| `BACKEND.md` ghi | Làm thành |
|---|---|
| `Posts.AspectRatio`, `Posts.JobPostingId` (#19), `Posts.RepostOfId` (#21) | Bảng `PostExtras(PostId PK/FK → Posts, AspectRatio NULL, JobPostingId NULL, RepostOfId NULL)` |
| `PostMedias.SortOrder` (#4) | Bảng `PostMediaOrders(PostMediaId PK/FK, SortOrder)` |
| `Comments.ParentCommentId` (#5) | Bảng `CommentReplies(CommentId PK/FK, ParentCommentId FK)` |
| `Messages.StoryId` (#13) | **Không làm.** Trả lời tin 24h = tin nhắn thường có link tới tin. |
| Cơ chế "đăng xuất mọi thiết bị" (#23) nếu cần phiên bản phiên | Bảng `UserSessionVersions(UserId PK, Version)` — không thêm cột vào `Users` |
| Các bảng mới khác (#6, 8, 9, 10, 13, 14, 15, 17, 18, 22) | Tạo đúng như `BACKEND.md` |

Mục #1 (`IsPublic`), #2, #3, #7, #11, #12, #16, #20 **không cần schema mới**.

Mọi quan hệ tới bảng cũ: FK trỏ **từ bảng mới** sang bảng cũ, `OnDelete(DeleteBehavior.Cascade)` chỉ khi xoá bản ghi cũ phải kéo theo bản ghi mới (vd. xoá bài → xoá `SavedPosts` của bài); còn lại `Restrict`. Không có navigation property **bắt buộc** mới trên entity cũ; nếu thêm navigation collection trên entity cũ thì chỉ là collection, không phải cột.

### 3.3 Migration: chỉ tạo, không áp
```powershell
# Build ra bin/Release (KHÔNG bị khoá bởi app Debug đang chạy của chủ dự án)
dotnet ef migrations add V7Social --project ArisSkyve --configuration Release
# Script SQL idempotent để chủ dự án tự áp
dotnet ef migrations script --idempotent --project ArisSkyve --configuration Release -o .local/v7-migration-V7Social.sql
```
- **Cấm:** `dotnet ef database update`, chạy SQL trực tiếp lên DB, `EnsureCreated`, `Database.Migrate()` trong code.
- Một migration duy nhất `V7Social` cho cả Phase B. Mở file migration kiểm lại: **chỉ có `CreateTable`/`CreateIndex`/`AddForeignKey` trên bảng mới**, không có `AddColumn`/`AlterColumn`/`DropColumn` trên bảng cũ. Dán tóm tắt (danh sách bảng) vào báo cáo.

### 3.4 Cờ tính năng tự bật khi migration đã áp
- Service `V7FeatureGate` (singleton): lúc khởi động và mỗi 5 phút, gọi `db.Database.GetAppliedMigrationsAsync()`; nếu có `V7Social` → `Enabled = true`. Lỗi kết nối → `false` (không làm sập app).
- `_AppLayout` in ra `<script>window.ArisFeatures = { social: @(gate.Enabled ? "true" : "false") };</script>` trước các script trang. Có thể tách cờ con (`stories`, `polls`, `savedJobs`…) nhưng tất cả phụ thuộc `social`.
- Mọi action mới: nếu `!gate.Enabled` → trả `Json(new { success = false, message = "Tính năng chưa được bật." })` (không ném lỗi SQL).
- Kết quả: bản build mới **chạy an toàn** trên DB chưa áp migration (tính năng mới ẩn); khi chủ dự án áp migration, tính năng **tự hiện** trong tối đa 5 phút, không cần build lại.

### 3.5 Kiểm thử backend khi migration chưa áp
Không kiểm được đầu-cuối trên DB thật. Bắt buộc làm:
1. `dotnet build` ra `.local/v7-build` sạch, 0 lỗi; app 5099 khởi động được, **mọi trang cũ vẫn chạy** (chứng minh không cột mới nào lọt vào bảng cũ).
2. Gọi thử từng action mới khi cờ tắt → nhận đúng `{ success:false, message:"Tính năng chưa được bật." }`.
3. Đọc lại code từng action: kiểm quyền sở hữu (chỉ chủ bài xoá bài, chỉ doanh nghiệp đọc ứng viên của mình…), `[Authorize]`, chống trùng (khoá chính kép), phân trang có giới hạn `take ≤ 50`.
4. Liệt kê trong báo cáo cuối: "Việc chỉ kiểm được sau khi áp migration" + các bước kiểm cụ thể cho từng tính năng.

---

## 4. Làm việc với `/boost` (nhiều agent)

- **Một agent duy nhất** làm Phase 0, Phase 1, Phase 7, Phase B, Phase F. (Phase 1 và B sửa file dùng chung; song song sẽ giẫm chân nhau.)
- Phase 2–6 được chia cho nhiều agent **theo trang**. Mỗi agent **sở hữu riêng** các file của trang mình: view của trang, `wwwroot/css/pages/<trang>.css`, `wwwroot/js/pages/<trang>.js`, partial riêng của trang.
- **File dùng chung** — chỉ agent điều phối được sửa, agent trang phải gửi yêu cầu: `wwwroot/css/aris-line.css`, `wwwroot/js/aris-motion.js`, `aris-shell.js`, `aris-palette.js`, `notification-client.js`, `chat-client.js`, `Views/Shared/*` (layout, AppNavbar, `_ChatWidget`), mọi file trong `Controllers/`, `Domain/`, `Migrations/`, `Program.cs`.
- Hai agent **không** chạy `dotnet build` cùng lúc vào cùng thư mục ra; mỗi agent dùng `.local/v7-build-<tên-agent>` hoặc để agent điều phối build.
- Chỉ **một** bản app thử cổng 5099 chạy tại một thời điểm (agent điều phối quản lý; agent khác cần cổng thì dùng 5100–5109, ghi PID).
- Trước khi sửa file nào: đọc lại nó (file có thể vừa bị agent khác đổi). Sau mỗi trang: agent điều phối chạy build + chụp ảnh toàn bộ các trang đã làm để bắt lỗi dây chuyền.

---

## 5. Tiến độ — `docs/design-v7/reports/PROGRESS.md`

Cập nhật **sau mỗi trang hoặc mỗi 30 phút**, nội dung **ghi đè** (không nối dài vô tận):
```markdown
# Tiến độ Antigravity — Aris V7
Cập nhật: 2026-09-26 14:05 (giờ máy)
Đang làm: Phase 2 — Việc làm (agent: jobs-worker)
Đã xong: Phase 0 ✓ · Phase 1 ✓ · Tin nhắn ✓
Lỗi/cần chú ý: <ngắn gọn, có đường dẫn báo cáo>
Bản app thử: http://localhost:5099 (PID 12345) — build .local/v7-build lúc 13:58
```
Không bao giờ ghi "xong" cho một phase khi chưa có ảnh + kết quả lệnh trong `reports/phase-<số>.md`.

---

## 6. Điểm dừng CỨNG — dừng và hỏi chủ dự án ngay trong terminal

Chỉ những trường hợp sau mới được dừng lại chờ người:
1. Cần dừng/khởi động lại app của chủ dự án ở **cổng 5025**, hoặc một file bị khoá bởi process của họ mà không có cách build ra thư mục khác.
2. Cần áp migration / chạy SQL lên DB (→ không làm, ghi vào Phase F).
3. Cần xoá file có sẵn, hoặc bất kỳ lệnh git ghi (`reset`, `checkout --`, `stash`, `clean`, `commit`, `push`, đổi branch).
4. Luật trong `AGENT-PROMPT.md` hoặc file này mâu thuẫn nhau hoặc không làm được, mà không có cách an toàn.
5. Phát hiện dữ liệu thật của người dùng có thể bị ảnh hưởng.

Còn lại: **tự quyết theo tài liệu**, ghi lý do vào báo cáo, làm tiếp.

---

## 7. Dữ liệu thử trên DB dùng chung

App thử 5099 dùng **cùng DB thật** với app của chủ dự án. Vì vậy:
- Đăng nhập bằng `QuickLogin`/`DirectLogin` (chỉ có ở Development) với tài khoản thử sẵn có (đọc `AccountController` để biết). **Không** tạo tài khoản mới hàng loạt.
- Nội dung tạo ra khi thử (bài viết, bình luận, tin nhắn, đơn ứng tuyển, tin tuyển dụng) phải bắt đầu bằng **`[V7 test]`** và **xoá ngay sau khi thử** bằng chính chức năng xoá của app. Ghi danh sách những thứ đã tạo/xoá vào báo cáo phase.
- **Không** gửi email thật hàng loạt (magic link: thử tối đa 1 lần, tới email thử), **không** bấm đăng lên Facebook/Zalo thật, **không** đổi trạng thái ứng viên thật của tin tuyển dụng thật (dùng tin `[V7 test]` do chính mình tạo rồi xoá).
- Không sửa dữ liệu hồ sơ/cài đặt của tài khoản thật; nếu phải thử form lưu, đổi rồi **đổi lại giá trị cũ** ngay.

---

## 8. Phase F — báo cáo cuối (bắt buộc)

`docs/design-v7/reports/FINAL.md`:
1. Bảng mọi route: đã làm ✓/✗, ảnh trước/sau (sáng, tối, mobile), số đo hiệu năng trước/sau.
2. Kết quả toàn bộ lệnh `README.md` §12.2 (dán nguyên văn).
3. Danh sách file đã sửa/thêm; danh sách file cũ không còn được dùng (chủ dự án tự quyết xoá).
4. Khác biệt với reference và lý do.
5. **Hướng dẫn áp migration cho chủ dự án** (điểm dừng cứng cuối cùng):
   ```
   1. Tắt app đang chạy ở cổng 5025.
   2. Sao lưu DB (khuyến nghị) rồi áp:  dotnet ef database update --project ArisSkyve
      hoặc chạy .local/v7-migration-V7Social.sql trên DB db47010.
   3. Build + chạy lại app. Tính năng mới tự bật (≤ 5 phút) nhờ V7FeatureGate.
   4. Chạy lại Antigravity:  agy --continue  → "Migration đã áp, kiểm thử Phase B đầu-cuối"
   ```
6. Danh sách việc "chỉ kiểm được sau khi áp migration" (mục 3.5.4).
7. Cách khôi phục nếu cần: bản sao `.local/v7-backup/pre-antigravity-20260926-1116/` (copy đè từng file/thư mục cần khôi phục; `git-diff.patch` là thay đổi chưa commit của chủ dự án trước khi bắt đầu).

Sau khi ghi `FINAL.md` → dừng, báo trong terminal: "Đã xong. Cần bạn áp migration theo FINAL.md mục 5."
