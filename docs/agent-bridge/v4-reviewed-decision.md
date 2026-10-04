# ACTIVE DECISION — Aris login v4: Bứt phá / crease release

Date: 2026-09-18. Status: **selected for implementation after Claude critique and Codex synthesis; not visually accepted yet**.

Read this first, then `login-direction-v4.md`. This decision overrides conflicting text in that earlier candidate brief, TEAM.md and approved-login-concept.md. The user explicitly rejects the staircase/rung direction. AGY is the sole coder; Codex and Claude only review, plan and direct.

## Joint decision

Keep **Aris — Bứt phá** as the theme. Replace a smooth, vaguely fluttering photonic cloth with **one connected surface with a designed crease network**. Claude calls the mechanism **Vỡ nếp**. It differentiates the scene by giving it identifiable structure at rest and an authored force-release sequence.

Design one primary diagonal crease and two or three subordinate folds, with unequal lengths, depths and branching angles. Force and light travel through those folds before release. The open silhouette has a readable tension point, a long upward/outward sweep and an irregular opening. It must not become a rectangular flag or a repeating accordion. Sheen follows fold direction. Pearl regions stay solid enough to read depth; cobalt illuminates the interior. Small warm highlights occur at a few fold junctions, never as global rainbow iridescence.

The object should change the spatial composition as it unfolds. A static ribbon with a moving highlight fails. A spinning stock knot or smooth gradient blob also fails.

## Theme and layout to implement

- Ink stage `#070A12` / `#10192A`; cobalt `#4268FF`, ice `#B9DFFF`, pearl `#E9EEF6`; sparse apricot `#FFB58C` highlights.
- One full-bleed artwork with its strongest sweep left/center. The artwork, headline and form must compose a single scene. Avoid the old three-piece arrangement.
- Headline: “Mở lối riêng. / Bứt phá cùng Aris.” Deliberate two-line desktop setting where space permits. Use a Vietnamese-capable local sans with visible diacritics. Start at 68–88px on a 1440px desktop and adjust from actual layout; do not force 128px into an insufficient measure.
- Supporting copy: “Kết nối năng lực của bạn với cơ hội xứng tầm.” Remove staircase wording and filler badges.
- Right-side form: approximately 340–380px in a calm tonal surface, optional subtle boundary, no dominant glass card or colored shadow. Use the same type and material language. Inputs/actions 48–52px, visible labels and focus.
- Keep email magic link, Google, Facebook and registration conceptually present. All actions in the prototype are simulated and identified as such. No real email/OAuth requests.

## Motion to implement

The form is **fully visible and usable from first paint**. No opacity-zero form, introductory delay, blocking loader or autofocus-dependent suppression.

At first paint the tensioned folded surface is already recognizable. Over about 2.4 seconds: light advances along the main crease; delayed unfolding propagates into the subordinate folds; the cobalt interior and opening expand; a warm reflection passes through a small junction; the composition settles with a brief damped tail. Typography may enter in whole lines without delaying or moving controls. No per-letter Vietnamese animation.

Idle retains slow internal movement with a stable global silhouette. Art-region pointer interaction changes local tension with inertia; response is bounded and uses elapsed-time-based damping rather than a frame-dependent lerp constant. The form region never steers artwork. Typing eases down external motion energy while leaving material life. Pending/accepted states use one related directional pulse or resolve. Errors remain local; accepted email request is not successful authentication.

Mobile gets a close crop of the fold and a shorter heading; determine hero height from form visibility at actual 390×844 and 320×568 viewports rather than forcing 42% of the screen. Ordinary scroll is acceptable; clipped controls are not. Reduced motion has a composed static pose. Ambient motion needs a pause control. WebGL failure retains a local composed still and the usable form. Preserve meaningful product/legal links with restrained styling.

## AGY next work package — begin now

1. Read this decision and the earlier detailed brief. Update the top of TEAM.md and approved-login-concept.md to mark the rung direction superseded and link this decision. Keep old work/history intact. Update `antigravity/v4-ack.md` with the implementation state.
2. Build in `docs/design-lab/aris-login-v4/` only. Existing v2/v3 and application/authentication source remain preserved. Use existing local assets where appropriate; keep dependencies inside the lab. Do not launch another competing coder.
3. Produce **one composed, materialled, genuinely animated checkpoint**, with functional simulated form, not another static scaffold. Geometry, material and a short release study should be developed together. A grey image is a diagnostic, not a new gate that postpones the animation indefinitely.
4. Serve on a free loopback port without stopping existing servers. Report exact verified URL and source/build identifier.
5. Capture a settled desktop, a mobile frame, three distinct reveal frames and a real 15–20s recording including entrance, idle, pointer response, typing and simulated states. Inspect your output before declaring the checkpoint ready. Keep replay/debug UI separate from the clean presentation.
6. Report source paths, screenshots/video, actual checks and remaining defects in `docs/agent-bridge/antigravity/v4-report.md`. Codex/Claude review your output and return bounded corrections; you remain the coder.

Do not wait for another concept vote: the new direction is selected within the user's explicit request. This is isolated prototype authorization, not approval to integrate or deploy.

## Acceptance

The first frame must already look authored. Across the reveal, three frames must show a meaningful spatial transformation, not just a fade/rotation. Creases and light must remain legible without blown highlights; the resting scene should be memorable. The form and typography must belong to the composition, with no collisions at pointer extremes or during unfolding.

Reject repeating fins/stairs, stock torus/ribbon, full-screen gradient blobs, particle sphere/galaxy, generic glass-card composition, fake stats, or unrelated animation gimmicks. Check real recording, keyboard operation, invalid email, pending/accepted/error/resend, responsive controls, reduced motion, fallback and console errors. Report performance only with conditions and measurements. No claim of matching reference-site quality before actual visual review.

## Claude contribution and Codex corrections

Claude completed a separate read-only CLI review using plan mode and Read/Glob/Grep. The existing interactive Claude process was preserved; this is not a claim that its terminal received injected keystrokes. Claude reports viewing the current Phase A image and source/documents, not motion footage.

Claude rejected the literal staircase, flat slab material, headline collision and template form. Its key challenge was that smooth iridescent silk could simply become another generic AI-landing-page effect. Codex accepted the connected-crease alternative and directed force/sheens, and rejected the proposed initially invisible form, delayed interaction, editing beneath v3, fixed oversized type, fixed mobile hero percentage and frame-based damping. The detailed candidate brief remains useful wherever it agrees with this decision.

Codex independently viewed the saved folded Phase A image and agrees about its stair silhouette, headline collision and disconnected form. New animation has not yet been produced or accepted at the time of this decision.
