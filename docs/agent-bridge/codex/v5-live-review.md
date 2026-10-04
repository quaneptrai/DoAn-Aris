# Codex live review — V5 preview restored

Date: 2026-09-18. The user's latest complaint was that nothing appeared to be running.

## Verified runtime and ownership

The prior AGY print invocation ended with a network error and terminated its child server/capture processes. Codex restarted a separate Python preview server bound to `127.0.0.1:5183`, PID 12052 at this check. Do not stop, restart or replace this server. It serves `docs/design-lab/aris-login-v5/` and will show source updates on browser refresh. Do not start another server on the same port.

Codex verified HTTP 200, opened `http://127.0.0.1:5183/index.html?clean=true` in the user's browser, and ran a separate browser check: one canvas, no page exceptions over initialization and a pointer move. This is a narrow runtime check, not final functional or motion acceptance.

Live screenshot inspected directly: `docs/design-lab/aris-login-v5/evidence/codex-live-preview.png`, 1440x900. AGY remains the only prototype coder; Codex and Claude review only.

## Visual result: not approved yet

The scene now has visible volume and multiple particle currents, a substantial improvement in scale over the thin V4 strip. However:

1. Bright bodies overlap the headline and supporting copy. This is an actual collision in the live frame, not a hypothetical pointer-extreme issue. Reserve readable negative space through the full animation and pointer range; do not solve this by shrinking the entire artwork back into a tiny ornament.
2. Many similar bright, faceted beads form two obvious loops, giving a bubbly/stock-demo appearance. White highlights and uniform pearl faces flatten the hierarchy. Create a stronger single asymmetric current, with variation in density, scale and shadowed depth; refine foreground bodies and restrain white saturation. The field must remain rich and large.
3. The form still appears as a conventional floating rounded card, while the small 'QUY DAO MOI' badge remains filler. Integrate the form surface and type into the scene, quiet the card shell and remove the badge, keeping controls unmistakable.

Read `v5-reference-observations.md`: Codex has now verified playback and inspected samples from all four user Shorts. Earlier reports that only poster frames were available are outdated. Their useful shared principle is scene-level change in scale, perspective and composition, not a particular particle count.

## Bounded AGY revision

Fix the three concrete visual issues in V5 without reducing the requested local-force interaction or scene scale. Preserve the existing isolated scope and mock-auth controls. No application integration or deployment.

Then capture an updated clean desktop, mobile and a real 15–20s pointer-visible recording against the existing server. Inspect images yourself. Include normal approach/sweep, hold/release if implemented, recovery and input focus. Check actual console errors and legibility. Do not declare success from HTTP 200 alone.

Keep runtime tasks bounded and await their actual completion. Prior print turns killed unfinished tasks on exit; use command_status/appropriate waits instead of finishing with an 'automatic update later' promise. The externally managed preview server is intentionally independent of your turn and must stay alive.

Write `docs/agent-bridge/antigravity/v5-report.md` only with actual completed checks and limitations. If a network error ends the turn, the coordinator will treat it as stopped, not still running.
