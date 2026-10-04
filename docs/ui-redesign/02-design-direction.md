# Design brief and proposed direction

## Brief

**Product:** Aris, a career network and recruiting platform. **Audience:** Vietnamese candidates, students, experienced workers and business recruiters. **Platform:** responsive web. **Design owner:** next design agent. **Implementation owner:** next full-stack agent. **Dates:** sequence by acceptance gates; no deadline supplied.

**User goal:** confidently move from an account and usable profile to relevant opportunities, applications and conversations; recruiters should move from a company profile to a job posting, applicant decision and interview without dead ends.

**Why this work:** the app already contains useful functionality and recognizable branding, but disconnected page implementations, unfinished controls and inconsistent onboarding undermine clarity and trust.

**Success:** the priority journeys complete locally; every visible action has real behavior or an honest unavailable state; the same component language extends across all pages; the four priority pages are polished on desktop and mobile. Visual approval requires screenshots of real rendered data and error states, not only a Figma cover screen.

## Figma reference research

These are references for studying patterns. They are not evidence that an editable Figma file has been inspected, duplicated or licensed. Direct Community requests were restricted and no connected Figma authoring tool was available. Do not copy a paid kit or publish downloaded preview artwork as an Aris product asset.

| Reference | Discovery / file | Fit for Aris | Access and evidence |
|---|---|---|---|
| Job UI Kit / Jobizz | [Publisher page](https://www.freefigmatemplates.com/gallery/job-ui-kit), [Figma Community](https://www.figma.com/community/file/1108008842589718759) | Candidate onboarding, personal profile, jobs, applications and mobile hierarchy | Publisher description read; cover preview downloaded and visually inspected. Publisher says 58 screens, cover says 40+; exact file contents not verified |
| Jobify — Seju UI/UX | [Creator listing](https://topmate.io/seju_ui_ux/1295661), [Figma Community](https://www.figma.com/community/file/1427716315717875267/jobify-job-portal-job-board-job-listing-template-job-finder-website-ui-kit-job-seeker-saas) | Desktop job-board, profile and application reference candidate | Search-indexed creator listing describes 60+ screens and responsive components. Direct fetch/file inspection unavailable; treat visual quality and license as unverified until opened |
| Purity UI Dashboard — Creative Tim & Simmmple | [Figma's dashboard catalogue](https://www.figma.com/templates/dashboard-designs/), [Figma Community](https://www.figma.com/community/file/1020707462188017225/purity-ui-dashboard-chakra-ui-dashboard/), [Creator demo](https://demos.creative-tim.com/purity-ui-dashboard/) | Employer KPI grouping, tables, profile and auth organization | Figma catalogue and demo structure inspected through page text. No editable-layer or chart accessibility validation |
| Onboarding, Login & Dashboard — Sundar Raj Sharma | [Creator project](https://www.srsdevdesign.com/projects/onboarding-ui-kit), [Figma Community](https://www.figma.com/community/file/1192255935701924968/onboarding-screen-basic-login-screen-dashboard-design-mockups-cards-design-system) | Secondary reference for compact mobile forms and consistent states | Creator description read; preview image retrieval failed; no visual endorsement implied |
| Dashboard Layout Ideas | [Figma Community](https://www.figma.com/community/file/1208363071768116045/dashboards-layout-ideas/), via [Figma catalogue](https://www.figma.com/templates/dashboard-designs/) | Supplementary responsive layout study | Link verified from Figma catalogue; file contents not accessible |

Recommended study order: Jobizz for candidate flow coverage, Jobify for job-discovery structure once accessible, Purity for employer data hierarchy. The social Dashboard/Index is not a sales analytics dashboard, so borrow spacing and organization without importing irrelevant revenue charts.

The viewed Jobizz preview uses navy and muted blue, broad spacing, simple type hierarchy, rounded mobile screens and a profile menu grouped by career tasks. For Aris, retain that clarity but avoid adding introductory carousel screens before the user can sign up. Aris already has a more distinctive trajectory motif worth developing.

Next design agent's reference extraction deliverable: for each accessible file record creator, source URL, license/access limitation, 2–3 relevant frame names/IDs, captured desktop/mobile preview, and a short note identifying the specific pattern to adapt. If a file stays inaccessible, mark it unresolved and continue with original layouts from this brief; do not pretend to have scraped its nodes.

## Proposed visual direction: Aris Career Studio

This section proposes the design response; it is separate from the outcome-focused brief above.

Keep the existing blue trajectory logo and make that curve a quiet recurring signature: a line through the onboarding progress indicator, a compact brand illustration on authentication, and a subtle divider on career summaries. Use white/off-white work surfaces, a dark ink brand panel, large but disciplined headings, and job metadata organized for comparison. Avoid making every card a glass panel or every dashboard section an animated scene.

Uniqueness should come from the product: recognizable career-progress cues, a profile/CV preview, explainable job recommendations, distinctive company initials/logos, and useful empty states. Do not add made-up match percentages, testimonials, hiring guarantees, verification badges or inflated usage counters for decoration.

Keep one consistent light working theme in this iteration. Employer charts/tables should use the same typography and controls as candidate views. A dark brand header is acceptable; a separate full dark system requires a complete token and state pass and is deferred.

### Proposed foundations

| Foundation | Specification |
|---|---|
| Typography | Reuse Inter with tested Vietnamese glyph coverage and system fallback. Body 16/24; helper 14/20; label 14/20 medium; section title 22/30 semibold; page title 32/40 desktop, 28/36 mobile; auth display up to 40/48 desktop |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64px. Default card padding 24 desktop / 16 mobile. Avoid mixing arbitrary margins on otherwise equivalent components |
| Containers | Max content width 1280px; 32px desktop gutter, 24 tablet, 16 mobile. At 1440 this yields 80px external margins |
| Grid | 12 columns desktop, 8 tablet, 4 mobile; 24px desktop and 16px mobile gaps. Collapse based on content fit, not device names alone |
| Breakpoints | Under 768: single-column work views; 768–1199: simplified two-column layouts; 1200+: full desktop compositions. Existing Bootstrap breakpoints remain the implementation baseline |
| Controls | 48px main inputs/buttons; 40px compact controls with at least 44px effective touch target; 12px control radius |
| Cards | 16px standard radius, 24px feature/brand panel; quiet border and one restrained shadow. No shadow as the sole focus indication |
| Overlays | One documented stack: sticky header, dropdown, backdrop, dialog, lightbox, toast. Integrate Bootstrap's stack instead of unrelated z-index values |
| Motion | 120–180ms control feedback; up to 240ms panel entry. No perpetual decorative particles in working areas. Respect reduced motion, including JavaScript effects |
| Content | Vietnamese UI by default; natural short labels, persistent visible field labels; show actual dates/deadlines and “Thỏa thuận” where salary is unknown |

The following proposed opaque text/background pairs were measured using the WCAG relative-luminance formula during this audit. These are token-level measurements, not a full accessibility certification. Recheck actual rendered combinations, transparency, focus borders, disabled states and font sizes.

| Text | Background | Intended use | Contrast |
|---|---|---|---:|
| `#12141A` | `#FFFFFF` | Main text | 18.41:1 |
| `#64707F` | `#FFFFFF` | Secondary text | 5.04:1 |
| `#64707F` | `#F7F9FC` | Secondary text on page | 4.78:1 |
| `#FFFFFF` | `#2F6FED` | Primary button | 4.55:1 |
| `#FFFFFF` | `#1E54C4` | Primary hover/active | 6.73:1 |
| `#1B3E82` | `#EAF2FF` | Informational/match badge | 9.06:1 |
| `#166534` | `#DCFCE7` | Success badge | 6.49:1 |
| `#92400E` | `#FEF3C7` | Pending/warning badge | 6.37:1 |
| `#991B1B` | `#FEE2E2` | Error badge | 6.80:1 |
| `#FFFFFF` | `#12141A` | Brand panel | 18.41:1 |

White on current blue narrowly passes normal-text contrast. Do not lower button opacity to style its normal state; measure any replacement blue. Status labels always include text or an icon with a name, not color alone.

## Priority page specifications

### 1. Jobs/Index — candidate discovery

**Goal:** compare real opportunities and reach an application with the right CV.

Desktop composition, inside a 1280px content container:

1. Shared 72px navigation with clear Jobs active state and role-aware account menu.
2. Compact title row: “Cơ hội phù hợp với bạn”, a short explanatory line and no oversized decorative hero.
3. Search row: keyword, location, primary “Tìm việc” action. Enter submits. Preserve query in the URL.
4. Three-column workspace at wide widths: 248px filter rail, flexible results (about 680px), 304px career panel, with 24px gaps. At narrower desktop/tablet remove the optional right rail before crushing results.
5. Results header: accurate count, active filter chips and supported sort selector. Loading affects the results region without hiding the controls.
6. Up to three recommended jobs with explicit reasons when available, followed by the main listing. The AI section must not block standard results or change active filters automatically.
7. Job cards: 48px company mark/initials, title, company, location/work mode, salary, experience, concise tags, posting/deadline metadata, and a clear details action. Save action exists only with persistence. Match score appears only if backed by the service and correctly labeled.
8. Right rail: profile readiness and one useful next action, such as creating a CV; optional selected application summary. Avoid unrelated advertisement-like cards competing with results.
9. Pagination or load more preserves filters, sort and keyboard focus; list updates announce counts through a polite live region.

Mobile: title then keyword/location controls; a “Bộ lọc” button with selected count opens a focus-trapped sheet. Sort is adjacent. One-column cards; move profile readiness below search or into a compact dismissible prompt. No permanently fixed sidebar. Avoid a second sticky bar that overlaps chat or the operating system safe area.

Query contract proposal: `q`, `location`, `workMode`, `employmentType`, `experience`, `category`, `sort`, `page`/cursor. Define supported values with the backend; do not implement a frontend-only illusion. Count and page data must use the same predicate. Normalize salary data before offering numeric salary sort.

Required states: initial, fetching, populated, no jobs at all, no matches, failed query with retry, end of results, no profile, no CV, recommendations unavailable, saved/unsaved/saving/failed save, closed job, expired session. Test long Vietnamese titles and unknown salary/logo/location.

Business variant: use “Tin tuyển dụng của bạn” as the primary task. Show owned postings and status/count/actions, with one “Đăng tin” action. Keep applicant management, posting form and social sharing available. Move advanced integration configuration to Settings. Candidate recommendations should not compete with recruiter tasks.

### 2. Register and Login — passwordless access

**Goal:** users understand how they will receive access and recover from delivery/provider failure.

Retain the split desktop shell: approximately 50/50 form and brand panel. Form max width 440px, with a calm single heading, short explanation, social options and email field. Keep provider button styling recognizable. Use one consistent language across both panels.

Suggested registration copy: “Bắt đầu hành trình nghề nghiệp của bạn”; explanation “Nhập email để nhận liên kết đăng nhập an toàn. Bạn không cần tạo mật khẩu.” Submit: “Gửi liên kết đăng ký”. After sending, replace the form's primary message with a dedicated confirmation state showing the destination email, delivery advice, “Đổi email” and a rate-limited resend action. Do not claim the email was delivered when the service merely accepted a request.

The brand panel should show the existing trajectory artwork and an original compact profile/opportunity composition. Keep any decorative example clearly illustrative. Remove unverified promises such as guaranteed rapid recruiter responses. No new intro carousel.

Mobile: hide the large decorative panel, retain the wordmark and short value statement; use 16–24px outer padding and 24px card padding rather than the current desktop-sized inset. Keep provider labels unbroken when practical. Verify 320px, 390px, 200% zoom and the on-screen keyboard.

States: empty, invalid email, sending, accepted, resend wait, retry allowed, service unavailable, expired/invalid link, provider unavailable, provider denied, verified new user, verified returning user, incomplete onboarding. Preserve email across errors. Buttons expose loading labels; errors connect to fields and an accessible summary. Default sign-in route preserves a validated local return URL through every provider path.

Do not add password/reset-password screens to a passwordless product. A Figma reference containing them is not a feature requirement.

### 3. NewUserInfor — guided profile setup

**Goal:** obtain enough information for a useful profile without trapping the user in irrelevant requirements.

Propose three visible stages, mapping to the existing fields without losing data:

| Stage | Fields and branching | Validation and completion |
|---|---|---|
| 1. Về bạn | Location; student/working choice; job title OR school/degree/field/start year | Require only documented essentials. Free-text locality always works. Student selection immediately restores the correct fields on reload/error |
| 2. Công việc mong muốn | Looking/not-looking, remote preference, desired role, optional desired company | Not-looking users can continue without inventing a target company; preserve their preferences without forcing job search |
| 3. Quyền riêng tư & hoàn tất | Recruiter sharing explanation, summary with edit links | Sharing is an explicit choice; explain visibility accurately. Submit once, show saving/error, then route to original destination or career home |

Keep server field semantics explicit; changing five visual steps into three is not permission to discard model data. If the backend cannot safely support three steps immediately, retain five with the same shell, progress and validation principles.

Desktop: narrow left progress rail, 560–640px main form, quiet contextual illustration or preview if space remains. Mobile: numbered “Bước 1/3” and progress line above one column. Back/Continue appear in a stable action area; a sticky mobile footer must not cover inputs or the keyboard.

Use the same logo, Inter, cards, controls and focus styles as Register. Display inline errors under the actual field and move focus to the error summary/first invalid field. Back preserves values. Refresh resumes verified onboarding where supported; do not store unverified user IDs as credentials. Saving a draft or skip behavior must be backed by a defined server contract.

States: new student, new worker, not-looking, prefilled provider account, returning incomplete profile, invalid field, API/DB unavailable, session expired, submitting, success. The student checkbox, education branch and validation must agree after a failed POST. No blocking alert boxes.

### 4. Dashboard/Index — useful career home and social feed

**Goal:** understand the next useful career action, follow relevant activity and participate in the network.

This route is a social home, whereas Employer/Index is an operational dashboard. Preserve posts, articles, media, likes, comments, editing/deleting and chat access.

Desktop composition: shared navigation; a compact greeting and career action panel capped near 200–240px rather than dominating the viewport; then a 240px profile/navigation rail, flexible 640–680px feed, and 288px contextual rail with 24px gaps where space permits. Prioritize readable feed width over preserving all columns.

The top panel contains the user's name, one next action based on actual profile/CV state, and at most two real metrics. Weather can remain optional and secondary, with a quiet fallback; the page must not depend on weather requests. Use the trajectory motif instead of continuous particles/flashes.

Composer: clear text entry, separate media/article actions, attachment preview/removal, submission progress and retry preserving draft. Feed: consistent author header, readable content width, media aspect handling, meaningful timestamps, accessible actions and count updates. Menus must enforce ownership on the server.

Right rail: upcoming interview/application action when backed by data, then a small jobs preview. Empty users get an actionable profile/CV prompt instead of fabricated activity. Mobile order: compact greeting, next action, composer, feed; secondary content appears below or through navigation.

States: no posts, no profile/CV, service failure for secondary widgets, creating post, upload failure, post deleted elsewhere, optimistic like failure, comments loading/empty/error, media unavailable, connection lost and expired session. Define the existing ten-post limit honestly until feed pagination exists. If sharing post URLs, the destination must load the shared item even when outside the initial ten.

## Remaining page specifications

| Page | Proposed layout and essential interactions | States and constraints |
|---|---|---|
| Jobs/Details | Main description column + 320px application summary; mobile summary first and safe sticky apply action. Salary, location, employer, deadline and requirements grouped consistently | Active/closed/missing job, candidate/business role, no CV, applied, applying, submission failure; no raw JSON in body |
| Apply dialog | Job context, selectable application-ready CV, preview, screening questions, submit, clear success | No CV with create/upload return path; invalid answers, duplicate submission policy, stale/closed posting, ownership check |
| Employer/Index | Compact company header, 3–4 real KPI cards, actionable funnel, postings table and upcoming interviews | New employer, zero jobs/applicants, loading, failed metrics; every chart has text/table equivalent and defined reporting window |
| Job editor | Grouped role/company/location/compensation/description/requirements sections with preview and publish action | Create/edit, invalid deadline, import parsing failure, missing company, saving, saved, publishing failure; preserve manual form when AI import fails |
| Applicant management | Search/status filters, readable table, candidate detail drawer, CV snapshot and decision actions | No applicants/filter matches, unavailable CV, reject reason, withdrawn/terminal status, concurrent update, interview scheduling error; real pagination or none |
| Profile/Index | Cover/avatar/identity header, readable About/contact blocks, tabs for posts/CVs/applications and explicit edit actions | Own vs accessible profile policy, empty fields, avatar failure, loading each tab, empty CV/application list; remove fake analytics and sample suggestions |
| Resume list | Shared full/partial list with filename/label, updated time, readiness and preview; create/upload/edit/rename/delete actions | Draft vs ready, upload/parse progress, unsupported/large file, save failure, delete confirmation, expired storage link |
| CV picker | Template grid with useful previews, category controls only if supported, selected-state confirmation | No templates, missing preview, new blank CV creation failure, return to existing draft; no silent draft deletion |
| CV builder | Editing tools + document preview + stable save/export controls; responsive panels/drawers | Local draft, saving, server saved, offline, conflict, session expired, export error, optional AI unavailable; do not equate local save with server save |
| MyApplications | Summary and status-filtered list with job/employer, date, CV version, next action and timeline | Empty, submitted, under review, shortlisted, interview, offered, rejected, withdrawn; preserve current allowed withdrawal policy |
| Company/Index | Heading/search and uniform company cards, industry/location/jobs count | Empty directory, no matches, missing logo, long name, loading/failure; derive job counts |
| Company/Details | Identity header, About, business facts and open jobs using shared cards | No jobs, incomplete company profile, verified/unverified from data, owner edit action, missing record |
| Company/Edit | Sections for identity, business information, description and contact/web presence | Field errors, invalid URL/year, image failure, saving, saved, unsaved navigation; only owner edits |
| Chat/Index | Conversation list + thread + optional context at desktop; one pane and back navigation on mobile | Empty inbox/thread, pending request, blocked/unauthorized access, sending/failed attachment, reconnecting, unread, forwarded/replied message |
| Interview/Room | Prejoin device preview, call stage, participant state and clearly labeled microphone/camera/leave controls | Waiting, no device, permission denied, peer offline, reconnecting, TURN unavailable, disconnected, ended, forbidden; leave confirmation where appropriate |
| Settings/Index | Section navigation: account, profile appearance, visibility, recruiter tools and connected channels | Saving/saved/error, username collision, image validation, unavailable provider, disconnect confirmation; do not expose token-management instructions as ordinary product onboarding |
| Facebook Page selection | Shared shell, explanation, selectable Page cards, confirmation | Loading, no eligible pages, invalid selection, denied permission, expired session, saving/error and return to Settings |
| Notifications | Shared menu/list with read/unread, timestamp and working contextual destination | Empty, fetch failure, mark-read failure, deleted target, session expiry; keyboard and mobile access |
| Global search / network | Search dialog on mobile; accessible results grouped by existing types | Too-short query, loading, none, failed, stale response cancellation; all results use valid routes |
| 403/404/500 | Consistent simple error shell with recovery action and optional reference ID | Public-safe text, no stack traces or dead recovery links; missing item does not impersonate an empty success state |

## Shared component plan

| Component | Existing foundation | Next action |
|---|---|---|
| Brand mark and wordmark | SVG and repeated inline SVG | Reuse one owned asset/component, correct sizing and accessible name |
| App/auth shells | Navbar component, AuthLayout; full documents in most views | Create an actual application layout and migrate incrementally; reuse auth shell |
| Buttons / inputs / select / textarea | Bootstrap plus page overrides | Consolidate variants, loading, disabled, invalid, focus and help text |
| Stepper | Only show/hide onboarding sections | Create accessible progress and step navigation |
| Job / recommendation card | Existing partials | Extend to consistent view model and complete action states |
| Status badge | Several status maps | Create shared vocabulary and styles without changing stored status codes |
| Tabs / filter chips | Bootstrap tabs and div pills | Reuse tab behavior; replace pills with buttons and explicit selected state |
| Avatar / company logo | Mixed uploads and fallbacks | Add owned fallback, alt/name rules and failed-image behavior |
| Dialog / drawer / sheet | Bootstrap modals and custom lightbox | Standardize focus trap, Escape, close, backdrop, scroll lock and restoration |
| Empty / error / loading states | Ad hoc text/spinners/alerts | Create reusable variants with real recovery action |
| Toast / save status | Alerts and inline feedback | Standardize success/error announcements and persistence for important errors |
| Data table / pagination | Employer and applicant tables | Shared density, mobile overflow or card view, real pagination semantics |
| CV card / preview | Existing CV partial and builder | Shared readiness/download/edit semantics and async status |
| Post / composer | Dashboard and profile markup | Share structure and action contracts; preserve media lightbox |

Create Figma components with actual variants: button (primary/secondary/quiet/destructive × default/hover/focus/disabled/loading), field (empty/filled/focus/error/disabled), card (default/loading/empty/unavailable), status badge, navigation item, step, dialog, alert, chip and table row. Avoid creating every theoretical combination if it has no real use. Use auto layout and semantic color/spacing variables; annotate existing Razor partial/view-component mapping.

## Flow and decision map

| Flow | Entry and steps | Success exit | Failure/recovery branches |
|---|---|---|---|
| New account | Register → email/provider → verified identity → onboarding → original destination/home | Completed profile bound to verified identity | Delivery failure/resend; expired link; OAuth denied; incomplete form; expired onboarding restarts verification without changing another account |
| Returning user | Protected route → Login → verify | Return to safe requested route | Session/provider failure; missing profile routes to setup; invalid return URL goes home |
| Find/apply | Jobs search/filter → Details → choose CV/answers → submit → MyApplications | Stored application and real status | No CV creates/uploads then returns; closed job recovers to results; duplicate/network failure avoids duplicate state |
| Create CV | Profile/Resume → picker/upload → builder/parse → save → preview/export | Application-ready CV with stable viewer/file | Invalid upload, AI unavailable, expired session, conflict, local draft unsynced, export failure |
| Recruit | Upgrade business if needed → Company edit → create job → applicant list → decision/interview | Candidate sees correct status/invitation | Invalid upgrade, lost ownership, no applicants, stale decision, CV unavailable, sharing failure does not undo saved job |
| Interview | Invitation → accept/decline → room prejoin → call → leave | Correct participant enters or declines clearly | Broken/missing link, wrong participant, device denied, peer absent, network failure |
| Social | Dashboard → compose → publish → interaction/chat | Persisted post/message with feedback | Invalid/failed attachment, dropped connection, stale/deleted post, expired session |

## Universal state and accessibility rules

Every asynchronous region gets loading, success, empty and failure variants with separate copy. A failure must never look like an empty dataset. Retry retains inputs and context; a global session expiry prompts sign-in and preserves safe drafts. Repeated submit/clicks do not duplicate writes. Mutating actions use server-side ownership checks; disabling a button is not authorization.

Keyboard order follows visual order. All controls have accessible names; labels are programmatically connected. Modal/sheet focus is trapped and restored; Escape closes when safe. Notifications use live regions appropriately. Support 200% zoom, 320px layouts, long Vietnamese strings, missing images, empty counts and keyboard-only operation. Supply text alternatives for charts and decorative artwork hidden from assistive technology. Measure contrast and test reduced motion. Protect text readability rather than shrinking it to fit a fixed card.

## Suggested Figma file organization

1. `00 Brief & References` — brief, evidence status, reference attribution and direction.
2. `01 Foundations` — colors, typography, spacing, grid, radius, motion, contrast.
3. `02 Components` — variants and states mapped to implementation primitives.
4. `03 Authentication & Onboarding` — all three account screens and verification branches.
5. `04 Jobs & Applications` — candidate discovery, details, apply, application tracking.
6. `05 Career Home & Profile` — Dashboard, profile, CV list, picker, builder.
7. `06 Employer & Companies` — employer home, business Jobs variant, management dialogs, companies.
8. `07 Communication & Settings` — chat, interviews, notifications, settings, channel selection.
9. `08 Responsive & Failure States` — mobile/tablet variants, offline/auth/permission/empty/error cases linked to originating frame.
10. `09 Handoff` — route map, component mapping, token names, interaction annotations and acceptance checklist.

Frame naming: `Area / Screen / Role / State / Width`, e.g. `Jobs / Index / Employee / No matches / 390`. Produce 1440 and 390 frames for all priority pages and representative 768/1024 states; all remaining surfaces need desktop/mobile specifications. Prototype at least new-user onboarding, job application and employer interview flows with failure branches.

If the next agent writes to Figma, load the appropriate mandatory Figma skills before creating a file or running authoring tools. This handoff does not create a Figma file or require permission to proceed with independent local engineering work.

## Deferred scope and decisions

Preserve the current stack; no React migration, new payment system, password flow, broad dark mode, invented analytics or automatic public job browsing. Saved jobs and durable draft handling are functional gaps that need explicit contracts in the implementation tasks, not decorative additions.

Assumptions to record before high-fidelity work: Vietnamese as default copy, current authentication gates retained, existing business role model retained, real data only. Product owner can revise these. Engineering must resolve salary semantics, application-ready CV format, safe business upgrade behavior and local-provider contracts during discovery; unresolved decisions should be isolated to the affected component rather than blocking unrelated design.
