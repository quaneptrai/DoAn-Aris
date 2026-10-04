# Aris Login V5 — Implementation & Verification Report

- **Date:** 2026-09-18
- **Session:** `0c87a08a-40d3-4923-bd20-6db46d4bbe81`
- **Role:** Sole Coder (Antigravity). Reviewers: Codex & Claude.
- **Active Direction Briefs:**
  - [`docs/agent-bridge/dna-sequence-latest.md`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/agent-bridge/dna-sequence-latest.md)
  - [`docs/agent-bridge/nano-storm-final-direction.md`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/agent-bridge/nano-storm-final-direction.md)
  - [`docs/agent-bridge/nano-material-correction.md`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/agent-bridge/nano-material-correction.md)
- **Verified Local URL:** [`http://127.0.0.1:5183/index.html`](http://127.0.0.1:5183/index.html) (Clean view: [`http://127.0.0.1:5183/index.html?clean=true`](http://127.0.0.1:5183/index.html?clean=true))
- **Runtime Server Status:** Loopback server on `127.0.0.1:5183` (PID 12052) remained preserved and active throughout all edits and checks.

---

## 1. Sequence & Choreography Architecture

Following user directions, the experience delivers a continuous, same-body molecular transformation:

1. **0.0s – 1.8s (Cyclone Swirl -> 3D DNA Double Helix Assembly):**
   - 750 polished dimensional bodies swirl in broad spiral streams with front/back depth and angular momentum.
   - The bodies assemble into a clearly recognizable 3D DNA double helix:
     - **Strand A (280 bodies, 0..279):** $2.2$ full helical turns, radius $R = 0.92$, height $4.4$.
     - **Strand B (280 bodies, 280..559):** $180^\circ$ phase shift matching Strand A.
     - **19 Bridging Rungs (190 bodies, 560..749):** 10 bodies per rung evenly spaced across the two strands.
2. **1.8s – 3.2s (DNA Molecular Hold & Axial Rotation):**
   - The DNA double helix holds recognizable form for ~1.4s, rotating slowly around the Y-axis ($0.85\,\text{rad/s}$) to display 3D depth and specular chrome/cobalt highlights.
3. **3.2s – 4.7s (DNA Uncoils -> ARIS Assembly):**
   - The same bodies uncoil along continuous curved trajectories directly into the uppercase **ARIS** glyph targets.
   - Preserves open counters in **A** and **R**, bold 800 letter geometry, spanning ~70% desktop width and ~82% mobile width.
4. **4.7s – 6.5s (ARIS 1.8s Hold):**
   - A dedicated 1.8-second hold on the completely formed, sharp, legible ARIS wordmark with subtle organic micro-breath.
5. **6.5s – 7.9s (Living Nano Card & Title Construction):**
   - **160 Title Cells (0..159):** Form the visible heading ("Đăng nhập" in login mode, "Đăng ký" in registration mode). Positioned into the exact measured DOM heading rect.
   - **200 Perimeter Cells (160..359):** Form the rounded-rectangle card outline, settling smaller (`scale: 0.50`) and dimmer (`opacity: 0.38`).
   - **390 Surface Facet Cells (360..749):** Physically expand horizontally and vertically into adjoining thin transparent facets, settling to a subtle clear sheet with fine seams (`opacity: 0.09`, `depthWrite: false`). Eliminates the old bright LED dot grid.
6. **7.6s+ (Card Revealed & Seamless Title Handoff):**
   - The see-through HTML card reveals as title particles smoothly fade to 0 (`titleMesh.visible = false`), handing off directly to the crisp DOM heading with zero ghosting or duplication.

---

## 2. Geometry, Material & Performance Budgets

- **Geometry Budget:**
  - `SphereGeometry(0.028, 8, 6)`: 80 triangles per body.
  - Total across all 750 bodies: **exactly 60,000 triangles** (verified via `window.getRenderStats().triangles`).
  - **97% reduction** compared to the old unoptimized baseline of 1,920,000 triangles.
  - Distant cosmic dust capped at 100 faint points (no dense confetti).
  - Canvas pixel ratio capped at `1.5` for consistent 60fps performance on integrated Intel UHD GPUs.
- **Dimensional Surface Material:**
  - Custom 512x256 PMREM environment map with high-contrast metallic reflection stripes.
  - Authored Palette:
    - **Polished Chrome / Silver (28%):** `#F0F4F8`, `roughness: 0.12, metalness: 0.90`
    - **Deep Metallic Cobalt (40%):** `#2F6FED`, `roughness: 0.12, metalness: 0.85`
    - **Luminous Cyan / Pearl (24%):** `#7EC8F5`, `roughness: 0.15, metalness: 0.88`
    - **Warm Apricot Spark (8%):** `#F08A5D`, `roughness: 0.18, metalness: 0.80`

---

## 3. Frame & Layout Clarifications

- **Zero Duplicate CSS Glass Box:**
  - `.glass-auth-card` is layout and hit-testing ONLY in normal WebGL mode:
    `background: transparent !important; border: 0 !important; box-shadow: none !important; backdrop-filter: none !important;`
  - The 3D nano material forms 100% of the visual surface, title, and rim.
- **WebGL Fallback Architecture:**
  - Three.js setup wrapped in `try ... catch`.
  - If WebGL initialization fails or context is lost, `.webgl-fallback` is appended to `document.body`, activating a scoped fallback backing (`rgba(11, 18, 33, 0.88)`, `backdrop-filter: blur(12px)`) with immediately usable HTML forms.
  - Fully passes automated environments where WebGL is disabled.

---

## 4. Mode Switch & Bug Resolutions

1. **Rapid-Switch Pointer Event Interception Fixed:**
   - Introduced `switchGeneration` token to invalidate stale callbacks.
   - Cleared `.is-leaving` and `.is-entering` classes from both panels on interruption and completion.
   - Enforced `pointer-events: auto` on the active panel and submit buttons.
   - Verified via automated test: rapid `switchAuthMode('register'); switchAuthMode('login'); switchAuthMode('register');` allows immediate clicking of `#btnSubmitReg` with zero timeout or click interception.
2. **Submit Cancellation Safety:**
   - Any active submit timers are cleared on mode switch; disabled button states are restored with original button labels.
3. **State & Draft Synchronization:**
   - Email values are synchronized bi-directionally between Login and Register.
   - Name draft is preserved when returning to Register mode.

---

## 5. Summary of Verification

| Check | Expected | Result |
| :--- | :--- | :--- |
| **Geometry Triangles** | $< 100\text{k}$ triangles | **60,000 triangles** (verified via `window.getRenderStats()`) |
| **Body Count** | 750 bodies | **750 bodies** (160 title + 200 rim + 390 surface) |
| **DNA Assembly** | Coherent 3D double helix | Two intertwining strands + 19 rungs with axial rotation |
| **ARIS Wordmark** | Legible hold ~1.8s | Held from $4.7\text{s}$ to $6.5\text{s}$, open A/R counters |
| **CSS Wrapper** | Zero autonomous glass box | `background: transparent`, `border: 0`, `shadow: none` |
| **Title Handoff** | Match DOM heading, no ghost | "Đăng nhập" / "Đăng ký" rasterized, fades to 0 as DOM text reveals |
| **Surface Facets** | Continuous thin clear sheet | Facets expand to touch neighbors with fine seams (`opacity: 0.09`) |
| **Rapid Switching** | No pointer-events lock | Tested with rapid switches; submit clicked successfully with 0 errors |
| **WebGL Fallback** | Graceful fallback | Caught in `try...catch`, `.webgl-fallback` activates scoped styles |
