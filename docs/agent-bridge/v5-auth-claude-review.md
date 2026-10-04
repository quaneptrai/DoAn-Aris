# Joint auth redesign decision — Claude critique and Codex resolution

Date: 2026-09-18. Read with `v5-auth-art-direction.md`. This is the next AGY implementation pass in the same V5 URL, not a new prototype number. Claude completed a read-only CLI review and did not edit source. Codex remains coordinator/reviewer.

## Agreed direction

Claude independently selects a **full-height pearl auth bay** opposite the dark kinetic scene, not a recolored rounded card. It agrees on large deliberate type, a single-edge cobalt detail, inset controls and clear geometry. It specifically warns that a small detached cream card with the old centered helper text and equal social boxes would still look like the same template.

Proceed with the composition in `v5-auth-art-direction.md`, with these refinements:

1. Make the right bay a structural page region extending from header to footer; squared outer geometry, roughly 430–470px at 1440px depending on actual spacing, with a 350–390px content measure. One restrained cobalt seam is enough. A few artwork accents may approach/overlap at most the decorative seam region only; no objects may touch text, fields or controls. Do not put all particles behind the auth surface and call that integration.
2. Prefer an editorial greeting around 40–44px desktop, mixed-case label at least 13px, 16–17px input text, clear body copy and left-aligned helpers. Retain the latest brief's concise truthful copy. Make the new greeting, field geometry and spacing visibly different from the original 22px card title and equal-gap stack.
3. Replace the old two equal small social boxes with **full-width Google and full-width Facebook rows**, both clearly actionable with brand marks and adequate tap size. They may have restrained hierarchy, but neither should masquerade as a disabled text link. Email stays primary. Keep all aligned to the same content grid.
4. Use one consistent control-radius family around 10–12px, while the structural bay has no rounded-card silhouette. CTA may have a fine lit top edge and short pressed-depth response. No enormous colored glow around it.
5. Add a suitable environment/PMREM lighting source to support metallic reflections. Claude identified high metalness without an environment in the earlier scene as a cause of flat grey-plus-specular-dot appearance. A named PBR material alone is insufficient. Confirm the new render has broad reflections, a substantial shadow side and smooth silhouettes.
6. Create obvious body-scale hierarchy, a thick near stream and receding far stream, with depth-dependent contrast/fog if appropriate. Do not turn the result into a gravel necklace or replace smooth objects with coarse octahedra. Shadow cues must have coherent spatial meaning; do not stick contact shadows under floating objects without a receiving surface.
7. Preserve usable form at first paint. Reject Claude's proposed whole-bay 40px entrance slide if it moves hit targets while someone is using the form. Animate a decorative seam or art instead. Keep errors and accepted-request transitions stable and readable.
8. Reject fixed mobile 46vh as a requirement; use real 390×844 and 320×568 layouts with natural scrolling. Reject an invented resend countdown such as 0:42; any cooldown in the mock must be implemented and visibly simulated rather than decorative. Do not add legal-consent claims unless the actual product flow calls for them.

## Evidence limitations

Claude reviewed images and source, not continuous motion. Some screenshots referred to the earlier V5 version. Codex separately inspected `codex-revision1.png` after the previous correction and still found the generic dark auth card and faceted necklace look. This decision applies to that newest observed result.

## Delivery gate

Implement both the new auth layout and credible material depth in V5. Keep the externally managed `127.0.0.1:5183` server running. Capture clean desktop/mobile, auth close-up and focus/error/accepted states; capture actual pointer-visible motion without stopping the server. Inspect them before reporting completion. The user must see a materially different login interface on refresh, not a nearly identical dark card with a new border.
