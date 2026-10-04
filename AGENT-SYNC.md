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
