# Selected concept for prototype studies: Aris — Nhịp vươn
 
> [!WARNING]
> **SUPERSEDED & CANCELLED (2026-09-18):** This staircase/rung concept is superseded and replaced by [`v4-reviewed-decision.md`](v4-reviewed-decision.md) ("Aris — Bứt phá / Crease Release"). Do not implement or review staircase geometry. Active work proceeds solely under `docs/design-lab/aris-login-v4/`.
 
Selected by the active Codex coordinator on 2026-09-18 after reading Claude's and Antigravity's written proposals. This is approval of a direction for visual studies, NOT a claim that the design is finished or visually accepted.

## Latest user requirement — visual and motion quality is the primary acceptance gate

The user explicitly reiterates: the finished login must be sufficiently impressive, with a complete animation experience at the aspirational craft level of the Astra and Antigravity reference sites. Treat that as the central objective, not an optional polish task. A static composition, a thin animated line, a logo plus spinner, or a fade-in on an otherwise ordinary login does not satisfy it. The references set ambition; they do not prescribe our concept or certify our result.

Phase A remains a cheap internal composition check only. Phase B must deliver an integrated, visually authored experience: an arresting entrance with meaningful spatial change; attractive material/light behavior; fluid, bounded pointer response; deliberate ambient life; transitions between form states; and a separately composed mobile experience. Quieting the scene during typing must not be misread as making the whole page lifeless. Avoid excessive motion and flashes; energy should come from choreography, scale, depth and contrast.

Before final acceptance, reviewers must inspect a real recording of entrance, settled motion, pointer movement, focus/typing, submit and accepted/error transitions. Show the actual production-intended presentation with debug controls hidden, plus an accessible way to replay the demo for review outside that presentation. Judge whether the object and composition remain distinctive at rest, whether motion reveals structure rather than simply moving objects, and whether every interaction feels part of the same visual language. Record defects and require a revision if the result still looks like a template or a technical demo. Do not label it world-class merely because code runs or because the report says so. Distinguish this qualitative aspiration from measured performance claims.

## Synthesis

Combine Claude's **Orbital Rungs** with Antigravity's **Architectural Trajectory**. Both propose a spatial ascending structure rather than a borrowed cosmic scene. Develop a sequence of substantial sculptural fins/steps whose orientation and spacing progress from a gathered curved base into an open rising gesture. The sequence creates one object with a deliberate inner opening. It should look like a designed kinetic sculpture; avoid a literal office staircase, equalizer, DNA helix, slinky or torus knot.

The Aris identity comes from upward momentum, a curved release and blue accents, not from tracing the small logo at giant scale. Keep the actual logo in the header. Do not add a galaxy, particle globe, scattered cards or digit animation.

## Ownership and cost control

Antigravity is the only implementation owner for `docs/design-lab/aris-login-v3/`. Codex and Claude provide review. Preserve v2 and all application files. Reuse the local Three.js asset if suitable; no dependency changes in ASP.NET. No real email/OAuth calls.

**Start with Phase A only.** Do not spend on a polished animation until the composition studies have been reviewed. This is an internal team milestone; do not ask the user for another permission.

## Phase A — two inexpensive visual studies of this ONE concept

1. Build a small true-3D scene, with roughly 18–30 fins as a starting range, actual thickness, restrained bevel/edge treatment and legible front/back occlusion. Adapt counts to the design rather than treating the numbers as requirements.
2. Model coherent progression in orientation, width and spacing along one composed curve. Leave the inner opening visible. Use a restrained opaque material first: no particles, no transmission shader and no bloom are needed to prove the object. Fix lighting and geometry before adding effects.
3. Prefer a dark ink/blue-black stage with pearl/slate lit faces and selective Aris blue inner edges. Avoid white hotspots. The important criterion is clear volume, not a mandatory hex code or expensive effects stack.
4. Produce two desktop compositions that vary camera angle and the object's relationship to the type. Both need a real form footprint. Compare a rising diagonal sweep with a more compact folded arrangement. Do not build two complete applications.
5. The headline is short: “Đi xa hơn. Theo cách của bạn.” Avoid the accidental three-line wrapping of v2. Use intentional line breaks and reserved bounds so neither text nor controls overlap the object's extreme projected position. The form should feel part of the composition; avoid a thick outlined box as the dominant second object.
6. Include a first mobile crop at 390px showing the form early, with an independently framed part of the sculpture. Keep a recognizable static hero if motion is reduced.
7. Capture the settled studies and inspect them yourself. Recommend the stronger composition based on actual rendered output, explaining one weakness to address. Confirm the geometry looks intentional without glow.

Serve the isolated directory on a loopback-only available port, preferably 5181; do not stop or reconfigure 5025/5180. Report the exact URL actually verified. Save evidence under `docs/design-lab/aris-login-v3/evidence/phase-a/`. Write `docs/agent-bridge/antigravity/phase-a-report.md` with exact paths, chosen camera, implementation notes, screenshot timestamps and any checks not completed. A working still study is sufficient for this milestone. Do not call it a finished animated login.

## Phase B — after reviewers select the composition

The intended gesture is **alignment followed by ascent**. The sculpture is already legible at first paint. Over approximately 1.6–2.2 seconds a modest coordinated change in the fins' orientation opens the negative space and reveals a directed light progression upward. No explosion from random positions and no compulsory loader. At rest the silhouette stays composed, with subtle internal light/motion rather than perpetual multi-axis wobble.

Pointer response belongs only to the artwork region: small damped perspective changes. Typing eases the scene into a quieter state. Reduced motion renders an attractive resting pose immediately. A loading request can accelerate one directed light passage; accepted request resolves once. Errors remain local to the form. Do not turn the sculpture into a success/authentication claim.

Phase B acceptance will require actual animation footage, responsive inspection and console/form-state checks per TEAM.md. Performance claims require measurement. If WebGL cannot initialize, provide a composed local fallback; do not abandon the principal concept without explaining the observed problem to reviewers.

## Notes to Claude

This selection incorporates your structural-rung idea, with Antigravity's emphasis on material and physical architecture. Please critique the actual Phase A studies when they arrive. Check for the slinky/equalizer failure mode, geometry that only works with glow, and whether the form/typography belong to the same design. Keep review feedback in `docs/agent-bridge/claude/review-phase-a.md`. Do not edit v3 source.
