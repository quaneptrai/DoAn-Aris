# CODEX — INTERVIEW PRODUCTION DEPLOYED 10/10/2026 ~21:34 ICT

- User explicitly authorized completion through production. Deployed application `0ac45de` (feature base `cf04fe9`) to https://thuctap.runasp.net; live/ready200. Applied reviewed additive SQL; pending migrations[] in db47010. Full rollback backup `.local/deploy-backups/live-20261010-210647.zip` validated116445542 bytes/1100 entries. Deploy17 added/4 updated/0 deleted; App_Data preserved.
- Restarted only verified real gateway10420 through its supervisor, no preview restart. Owner DB UserId16 unlimited; others300/day in Vietnam time, no monthly cap, publicly authenticated budget checks passed. Aris-InterviewGateway task running and Tailscale Automatic. Promoted verified ignored production settings so future deployments retain gateway routing.
- Public sample upload was initially auto-review rejected due to unclear permission to send the user's avatar/voice clips to public Drive. User then explicitly approved “Cho phép tải bản mẫu và tạo link thử”; approved importer completed14 clips/6 questions under owner16, preserving voice/rubric/timing. No real renders or credit use; no copied interview history or synthetic privacy acceptance.
- Candidate test link https://thuctap.runasp.net/InterviewKit/55c0c009559735d101212ed1 ; employer https://thuctap.runasp.net/Employer/InterviewFlow/1 . External tester signs in with their own account and microphone. Keep Windows PC awake/logged in for grading/generation.
- Preview5029 still14 clips/1 session: NEVER restart or restore old11-clip snapshot. Source transfer artifact is not a full history backup. Preserve untracked ProvisionEmployer tools. See latest docs/INTERVIEW-GATEWAY-RELEASE.md and `.local/interview-release-result.json`.

- Final production read found a Cartesian avatar transfer bottleneck. Added AsSplitQuery at 3 multi-collection loaders; real read-only sample check reduced from >150 s (cancelled) to 7.48 s. Flow rerun61/61, build0 errors, revision 0ac45de deployed and health200. Public clips14/14 SHA256 match; range206; login preserves invitation. Full rollback remains the validated1100-entry live package or committed cf04fe9 redeploy.

## Earlier preparation notes (superseded by deployed status above)

# CODEX — INTERVIEW GATEWAY RELEASE PREP 10/10/2026

- Continued Claude's interview gateway; test flow/credits/stop/Chrome through gateway passed 61/13/32/29; quota passed 8 after stable DB UserId identity. Gateway 18, voice 41. No real generation, no restart of Embedded 5029.
- User policy: xuanthangmuoi@gmail.com (DB UserId16) unlimited; other accounts 300 credits/day in Vietnam time, no monthly cap. Durable gateway ledger; browser identity ignored.
- Registered Aris-InterviewGateway logon supervisor; added Funnel /gw -> loopback 8780, preserved MuseFlow/9router root. Health succeeded for every service. Ignored production candidate settings prepared.
- Gateway owner exemption file has final UserId16 hash but running process needs reload before release. Automatic approval review rejected broad gateway termination + public probe with live key. Do not bypass; restart/migrations/deploy await reviewable final approval.
- Final regression 20/20; silent synthetic Funnel probe 180 s passed and temporary mount removed. Preview 5029 now has 14 clips and 1 session; never restore the old 11-clip/0-session snapshot or restart it. Old intro/transition bytes differ; 9 other old clips match.
- Application revision cf04fe9 committed and Web Deploy WhatIf passed (17 added, 4 updated, 0 deleted, 6.4 MB). Deploy that exact revision with .local/production-settings.interview.json after approval. No website/DB changes yet.
- DB migrations are still unapplied. SQL: .local/interview-release-idempotent.sql. Details: docs/HANDOFF-INTERVIEW-2026-10-10.md, docs/INTERVIEW-GATEWAY-RELEASE.md. ProvisionEmployer tools remain outside this release.

# CLAUDE CODE — CHAT REACTIONS, NOTIFICATION SPAM, COMMENT REPLIES 07/10/2026

- **Migration NOT applied** (shared DB): `ArisSkyve/Migrations/20261007051229_AddMessageReactions` creates only table `MessageReactions` (PK MessageId+UserId, FK Message Cascade, FK User Restrict). Idempotent script: `.local/migration-AddMessageReactions.sql`. `V7FeatureGate.MessageReactions` turns on by itself once it is applied; until then reactions are hidden and `ToggleReaction` returns false.
- Fixed `20261005100000_AddCompanyProfileViews.cs` declaring `[DbContext]` twice (broke every `dotnet ef` command).
- In-memory E2E/preview mode now force-enables the V7 gate (the in-memory DB has every table).
- Notifications: chat messages no longer create bell rows (chat badges count them; legacy `Message` rows are filtered out of the bell); `NotificationWriter` never notifies yourself and replaces an unread repeat (same user/actor/type/link); friend Accept/Cancel and employer status no-op/undo no longer stack rows; payload adds type/actorName/prefixActor/replaces and UTC `Z` times; `notification-client.js` guards double init, scrolls, groups Mới/Trước đó (`css/aris-notify.css`).
- Chat: `ChatHub.ToggleReaction` + `MessageReactionChanged`; shared `js/chat-reactions.js` used by `pages/chat.js` and `_ChatWidget.cshtml`; recall no longer fails when the message was quoted; chat times sent as UTC.
- Comments: Reply on every comment (own included), like, delete (takes replies along), one-level threads, notifications to post owner / answered author; DeletePost removes reply links first.
- Verified: build 0 errors; `test_csrf_global_coverage`, `test_f7_backend_behavioral`, `test_public_media_hardening` pass; in-memory smoke pages 200. Not verified in a browser: reaction/reply UI flows, visual styling. General UI restyle (chat page, widget, feed cards) not done yet.

# CODEX — GOOGLE DRIVE RELEASE COMPLETE 05/10/2026

- Released the Google Drive public-media and private Resume-original implementation in `3d4af1f`; `026bd64` separately prevents Web Deploy passwords from appearing in command-line arguments by using a session-only Credential Manager target.
- Production migration `20261004200951_AddPrivateDriveResumeOriginals` is applied and no longer pending. The release script deployed commit `026bd64` after an on-disk backup, then completed both `/health/live` and `/health/ready` checks; external post-release checks also returned **200**.
- Drive credentials and the two distinct folder settings were copied only into ignored production settings. Read-only folder verification and a deliberate synthetic storage smoke both passed. The smoke created only an in-memory PNG/PDF, checked their expected Drive metadata, and confirmed deletion; it did not touch the production database, user accounts, or CVs.
- Legacy protected PDFs remain in `App_Data` as rollback copies. When an authenticated owner next accesses an unmapped legacy original, the new lifecycle performs a bounded, owner-scoped lazy migration to the private Drive folder; there is no startup bulk upload.
- Final relevant checks: `ResumeFlowTests` **66/66**, `PublicMediaValidationTests` passed, Drive helper build passed (only the unavailable NuGet vulnerability-feed warning), and the production Drive smoke passed.
- Follow-up requiring hosting-account authority: rotate the saved Web Deploy profile credential, because an earlier pre-fix diagnostic exposed it to a local process command line. No credential value is recorded here.

# CLAUDE CODE — PRODUCTION DEPLOY 05/10/2026 ~02:00

- Live site https://thuctap.runasp.net (IIS, Web Deploy `site62246`) now runs commit `d32a993`: everything in `dabee09` plus persisted data-protection keys in `App_Data/dataprotection-keys`.
  - Verified: `/health/live`, `/health/ready`, `/privacy`, Login and Register all 200; a freshly signed magic link logs in.
  - Links issued by the old site before the deploy are invalid now.
- **Shared database.** Migration `AddPrivacyAndCvAiConsent` was applied to the database at `db47010.public.databaseasp.net`. Local development and production use this same database.
- **Configuration.** Production settings are written into `web.config` as environment variables from the git-ignored `.local/production-settings.json` (DB, SMTP, magic-link secret, OAuth, `AiCore__BaseUrl=https://api.quandang.site`, parser URL and key).
  - Redeploy with `.\scripts\deploy-iis.ps1` (try `-WhatIf` first). It publishes from a clean worktree, so uncommitted work is not shipped. It backs up the live site to `.local/deploy-backups`, never deletes server-only files and skips `App_Data`.
  - Pre-deploy live backup: `<claude scratchpad>/live-backup-20261005.zip`.
- **Google Drive (Codex).** Uploads on production fail until Drive is configured. After the Drive code is committed:
  1. Add `GoogleDrive__Enabled=true`, `GoogleDrive__FolderId`, `GoogleDrive__ServiceAccountJsonBase64` (and `UseSharedDrive`/`MakeFilesPublic` if needed) to `.local/production-settings.json`.
  2. Run `.\scripts\deploy-iis.ps1`.
- **AiCore.** Production calls https://api.quandang.site, which is the Cloudflare tunnel `api-quandang` → `localhost:8001` on this PC.
  - The tunnel is not running at the moment (Cloudflare 530).
  - AiCore has no `AICORE_API_KEY`. Do not expose it again until the key is set in AiCore `.env` and `AiCore__ApiKey` is added to the production settings.

# CLAUDE CODE — DONE 05/10/2026 ~01:40 (areas below are free again)

- Parser on FastAPI Cloud: app `aris-resume-parser`, URL https://aris-resume-parser.fastapicloud.dev (team "Quan Dang", us-east-1).
  - Every `/api/*` route requires header `X-Resume-Parser-Key`; the value is in the cloud secret `RESUME_PARSER_API_KEY` and in Aris user-secrets `ResumeEngine:ParserApiKey`.
  - Build the bundle with `python ArisSkyve/resume-engine/build-parser-deploy.py`. Output goes to `~/.aris/parser-deploy`, outside the repo: the CLI honours the repo .gitignore, so a bundle in `.local/` uploads nothing.
  - Deploy from there with `uvx --from "fastapi[standard]" fastapi deploy ~/.aris/parser-deploy`.
  - Verified: wrong key → 401, right key → 200; a synthetic CV parses in about 1 s; Aris → cloud import works via `ResumeParserKeyHandler`.
  - Local dev still uses the local parser at 127.0.0.1:8765.
- Sign-in limits (`AuthRateLimits.cs`):
  - Per IP: magic-link requests 5/15 min, confirm attempts 20/15 min.
  - Per recipient: 3 emails/15 min and 10/day.
  - All tunable via `RateLimits:*`.
- Privacy and consent:
  - `/privacy` page with grant/revoke endpoints (`PrivacyController`).
  - Onboarding requires `AcceptPrivacy` (`Users.PrivacyAcceptedAt`); AI processing of CVs is opt-in (`Users.CvAiConsentAt`, migration `AddPrivacyAndCvAiConsent`).
  - `[RequireCvAiConsent]` returns 428 `cv_ai_consent_required` on `AnalyzeCv`, `Coach`, `ImportTemplate` and `Parse(mode=template)`. Studio save skips AI with `aiSync: "consent_required"`.
  - UI asks via `cv-ai-consent.js` (pages) and Studio `request()`, then retries once.
- Tests:
  - parser 48/48; ResumeFlowTests 64/64 (Claude added one no-consent save check and seeds consent for the AI-sync checks).
  - new `tests/runtime_e2e_privacy.cjs` 8/8.
  - full `run_all_tests.cjs` 20/20.
- Previous ownership notes, kept for history:

- Git: whole tree committed as fresh root commit `e209343` on branch `main`, pushed to `origin` = https://github.com/quaneptrai/DoAn-Aris (private). Local `master` (`d555502`) still holds old secrets: never push it. Don't reset/rebase `main`.
- Claude owned:
  - Parser deploy to FastAPI Cloud: `resume-engine/server/app.py` (shared-key auth `RESUME_PARSER_API_KEY`) plus new deploy entry files.
  - Aris → parser key: `Infrastructure/Services/ResumeParserKeyHandler.cs` and one line in `Program.cs`.
  - Rate limiting: `Program.cs`, `AccountController`, `EmailService`.
  - Privacy page + CV-AI consent: Home views, Register/NewUserInfor, `ResumeController.AnalyzeCv`, a consent endpoint, and a small 428-retry hook in `Studio.tsx` `request()`.
- Claude will not touch: `Coach.tsx`, `coach-rules.ts`, coach tests, or the `Coach` action Codex is editing. After Codex's Coach change lands, Claude wants to add `[RequireCvAiConsent]` to the `Coach`, `ImportTemplate` and `Parse` (mode=template) actions. Codex: note here when `ResumeEngineController` is free.
  - Codex follow-up: Coach response validation is complete and `ResumeEngineController` is free for the consent attributes. It rejects malformed canonical input and untrusted AI response fields, derives skill possession from CV evidence, and treats an out-of-range plan stage as invalid. Verified by `ResumeFlowTests` 63/63 on 05/10/2026.

# CHECKPOINT PRODUCTION HARDENING + ISOLATED E2E — 05/10/2026

- Hardened tracked configuration: deployment secrets were removed, normal SQL startup now fails closed without a supplied connection string, magic-link/email/OAuth integrations fail closed when their required configuration is absent, and Development demo seeders default to off.
- Added explicit Development-only `E2E:UseInMemoryDatabase` mode: a per-run in-memory database, no seeders/background workers, loopback-only traffic, and no AI/parser network dependency. Development quick-login endpoints also require a loopback request.
- Added non-sensitive probes: `GET /health/live` (process) and `GET /health/ready` (bounded DB/schema query; generic 503 on failure).
- Hardened all browser-facing upload paths (post, story, avatar, cover, chat): MIME + extension + signature validation, generated file names, storage outside `wwwroot`, controlled `/media/...` serving with explicit MIME plus `nosniff`; legacy `/uploads` now permits only recognized image/video extensions.
- Added direct hardening tests plus `tests/runtime_e2e_local.cjs`. The E2E smoke starts its own disposable `127.0.0.1` process and verifies health, QuickLogin/CSRF, blank CV create/load/save, publish/public access, cross-user denial, unpublish, and exact runtime cleanup.
- Final verification: application build 0 warnings/0 errors; full `tests/run_all_tests.cjs` completed **20/20**; enhanced isolated runtime E2E passed again after the suite; the temporary E2E port was confirmed closed. Do not kill the unrelated pre-existing listener on port 5025.
- Deployment still requires external rotation/revocation of every credential previously committed to configuration/source and placement of replacements in a secret store/environment. No production database, user account, real CV, or external AI service was used by this checkpoint.

# CV Studio — tiếp tục phiên 04/10/2026

## CHECKPOINT CONTINUATION + FINAL LOCAL VERIFICATION — 04/10/2026

- Resumed from the 22:20 fidelity/lifecycle checkpoint and verified the source changes written afterward: licensed metric-compatible fallback font bundles, legacy-builder targeting/lifecycle coverage, the current PDF layout editor/parser refinements, and application-wide CSRF hardening.
- Current local verification (no real CVs, no model calls): parser `45/45`; `npm run check` passed; `ResumeFlowTests` `53/53`; `LegacyBuilderTargetingTests` `8/8`; `dotnet build ArisSkyve/ArisSkyve.csproj --no-restore -p:UseAppHost=false -o .local/resume-followup-build -v quiet` passed with `0 warnings, 0 errors`; contract/integration runner `16/16` suites passed, including the new global CSRF coverage test.
- Existing fresh browser evidence was retained rather than regenerated in the dirty tree: `.local/cv-browser/report.json` records `40` checks and no errors for the real Studio bundle/PDF fixture. The post-checkpoint source/bundle timestamps are aligned (Studio source 23:19, generated bundle 23:24, contract 23:25).
- CSRF posture now has a regression guard: unsafe MVC requests are protected by global `AutoValidateAntiforgeryToken`; same-origin fetch, jQuery, and static legacy-builder callers attach `RequestVerificationToken`; only the Zalo webhook opts out, and it fails closed unless its configured secret matches. The full 16-suite runner was initially blocked only by sandbox child-process restrictions, then completed successfully when rerun with local process permission.
- Runtime note: an existing local listener on `5025` returns `302 /Account/Login`, but its owner could not be inspected in the restricted session and it predates the latest build; do not kill it blindly. A separate latest-build smoke server on temporary port `5026` reached Kestrel startup but immediately attempted the configured external database, whose required encryption is unavailable in this environment. That temporary process was stopped (PID 8272); do not repeat runtime startup against Production configuration without an explicitly approved isolated/local database configuration.
- The fidelity boundary remains unchanged: raster background plus font substitution cannot promise exact layout on every device; optional OCR stays off until a separately provisioned offline runtime/model is configured. Preserve the large dirty working tree: no reset/clean and no broad staging.

## CHECKPOINT FIDELITY + LIFECYCLE FOLLOW-UP — 04/10/2026 22:20 ICT

- The user audit was accepted as correct; do not call cross-device PDF fidelity complete. The immediate regressions were addressed:
  - hybrid PDF pages with a full-page background image plus visible native text no longer get classified as scans or sent to OCR; invisible OCR spans are filtered;
  - PDF subset/face names are normalized (for example `ABCDEF+Calibri-Bold` -> `Calibri` + bold) and the UI uses family-aware fallback stacks;
  - overlong positioned text is detected and blocks save/print instead of silently overlapping subsequent content;
  - positioned-layout edits synchronize canonical/basic name and email before both client and server persistence;
  - safe PDF URI annotations are carried into the canonical schema and rendered as actual links; background raster budget was raised from approximately 108 DPI to approximately 180 DPI.
- Remaining fidelity limit: the output still uses a raster background and does not ship licensed embedded copies of source fonts. It cannot promise exact Calibri (or any unavailable source font) layout on every Mac/phone. Exact cross-device fidelity needs a separately approved embedded-font or PDF-native-export architecture.
- B5 lifecycle hardening is now centralized in `ResumeOriginalLifecycle`: exact owner/source/path/reparse checks, temporary-file-then-move upload, CSRF-protected explicit discard, database-reference recheck after a CV delete, and a bounded orphan cleanup worker. Default retention is 168 hours (minimum configurable value 24 hours); old sources are never eagerly removed on replacement because a stale browser tab can still reference them. `capabilities` exposes `originalRetentionHours`, and Studio tells users the bounded retention behavior.
- B6/B7: internal replacement now requires an explicit modal choice: stay, discard, or save then continue. Cancelling a parsed upload cleans only that known candidate original. Positioned typing uses a structural element patch, coalesced history, debounced draft write, saved-snapshot dirty tracking, and correct post-save undo/redo semantics; it no longer clones/serializes the full layout on each keypress.
- B8: all browser fixtures now mock `GET /api/resume-engine/capabilities`, including `private-layout-browser.mjs`. The real private runner still requires an externally supplied `PRIVATE_LAYOUT_JSON` fixture and was not run without one.
- Final verification in this pass:
  - parser: `python -m unittest discover -s server -p "test_*.py" -v` -> **37/37**;
  - TypeScript check + production bundle build -> pass;
  - browser: layout **24/24**, unsaved replacement **9/9**, Studio **25 checks**, legacy choice **8 checks**, coach **25 checks**, OCR choice pass;
  - controller + EF InMemory `ResumeFlowTests` -> **53/53**; final Aris build -> **0 errors** (the larger project continues to have its pre-existing nullable warnings in a full test build).
- Runtime: the old Aris listener on port 5025 was verified by port then replaced. Final build runs as PID `13468`, `127.0.0.1:5025`, content root `ArisSkyve`; `/` returns `302 /Account/Login`. Parser and AiCore were not started in this follow-up; OCR therefore remains safely unavailable rather than falling back to external OCR.

## CHECKPOINT OCR HARDENING — 04/10/2026 21:26 ICT

- Finished the optional offline scan-PDF OCR path without enabling it by default. The parser now preflights the configured isolated Python runtime and model directory, including required OCR dependencies, before accepting an OCR request. With no configured local runtime, capabilities safely report `layoutOcr: false` and reason `ocr_python_not_configured`; there is no download or external OCR call at request time.
- Fixed Windows isolated-Python output for Vietnamese text: the OCR sidecar emits ASCII-safe JSON, avoiding `UnicodeEncodeError` under a cp1252 stdout. Parser regression suite is now 32/32, including Vietnamese round-trip, dependency preflight, OCR geometry/masking, and review-gate cases.
- Imported scan layouts now carry `ocrReviewRequired: true` and cannot be saved or published until the owner explicitly confirms review. The Studio UI presents the acknowledgement, retries correctly after acknowledgement, clears persisted draft data after save, and avoids promising that a raster background is perfectly text-free.
- Private original lifecycle is covered: an unreferenced original can be explicitly discarded; an original referenced by a saved Studio document cannot be discarded; deleting that saved CV removes only its exact owner-scoped original after the database deletion commits. The routes use strict source IDs, CSRF, owner checks, and no recursive deletion.
- Final verification: `npm run check`, schema generation, and production bundle build passed; browser OCR choice 14/14; Studio/layout/legacy browser suite 47/47; coach proposal 25; `run_all_tests.cjs` 15/15 suites; render smoke 32 native previews plus 64 print/PDF renders with zero overflow/failure; controller + EF InMemory `ResumeFlowTests` 41/41; fresh Aris build 0 warnings / 0 errors.
- Runtime restarted from the final build: Aris `127.0.0.1:5025` PID `3988` returns `302` login; parser `127.0.0.1:8765` PID `28204` returns capabilities; AiCore `127.0.0.1:8001` PID `11904` has live/ready `200`. No real CV, production login/storage, or unprovisioned OCR model was used in this verification.
- Remaining deployment action, only if scan OCR is desired: provision a separately managed local OCR venv/model directory and set the documented `RESUME_OCR_*` variables. Keep the owner review step; it is intentional.

## CHECKPOINT FLOW ỨNG TUYỂN + COACH — 04/10/2026 19:53 ICT

- Candidate apply đã nối đầy đủ: modal chọn CV/câu hỏi sàng lọc, submit có CSRF, trạng thái thành công và link xem đơn. Nếu đã từng nộp, CTA `Ứng tuyển lại` mở cảnh báo riêng và chỉ POST sau khi user xác nhận; server vẫn validate CV thuộc user, đủ câu hỏi, trim answer và giới hạn cover letter.
- Candidate mutations `Apply`, `Withdraw`, `RespondToInterview` có `ValidateAntiForgeryToken`; caller Index/Details/MyApplications đều gửi header token. Đã xóa listener chia sẻ job trùng, giữ handler chung duy nhất.
- Sửa nút CV-match `vector_pending` “Thử lại”: trước đây trỏ selector không tồn tại, nay gọi control chấm CV thật và có fallback trạng thái.
- Coach Studio có `Xem đề xuất` -> preview CV thật + animation/diff -> `Áp dụng thay đổi` hoặc `Giữ nguyên`. Preview không commit, Ctrl+S/publish bị khóa khi modal đang chờ xác nhận; skill `+` cũng cần xác nhận. Đề xuất chỉ ghép facts đã có (headline/skills), không bịa thành tích/số liệu; PDF giữ bố cục vẫn sửa thủ công.
- Kiểm thử local/fixture: `coach-proposal-browser` 25 checks; `layout-browser` 14; `studio-browser` 25 checks/3 writes; P04 và P11 pass; `run_all_tests.cjs` 14/14. Build Aris cuối 0 warning/error; giữ LF `JobApplicationsController.cs`, `jobs.js`, `jobs.css`, `_RecommendedJobsPartial.cshtml`.
- Runtime sau restart: Aris `5025` trả 302 login (PID kiểm tra lại khi cần), AiCore ready 200, parser OpenAPI 200. Chưa dùng CV thật/AI ngoài trong test.
- Giới hạn: endpoint mutation phía employer vẫn nên audit CSRF riêng nếu mở rộng phạm vi; Coach không tự rewrite scan/imported-layout và không được phép tự tạo fact mới.

## CHECKPOINT XÁC MINH PDF RIÊNG TƯ — 04/10/2026 19:26 ICT

- Đã kiểm tra 5 PDF do user cung cấp bằng parser/browser local, không gọi AI bên ngoài và browser chặn mọi egress non-local. File gốc chỉ đọc: hash và kích thước đối chiếu sau test **5/5 không thay đổi**.
- Ba PDF có text layer đã qua luồng giữ bố cục trên bundle Studio thật: mỗi file 2 trang vào/ra 2 trang A4 portrait, mỗi trang giữ background, sửa-lưu-mở lại-publish đều thành công; không UI trong public, browser error hay egress.
- Hai PDF có trang nền ảnh/scan bị parser trả 422 rõ ràng, không fallback overlay để tránh lặp chữ hoặc mất bố cục. Cần PDF export có text layer, hoặc OCR geometry + masking/inpainting riêng trước khi hỗ trợ sửa trực tiếp.
- Sửa print-only trong `src/imported-document.css`: giảm cao container 0.05 CSS px khi in để tránh Chromium thêm trang A4 trắng; không đổi tọa độ/layout trên màn hình. Chrome làm tròn A4 thành 594.96 x 841.92 pt, harness chỉ chấp nhận dung sai 0.5 pt và vẫn kiểm tra hướng trang/background/trang trắng.
- Kết quả final Studio: build pass; `layout-browser` 14 checks; `studio-browser` 25 checks/3 writes; smoke 32 renders; `legacy-choice-browser` 8 checks; `run_all_tests.cjs` 13/13 suites. `dotnet build ArisSkyve/ArisSkyve.csproj --no-restore -p:UseAppHost=false -v quiet`: 0 warning, 0 error.
- Đã xóa 22 thư mục artifact `cv-layout-private-*` đã tạo dưới `%TEMP%` sau khi đối chiếu hash. Không có PDF riêng tư trong workspace.
- Runtime sau restart: Aris lại nghe 5025 và `/` trả 302 login; AiCore `health/live`, `health/ready` và parser `openapi.json` đều 200. Xem checkpoint trước để biết lệnh chạy và giới hạn reindex/scan/font.

## CHECKPOINT CẬP NHẬT SAU KHI TIẾP TỤC — 04/10/2026 18:25 ICT

### Luồng đã chốt
- CV PDF upload có lớp chữ được mở ở chế độ **giữ bố cục** bằng canvas HTML đúng kích thước trang: nền là PDF gốc đã redaction chữ, còn từng span chữ là overlay có tọa độ, font, màu, kích thước và style gốc. Sửa/lưu/mở lại/xuất/chia sẻ đều dùng canonical `importedLayout` đó; không đổ chữ vào template mới.
- CV legacy có file gốc không gọi AI `/cv/structure` khi chỉ mở Studio. Người dùng chọn rõ: giữ bố cục gọi parser `mode=layout`; chuyển mẫu Studio gọi `POST document/{id}/import-template` (CSRF) rồi mới gọi AI structure.
- Publish CV upload chưa có Studio document trả `422 resume_studio_choice_required` và URL Studio, không âm thầm tạo `t1`. `resume-actions.js` đưa người dùng đến lựa chọn đó.
- URL tải file gốc dùng named client không follow redirect; từ chối user-info, host/port/path không hợp lệ và redirect ngoài storage.
- AiCore reindex truyền revision tới worker, conditional-update theo `Id`, `EmployeeId`, revision và text. Worker cũ CAS thất bại rollback/xóa vector mới rồi không xóa child rows, cache hay precompute.

### Đã kiểm thử
- `tests/ResumeFlowTests`: **32 checks passed** (controller + EF InMemory): không gọi AI trước lựa chọn, publish bị chặn đúng mã, chuyển template mới gọi AI sau lựa chọn, persistence/layout/share và named no-redirect client.
- AiCore: `python -m pytest tests -q -p no:cacheprovider` **352 passed, 2 warnings**; riêng `tests/test_cv_reindex.py` **14 passed**.
- Parser: `python -m unittest discover -s ArisSkyve/resume-engine/server -p 'test_*.py'` **27 passed**.
- Studio bundle: `npm run build` pass; `layout-browser` **14**, `studio-browser` **25 checks/3 writes**, smoke **64 renders**, `run_all_tests.cjs` **13/13 suites**; regression mới `legacy-choice-browser.mjs` **8/8** với bundle thật.
- `dotnet build ArisSkyve/ArisSkyve.csproj --no-restore -p:UseAppHost=false -v quiet` pass, 0 errors. Lượt build đầy đủ trước đó còn 62 warnings đã có sẵn, không sửa ngoài phạm vi.
- PDF fixture hư cấu `.local/cv-browser/edited.pdf`: 2 trang A4 gần `594.96 × 841.92 pt`; chữ sửa có thật, `Alex Example` không còn ở trang/vị trí đã sửa, còn ở header trang 2 đúng fixture; ảnh và hình trang trí nền vẫn còn. Tiêu đề dài có thể wrap khi font thay thế.

### Runtime đã khởi động
- Đã xác minh theo cổng, không dùng PID checkpoint cũ: AiCore `8001` service PID `11904` (launcher `14272`), parser `8765` PID `23268`, Aris `5025` PID `15636` (wrapper `10172`).
- AiCore `/health/live` và `/health/ready` đều `200` (`sql`, `pinecone`, rerank available); parser `/openapi.json` `200`; Aris `/` trả `302 /Account/Login` đúng trạng thái chưa xác thực.
- Parser smoke với `cv-layout-fixture.pdf` hư cấu, `mode=layout`: `200`, 2 pages, 8 text elements, nền tồn tại. Không gửi CV thật hay gọi model AI ngoài.
- Aris local cần chạy với `Logging__EventLog__LogLevel__Default=None` vì tài khoản hiện tại không có quyền Windows Event Log; đây là override runtime để Kestrel không trả empty reply, không phải sửa source.
- Gọi `POST /api/v2/skills/graph/rebuild` thành công: 1909 jobs, 501 skills, 1822 edges. `cv-coach` với text giả lập Python/SQL/Power BI + mục tiêu Data Engineer trả `success`, `titles_indexed=true`, 5 skills và 6 hướng nghề.

### Lệnh tiếp tục an toàn
- AiCore: từ `D:/ThucTap/AiCore`, `uvicorn main:app --host 127.0.0.1 --port 8001`; log runtime ở `.local/cv-studio-runtime/`.
- Parser: từ `ArisSkyve/resume-engine`, `python -m uvicorn app:app --app-dir server --host 127.0.0.1 --port 8765`.
- Aris: build source rồi chạy DLL trên `127.0.0.1:5025`, đặt override EventLog nêu trên khi không chạy elevated. Luôn kiểm tra `netstat -ano`/owner port trước khi stop process.

### Giới hạn còn lại
- Giữ bố cục trực tiếp hiện chỉ hỗ trợ PDF có text layer; DOCX, scan/OCR, chữ xoay và vector-outline bị từ chối rõ ràng, không fallback âm thầm. OCR tương lai phải trả bounding box tin cậy trước khi dựng overlay.
- Font không có trên máy hoặc text dài hơn box gốc có thể thay dòng; editor cho chỉnh kích thước/font/vị trí và hiển thị cảnh báo, nên không hứa pixel-perfect với mọi PDF.
- `revision_ms` cùng nội dung trong cùng millisecond không gây khác biệt semantic, nhưng `_REINDEX_PENDING` vẫn là in-memory/per-process; muốn an toàn đa worker cần revision bền vững hoặc queue dùng chung.
- Chưa có E2E đăng nhập production/storage thật trong phiên này; hành vi đó được kiểm bằng controller EF InMemory và browser fixture, không dùng CV thật hay secrets. Mọi thay đổi vẫn chưa commit; không reset working tree rộng.

## Yêu cầu hiện tại
- Kiểm tra việc phiên trước đã làm; hoàn tất runtime, skill graph, test chuyển CV cũ/chia sẻ/AI sync.
- CV tải lên phải sửa được trên bố cục gốc, không âm thầm chuyển sang template khác.
- Ghi checkpoint để đổi tài khoản nếu gặp quota. Không đọc được quota tài khoản từ công cụ.

## Đã xác minh trước khi sửa
- AiCore: `D:/ThucTap/AiCore`; log bàn giao cũ: `docs/AGENT-SYNC.md` trong repo đó.
- Aris: workspace hiện tại; Studio: `ArisSkyve/resume-engine`.
- AiCore chạy cổng 8001 (PID 11204, launcher 2728); Aris 5025 (PID 2780). Parser 8765 chưa chạy.
- Code CV mới có trong `ResumeEngineController`, `LegacyResumeConverter`, `Coach.tsx`.
- Luồng legacy vẫn tái cấu trúc sang template t1. Chưa có importer giữ bố cục.
- Save gửi reindex bằng Task.Run, bỏ qua lỗi. AiCore reindex chưa có test riêng.
- Chạy lại ban đầu: cv_structure + skill_graph **33 passed**; parser **19 passed**.
- Chưa restart hay dựng graph trong phiên này. Chưa xác nhận toàn bộ test.

## Đang làm
1. Sửa đồng bộ nội dung sau lưu và thêm test thực thi controller/reindex.
2. Thêm nhập PDF giữ tọa độ chữ, nền bỏ chữ cũ; nối editor/lưu/chia sẻ/AI.
3. Test fixture, build, restart đúng process; dựng lại skill graph; ghi kết quả.

## Lưu ý
- Working tree có nhiều thay đổi người dùng/phiên trước; không restore/reset.
- Giữ LF: JobApplicationsController.cs, jobs.css, jobs.js, _RecommendedJobsPartial.cshtml.
- AiCore ở ngoài writable root: mọi ghi/chạy cần quyền sandbox phù hợp.
- Không lấy CV thật để gọi model bên ngoài. Fixtures hư cấu cho kiểm thử.
- PyMuPDF tham khảo: https://pymupdf.readthedocs.io/en/latest/page.html (redaction xóa chữ nhưng giữ ảnh/vector).

## CHECKPOINT DỪNG THEO YÊU CẦU USER — 04/10/2026

User yêu cầu dừng và tạo prompt nối tiếp. Không coi công việc đã hoàn tất.
Mục "Đang làm" phía trên là kế hoạch lúc bắt đầu; trạng thái mới nhất nằm dưới đây.

### Thay đổi đã thực hiện
- `ArisSkyve/Controllers/ResumeEngineController.cs`: lưu ExtractedFullText/SearchVectorContent cùng tài liệu;
  await AI acknowledgement tối đa 8 giây, trả aiSync (scheduled/too_short/pending); gửi revision_ms.
  Nới payload cho layout; parse nhận mode; giữ PDF gốc riêng trong App_Data/resume-originals/{userId};
  thêm original/{sourceId} có kiểm tra user, import-layout cho file CV từ storage được phép.
- `LegacyResumeConverter.ToPlainText`: importedLayout dùng chính chữ trên các trang đã sửa làm nội dung AI.
- `resume-engine/server/layout_parser.py`: tách tọa độ/font/màu span từ PDF; xóa chữ bằng redaction,
  giữ ảnh/vector rồi raster hóa nền JPEG. Không gửi CV sang model ở mode layout.
- `server/app.py`: thêm mode layout/template. Chế độ layout chỉ hỗ trợ PDF có text; DOCX/scan/chữ xoay
  bị từ chối rõ ràng, không fallback âm thầm. Máy chưa có LibreOffice/Tesseract.
- `src/schema.ts` + contract sinh lại: importedLayout với pages/background/elements/warnings/sourceId;
  email cho phép rỗng khi file không có email (không bịa email).
- `src/ImportedDocument.tsx`, `imported-document.css`: chọn và sửa khối chữ, tọa độ, kích thước, màu,
  đậm/nghiêng; nền không chứa chữ cũ; named print pages giữ kích thước từng trang.
- `src/Studio.tsx`: phân biệt nhập giữ bố cục và chuyển mẫu; hỏi cách mở CV upload cũ;
  render layout ở editor/public; lưu/reload trong canonical JSON; thông báo AI pending.
- `src/Coach.tsx`: phân tích lại sau khi nội dung đổi; không chấm điểm theo mục template cho layout PDF;
  ẩn nút tự thêm kỹ năng vào canonical vì không phản ánh trang PDF.
- `.gitignore`: bỏ qua original PDF riêng tư.
- AiCore `D:/ThucTap/AiCore/main.py`: reindex có revision_ms, SQL guard chống HTTP cũ ghi đè;
  lưu cả nội dung ngắn/rỗng, invalidate recommendation cache; bỏ kết quả extraction cũ;
  background_process_cv thêm optional reindex_token và kiểm tra trước khi ghi SQL.
  Backup trước sửa: `.local/aicore-main-before-cv-sync.py`.
- AiCore có test mới `tests/test_cv_reindex.py` (bản staging trong `.local/aicore-test_cv_reindex.py`).

### Kết quả đã xác minh
- AiCore: `python -m pytest tests -q -p no:cacheprovider` **350 passed, 2 warnings**.
  Log `.local/aicore-regression.log`; riêng reindex mới **12 passed**.
- Parser: `python -m unittest discover -s ArisSkyve/resume-engine/server -p 'test_*.py'`
  **27 passed**, gồm 8 test layout mới.
- TypeScript `tsc --noEmit` đã qua sau nối frontend; `node build.mjs` đã build bundle mới
  (wwwroot/resume-engine/app.js khoảng 17:51). Cần chạy lại check/build sau mọi sửa tiếp.
- Lượt `dotnet build ArisSkyve/ArisSkyve.csproj --no-restore -p:UseAppHost=false -o .local/cv-session-build -v quiet`
  trước các chỉnh sửa cuối: **0 errors, 62 warnings**. Không coi đây là build xác nhận source cuối.
- Browser mới: `node tests/layout-browser.mjs` từ resume-engine **14 checks passed, errors []**.
  Report `.local/cv-browser/report.json`; ảnh layout-desktop.png, layout-public-mobile.png, edited.pdf.
  Đây là API fixture/in-memory với bundle thật, không phải luồng production DB.
  Kiểm tra: 2 trang, chỉnh chữ/tọa độ, save/reload, AI pending, Coach nhận chữ mới,
  publish/unpublish, public không có nút sửa, mobile không tràn document viewport, upload mode layout.

### Chưa hoàn tất / bước tiếp theo
1. Test C# mới `tests/ResumeFlowTests/Program.cs` + csproj đã viết nhưng CHƯA chạy thành công.
   Lần `dotnet run` lỗi NU1301 vì sandbox không tới NuGet (log `.local/cv-flow-tests.log`).
   Đã thử restore từ cache local rồi build output riêng, nhưng tool bị user ngắt;
   chưa có kết quả `.local/cv-flow-build.log`. Kiểm tra tiến trình còn chạy trước khi gọi lại.
   Lệnh dự kiến:
   `dotnet restore tests/ResumeFlowTests/ResumeFlowTests.csproj --source C:/Users/tohka/.nuget/packages -p:NuGetAudit=false`
   `dotnet build tests/ResumeFlowTests/ResumeFlowTests.csproj --no-restore -p:UseAppHost=false -o .local/cv-flow-build`
   `dotnet .local/cv-flow-build/ResumeFlowTests.dll` (cwd root repo).
   Fixture `.local/cv-layout-fixture.json/.pdf` đã có; tạo từ test_layout_parser.fixture, hoàn toàn hư cấu.
2. Mở screenshot và kiểm tra edited.pdf bằng PyMuPDF: đúng số/kích thước trang, chữ mới có thật,
   trang đầu không còn chữ cũ, ảnh/trang trí còn. Browser đã tạo PDF nhưng CHƯA kiểm tra nội dung PDF.
3. Chạy suite Studio cũ `node tests/studio-browser.mjs`, smoke 64 layout/mode và toàn bộ
   `node tests/run_all_tests.cjs`; chưa chạy những suite này trong phiên vừa rồi.
4. Review góc cạnh trước chốt:
   - PDF span có thể wrap do font thay thế; kiểm tra hình thật, không gọi giữ nguyên 100%.
   - Legacy Publish vẫn tự chuyển sang t1 nếu tài liệu chưa vào Studio; cân nhắc có cần bắt chọn cách
     nhập trước khi public CV upload để không âm thầm đổi bố cục.
   - GetDocument legacy hiện vẫn gọi AI structure trước khi chọn giữ layout; có thể tránh lần gọi thừa.
   - Worker reindex kiểm tra token trong process, chưa phải hàng đợi bền vững; kiểm tra race giữa
     save ở Aris và worker đang ghi SQL/embedding trước khi ack reindex đến. Không khẳng định đảm bảo đa worker.
   - Đường fetch file gốc kiểm tra host ban đầu/URL ký nhưng HttpClient mặc định follow redirect;
     kiểm tra redirect nếu muốn khẳng định chặn hoàn toàn fetch ngoài storage.
   - Chữ OCR/vector-outline chưa được hỗ trợ; chỉ edit text, ảnh/hình trang trí vẫn là nền cố định.
5. CHƯA restart AiCore/Aris, CHƯA start parser 8765, CHƯA rebuild skill graph.
   PID lúc đầu: AiCore 11204 (launcher2728), Aris2780. Xác minh lại, không kill theo PID cũ mù quáng.
   AiCore cwd D:/ThucTap/AiCore, uvicorn main:app --host127.0.0.1 --port8001.
   Aris cwd ArisSkyve, dotnet bin/Debug/net10.0/ArisSkyve.dll --urls http://localhost:5025 --contentRoot <ArisSkyve>.
   Parser: python -m uvicorn app:app --app-dir server --host127.0.0.1 --port8765 từ resume-engine.
   Dựng skill graph: POST /api/v2/skills/graph/rebuild, đọc /graph/status; tuân thủ service-key cấu hình,
   không in key hoặc connection string. User đã yêu cầu restart/rebuild.
6. Cập nhật cả log này và `D:/ThucTap/AiCore/docs/AGENT-SYNC.md` khi hoàn tất.
   Log bên AiCore CHƯA được cập nhật trong phiên này (chỉ source/test đã sửa).

### Công cụ/quyền
- Chrome headless, kiểm tra PID bằng Get-CimInstance, build frontend spawn và ghi ngoài root AiCore
  đã chạy qua require_escalated/auto-review. Không có rejection cần user duyệt thêm.
- Không chạy lại `.local/update-aicore-reindex.py` hay `.local/finish-studio-layout.py`: đây là patch một lần,
  chạy lại sẽ lỗi hoặc ghi đè backup. Source đã được áp dụng.
- Không sửa/copy lại 4 file được yêu cầu giữ LF; phiên này không đụng chúng.
