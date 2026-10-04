# Aris V5 — immersive interactive spectacle: latest user override

Date: 2026-09-18. Active Codex coordinator, following a fresh read-only Claude critique. This supersedes the V4 crease-only art direction. AGY remains the sole coder. Codex and Claude remain reviewers/planners.

## What the user actually wants

The user explicitly rejects small decorative animations and requests an explosive, distinctive interactive scene with the ambition of Astra's galaxy introduction and Antigravity's large rings/nanosphere simulations that visibly respond to the pointer. They supplied four YouTube Shorts as visual references:

- https://www.youtube.com/shorts/yVXsS59LYJ0
- https://www.youtube.com/shorts/sYGsqFtojDc
- https://www.youtube.com/shorts/LQOona1NXrE
- https://www.youtube.com/shorts/_-Eo8G3CYWc

Earlier blanket bans on galaxies, spheres, rings or particles are cancelled. Those are permissible visual building blocks. The requirement is an authored experience with real observable interaction, not avoidance of a category. Do not use this new brief to make a slightly richer variant of the old waving membrane.

## Evidence: V4 does not satisfy the brief

Codex directly inspected `aris-login-v4/evidence/desktop_settled.png`: a narrow diagonal strip, largely empty stage, separate conventional form card. Source inspection shows pointer input mainly assigning whole-mesh X/Y rotation, rather than local force or displacement. The advertised idle surface wave is computed in `applyVertexPositions`, which the shown loop calls only during reveal, so the claimed continuing internal flow is not established. The form-side pointer still influences the mesh. These are concrete reasons to replace the visual system, not subjective requests for extra glow.

Claude independently rejected the single-plane/global-parallax approach and proposed a **Living Toroidal Field** with differentiated depth/density, local attraction/repulsion/curl, inertia, recapture, and an entrance that changes the scene. This brief accepts those principles and adds constraints against generic particle soup and arbitrary particle-count targets.

## Selected direction: ARIS — RESONANCE / Trường cộng hưởng

An immense asymmetric orbital field occupies the scene: pearl/metallic micro-bodies collect into dense luminous currents, with an open core and a sweeping escaping arc. The camera looks obliquely through multiple layers, close enough that foreground bodies have weight and occlude the distant field. A few larger bodies anchor scale; the micro-field supplies richness. The structure has uneven density and a composed direction, never a uniform cloud or a perfect flat ring.

This is a kinetic environment. The form and typography inhabit its quiet negative space; they are not three unrelated columns alongside a small 3D toy. Use atmospheric spill and shared composition to connect the DOM form to the scene. Keep native HTML controls fully legible and operable; do not bury controls behind particles or put form text inside WebGL merely to claim integration.

At rest the field should already be striking. Motion must reveal depth and weight, not compensate for an uncomposed screenshot. Keep Aris identity through its blue, asymmetric release, Vietnamese editorial typography and precise interaction.

## Theme and stage

Use deep ink with broad tonal depth, pearl/silver bodies, intense cobalt currents and small warm energy accents. Distinguish lit surfaces, reflection and emission; avoid giving every particle identical glow. Use a small family of controlled body sizes and depth-dependent brightness. Preserve dark pockets so dense regions read as structure rather than luminous fog.

On a 1440×900 desktop the field should dominate roughly 60–75% of the visual experience, crop intentionally off the stage, and show at least three obvious depth layers. These are composition targets, not mechanical area percentages. Large type sits within the designed negative space. The form occupies a calm surface integrated into the same scene with clearly bounded fields, not a dominant floating rounded card. Remove the old filler badge.

Suggested copy: “Mở lối riêng. / Bứt phá cùng Aris.” The scene carries the spectacle; copy stays concise. Retain real login choices as simulated controls in the lab. The login must be visible and usable at first paint.

## Non-negotiable interactive behavior

1. **Approach:** as the pointer enters the artwork, a local region responds visibly. Peripheral elements lean or gather toward the force field while the immediate core parts around it. The response must be visible at normal viewing scale, not just a few pixels of camera tilt.
2. **Sweep:** pointer movement imparts direction and momentum. Bodies deflect and curl into a coherent wake; foreground and background layers react differently. Elements outside the influence region retain their flow.
3. **Hold and release:** optional press-and-hold in the art region gathers/compresses a local region; release produces one controlled outward surge followed by re-capture into the orbit. Ordinary pointer movement already demonstrates substantial interaction, so the scene does not depend on discovering a hidden gesture. No input interception over controls.
4. **Recovery:** releasing or leaving the art does not snap to a rest pose. Different layers settle with visible inertia. A short-lived energy trail decays along the affected current and resolves cleanly.
5. **Continuity:** this is one motion system. Pointer forces, ambient currents, entrance and form-state light gestures share its direction and materials. Do not bolt a separate particle explosion onto a stock ring.

Implementation must maintain temporal state (position/velocity or an equivalent continuous stateful field), use bounded forces/time integration, and prove local causality. A sine deformation whose amplitude tracks cursor position or whole-group rotation alone does not meet this requirement. Visual plausibility matters; no need to claim scientifically accurate nanophysics.

## Entrance and living scene

Plan a 3–4 second authored transformation while keeping the form available. Start with a rich compressed current already present. Draw the near and far streams apart to reveal the opening and depth; release a coherent arc across the scene; use a modest camera move to reveal scale; settle into an active orbit. Three extracted frames must show materially different spatial arrangements.

The settled scene stays alive, with multiple coherent flow speeds and occasional light/energy transfer. Typing reduces interference in the immediate form region, not the entire environment to a near-static ornament. Form pending and request-accepted states give concise related feedback; errors remain local to the form. Accepted email request is not authenticated success.

## Technical scope belongs to AGY

Use an efficient rendering approach appropriate to this scale: GPU instancing, sphere impostors, shader-driven field motion or GPU state textures are options. A few large real meshes can anchor depth while cheaper bodies form dense currents. Choose by rendered quality and measured behavior. Do not simulate tens of thousands of rigid bodies on the CPU to satisfy an arbitrary numeric count.

Claude suggested 60k–150k bodies as an ambition sketch. Codex explicitly rejects a hard >=50k-body acceptance gate: a count does not prove richness, responsiveness or frame rate. Record actual representation, visible density and measurements. Do not accept 500 weak dots simply because they run smoothly, or 150k indistinguishable points because the count sounds impressive.

Keep dependencies isolated. Preserve all earlier prototypes and application/auth source. Work in `docs/design-lab/aris-login-v5/`; no integration/deployment yet. Use a free loopback-only port and keep established servers intact. If the rendering path fails, provide a composed static fallback and usable form without claiming that fallback fulfills the primary interactive target.

## Mobile and accessibility

Compose a closer crop rather than shrinking the desktop scene. Support meaningful touch interaction in the dedicated art region without hijacking page scroll or form entry. Desktop pointer quality must not be watered down because mobile needs a different input model. Reduced motion has a strong settled composition and restrained feedback. Include pause motion, visible keyboard focus, readable contrast and accessible request status. Do not hide form controls to make room for spectacle.

## Next work package and acceptance

First inspect the supplied references honestly. Distinguish poster/thumbnail from advancing video and verify actual playback time before calling a capture a timed frame. A video showing motion does not by itself prove mouse-driven physics. Do not label console-encoding failures or paused playback as video access restrictions.

Then build **one convincing live interaction proof in the intended scene and layout**: dense articulated volume, local force response, inertia and recovery, plus an immediately usable mock form. This checkpoint precedes prolonged micro-polish. AGY may proceed autonomously once it has read the latest reviewer decision and recorded reference findings; another user concept vote is not needed.

Show a real recording with pointer visible: idle, slow approach, rapid sweep, hold/release, pointer exit/recovery, then input focus/typing. Capture three entrance frames, a settled desktop, mobile, and an alternate pointer state at a comparable time. Include an idle-control capture or deterministic replay that allows reviewers to separate cursor effects from ambient animation. Record build/source identity and viewport/browser/hardware conditions.

Reject if the effect is only rotation, blur, glow, scale breathing, static stars, a spinning ring, or a generic flat point cloud; if pointer motion has no obvious local consequence; if recovery snaps; if the scene visually collapses into a thin strip; or if controls are clipped/obscured. Review the actual footage, not the implementation's naming or its report.

Measure frame-time distribution under idle and vigorous interaction at a stated resolution/DPR and device; report dropped frames and quality tradeoffs honestly. Aim for fluid interaction on the test device, with no unsupported universal 60fps claim. Art acceptance and functional acceptance are separate and both required.

## Observation limits at drafting

Codex has inspected two YouTube captures: the first link shows a white editorial page with a vivid band of repeated folded forms, and the fourth shows a large Earth beside prominent type. Both captures display a play overlay; these establish composition, not observed animation. The initial capture script did not verify media currentTime and its filenames are elapsed capture labels, not verified video timestamps. Two other attempts initially failed because Windows stdout could not encode emoji in their titles; that is a local logging issue. AGY is retrying. Do not claim all four motions have been watched on the basis of these files.
