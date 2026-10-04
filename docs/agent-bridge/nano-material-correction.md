# User correction: the nano bodies ARE the card, not decoration around it

Latest user explicitly rejects the current result: ARIS cannot be read, excessive particles slow the page, and the card is still an unrelated panel. This directive supersedes the rim-only card construction and particle-density choices in earlier briefs. AGY codes; Codex and Claude review only. Do not implement another large rewrite or add embellishments before solving these three issues.

## Core visual contract

The SAME visible nano material first forms an unmistakable ARIS word, holds, then reorganizes INTO the transparent card itself, including its surface structure and title. It must not look like spheres swarming around a pre-existing CSS rectangle. When login/register changes, that material remaps into the new card structure and title, not just a new perimeter. Actual semantic HTML inputs remain required for usability, but their visual reveal must be synchronized with construction.

## 1. Readable ARIS, not a momentary cloud

Use dramatically fewer, more deliberate low-cost bodies. Proposed budget: about 600-900 instances with low-poly geometry (e.g. tiny rounded tiles/simple shallow cells or spheres with 6-8 segments); remove 1600-point background star confetti, or cap subtle distant points around 80-150. Existing 4000 spheres at16x16 and 1600dust are explicitly rejected. Do not compensate by giant noisy beads closing letter counters.

Choose glyph targets from a spaced, stratified or grid-sampled mask, not independent random sampling with gaps and clumps. Normalize actual glyph bounds; generous A/R counters, clear I and S, proper spacing. Fit width ~65-75% desktop and ~80-85% mobile. A clean bold sans skeleton must be recognizable at a glance.

Use bounded deterministic choreography to place the bodies on their assigned glyph positions within roughly1.2-1.6 seconds. A spring target that arrives but bodies continue lagging is NOT arrival. Hold the ACTUAL formed word for at least1.5-2 seconds before card construction. Prefer a measured readable hold over rigidly ending the intro at4 seconds. Idle shimmer cannot destroy the letter silhouette. Capture and inspect at the middle of the actual hold, not merely a filename called readable.

## 2. Material transforms into a card with text

Design a continuous mapping from the glyph cells to the card's thin transparent surface grid/lamellae and structural outline, while a reserved subset maps into the visible title 'DANG NHAP' / 'DANG KY' (render proper Vietnamese diacritics if legible). Cells can rotate/flatten/stretch into thin translucent facets as they travel, making a coherent low-alpha glass surface rather than a beaded necklace. The same instance IDs persist; no teleport/dispose/recreate. Avoid a permanent heavy grid or a thick particle border: settled surface should merge visually into refined clear glass while retaining enough material trace that its origin is obvious.

The HTML wrapper must NOT provide an independently opaque/blurred boxed card that simply fades in. It supplies layout, actual fields, labels, accessible heading and hit targets. If an HTML material backing is necessary as a technical bridge, reveal it progressively with the assembling cells and make the assembled visual read as one material, not two overlapping rectangles. No opacity0.55/blur24 glass. Keep environmental detail visible through the final surface and controls legible. Give the scene a restrained atmospheric depth, not thousands of bright confetti points.

The card title must genuinely participate in particle construction/remapping. A matching semantic DOM heading may take over for crisp text after the cells settle, without a duplicate title or perceptible replacement; don't claim DOM text simply fading in is particle lettering.

## 3. Login / registration modes

On explicit registration action, selected surface/title cells detach, reshape the taller card, and remap title cells to registration; the full-name/email controls reveal as that construction settles. Reverse uses the same bodies and retains draft input values. Title change and fields cannot jump immediately while the surface animates later. Keep each transition around0.8-1.2s, settle fully, then remain stable. No forced registration after successful sign-in.

Keep real inputs, passwordless prototype concept, visible labels, accessible hidden/inert state and focus restoration. Latest outgoing email value synchronizes both directions. Cancel stale simulated-submit callbacks during switches. Reduced motion, paused scene and WebGL fallback must still allow both usable forms. Match the measured card rectangle after layout and during mobile scroll. Do not replay intro on resize/focus.

## 4. Performance is now an explicit acceptance condition

Use low total triangle count and one/few instanced draws. Cap renderer pixel ratio around1-1.5, avoid heavy postprocessing/large blur and per-body allocations per frame. Cache stationary layout; update measurements only during resize/scroll/morph. Suspend rendering when tab hidden; after scene settles use restrained motion rather than needless high-density simulation. Report actual instance/triangle counts and measured frame intervals on the available browser, clearly identifying software rendering if used. Do not promise universal60fps.

## Delivery

Same docs/design-lab/aris-login-v5 prototype, same independent preview127.0.0.1:5183. Preserve server PID12052, app code, backend and snapshots. Inspect partial edits from interrupted previous pass before patching. Implement these core corrections FIRST. Run short awaited checks only, do not launch background captures that are killed on CLI exit. Codex will independently inspect actual readable word, mid-construction surface, final login, mid title/card remap, registration, reverse, mobile and fallback. Return honest completed results; no 'awaiting later' report.
