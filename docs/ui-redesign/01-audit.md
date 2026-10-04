# Current UI and flow audit

## Evidence vocabulary

- **Runtime confirmed:** observed on the isolated local host during this audit.
- **Source confirmed:** behavior is evident in the inspected implementation; it was not necessarily exercised with authenticated data.
- **Needs reproduction:** plausible issue requiring a seeded local account or provider test.
- **Proposal:** intended future behavior, not an existing feature.

Source locations below are relative to `ArisSkyve/`. Line numbers describe the snapshot inspected on 18 September 2026 and may move after edits.

## Architecture and current design

The application is .NET 10 ASP.NET Core MVC with Razor views, SQL Server through Entity Framework Core, Bootstrap, jQuery/fetch, and SignalR chat/video signaling. There is also a standalone HTML/JavaScript CV picker and builder under `wwwroot/cv-builder`. Authentication combines cookie sessions, Google, Facebook, and email magic links. `AiCore:BaseUrl` defaults to a remote service; some browser calls hardcode that service separately.

Useful existing design assets:

- `wwwroot/img/logo-mark.svg` and repeated trajectory-mark SVGs establish a recognizable brand.
- `wwwroot/css/aris-theme.css` defines Inter, blue accents, neutral surfaces, rounded cards, and a shared navbar.
- `Views/Shared/_AuthLayout.cshtml` provides a split authentication shell.
- `Views/Shared/Components/AppNavbar/Default.cshtml` provides navigation, global search, notification access, and role-dependent employer links.
- `_JobCardPartial`, `_RecommendedJobsPartial`, `_MyCvsPartial`, `_MyApplicationsPartial`, `_ChatWidget`, and shared action scripts already support reuse.

Most full views use `Layout = null`, carrying their own complete HTML document, dependency imports, CSS, and scripts. Jobs/Index is 1,736 lines, Dashboard/Index 2,400, Chat/Index 1,769, Employer/Index 912, and Profile/Index 869. These sizes are a maintainability signal rather than a performance measurement. They make shared changes, script ordering, overlay behavior, and consistent responsive layouts harder to reason about.

The default `_Layout.cshtml` still points at Home/Index and Home/Privacy, but no HomeController exists. Most actual screens bypass it. Do not blindly activate this layout across the app without replacing its navigation and assets.

## Full-page inventory

| Surface / current entry | Existing purpose | Audit and redesign emphasis |
|---|---|---|
| `/`, `/Account/Login` | Magic-link and social sign-in | Clear passwordless instructions, consistent locale, preserved return destination |
| `/Account/Register` | Same email-link mechanism, registration copy | Existing split composition is worth keeping; add explicit delivery/resend/error states |
| `/Account/NewUserInfor?userId=…` | Five-step location, work/education, intent, preferences, sharing form | Highest onboarding priority; ownership, validation, mobile shell, progress and optional fields |
| `/Jobs/Index` — Employee | Recommendations and five initial job cards | Search/filter/sort contracts, truthful result counts, usable job cards |
| `/Jobs/Index` — Business | Own postings, applicant management, posting and sharing modals | Distinct business workspace with shared primitives; avoid mixing candidate and employer tasks |
| `/Jobs/Details?id=…` | Job description and application entry | Scannable summary, clear eligibility/closed state and application action |
| `/Dashboard/Index` | Social/career home, composer, feed, profile and live stats | Preserve social product; reduce hero dominance and motion, prioritize useful next actions |
| `/Employer/Index` | Employer overview, funnel, postings | Legible operations dashboard using real counts; simplify decorative starfield/hero |
| `/Profile/Index` | Profile, bio/contact, posts, CVs and applications tabs | Repair CV route; remove invented metrics; explain privacy and editability |
| `/Resume` | Full CV list; AJAX partial for profile tab | Canonical route, complete lifecycle, builder-file availability |
| `/cv-builder/picker.html` | Template selection | Clear template preview and authenticated save behavior |
| `/cv-builder/builder.html` | CV editing, local draft and server sync, optional AI | Draft ownership, save/export status, no hidden local-provider requirement |
| `/JobApplications/MyApplications` | Application status and withdrawal; interview links | Status timeline, accurate actions, retry and empty states |
| `/Company/Index` | Company discovery wall/list | Searchable consistent cards, long names and empty data |
| `/Company/Details?id=…` | Company identity, details and jobs | Credible information, derived verification status, matching job-card language |
| `/Company/Edit` | Business profile editing | Grouped form sections, validation, image preview, unsaved changes |
| `/Chat/Index` | Conversations, network, invitations, rich messages | Three-pane desktop / single-pane mobile, reconnection, attachment failure |
| `/Interview/Room?id=…` | Candidate/employer video room | Repair all entry links; permission, waiting, connection and ended states |
| `/Settings/Index` | Profile assets, username, active status, business social channels | Organized sections, consistent feedback, availability of integrations |
| `/SocialConnect/SelectFacebookPage` | Select an authorized Facebook Page | Bring into shared shell; selection, permission, no-pages and expired-session states |

Jobs/Index has two role variants, so this table has 20 rows for **19 full-page surfaces** including the two static CV pages. Notification lists, global search, friends, application dialogs, job editor, sharing dialogs, comments and media lightboxes are additional interaction surfaces, not omitted pages. They need states and tests too.

## Local runtime evidence

Audited using `http://127.0.0.1:5025`, environment `Audit`, fresh build, no authenticated session. HTTP redirects were inspected without following Google. SQL and AI endpoints were overridden to `127.0.0.1` port 1, so no data-backed success is inferred.

| Request | Observed | Interpretation |
|---|---:|---|
| `/` | 200 | Default login route renders |
| `/Account/Login` | 200 | Login shell renders |
| `/Account/Register` | 200 | Register shell renders |
| `/Account/ConfirmMagicLink?token=invalid` | 200 | Invalid-token path returns login view; no sign-in attempted |
| `/Jobs/Index`, `/Dashboard/Index` | 302 to Google | Current default challenge bypasses login choice |
| `/Company/Index`, `/Employer/Index` | 302 to Google | Same default challenge |
| `/Settings/Index`, `/Chat/Index` | 302 to Google | Same default challenge |
| `/JobApplications/MyApplications` | 302 to Google | Same default challenge |
| `/Resume` | 302 to Google | Canonical route exists and is protected |
| `/Resume/Index` | 404 | Does not match attribute-routed controller |
| `/Interview/Room/1` | 404 | Does not match conventional route template |
| `/Interview/Room?id=1` | 302 to Google | Correct route shape exists and is protected |
| `/Profile/Index` | 500 | Anonymous claim is parsed without authorization/null guard |
| `/Account/NewUserInfor?userId=0` | 500 | Isolated DB intentionally unavailable; not evidence of failure with a valid DB |
| `/Home/Error` | 404 | Configured non-development exception endpoint is absent |
| `/images/default-avatar.png` | 404 | A fallback used by DashboardController is missing |
| `/css/aris-theme.css` | 200 | Shared CSS served |
| Both `/cv-builder/*.html` pages | 200 | Static shell accessible; saving still requires authentication |

Register screenshots were captured after settling and with explicit Chrome device metrics:

| Capture | Viewport | Measured document scroll width | Card width |
|---|---|---:|---:|
| Desktop | 1440 × 1000 | 1440 | 432 |
| Mobile | 390 × 844 | 390 | 334 |

No horizontal overflow was observed for Register at those sizes. An initial window-size-only capture was unreliable and was replaced by device-emulated evidence. Do not report that initial apparent clipping as an application defect.

Visual observations from Register: the trajectory motif, light form panel and dark showcase already form a coherent identity. The form is spacious but uses substantial vertical padding on mobile; the desktop mixes English form copy with Vietnamese showcase copy. The next design should retain the identity while tightening mobile spacing and explaining the magic-link step. Authenticated pages have not been visually verified in this pass.

## Defect and risk register

### B01 — P0: onboarding identity is controlled by the request

**Source confirmed.** `Controllers/AccountController.cs:60–137` loads GET by `userId`, loads POST by `dto.UserId`, updates that profile, and calls `SignInUserAsync(user)`. Neither onboarding action has an evident authorization/verified-onboarding ownership check. Program.cs does not establish a global authorization or antiforgery filter.

Impact: this is a release-blocking identity/ownership issue, not just a form bug. Do not reproduce against a real user's account.

Required outcome: after verified email/OAuth, issue a short-lived onboarding identity bound to that verified user. Derive the target user server-side. Reject anonymous, expired and mismatched submissions; protect the POST against CSRF. A simple `[Authorize]` added alone is insufficient because the new magic-link path currently redirects to onboarding before issuing the normal application cookie. Design the whole transition, including incomplete OAuth profiles and completion state.

### B02 — P0: development is not demonstrably isolated

**Source/configuration confirmed.** `Program.cs:55–61` invokes `DbSeeder.SeedCompaniesAndJobsAsync` at Development startup. The seeder checks `BussinessAccounts.AnyAsync()` and can create companies/jobs. Development user secrets contain a connection string classified as remote/unknown. Base and Development JSON do not provide a documented local SQL setup. Startup does not first apply migrations.

Required outcome: explicit local SQL database, reviewed migration setup and opt-in idempotent seed mode that refuses nonlocal targets. App startup must report missing configuration clearly. Do not point the current Development host at the shared database merely to obtain screenshots.

Configuration files contain populated credential-like values in Production and Development settings. Values were not copied into this documentation. Move sensitive configuration to appropriate secret stores and have the owner assess rotation before publishing or sharing the repository. This is a concrete source finding, not a generic compliance exercise.

### B03 — P1: broken CV-list route

**Runtime + source confirmed.** `Controllers/ResumeController.cs:19,82` combines `[Route("Resume")]` with `[HttpGet]` on Index. `Views/Profile/Index.cshtml:666` calls `/Resume/Index`, which returned 404. `/Resume` is the valid list route.

Required outcome: use generated routes consistently; support an intentional compatibility alias only if needed. Both full-page and `X-Requested-With: XMLHttpRequest` partial behavior must work without duplicate shells/scripts.

### B04 — P1: interview entry links return 404

**Runtime + source confirmed.** `Program.cs:93` uses `{controller=Account}/{action=Login}` without `{id?}`. Links in `Views/Jobs/Index.cshtml:609`, `Views/Chat/Index.cshtml:1179` and `Views/JobApplications/_MyApplicationsPartial.cshtml:50` use `/Interview/Room/{id}`. The query-string version resolves.

Required outcome: choose one route contract and update every producer, including notifications and new JavaScript markup. Keep `InterviewController` participant ownership checks and hub checks. Test correct participant, unrelated user, missing application, and non-video application.

### B05 — P1: default authentication challenge skips the login screen

**Runtime + source confirmed.** `Program.cs:26` sets Google as `DefaultChallengeScheme`. Cookie `LoginPath` exists but is not the default challenge. Protected HTML pages send anonymous visitors directly to Google.

Required outcome: protected HTML navigation reaches local Login with a safe local return destination; users choose email, Google or Facebook. Expired authenticated fetch/XHR requests return a machine-readable 401 rather than external provider HTML. Provider buttons explicitly challenge their provider. Verify .NET 10 endpoint-specific cookie behavior rather than assuming every MVC action is recognized as an API. [Microsoft cookie authentication documentation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/cookie?view=aspnetcore-10.0).

### B06 — P1: anonymous profile exception and missing error route

**Runtime + source confirmed.** `Controllers/ProfileController.cs:17–29` parses a potentially null user claim with no controller authorization attribute. `Program.cs:52` sends production exceptions to missing `/Home/Error`.

Required outcome: enforce authentication, handle a deleted user/incomplete profile, and provide real not-found, forbidden and unexpected-error surfaces. Errors must not recursively fail. Review Profile/AddContact and UpdateBio for the same authentication, ownership and CSRF expectations.

### B07 — P1: onboarding validation and redisplay can strand the user

**Source confirmed; specific form branches need reproduction.** `AccountController.cs:81–96` returns the view on invalid ModelState without repopulating ViewBag.UserId/Username. The hidden field uses ViewBag rather than the model. The GET DTO itself does not set UserId. `EducationDTO` defines both `Degree` and `degree`; validate binder behavior and remove ambiguity deliberately. On student redisplay, the education section begins hidden and the current job-title section begins visible until the toggle changes.

All visible inputs are forced nonempty by JavaScript, including desired company, even for people not seeking work. The page has no viewport meta, document language, shared theme, inline validation summary or progress indicator. Errors are browser alerts; successful/back transitions do not manage focus. Form data is logged to the console.

Required outcome: explicit conditional validation, optional desired company, correctly restored branch/step/values, inline error focus, a stable verified identity, and no personal-data console logging. Make student and experienced-worker fixtures part of the release gate.

### B08 — P1: browse controls overstate their functionality

**Source confirmed.** `JobsController.Index` loads five records. `GetJobs` pages unfiltered records. `Views/Jobs/Index.cshtml:1177–1204` filters only cards already in the DOM, so zero visible cards can be mistaken for zero matching jobs. Recommendation completion programmatically changes the selected filter. Sort links at lines 449–451 are placeholders with no evident handler. Applicant pagination at 1674–1677 is placeholder markup. `_JobCardPartial.cshtml:247` explicitly describes bookmark toggling as a nonpersistent visual affordance.

Required outcome: server-side query/filter/sort/pagination over the same dataset and stable state in the URL. Suggestions must not silently change a user's selection. Implement bookmarks end-to-end or remove the active-looking action until a real contract exists. Do not invent a salary sort while salary remains unnormalized free text; define parsed numeric data and unknown-salary ordering or omit that option.

### B09 — P1: missing-profile recommendations and inconsistent locations

**Source confirmed.** `JobsController.cs:102` references `profile.Id` before checking whether profile is null. Initial Index and Details queries omit `Include(j => j.Locations)` while GetJobs includes it. Cards use location navigation data and fall back to “Toàn quốc”.

Required outcome: no-profile/no-resume response is an actionable empty state. Shared job projection supplies consistent location data for initial list, appended list and detail. Recommendations time out with a retry state; a service failure must not be described indefinitely as ongoing search.

### B10 — P1: local and hosted integration paths differ

**Source confirmed; external behavior untested.** `Views/Profile/Index.cshtml:749` uploads directly to `https://api.quandang.site/process-cv-full`; `ResumeController` has a hardcoded delete-CV URL and restricts storage-refresh URLs to a fixed host. CV AI defaults to browser-side `http://127.0.0.1:11434`. The remote mail sender is necessary for the current magic-link flow. Base configuration alone lacks Auth:MagicLinkSecret; local user secrets provide it, but production environment injection is unknown.

Required outcome: environment-specific service contracts, preferably same-origin application endpoints for sensitive operations, bounded timeouts, and explicit optional-provider states. Hosted clients cannot assume a user's local AI server is available. Core CV editing and saving must work without AI. Dev mail must be delivered to a local capture inbox/service, not silently sent to real recipients.

### B11 — P1: CV builder documents may not become usable application files

**Source confirmed gap; end-to-end impact needs reproduction.** Resume/SaveBuilderData stores JSON/name/email but does not generate FileUrl. Applying snapshots `resume.FileUrl`. Check whether a builder-created CV can actually be opened by an employer after application; saving a JSON draft is not proof that a shareable CV exists.

Required outcome: define draft versus application-ready status, generate a stable application snapshot or supported viewer, and preserve historical submitted versions when the editable CV changes. Test uploaded and builder-created CVs separately. The global `cv-builder-data` localStorage key also needs user/resume scoping and logout/account-switch tests.

### B12 — P1: public Nominatim used for typeahead

**Source confirmed.** NewUserInfor makes browser requests to public Nominatim on every input event after three characters. That provider's published policy disallows client-side autocomplete. Merely adding debounce does not make that pattern acceptable. Replace it with manual locality input plus optional explicit lookup, a suitable autocomplete service, or a self-hosted service. The field must remain usable if lookup fails. [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).

### B13 — P2: visual and interaction debt

- Profile displays hardcoded `124`, `12%`, and sample suggested jobs (`Views/Profile/Index.cshtml:565–585`). Remove these or replace with real data and defined periods.
- English navigation/forms appear alongside Vietnamese content; some Vietnamese pages declare `lang="en"`, while onboarding and auth omit a document language.
- Navbar uses z-index 3000; dashboard lightbox uses 5000. Verify modal/backdrop/dropdown ordering and keyboard focus in every composition. This is a suspected overlay problem, not a runtime-confirmed obstruction.
- Onboarding and Facebook Page selection lack viewport metadata; Interview and Facebook selection do not use the shared theme.
- Dashboard and employer pages include substantial decorative animation; the inspected shared CSS/auth/dashboard/employer files have no reduced-motion rule.
- Navbar search is hidden below the medium breakpoint; supply a mobile search entry. Filter pills are divs, not keyboard-native buttons. Avatar menu trigger lacks native button semantics.
- Dependency delivery mixes local Bootstrap and CDN resources. Ensure base navigation/forms remain usable with external fonts/icons/services unavailable.
- Several controls use alerts, placeholder anchors or informational copy about internal APIs. Replace with useful user-level explanations and working stateful controls.
- DashboardController references missing `/images/default-avatar.png`. Use one owned fallback everywhere.
- Dashboard only fetches ten feed items. Do not show a load-more promise without implementing the corresponding server contract. Shared post deep links may point to an item outside those ten; add a stable post retrieval path or clearly scope sharing.

## Remaining validation

Authenticated visual review, database migration from empty and existing schemas, email/OAuth completion, job posting/application lifecycle, actual uploaded-media ownership, CV export/snapshot behavior, SignalR reconnect, cross-network video, provider callbacks, and deployment were **not executed**. Their exact fixtures and acceptance cases are in the execution plan. Do not turn these unknowns into blanket claims that every feature is broken or working.
