# V5 revision 2 — redesign the auth composition and material, not only its effects

Latest user feedback: the floating bodies still look plain/flat, and the login card is too simple and ugly. This is the next active revision, superseding the earlier instruction that merely quieted the card shell. Codex and Claude review only; AGY implements. Stay on the current V5 preview and preserve its independent loopback server at `127.0.0.1:5183`.

## What failed in the actual render

Codex inspected `evidence/codex-revision1.png` at the current 1440×900 desktop viewport. Text clearance improved, but the primary scene now reads as a simple circular blue gravel necklace with low-poly anchor rocks. Its strongest mass sits behind the form. The auth form still has almost the same small welcome heading, dark translucent rounded card, uniform rounded input/buttons and generic centered hierarchy. Recoloring the particles and removing the badge did not solve the user's complaint.

The revised Aris logo also differs from the original recognizable mark. Restore the existing actual brand mark unless the user explicitly asks to redesign the brand. Do not invent product claims such as 'công nghệ thế hệ mới' to fill visual space.

## Chosen composition — an ink kinetic scene opening into a pearl auth surface

Create a visibly different composition, not another CSS polish pass on the same card.

On desktop, an immersive ink scene occupies the left roughly 62% and connects into a **tall warm-pearl architectural auth surface on the right**. The right surface is a page region, not a small floating rounded rectangle: extend it close to the top and bottom page bounds, with a deliberate vertical edge, restrained depth at that seam, mostly straight geometry and subtle physical shading. Avoid a conventional equal 50/50 split or a detached cream card. Its inner content is a considered 350–390px column within a larger calm surface.

The scene's long asymmetric sweep approaches the seam tangentially and recedes in depth beside it, giving the two regions one spatial relationship. A small controlled light reflection can reach the seam. Reserve the auth surface against particles and reserve the narrative bounds against bright objects. The interactive scene remains substantial; do not shrink it into a corner to fit the new form.

Use near-black ink `#070B14`, pearl paper `#F0EEE8`, dark text `#172031`, cobalt `#355CFF`, with steel/slate neutrals and a few ice highlights. The light region is an intentional tonal counterweight to the kinetic dark environment. No heavy all-over blur, colored drop-shadow or luminous border around the entire form.

## Form art direction — make it a designed interface

Typography, hierarchy and spacing must visibly change. Use a locally available Vietnamese-capable editorial sans, with display weight around 500–600 and body weight 400–500. Avoid retaining the old ultra-heavy 22px welcome title as the primary form statement.

- Small real Aris wordmark/mark at the top of the auth surface; quiet registration affordance aligned intentionally, not a random extra badge.
- A generous 42–48px desktop greeting, **“Chào bạn.”**, with 1–2 short lines: **“Cơ hội tiếp theo bắt đầu từ đây.”** Distinctive type and whitespace should carry confidence. On mobile, use roughly 32–36px and test actual diacritics/line boxes.
- Form introduction in clear 14–15px text: **“Nhập email để nhận liên kết đăng nhập.”** Don't repeat a long marketing pitch here.
- Visible **“Email của bạn”** label. Make the input a precise, tactile inset field about 56px high, warm-white surface, 8–10px radius, fine neutral border, subtle top inset shadow and room for real typed text. Focus adds a clean cobalt boundary/indicator and shifts the surface slightly, not a neon halo. Keep a clear keyboard outline.
- Primary action about 56px high, deep ink or cobalt surface chosen by actual contrast. Label **“Gửi liên kết đăng nhập”**. A right-aligned directional arrow sits in a deliberate small end zone while the main label remains balanced; do not insert a fake extra button/tab or let the arrow steal semantic meaning. Press travel 1–2px, hover response ~160–220ms, no moving target.
- A quiet **“Không cần mật khẩu.”** helper below the email action. An editorial divider with **“hoặc”** follows, with deliberate spacing rather than dense stacked boxes.
- Google and Facebook retain recognizable official marks and readable labels. Give them equal geometry and alignment; use 48px minimum hit areas and calm white/neutral outlined surfaces. They must look designed with the email input, not like Bootstrap buttons copied from the previous version.
- Bottom registration copy and relevant legal/help links align with the same content grid. Do not add fake trust counters, arbitrary section numbers, dashboards, decorative status chips or unverifiable security promises.

Use a spacing rhythm around 8/16/24/40px. Header, input group, alternative providers and footnotes should read as distinct groups, not one equal-gap stack. Keep the auth content attractive and usable even when the art is hidden; this is a hard visual review test.

## Form states are part of the new design

Idle, focus, invalid email, pending request, request accepted, resend and recoverable error must share the new grid, surface and type system. Keep dimensions stable during progress. Use a restrained directional transition for the accepted request panel, with a properly composed heading **“Kiểm tra email của bạn”** and the submitted email. Do not reuse the old dark confirmation card inside the new surface. Announce status accessibly; accepted request is not authenticated success.

The form is visible and usable immediately; no entrance gate. The rich spectacle remains in the scene. Form movement is refined and state-related, not an excuse to add more decoration.

## 3D material correction — depth, not faceted confetti

The previous switch from pearl balls to octahedral gravel made the scene cheaper. Replace the low-poly presentation with a small family of deliberately smooth, weighty rounded bodies and finer supporting currents. The dominant objects need continuous curvature, broad readable reflections, a substantial shadow side, and distinct front/back occlusion. No handful of disconnected low-poly rocks floating around a ring.

Create a coherent environment/light rig that reveals shape: broad soft key reflection, darker opposing hemisphere, narrow controlled rim, reflected cobalt from the current. Smooth normals without adequate silhouette geometry are not enough. Avoid baking all depth into one white specular spot. Keep metal/pearl roughness differences legible; do not make all bodies mirror chrome or all matte blue.

Use asymmetry in the flow and the camera to eliminate the flat donut silhouette: one near arc, a receding far stream, a tapered release and variable cross-section/density. The primary current should look composed at rest. Keep fine bodies subordinate to a few credible foreground forms. The user's desired scale and local interactive forces remain required; a static product render is not the solution.

## Responsive and runtime

At 390px and 320px, compose a shallow dark artwork zone leading into the full-width pearl auth surface. Bring the greeting and first control into view early; allow natural scroll without hiding the primary action or hijacking touch. At short laptop heights, use sensible scrolling rather than clipping the taller auth surface. Reduced motion and WebGL fallback retain the designed composition. Preserve existing mock-auth boundaries and original brand assets.

AGY alone edits prototype source. Update V5 in place so the user can refresh the same preview. Do not create V6 or another port. Do not restart/stop the independent server. Preserve a pre-revision source snapshot inside the isolated lab if useful, without resetting user files.

## Deliver and verify

Produce a clean 1440×900 desktop, a 390px mobile screenshot, and a short pointer-visible recording. Capture one auth close-up with the artwork hidden or outside the crop: reviewers must be able to evaluate the interface itself. Review normal/focus/error/request-accepted states, text contrast and keyboard operation. Keep real animation interaction and scene depth visible in the overall recording.

Acceptance requires a clearly transformed auth region and credible material depth. A form that still has the old card silhouette and hierarchy is not complete even if its colors changed. A high particle count or material named 'physical' proves nothing without the rendered result.
