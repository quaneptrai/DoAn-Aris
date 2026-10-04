# Aris Login V3 — Phase A Visual Studies Report

*Date: 2026-09-18*  
*Role: Primary Coder (Antigravity)*  
*Reviewers: Codex & Claude*  
*Live Prototype URL:* `http://localhost:5181`  
*Scope:* Isolated Visual Studies under `docs/design-lab/aris-login-v3/`

---

## 1. Executive Summary & Verification Context

In accordance with `docs/agent-bridge/approved-login-concept.md` ("Aris: Nhịp vươn") and requests `codex_login_phase_a_1789726419419` / `codex_login_quality_1789726461838`, we have built the internal Phase A 3D composition studies in isolated directory `docs/design-lab/aris-login-v3/`.

* **Geometry:** Modeled 24 substantial architectural fins (`NUM_FINS = 24`) with tactile thickness (`0.11` height, `0.42`–`0.95` tapered width). No particles, no particle spheres, no galaxies, and no giant logo tracings.
* **Materials & Lighting:** Restrained opaque PBR dual-material finish — pearl/slate matte lit faces (`#CBD5E1`, roughness `0.38`, metalness `0.12`) with selective radiant Aris Blue inner facets (`#2F6FED`, emissive intensity `0.35`). Illuminated with studio directional key light, fill light, blue rim light, and soft radial contact ground shadow. The volume is completely legible without relying on bloom or post-processing glow.
* **Hosting & Port Isolation:** Actively served on loopback port **`http://localhost:5181`**. Application source on `5025` and v2 prototype on `5180` remain 100% untouched.

---

## 2. Evidence Artifacts & Inspection

All screenshots were captured directly via Playwright headless browser on the running loopback server:

| Study Item | Artifact Link | Resolution | Notes |
|---|---|---|---|
| **Composition 1: Diagonal Sweep** | [`desktop_comp1_diagonal.png`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/aris-login-v3/evidence/phase-a/desktop_comp1_diagonal.png) | 1440×1000 | Expansive parabolic diagonal ascent across the negative space |
| **Composition 2: Compact Folded** | [`desktop_comp2_folded.png`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/aris-login-v3/evidence/phase-a/desktop_comp2_folded.png) | 1440×1000 | Curvilinear kinetic monument looping around an intentional inner opening |
| **Mobile Crop (390px)** | [`mobile_390.png`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/aris-login-v3/evidence/phase-a/mobile_390.png) | 390×844 | Dedicated vertical stage between narrative and form, 0% text collision |

---

## 3. Visual Comparison & Recommendation

### Composition 1: Rising Diagonal Sweep (`?comp=diagonal`)
* **Characteristics:** The 24 fins sweep diagonally from the lower-left center toward the top-right in an expansive arc.
* **Strengths:** Strong directional momentum suggesting rapid ascension and career trajectory.
* **Observed Weakness:** When viewed from a static desktop perspective, the lower segment can read somewhat uniformly like an architectural louver or staircase railing.

### Composition 2: Compact Folded Structure (`?comp=folded`) — **RECOMMENDED**
* **Characteristics:** The fins loop around a clear, intentional negative-space aperture before ascending vertically into an open gesture.
* **Strengths:**
  1. Substantially more sculptural and bespoke. It evokes the Aris looped brand motif without being a literal 2D tracing.
  2. Distinct front/back occlusion: the rungs twist and expose their pearl top faces while concealing and revealing the Aris Blue inner facets.
  3. Perfectly balances the negative space between the 2-line headline ("Đi xa hơn. / Theo cách của bạn.") and the login pod without crowding either element.
  4. On mobile (`mobile_390.png`), the folded silhouette reads immediately as an iconic kinetic emblem rather than a diagonal line.
* **Weakness to address in Phase B:** In Phase B motion choreography, the transition between the gathered base and the rising arc should have an orchestrated stagger (a progressive wave of orientation and traveling light pulse) rather than a rigid uniform rotation.

---

## 4. Phase B Readiness

* [x] Form is usable and keyboard-focusable from frame 0.
* [x] Zero external CDN network dependencies (Three.js r128 locally pinned under `vendor/`).
* [x] Reduced-motion media query handled.
* [x] No console errors on initialization, resize, or state inspection.
* [ ] Awaiting Codex and Claude review in `docs/agent-bridge/claude/review-phase-a.md` and `docs/agent-bridge/codex/review.md` before initiating full Phase B motion choreography.
