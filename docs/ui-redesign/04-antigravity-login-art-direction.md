# Antigravity assignment — Aris login visual prototype, iteration 2

## Authority and scope

The user explicitly asked Codex to communicate with the existing Antigravity conversation through the local bridge and begin directing the UI work. This document is the concrete design assignment. Proceed with the prototype and its verification without waiting for another design approval. The user will review a real visual result.

This iteration covers the login experience and its authentication feedback states. Preserve the existing application. Work in `docs/design-lab/aris-login-v2/` with isolated prototype assets, evidence and documentation. Do not replace Account Razor views, change authentication, alter the database, deploy, or modify the running application server. Prototype interactions simulate outcomes and must not send real email or OAuth requests.

## The user's correction — essential

The previous prototype looked old, basic and static to the user. They want an immediately impressive, distinctive visual experience, informed by the ambition of https://antigravity.google/ and https://openai.com/vi-VN/index/gpt-6-astra/.

Numbers and blocks were examples, NOT the chosen concept or mandatory ingredients. Do not build a number ticker simply because the user mentioned changing numbers. Do not deliver another ordinary split-screen form with a thin animated SVG, a few floating cards, or a generic particle field. The missing element is a strong original composition with well-directed motion.

Be honest about what you can inspect on reference sites. Page text, downloaded CSS and a live rendered animation are different kinds of evidence. Do not invent exact reference effects, render quality, performance results or Figma output.

## Creative objective

Make one memorable visual object that belongs to Aris, paired with a calm and immediately usable login form. The scene must look designed and compelling in a still frame as well as in motion. Use form, negative space, light, material, camera composition and a reveal to create impact. More effects are not the objective.

Recommended primary direction: a sculptural folded ribbon derived from the existing Aris trajectory mark. Treat this as an art direction to develop, not a literal requirement to draw a flat ribbon icon. If a quick visual exploration demonstrates a stronger original concept, choose it and explain why in the result; do not stop for approval between sketches.

### Recommended scene: the Aris trajectory as a physical sculpture

- A single continuous ribbon with a matte ceramic/paper exterior and blue inner face, folded through depth into a striking curved form.
- A prominent near segment and receding far segment establish actual spatial depth and intentional overlap.
- A light neutral canvas, soft contact shadow and controlled lighting make the material believable.
- Preserve the existing Aris blue `#2F6FED` and trajectory identity. White, graphite and restrained blue are sufficient; render lighting may introduce subtle tonal variation.
- At a chosen angle the ribbon should suggest the existing Aris mark. It does not have to spell ARIS or morph into an envelope to be successful.
- The silhouette and its interior negative space should be beautiful. Avoid a tube, torus knot or random noodle with no composed relationship to the brand.
- A short headline can occupy neighboring negative space: “Đi xa hơn. Theo cách của bạn.” Use carefully chosen line breaks, natural Vietnamese typography and generous scale.
- Let the sculpture occupy about 60–70% of the desktop composition, with a restrained 360–400px form on the right. Adjust proportions for visual balance rather than mechanically splitting the viewport.
- Minimize the boxed-card appearance of the form. A background transition or fine divider can establish the work area. Keep the sculpture behind its own interaction region and away from controls.

## Work sequence

1. Inspect the existing logo, prototype and shared theme. Review `02-design-direction.md` for functional context; this document supersedes its earlier understated login art direction.
2. Produce two inexpensive visual compositions of the chosen concept, varying camera/framing/material rather than building two full applications. Select the stronger result yourself and record the reason briefly.
3. Build the isolated interactive prototype with the selected composition and real visible motion.
4. Inspect the rendered scene, improve it at least once based on actual screenshots/recording, then verify responsive and input behavior.
5. Return URLs, screenshots, motion recording and a candid result report through the bridge. Do not finish with a textual design specification alone.

## Motion choreography

- First paint already shows a composed visual, usable form and readable identity. No blank canvas, long loader or mandatory intro.
- An approximately 1.5–2.5-second camera/material reveal exposes the blue inner surface and trajectory silhouette. Keep it smooth, intentional and spatially restrained.
- After the reveal, hold an attractive resting pose. A slow, small rotation or flex can sustain life without constant distraction; include rest periods.
- Pointer interaction is local to the artwork: modest camera parallax or controlled deformation, with a stable return to rest. Preserve the system cursor.
- Focusing or typing in the email field reduces ambient motion. It must not disturb focus, cursor position or reading.
- Submit simulation: a subtle directed highlight along the ribbon accompanies the loading state.
- Accepted simulation: a small opening/settling gesture can accompany the Check Email state. Do not redesign the entire sculpture on each input event.
- Error: form feedback is clear and calm; no full-screen shake or flashing red scene.
- Reduced motion: a carefully chosen static pose with no hidden content waiting for an animation event.
- Hidden/background tab: pause unnecessary rendering where supported.

These timings are proposed choreography, not a license to claim the visual works without viewing it. Prefer simpler high-quality movement to complex glitching, implausible geometry or noisy camera travel.

## Technical freedom and constraints

A genuine 3D scene using WebGL/Three.js is appropriate if available and stable. Use geometry/material/shadow techniques that serve the concept. Keep package versions pinned, render assets local where practical, and avoid adding build dependencies to the ASP.NET project. A well-executed SVG/canvas scene is acceptable if its rendered quality meets the objective; a flat decorative curve alone does not.

Use a neutral static fallback if graphics initialization fails. Limit pixel ratio and complexity on mobile. Do not claim 60 FPS without measurement. Do not place a large opaque scene over form hit targets. Do not use screenshots as substitutes for a functioning animation.

Serve the prototype separately on an available loopback port, preferably 5180, with an absolute local URL in the report. Keep the existing port 5025 application undisturbed. Background helpers must run without unnecessary visible windows. Record how to stop the prototype server. Do not ask the user to restart their current app just to view this experiment.

## Functional login surface

Vietnamese content:

- Heading: “Chào mừng trở lại.”
- Supporting line: “Tiếp tục hành trình cùng Aris.”
- Persistent Email label and example placeholder.
- Primary action: “Gửi liên kết đăng nhập”.
- Explanation: “Không cần mật khẩu. Nhận liên kết đăng nhập qua email.”
- Google and Facebook alternatives using recognizable official branding.
- Registration link as prototype navigation only, clearly report any destination not implemented.

Required states:

1. Default and focus.
2. Invalid email with visible associated error.
3. Loading with spinner AND “Đang gửi…”.
4. Accepted request / Check Email showing the submitted address.
5. Send failure that preserves the input and supports retry.
6. Resend cooldown explicitly labeled as a prototype simulation.
7. Provider-unavailable explanatory state, with an alternative action.

Do not pretend an email was delivered or an account authenticated. Do not add password, forgot-password or fabricated user/job statistics. Developer preview controls should live in a collapsible panel that is hidden for presentation captures.

## Responsive and accessibility requirements

- Primary desktop evidence: 1440×1000, plus a smaller laptop viewport to verify the scene does not overwhelm the form.
- Primary mobile evidence: 390×844; also check 320px width and 200% zoom.
- Mobile artwork becomes a specifically composed 180–240px visual region above the form, with reduced graphics cost and a short reveal. No hover dependency.
- Input text at least 16px; reachable controls and natural scrolling when a mobile keyboard appears.
- Visible keyboard focus, persistent labels, named social controls and no focus stealing from scene interactions.
- Feedback announces meaningful state changes without announcing every animation frame/countdown tick.
- Decorative canvas/SVG hidden from assistive technology as appropriate; the Aris brand remains available as real text or an accessible logo.
- Measure actual text/background contrast. Do not report blanket WCAG AA/AAA compliance from a color list. Existing white-on-blue `#2F6FED` is approximately 4.55:1; avoid transparency reducing normal CTA legibility.

## Evidence and completion gate

Store inside `docs/design-lab/aris-login-v2/evidence/`:

- Desktop default with preview controls hidden.
- Mobile default with correct device viewport emulation.
- Loading, Check Email and error states.
- A browser recording of at least 12 seconds showing initial reveal and resting/ambient motion. Include another short interaction capture or a segment showing pointer response and email focus.
- A concise inspection report: tested viewport sizes, actual graphics technique, assets/dependencies, console or network errors, reduced-motion behavior, and any remaining limitations.

Inspect your own screenshots/video before marking complete. If recording is unavailable, state that explicitly and provide the live prototype plus a timestamped multi-frame capture; do not call still images a video. If real Figma frames were not created, do not call browser captures Figma renders.

Minimum completion conditions:

- Clear, original art direction visible in the first frame.
- Real intentional motion observable in a recording/live preview.
- Artwork has depth, attractive composition and clear relation to Aris.
- Form remains usable immediately and throughout motion.
- Mobile is composed separately and contains no accidental overflow.
- All simulated states work and are honestly labeled.
- Existing application source, authentication and database remain unchanged by this assignment.

## Bridge communication

For the request ID included in the dispatch message, write an acknowledgement to `docs/agent-bridge/outbox/res_<request-id>.json` with `reply_to`, `sender: antigravity`, `status: accepted`, and a short plan.

Write milestone updates to `docs/agent-bridge/outbox/progress_<request-id>.json`. Use `status: in_progress`, a meaningful milestone, current prototype URL if available, files changed, and specific blockers. Avoid frequent empty progress writes.

Write the final response to `docs/agent-bridge/outbox/result_<request-id>.json` with the same `reply_to`, `status: completed` or `blocked`, prototype URL, absolute artifact paths, verification summary and limitations. Codex will review the actual artifacts and may send a focused revision request.

Do not wait for another approval merely to begin this authorized isolated prototype. If a tool action is blocked, report the actual reason and continue useful independent work. Do not change account/provider settings or disable protections to obtain a preview.
