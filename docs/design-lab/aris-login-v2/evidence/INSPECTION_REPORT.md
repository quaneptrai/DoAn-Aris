# Aris Login V2 — Visual Prototype Inspection & Verification Report

*Date: 2026-09-18*  
*Prototype Target URL:* `http://localhost:5180`  
*Scope:* Isolated Visual Prototype under `docs/design-lab/aris-login-v2/`

---

## 1. Executive Summary & Creative Direction

This iteration fulfills the art direction set forth in `docs/ui-redesign/04-antigravity-login-art-direction.md`:
* **The Sculpture Concept ("Quỹ Đạo Điêu Khắc"):** Replaced the generic flat SVG and split-screen box with a genuine physical continuous 3D ribbon sculpture in Three.js WebGL. The sculpture features a tactile matte ceramic paper exterior (`#F8FAFC`, roughness 0.78) and a luminous electric Aris Blue interior (`#2F6FED`, emissive `#1E5AD6`).
* **Visual Composition:** Formulated based on **Composition A**, establishing a tangible 3D ascending trajectory that echoes the Aris brand mark. On desktop (1440×1000), the sculpture occupies ~60% of the canvas in its own visual theater while the calm 400px login pod rests on the right.
* **Responsive Recomposition:** On mobile (390×844 and 320px), the 3D sculpture is independently composed into a dedicated 175px floating visual header directly above the headline, eliminating any visual occlusion or text collision.

---

## 2. Graphics Technique & Material Architecture

* **Engine:** Three.js r128 (`docs/design-lab/aris-login-v2/vendor/three.min.js`, 603 KB, pinned locally, 100% offline capable).
* **Geometry:** Custom parametric Catmull-Rom 3D space curve with 200 ribbon segments, variable width tapering (0.42 to 0.92 units), and continuous surface normals.
* **Materials:** Dual-surface standard PBR:
  * Front side: Matte textured ceramic (`color: #F8FAFC, roughness: 0.78, metalness: 0.03`).
  * Back side: Radiant Aris Blue (`color: #2F6FED, roughness: 0.32, emissive: #1E5AD6, emissiveIntensity: 0.32`).
* **Contact Shadow:** Soft radial falloff contact shadow rendered on a blurred canvas texture plane (`opacity: 0.9`) to provide grounding without harsh polygons.
* **Lighting:** Studio 3-point lighting + blue inner glow point light (`PointLight(0x2F6FED, 2.8)`).

---

## 3. Motion Choreography & Interaction Verification

* **Reveal Sequence:** 2.2-second entrance with smooth cubic-bezier camera glide from `z: 9.8` to `z: 7.8` and subtle rotation, revealing the vibrant inner blue fold.
* **Ambient Breathing:** Organic harmonic oscillation (`sin(t * 0.7) * 0.035`) with gentle torsional twist (`cos(t * 0.45) * 0.03`).
* **Pointer Parallax:** Real-time mouse/touch parallax tracking with inertia lerp (`mouse += (target - mouse) * 0.05`), preserving the native cursor.
* **Form-Focus Damping:** When the email input is focused, ambient motion is automatically damped by 80% (`focusDamping = 0.2`) to prevent visual distraction while typing.
* **Loading State Pulse:** A luminous emissive pulse travels through the ribbon during submission simulation.
* **Settling Gesture:** When the Check-Email state is entered, the ribbon performs a gentle vertical settling gesture (`settleOffset = 0.25`).
* **Prefers-Reduced-Motion:** Fully respected via CSS media query and JavaScript detection; freezes all animations and displays an elegant static resting pose.

---

## 4. State Matrix & Functional Coverage

| State | Trigger / Query Param | Visual Feedback |
|---|---|---|
| **1. Default** | `/?clean=true` | Clean empty input, blue CTA button, resting sculpture |
| **2. Loading** | `/?clean=true&state=loading` | Button spinner + "Đang gửi…", input disabled, ribbon luminous pulse active |
| **3. Check Email** | `/?clean=true&state=check-email` | Mail icon card, submitted email displayed, 45s countdown timer, "Đổi email" action |
| **4. Invalid Email** | `/?clean=true&state=error` | Red border `#DC2626`, dark red error text `#991B1B` (WCAG AAA 7.6:1), aria-invalid |
| **5. Send Failure** | `/?clean=true&state=send-failure` | Keeps input intact, shows calm error banner, enables retry |
| **6. Cooldown** | `/?clean=true&state=cooldown` | Explicitly labeled prototype simulation timer |
| **7. Provider Down** | `/?clean=true&state=provider-unavailable` | Google button disabled with clear explanatory banner and Email fallback |

---

## 5. Viewport Verification & Evidence Artifacts

* **Desktop 1440×1000:** [`desktop_default.png`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/aris-login-v2/evidence/desktop_default.png)
* **Desktop Loading State:** [`desktop_loading.png`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/aris-login-v2/evidence/desktop_loading.png)
* **Desktop Check-Email State:** [`desktop_check_email.png`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/aris-login-v2/evidence/desktop_check_email.png)
* **Desktop Error State:** [`desktop_error.png`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/aris-login-v2/evidence/desktop_error.png)
* **Laptop 1024×768:** [`laptop_1024.png`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/aris-login-v2/evidence/laptop_1024.png)
* **Mobile 390×844:** [`mobile_390.png`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/aris-login-v2/evidence/mobile_390.png)
* **Mobile Narrow 320×650:** [`mobile_320.png`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/aris-login-v2/evidence/mobile_320.png)
* **Browser Motion Recording (14s WebM):** [`aris_login_v2_motion_recording.webm`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/aris-login-v2/evidence/aris_login_v2_motion_recording.webm)

---

## 6. System Integrity & Boundaries
* **Application Code:** Untouched. ASP.NET Core Razor views, controllers, migrations, and database remain 100% intact.
* **Server Isolation:** Prototype runs independently on loopback port `http://localhost:5180`. Existing application continues running undisturbed on `http://localhost:5025`.
* **Shutdown:** To stop prototype server, terminate background task `task-890` or stop Python HTTP server.
