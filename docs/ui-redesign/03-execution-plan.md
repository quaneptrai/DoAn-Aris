# Implementation orchestration and validation plan

This is work for the next agent. No application implementation described here was performed during the audit.

## Working contract

Preserve ASP.NET Core MVC/Razor, Bootstrap, the existing SQL Server schema history, and working social/recruiting capabilities. Refactor in small vertical slices. Start from the evidence in `01-audit.md`; use `02-design-direction.md` for intended design. Distinguish a proposed feature from an existing endpoint. Do not report a compile pass as a flow pass or an HTTP 302 as successful authentication.

This folder has no Git root in the supplied checkout. Before edits, create a source backup or establish a repository according to the workspace owner's normal process. Exclude build outputs, real uploads, local secrets, browser profiles and credentials from any future commit. Do not overwrite unrelated changes.

Use a coordinator and bounded workers if the next session authorizes delegation. Otherwise one agent can execute the same work packages sequentially. A sensible maximum is coordinator plus three active workers; do not run overlapping shared-file edits.

| Role | Responsibility | Exclusive ownership while active |
|---|---|---|
| Coordinator / full-stack lead | Reproduce findings, define contracts, integrate work, report gates | Program.cs and cross-cutting configuration unless explicitly delegated |
| Backend / local-runtime engineer | Local setup, identity, routes, contracts, persistence | Assigned controllers/DTOs/services/migrations; coordinate before changing shared models |
| Designer / UI engineer | Reference analysis, Figma if available, tokens, shells, page composition | Shared theme/layouts/navbar, then explicitly assigned view families |
| QA / integration engineer | Fixtures, meaningful regression tests, browser journeys, evidence | Test project/evidence/docs; does not silently change implementation to make tests pass |

After shared-shell integration, page workers can work independently on account pages, jobs/employer pages, and home/profile/communication pages. Shared CSS and Program.cs retain a single owner. For each task deliver changed paths, contract changes, test output, screenshots where applicable, and remaining limitations.

## Dependency order

1. **G0: repeatable baseline.** Backup/version control, build, isolated database, service/configuration inventory, fixtures. Design reference research may run alongside this.
2. **G1: safe and reachable flows.** Onboarding ownership, auth challenge, route fixes, error pages, server validation. No high-fidelity sign-off while these are unresolved.
3. **G2: coherent foundations.** Agreed tokens, real application shell, shared controls/overlays and reference compositions. API/query contracts for jobs/CVs agreed.
4. **G3: priority journeys.** Account → onboarding → Jobs → details → CV → application, plus the Dashboard social home. Use real seeded data.
5. **G4: complete product coverage.** Employer/company, profile/CV, applications, chat/interview, settings/social selection, notifications/search and failure states.
6. **G5: local acceptance.** Browser/API tests, two-user ownership tests, offline/provider failure, accessibility and screenshot review. Fix failures and rerun affected tests.
7. **G6: online readiness.** Deployment package and configuration matrix, staging verification, migrations/storage/proxy/provider checklist, rollback plan. Actual deployment requires a confirmed target and the user's deployment authorization; this audit does not deploy.

Do not hold engineering work for inaccessible inspiration files. Create original layouts from the brief and record which Figma references remain unverified.

## Work packages

### T00 — Baseline and source protection

**Owner:** coordinator. **Depends on:** nothing. **Size:** small.

- Record SDK/runtime, source tree, current build diagnostics and actual hosting assumptions.
- Establish source backup/version control without copying configuration secrets into a public repository.
- Identify all existing tests/tools; none were apparent in the inspected project.
- Confirm the online destination from the owner/configuration without using deployment credentials or publishing.
- Preserve the audit screenshots and source evidence.

**Done:** a clean baseline is reproducible; changed source can be reviewed and reverted; developer commands are documented.

### T01 — Isolated local runtime

**Owner:** backend. **Depends on:** T00. **Size:** medium. **Files:** Program.cs, Infrastructure/Data/DbSeeder.cs, configuration templates, development documentation; new service boundaries as needed.

- Choose LocalDB or a local SQL Server instance. Use SQL Server behavior, not an in-memory provider, for migration/integration verification because the model contains SQL-specific constructs/computed activity state.
- Configure a clearly named local database such as `ArisSkyve_Dev`; verify the actual resolved server before applying migrations or seeding.
- Make seed execution explicit, idempotent and local-only. The presence of Development alone must not authorize writes to a remote database.
- Review migrations from empty database before applying; preserve existing migration history. Add a separate existing-schema upgrade exercise when relevant.
- Add local fixtures for all roles/states below. Never import production personal data.
- Separate essential configuration from optional providers. Enable social providers only when configured; show honest unavailable states when disabled.
- Provide local mail capture/delivery adapter for magic links. Do not add an unrestricted email-only login or publicly reachable demo-user selector.
- Keep AI recommendations/import/weather/social sharing optional; define deterministic local stubs where needed. An API service missing from this repository must not prevent basic login, browsing or editing.

**Done:** documented fresh-machine commands lead to Login and seeded core journeys with no remote database or real mail dependency; nonlocal seed attempt is refused.

### T02 — Authentication, onboarding ownership and validation

**Owner:** backend. **Depends on:** T01. **Size:** large. **Files:** Program.cs, AccountController, ProfileController, NewUserInforDTO, EducationDTO, account views as coordinated with UI owner.

- Model verified-but-incomplete identity explicitly; complete onboarding using that identity, not request-selected user ID.
- Guard GET/POST ownership and CSRF; ensure existing users cannot be silently modified by registration fields.
- Route ordinary auth challenges to Login; provider buttons remain explicit. Preserve only safe local return destinations.
- Define behavior for missing/invalid email claims, denied OAuth, expired/replayed magic links and concurrent account creation. Rate-limit request/resend without inventing delivery success.
- Make magic-link token replay policy explicit. Existing HMAC tokens have no persisted consumed state; if one-time use is claimed, implement atomic consumption rather than changing copy alone.
- Restore all onboarding values and correct visible step after server rejection. Remove case-ambiguous education properties through reviewed DTO mapping.
- Replace blanket required-field checks with conditional rules. Desired company is optional; not-looking users are supported.
- Protect Profile actions and handle stale/deleted users, null profiles and wrong-owner updates.
- Audit mutating cookie-auth endpoints for antiforgery consistently. Adding a global filter requires updating fetch/jQuery and CV autosave/beacon behavior so it does not create new blocked flows.

**Done:** student/worker/returning-user flows complete; tampered user ID, anonymous POST, expired onboarding and missing CSRF do not change data or create a session; inputs survive errors; expired API sessions return a consumable response.

### T03 — Route, error and navigation repairs

**Owner:** backend with UI integration. **Depends on:** T01. **Size:** small/medium.

- Fix `/Resume/Index` versus `/Resume` at every producer; preserve full/partial list contracts.
- Fix all interview link producers or add a deliberate route shape; use route helpers for server markup and a consistent generated URL contract for JSON/JS.
- Implement a real exception destination and styled 403/404/error recovery pages.
- Replace missing avatar fallback and stale Home links wherever those layouts are used.
- Inventory every href, form target, fetch/jQuery endpoint, deep link and callback. Placeholder anchors must be a deliberate scripted control or replaced.
- Ensure notification, search and invitation destinations survive refresh and direct entry.

**Done:** route regression tests cover canonical and supported legacy URLs; navigation has no unexplained 404/500; failed items lead to useful recovery.

### T04 — Design research and foundations

**Owner:** designer. **Depends on:** T00; can run alongside T01–T03. **Size:** medium.

- Inspect available reference files without assuming the discovery listings prove their contents. Record license and creator attribution.
- Create tokens/components and responsive compositions from the brief; preserve the trajectory logo and practical blue palette.
- Produce Register, onboarding, candidate Jobs and social Dashboard first, including default/empty/error and mobile variants.
- Resolve layout spacing, content hierarchy, navigation roles and Vietnamese copy before polishing decorative motion.
- If Figma access exists, build native auto-layout frames and component variants using required skills; otherwise provide reviewable local design specifications and later capture the rendered implementation when the connection is available.

**Done:** exact page composition, variants, breakpoints and data expectations are documented. Each visual element has an implementation mapping or is labeled a proposal.

### T05 — Shared shell, controls and overlay stack

**Owner:** UI engineer. **Depends on:** T03, T04. **Size:** medium/large.

- Replace the unusable default layout with a real shared application shell or introduce a new named shell, then migrate one reference page first.
- Consolidate fonts, Bootstrap/icons, theme loading, toast/error handling and script sections. Preserve script initialization order for partials, chat and CV tools.
- Centralize component styles in scoped layers; avoid a global selector sweep that unexpectedly restyles the static CV builder.
- Standardize navbar active states, mobile search/navigation, avatar/notifications, focus styles and skip link.
- Establish one overlay hierarchy, scroll-lock behavior and keyboard focus contract across Bootstrap modals, lightboxes, menus and chat widget.
- Add reduced-motion behavior to CSS and JS effects. Use local/pinned dependencies where practical for reliable dev behavior.

**Done:** migrated reference pages render once, initialize handlers once, have no duplicate nav/chat widget, and preserve existing interactions. Overlay tests pass at mobile/desktop sizes.

### T06 — Account UI and onboarding

**Owner:** UI engineer. **Depends on:** T02, T05. **Size:** medium.

- Implement the Register/Login/confirmation/error states and verified onboarding design.
- Adapt the existing five-step data model to the agreed visual stages without losing fields.
- Add inline validation, step focus, restored values, optional preferences and privacy explanation.
- Replace public Nominatim typeahead with an allowed, resilient locality interaction.

**Done:** local email/provider-fixture journeys complete at 390 and 1440px; 320px/zoom/keyboard checks pass; no success statement appears before the corresponding server outcome.

### T07 — Job discovery and detail contracts

**Owner:** backend + page UI owner. **Depends on:** T02, T03, T05. **Size:** large. **Files:** JobsController, JobsIndexViewModel, job views/partials, SearchController as needed.

- Define server query/filter/sort/pagination and total-count semantics. Make first render and subsequent pages use the same query/projection.
- Include locations consistently and guard missing profile before accessing its ID.
- Replace inert sort options and pagination. Do not silently filter to an AI category when a request finishes.
- Define genuine saved-job storage with user ownership and unique user/job pair if saved jobs are included; otherwise remove the misleading control until supported.
- Render recommended job reasons only when available; use bounded timeout and useful fallback. Avoid dead links when AI result cannot map to a local posting.
- Implement job-card/details/mobile-filter designs with accessible controls and stable return-to-results state.

**Done:** a matching job outside the initial five is found; filter/sort survives page changes and back navigation; no duplicated/skipped items; counts are accurate; normal jobs work while AI is down; location agrees across surfaces.

### T08 — CV lifecycle and applications

**Owner:** backend + profile/CV UI owner. **Depends on:** T02, T03, T05; coordinate with T07. **Size:** large.

- Fix list route and partial rendering; unify upload, builder, rename, delete, preview and application readiness.
- Move environment-specific CV requests behind clear configurable contracts. Verify upload size/type and ownership server-side.
- Define the application artifact for builder-created CVs: rendered file or authenticated snapshot viewer. Do not snapshot an absent FileUrl and report a usable application.
- Preserve submitted versions when candidates edit/delete drafts. Review storage-refresh authorization: a known storage URL alone must not grant unrelated users access to private CVs.
- Scope local draft data to user/resume; handle account switching, logout, multiple tabs, conflicts, offline edits and expired sessions.
- Distinguish saving to local storage, server persistence and export. Review sendBeacon JSON/antiforgery compatibility when changing the security model.
- Complete application modal, screening answers, submitted/duplicate/withdrawn behavior, and candidate status timeline.

**Done:** uploaded and builder-created CVs can be submitted and opened by the correct employer; unrelated employer cannot access them; edits do not alter old application snapshots; offline/failed saving is visible and recoverable.

### T09 — Social Dashboard and Profile

**Owner:** home/profile UI owner. **Depends on:** T05, T08 for CV tab integration. **Size:** medium/large.

- Apply compact career-home composition while retaining posts/articles/media/likes/comments.
- Remove hardcoded profile analytics/sample recommendations or connect real defined data sources.
- Implement real empty states and a profile completion model based on documented fields.
- Preserve and test composer drafts, upload feedback, post ownership menus, lightbox and comment focus.
- Resolve ten-item feed limits and shared-post deep links; do not show fake paging.
- Keep weather optional and fail quietly without covering primary content.

**Done:** complete social interactions persist correctly; all profile tabs work; no fabricated counts; no obscured dialog controls; mobile feed remains readable.

### T10 — Employer and company workflows

**Owner:** jobs/employer engineer. **Depends on:** T07, T08. **Size:** large.

- Review UpgradeToBusiness persistence before relying on its type/discriminator conversion; verify existing profile/CV/contact relations survive and rollback is safe on failure. Treat comments claiming this works as hypotheses until tested.
- Redesign employer overview, business Jobs variant, editor, applicant table/drawer, rejection and scheduling dialogs.
- Use real metrics with explicit periods; remove placeholder table pagination and decorative operational clutter.
- Complete company directory/details/edit layouts and enforce owner-only editing.
- Keep publishing and external sharing separate outcomes. A failed social provider should not make a saved job appear unsaved or cause duplicate posting.

**Done:** candidate-to-business upgrade fixture retains data; a business can publish and manage its job; another business cannot edit it; candidate sees the correct status and invitation.

### T11 — Communication, interviews, settings and integrations

**Owner:** communication engineer. **Depends on:** T02, T03, T05, T10. **Size:** large.

- Apply shared navigation/styles to chat, interview and Facebook Page selection without breaking hub lifecycle.
- Verify friend requests, accepted connections, message send/reply/forward/attachment and reconnect.
- Implement prejoin camera/microphone state and meaningful video connection fallback. Require correct candidate/employer room membership in controller and hub.
- Organize Settings, channel connection/selection/disconnection and username/avatar/cover changes with accessible feedback.
- Preserve notifications and mobile search. Hide unavailable integrations or explain availability honestly; no raw provider-token workflow in ordinary user setup.
- Hosted video tests require secure context, WebSocket support and cross-network TURN verification; localhost success is insufficient.

**Done:** two local users can complete communication/interview fixture journeys; failure states recover without reload loops; provider sandbox tests are separately recorded when available.

### T12 — Local acceptance and integration review

**Owner:** QA; coordinator closes gate. **Depends on:** T06–T11. **Size:** medium/large.

- Run the matrix below with local disposable fixtures.
- Add regression tests for material defects and ownership/contract behavior. Avoid tests that merely assert decorative class names.
- Record browser console errors and failed network requests per journey, plus screenshots at the specified widths.
- Test actual keyboard/focus and mobile navigation, not only screenshot similarity.
- Review DOM interpolation of user/provider content in shared post, search, recommendation and chat renderers; preserve text escaping during redesign.
- Run build/tests appropriate to changed areas. Repeat broader checks only when integration changes or failures justify them.

**Done:** no open P0/P1 in supported local journeys; remaining optional-provider limitations are explicit; every page has a tested route, role and failure state.

### T13 — Online readiness package

**Owner:** coordinator/backend. **Depends on:** T12. **Size:** medium; provider availability may affect elapsed time.

- Prepare release artifacts and a staging configuration matrix with secrets referenced by name only.
- Confirm domain/base URL, host .NET 10 support, SQL compatibility, writeable durable media paths and data-protection key persistence.
- Review migration script, backup, rollback/forward-fix plan, health checks and deployment procedure.
- Verify HTTPS/proxy forwarded-header handling for the actual host. Trust only known proxies/networks; do not broadly trust arbitrary forwarded hosts. Ensure generated callback/magic links use the public scheme/host. [Microsoft proxy guidance](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0).
- Register exact Google/Facebook login and social-sharing callback URLs separately; prove cancel/error paths as well as success. Verify required Auth:MagicLinkSecret exists in hosting configuration without printing it.
- Confirm no Development seeds/demo auth/local mail stubs are active. Set actual allowed hosts and review configured credentials already present in the source snapshot.
- Test upload limits, expiring media URLs, browser CORS/mixed-content, SignalR/WebSockets and video across two networks.
- Run staging smoke journeys with dedicated test accounts. Do not trigger real social publishing or production emails merely to demonstrate UI readiness.

**Done:** staging evidence and release checklist are reviewable, unresolved infrastructure/provider requirements have owners, and the final deployment action is ready for explicit authorization if it was not previously provided.

## Local configuration and runbook for the implementing agent

Current launch profiles use **http://localhost:5025** and **https://localhost:7196**. Keep those stable unless there is a documented port conflict, because OAuth callback registration depends on them. The audit used `127.0.0.1:5025` only for isolated checks; localhost and 127.0.0.1 are not interchangeable callback identities.

| Area | Existing configuration / contract | Local development target | Online target |
|---|---|---|---|
| Database | `ConnectionStrings:DefaultConnection` | Verified LocalDB/local SQL, disposable fixtures | Dedicated hosted SQL; reviewed migrations |
| Google/Facebook auth | `Authentication:{Provider}:ClientId/ClientSecret` | Optional sandbox credentials or disabled provider | Host secret store and exact registered callback |
| Email links | `Auth:MagicLinkSecret`, AiCore `/send-verification-email` | Local-only secret and capture inbox adapter | Real sender service and configured public URL |
| AI/API | `AiCore:BaseUrl` plus current hardcoded exceptions | Local service/stub with explicit degraded behavior | Configured TLS service; no loopback assumptions |
| CV storage | Current fixed storage host + refresh endpoint | Local test storage/viewer fixture | Durable private storage with ownership and renewed URLs |
| Video relay | `Metered:AppName/SecretKey` | Optional relay for cross-network tests | Production relay with tested credentials/limits |
| Social | `Social:Facebook`, `ZaloOa`, `ZaloBot`, `N8n` | Disabled by default or provider sandbox | Separate secrets, registered webhooks, controlled publication |
| Local CV AI | Browser Ollama endpoint | Optional developer feature | Explicit opt-in or hosted adapter; ordinary editing independent |
| Weather/location/fonts/icons | External browser services | Local fallback/optional loading | Bounded failure behavior and appropriate provider usage |

After T01 supplies safe setup and validates the database target, document runnable equivalents of:

```powershell
dotnet --info
dotnet restore ArisSkyve/ArisSkyve.csproj
dotnet build ArisSkyve/ArisSkyve.csproj --no-restore
# Set the local-only connection/secret configuration before any database command.
# Use the reviewed SQL Server migration procedure or a repo-local EF tool manifest.
dotnet ef database update --project ArisSkyve/ArisSkyve.csproj
dotnet dev-certs https --check
dotnet run --project ArisSkyve/ArisSkyve.csproj --launch-profile https
```

These are **future implementation steps**, not commands already run by this audit. `dotnet ef` requires its tool installation/manifest; add the matching supported version to the setup documentation. Do not run database update using the current unverified remote connection. Trust/install a development certificate only if the local browser workflow requires it and report that machine-level action.

## Required local fixtures

| Fixture | Purpose |
|---|---|
| Anonymous visitor | Login routing, public shell and expired session |
| Newly verified student | Education binding, privacy and completion |
| Newly verified experienced worker | Job title branch and preferences |
| Candidate not currently searching | Optional preferences and nonblocking onboarding |
| Candidate A with uploaded CV | Application, preview, ownership and snapshot |
| Candidate B with builder-created CV | Export/viewer readiness, independent identity |
| Incomplete/stale/deleted user | Null handling and onboarding return |
| Employer A with jobs | Applicant and company ownership |
| Employer B with a different company | Negative authorization tests |
| Employer with no jobs | Empty state and first posting |
| 12+ jobs including a match beyond item five | Real filtering and pagination |
| Jobs with missing logo/salary/location, long title, expired deadline | Robust card/details rendering |
| Applications in every existing status | Correct status/actions; no invented transitions |
| Accepted and pending friendships; unread notifications | Network/chat/menu behavior |
| More than ten posts, including shared older post | Feed limit and deep-link behavior |
| Provider timeout/rejection fixtures | Honest failure states without real external side effects |

Use deterministic fixture identifiers in tests and capture only synthetic personal data in screenshots. Seed via local fixture setup, not by calling production providers.

## Acceptance matrix

Record Pass / Fail / Blocked / Not run for each row with route, account fixture and evidence. Do not leave blank cells at completion.

| ID | Scenario | Expected result | Level |
|---|---|---|---|
| A01 | Fresh local database + reviewed setup | Migrations and opt-in seed succeed; second seed does not duplicate | Integration |
| A02 | Attempt seeding nonlocal target | Refused before writes | Integration |
| A03 | Signed-out Jobs/Company/Resume navigation | Login choice and safe return URL | HTTP/browser |
| A04 | Expired session during fetch/autosave | 401 handled; draft retained; no provider HTML parsed as data | Integration/browser |
| A05 | Register invalid email, accepted send, timeout, resend | Correct field/delivery states without real mail | Browser + mail fixture |
| A06 | Magic link valid, invalid, expired and replay | Defined secure behavior; no duplicate account/session escalation | Integration |
| A07 | OAuth success/cancel/missing email | Complete account flow or usable recovery | Provider sandbox/fixture |
| A08 | Tamper onboarding target ID or omit verification | No profile write and no issued application session | Integration |
| A09 | Student/worker/not-looking onboarding | Correct conditional fields and persisted values | Browser/integration |
| A10 | Invalid onboarding POST and refresh/back | Identity, fields, branch and step remain correct | Browser |
| A11 | Missing CSRF on sensitive mutation | Rejected; valid frontend submission still works | Integration |
| A12 | Anonymous or stale user opens Profile | Login/setup/recovery, never unhandled 500 | HTTP/integration |
| A13 | Profile CV tab and direct `/Resume` | Correct partial/full rendering, same records | Browser |
| A14 | Interview links from Jobs, Chat, applications | All resolve to agreed route | Route/browser |
| A15 | Interview wrong participant or missing/nonvideo record | Access refused/useful error; no room data leak | Integration |
| A16 | Job match beyond first five, filter + sort + paging | Accurate full-dataset result/count; no duplicates | Integration/browser |
| A17 | Job initial vs appended vs detail location | Same truthful location metadata | Integration |
| A18 | AI absent, slow, unmapped result, no profile/CV | Normal jobs usable; clear recommendation fallback | Integration/browser |
| A19 | Bookmark, reload and second account | Persists per owner if shipped; otherwise control absent | Integration/browser |
| A20 | Upload unsupported/oversized/failing CV | Safe validation, no false success, retry available | Integration/browser |
| A21 | Builder create/edit/save/reopen/export | Correct document and distinguishable sync status | Browser |
| A22 | Logout/account switch/multiple CV drafts | No prior user's draft displayed or saved as new user's CV | Browser/integration |
| A23 | Apply uploaded CV and builder CV | Correct employer can open the submitted artifact | End-to-end |
| A24 | Edit/delete source CV after submission | Submitted snapshot follows explicit retention policy | Integration |
| A25 | Apply closed job/duplicate click/invalid answers | No invalid/accidental duplicate state; useful feedback | Integration/browser |
| A26 | Withdraw and terminal application statuses | Allowed actions match actual status policy | Integration/browser |
| A27 | Business upgrade and failed upgrade | Related profile/CV/contact data preserved or safely rolled back | Integration |
| A28 | Business creates/edits job; other business attempts edit | Correct persistence and enforced ownership | Integration/browser |
| A29 | Review/reject/schedule/reschedule/respond | Candidate and employer see consistent persisted state | End-to-end |
| A30 | Composer/media/like/comment/edit/delete | Ownership and count consistency; failed requests preserve context | Browser/integration |
| A31 | Shared post outside initial ten | Requested post loads or supported recovery; no misleading empty destination | Browser |
| A32 | Chat reply/forward/image/reconnect | Messages persist once; reconnect and failure visible | Two-browser |
| A33 | Video no device/denied/offline/relay failure | Useful prejoin/call recovery; leave works | Two-browser/provider |
| A34 | Company/profile/settings updates | Correct owner, validation and durable feedback | Browser/integration |
| A35 | Facebook selection no pages/denied/expired | Clear outcome and return to Settings | Provider fixture/sandbox |
| A36 | Navigation, notifications and search links | Correct routes and contextual destinations | Browser |
| A37 | Keyboard: navbar, filters, tabs, modals, lightbox | Named controls, visible focus, trap and restoration | Manual browser |
| A38 | 320/390/768/1024/1440px + 200% zoom | No accidental horizontal overflow/hidden primary controls | Browser screenshots |
| A39 | Reduced motion and external assets unavailable | Core tasks usable, no endless decorative motion | Browser |
| A40 | 404/403/unexpected error | Real branded recovery, no exception-loop/missing route | HTTP/browser |
| A41 | Staging HTTPS, restart, reverse proxy | Correct callbacks/cookies, no redirect loop, persistence retained | Staging |
| A42 | Staging two networks, private CV and provider failure | Relay/media/session/integration behavior proven or explicitly blocked | Staging |

Core screenshot set: Login/Register (default, sent, failure), onboarding each branch/error, Jobs (results/no matches/provider failure/mobile filters), Details/apply, Dashboard (feed/empty/composer), Profile tabs, Employer table/applicants, Company edit, Chat mobile/thread, Interview prejoin/error, Settings/provider selection, CV picker/builder/save failure and recovery pages.

## Copy-ready worker instructions

**Backend worker:** Read the audit and complete T01–T03 before feature expansion. Reproduce defects using disposable local SQL data; never exercise onboarding tampering on real accounts. Preserve provider choice and ownership, correct routing, and make configuration failure understandable. Coordinate Program.cs edits with the lead. Return exact changed files, migration effects, test evidence and unresolved external dependencies.

**Design/UI worker:** Read the design direction and evidence; inspect accessible Figma references with attribution, then create an original Aris design preserving the logo/blue identity. Complete tokens/shared shell before page-specific polish. Prioritize Jobs, Register, NewUserInfor and Dashboard, then cover every inventory row. Implement full responsive and async states, semantic controls and reduced motion. Coordinate field/endpoint changes with backend. Return screenshots tied to real routes and a component mapping.

**QA worker:** Treat this audit as a baseline rather than a completion report. Execute the acceptance matrix on isolated fixtures. Verify account/role boundaries, errors, route shapes, form restoration and CV artifact readiness before aesthetic sign-off. Report observed HTTP/UI behavior, steps and synthetic fixture IDs. Mark external-provider and staging cases Blocked/Not run when unavailable; never infer they pass from mocks.

**Coordinator closing instruction:** Integrate without overlapping shared files, review every visible CTA against a real handler and permitted role, and require evidence for every completed gate. Provide a concise completion report plus remaining blockers. Prepare deployment only after the local gate passes; do not conflate a polished screenshot with a working product.
