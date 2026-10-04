# Aris — Bứt phá / Breakthrough: v4 art direction and AGY implementation brief

Date: 2026-09-18. Author: active Codex coordinator. Status: proposed direction under joint Claude review; v3 staircase approval is superseded immediately.

## Latest user instruction and ownership

The user rejects the current simplistic stair/rung direction and wants a distinctive, beautiful, spectacular animated login with the craft ambition of the Antigravity and Astra introductions. Codex and Claude review, plan and define the theme; Antigravity (AGY) is the primary and sole implementation owner. This instruction supersedes the earlier rung concept and grey-sculpture-only review gate.

Preserve existing work. Develop the next isolated prototype in `docs/design-lab/aris-login-v4/`. Application integration follows visual review; this brief does not authorize changing authentication, database, existing application files, deploying, or replacing v2/v3. Keep existing servers on 5025/5180/5181 intact. Use another available loopback port and report the actual address.

## Evidence and diagnosis

Codex inspected `docs/design-lab/aris-login-v3/evidence/phase-a/desktop_comp2_folded.png` directly. This is a saved Phase A still, not a fresh live capture or motion review.

- The large faceted object reads as an unfinished staircase assembled from thick rectangular slabs. Repetition dominates its identity; lighting cannot supply the missing concept.
- Its leftmost edges compete with the end of the headline. The composition contains three separate objects: text block, stair model, and generic rounded form card.
- The page's top and bottom carry large inactive regions. The object occupies the middle without creating an immersive scene.
- Default blue highlights, dark card, badge and predictable two-column arrangement make the result feel familiar despite the 3D geometry.

The current Razor login was inspected as source: it is a conventional split form/showcase with decorative constellation SVG. Source inspection establishes structure, not the current rendered visual quality.

References: https://antigravity.google/ and https://openai.com/index/gpt-6-astra/ . Both pages were accessible as web text in this session. That does not establish that their animations were watched. Earlier local recordings exist but have not yet been independently reviewed in this session. Use them as ambition references, not templates to copy or evidence that our design matches their quality.

## Selected candidate: an unfolding field, not a decorative object

Working name: **Aris — Bứt phá / Breakthrough**.

A giant asymmetric, continuous light-bearing membrane fills the left and middle of a deep ink stage. It begins in a tensioned, folded pose and releases into an open, wing-like sweep. Deep folds reveal a pearl skin and electric cobalt interior; a narrow warm caustic provides contrast. The distinctive silhouette is a long diagonal release and an irregular triangular opening, never a closed doughnut, sphere or centered portal.

The visual narrative is latent potential becoming room to move. Aris identity lives in the upward release, cobalt and typography. The small brand mark stays in the header. Do not trace it into a giant hero logo.

Material and movement are central to this direction. A grey render may diagnose depth but is not a standalone art acceptance gate. First-frame silhouette, material study and a short motion study must be judged together.

## Theme and composition

- Stage: ink `#070A12`; subtly cooler depth `#10192A`. Avoid flat navy over the whole viewport.
- Primary light: cobalt `#4268FF`; secondary ice `#B9DFFF`; lit skin `#E9EEF6`.
- Small warm reflection: apricot `#FFB58C`, confined to folds/highlights, not a second full-screen gradient.
- Text: near-white `#F4F6FA`; muted copy initially `#A8B3C6`, verify contrast over its actual surface.
- Use the project's suitable locally available Vietnamese-capable sans first. Editorial display weight 550–650; avoid ultra-heavy rounded headings. Body and labels stay clearly readable. Verify Vietnamese diacritics and line boxes.
- Desktop starting point: 1440×900; 48–64 px outside margins, 340–380 px form column. Treat numbers as composition guides, not a rigid split-screen template.
- Art can occupy roughly 60–70% of visual attention and intentionally crop off the left/top. Show the opening and important fold; a tiny centered object is a failure.
- Headline: “Mở lối riêng.\nBứt phá cùng Aris.” Starting size 68–88 px desktop, 34–42 px mobile. Place in a deliberate quiet region below/alongside the sweep, with reserved bounds across the full motion path. Do not animate individual Vietnamese letters.
- Supporting copy: “Kết nối năng lực của bạn với cơ hội xứng tầm.” One quiet supporting line/short paragraph; no fake counters, trust badges or invented social proof.
- The form sits in a calm right-side surface with a subtle tonal boundary; avoid a dominant rounded glass card or thick outline. Use consistent type and lighting with the art. Input and CTA remain unmistakable, 48–52 px tall.
- Preserve the real login choices conceptually: email magic link, Google, Facebook, registration. In the lab these are visibly simulated; no real authentication requests.
- Email labels remain visible, buttons have stable dimensions; progress never shifts the whole form. No cursor replacement, moving CTA target or hover magnet on inputs.

## Motion storyboard — one authored sequence

| Time/state | Visual event | Form behavior |
| --- | --- | --- |
| First paint | Composed tensioned membrane already visible, strong silhouette, usable fallback while WebGL prepares | Fully visible and usable; no loader gate |
| 0–450 ms | Directional rim draws attention to a real fold; modest camera approach | No focus stealing |
| 450–1500 ms | The fold unfurls with delayed response along its surface; the opening grows and cobalt interior is revealed | Controls stay steady |
| 1500–2400 ms | Main sweep releases outward/upward, warm caustic briefly crosses one fold, scene settles with a short elastic tail | Typography settles as whole lines with restrained opacity/position change |
| Idle | Slow internal advection and secondary cloth response; stable overall silhouette with occasional directional light travel | Reading remains comfortable |
| Pointer in art | Local damped displacement/tension responds with inertia and recovers; bounded camera response supports depth | Pointer over form does not steer the scene |
| Typing | Ease the external motion energy down while preserving internal material life | Use input activity; autofocus must not suppress entrance on load |
| Pending request | One directional pulse travels through the same surface; no unrelated spinner spectacle | Busy status exposed accessibly; prevent duplicate submit |
| Request accepted | The opening resolves once toward a warm/clear pose | “Kiểm tra email của bạn”; this is not authenticated success |
| Recoverable error | Artwork retains identity and calm | Error text by the field/status; preserve typed email; retry available |

No random exploding particles, repeated fins, staircase geometry, endless full-scene spinning, neon loading rings, stock torus knots or blur-blob substitution. “Bùng nổ” means a strong spatial reveal, responsive material and compositional impact. Do not add flashes or unrelated effects to inflate complexity.

## Responsive and accessible direction

At 390 px, compose a shallow cropped fold above/behind a short headline; show the start of the form early and the primary action within a normal first screen where feasible. At 320 px and short heights, allow ordinary scroll without clipping or hiding controls. Use actual viewport-height test cases, not width alone. The keyboard must not trap the user behind fixed artwork.

Reduced motion renders a designed resting pose immediately with restrained non-spatial feedback. Add an unobtrusive pause-motion control for ongoing ambient animation, respecting user preference. No essential information depends on art, hover, color or motion. Keyboard focus stays visible; normal Tab order, labels and live request status must work. WebGL failure produces a composed local still plus the working form. Do not start with a blank canvas or hide the entire hero.

## AGY work packages

1. Read the latest TEAM and this brief. Acknowledge the v3 concept cancellation and sole-coder role in `docs/agent-bridge/antigravity/v4-ack.md`. State any actual blocker; do not invent one from the older Phase A gate.
2. Inspect existing assets and locally available rendering tools. Choose geometry/shader technique that achieves the authored membrane and material; Three.js is acceptable, not the deliverable itself. Keep dependencies isolated in the lab.
3. Build one coherent v4 scene and composition. Produce a desktop settled frame, mobile frame and short real motion study early. Do not deliver two extra static concepts instead of animation, or spend the whole pass on a generic scaffold.
4. Share this checkpoint and receive focused corrections from Codex/Claude. Continue to entrance, idle, art-region pointer interaction, form states and reduced motion. AGY performs all source edits.
5. Capture final evidence with build identifier/source hash, timestamp and exact URL. Deliver clean desktop/mobile screenshots plus actual 15–20 second motion recording covering entrance, idle, pointer, typing, simulated submit and request-accepted/error states. Review-only replay controls must be separate from the intended user presentation.
6. Write `docs/agent-bridge/antigravity/v4-report.md`: source files, URL, rendering decisions, captures, checks performed, measured limits, known defects. No unsupported “60fps”, “production-ready” or “world-class” claims.

## Acceptance by Codex and Claude

Visual acceptance is required in addition to functionality. Ask of the rendered result: is its first frame authored and memorable; does the main transformation materially change the spatial composition; are depth and light believable; does it still look distinctive at rest; do typography and form inhabit the same scene; is mobile deliberately composed?

Reject if it is recognizably a stock ribbon/torus, if the only effect is fade-in or glow on a static shape, if the form reads as an unrelated template, if text intersects the moving art, or if the main spectacle overwhelms signing in. Material may be luminous but must retain readable fold structure rather than clipping into a white patch.

Check keyboard, invalid email, simulated pending/accepted/error/resend, mobile sizes, reduced motion, fallback and console errors. Record actual browser/device conditions and frame-time observations if making performance claims. A video file existing is not proof that it depicts the right build or has been inspected.

The prototype remains a review artifact until this gate is passed. The user asked Codex/Claude for direction and review: neither reviewer may take over implementation from AGY.
