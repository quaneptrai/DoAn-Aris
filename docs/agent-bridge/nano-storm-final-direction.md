# Latest correction: a metallic nano cyclone, no old glass frame overlay

The user has again viewed the live prototype and rejects three concrete things: the old transparent CSS frame overlaps the nano-constructed card; bodies lost their reflective finish and look plastic; convergence is too fast and unimpressive. They explicitly want a circular nano storm gradually gathering into ARIS. Preserve previous requirements for same material forming login/register cards, lower GPU cost, readable lettering and genuine controls. AGY sole coder; reviewers never implement app code.

## Remove the duplicate frame completely

The final `.glass-auth-card` HTML wrapper must be layout/hit-testing ONLY: background transparent, border none, box-shadow none, backdrop-filter none. Remove pseudo-element/other overlapping panel surfaces as well. No autonomous CSS glass rectangle may fade in on top of the particle material. The scene supplies the actual surface/rim. Fields may have controlled local inset contrast, but not an enclosing competing box. One visible material silhouette only. This supersedes earlier alpha0.08+blur3 wrapper permission.

## Intro: clearly a cyclone, not a lerp cloud

Use the accepted approximate750-body budget. Author broad curved spiral streams with coherent angular velocity, front/back depth, varied orbital radii, a luminous reflective leading band and darker trailing bodies. Think a controlled metallic hurricane around an open core, not a uniform star field. It should be visibly rotating across at least a full turn before converging. The nucleus/camera remain composed; no dizzy camera spin or flashing.

Suggested pacing: ~2.0-2.5s recognizable circular storm; ~1.5-2s gradual winding-in and stream-by-stream capture into glyph strokes; at least1.8-2s ACTUAL readable ARIS hold; then a deliberate1.3-1.7s material transformation into card. A ~7-8s first-run presentation is acceptable for this explicitly requested visual prototype, with Skip clearly available. Do not accelerate the whole thing back to4s. Reduced motion still opens a usable final form.

During convergence, retained angular momentum bends paths around the core then dissipates as individual bodies lock into spaced glyph targets. Do not just multiply a random sine swirl by1-progress and straight-line interpolate all bodies simultaneously. Keep coherent arcs and stagger capture spatially by streams/letter strokes; use bounded completion so every letter is fully readable when hold starts. Do not lose the accepted A/R counters and ARIS sizing. Once held, motion is subtle enough to read without squinting.

## Material: polished, dimensional nano bodies

Current uniformly flat cylinders/dots look plastic. Restore rounded dimensional bodies with controlled sharp environment highlights (silver/chrome and deep cobalt, sparse pearl). Use an environment that actually has bright reflection strips and dark contrast, not merely a dull all-blue wash. Material metalness/roughness numbers alone do not prove appearance; inspect actual frames. Slight body rotation must carry highlights as they orbit. Avoid blown-out white discs, random pastel confetti, glow hiding shape, or blanket blur.

Use efficient rounded geometry, roughly60-120 triangles per body if needed:750 bodies can remain well under100k triangles, hugely below old1.92million. Instance draws, no large postprocessing, pixel ratio max1.5, no return to4000 spheres. Measure actual renderer triangle count and frame intervals.

When forming card, these same bodies can flatten/stretch into subtle translucent contiguous surface cells. They must not stay as a bright LED dot grid. Rim settles thin/dim. Title construction must coincide with exact DOM heading bounds/text and transition cleanly to legible text, no ghost second heading. Registration remaps the same material and title. Preserve latest email and name drafts, stable accessible controls.

## Known functional checks for the final pass

- Rapid register/login/register left outgoing `is-leaving` or inert/pointer-events state attached to the final panel, causing `glassAuthCard intercepts pointer events` on btnSubmitReg. Normalize both panels on interruption and completion.
- WebGL disabled test throws `Error creating WebGL context` and no usable registration appears. Catch renderer initialization and expose both working HTML forms as graceful fallback (a quiet static fallback may have its own clearly scoped backing, never in normal WebGL mode).
- Mobile390/320 has no horizontal overflow in latest test; preserve natural scroll and scene alignment.
- Avoid stale simulated-submit callbacks changing modes or leaving disabled buttons.

Do not launch background verification then exit; those tasks get killed. Complete a focused code pass, return only completed changes, and Codex will run independent screenshots/runtime checks. Same V5, same external preview127.0.0.1:5183 and PID12052, no app integration/deployment. Inspect partial edits from interrupted pass rather than resetting accepted work.
