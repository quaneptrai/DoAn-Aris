# Antigravity Design Response & Concept Proposals

*Date: 2026-09-18*  
*Role: Primary Coder (Aris Login v3)*  
*Context: Response to `TEAM.md`, `codex_team_login_1789725983234`, and `05-claude-login-design-dialogue.md`*

---

## 1. Reference Site Inspection & Video Evidence

Per the user's explicit instruction to inspect and record animations from the reference sites, we conducted live browser capture sessions:

1. **Google Antigravity (`https://antigravity.google/`):**
   * **Evidence Artifact:** [`docs/design-lab/references/antigravity_google_animation.webm`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/references/antigravity_google_animation.webm) (4.0 MB, 1440×900 60fps recording).
   * **Visual Analysis:**
     * **Background & Space:** Pure, unapologetic white canvas (`#FFFFFF`) with generous, confident whitespace.
     * **Graphics Technique:** Multi-canvas WebGL particle vortex simulating physical buoyancy and upward liftoff ("antigravity").
     * **Interaction:** Cursor movement creates dynamic displacement in the particle field; particles react, scatter, and settle organically without frantic jitter.
     * **Typography & UI:** Deep contrast Google Sans, bold headline, pill CTA buttons (`rounded: 999px`, dark solid `#000000` vs ghost secondary).
     * **Takeaway:** High-end craft comes from **radical restraint, tactile interactivity, and breathing room**, not dense visual noise.

2. **OpenAI Astra (`https://openai.com/index/gpt-6-astra/`):**
   * **Evidence Artifact:** [`docs/design-lab/references/openai_astra_recording.webm`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/references/openai_astra_recording.webm) and screenshot [`openai_astra_screen.png`](file:///D:/Downloads/ArisThucTap-main/ArisThucTap-main/docs/design-lab/references/openai_astra_screen.png).
   * **Status & Honest Limitation:** Automated headless browser access was intercepted by Cloudflare Turnstile verification challenge. In adherence to user instructions ("Nếu không truy cập được, ghi rõ giới hạn; không tự khẳng định đã xem hiệu ứng"), we document this boundary rather than inventing unobserved animation details.

---

## 2. Concept Critique & Three Independent Candidate Directions

Aris is a Vietnamese career and recruitment platform. The visual metaphor must signify **career elevation, authentic capability, momentum, and professional trust**, rather than deep-space fantasy, video game sci-fi, or generic SaaS particle soup.

### Direction A: The Architectural Trajectory ("Quỹ Đạo Kiến Trúc")
* **First-frame composition:**
  Clean studio gallery setting (warm neutral canvas `#F8FAFC`). Left: Bold typographic statement (*"Đi xa hơn. Theo cách của bạn."*) with generous line-height. Center-Right: A series of precisely faceted, semi-translucent architectural blades that overlap in 3D space. Right: Crisp, borderless login pod with elevated field contrast.
* **Memorable 2-second motion gesture:**
  On load, the geometric blades smoothly slide along their axes and interlock into a single cohesive ascending staircase/trajectory. When interlocked, a focused Aris Blue light seam pulses once along the spine.
* **Aris Identity:**
  Directly evokes career ascension, structure, and the Aris looped ribbon mark without being a literal 2D logo tracing.
* **Biggest Risk of Generic:**
  If the facets lack realistic studio depth, contact shadows, or physical refraction, it risks looking like a 2018 corporate fintech geometric graphic.

### Direction B: Sculptural Folded Ribbon V3 ("Quỹ Đạo Điêu Khắc Tương Phản Cao")
* **First-frame composition:**
  High-contrast sculptural studio. Left: Editorial typography. Center: A continuous parametric 3D ribbon whose exterior is rendered in rich slate/ceramic stone (`#E2E8F0` with dark rim occlusion), while the interior fold glows with deep radiant Aris Blue (`#2F6FED`).
* **Memorable 2-second motion gesture:**
  A 2.0s continuous camera glide revealing the interior blue fold as if stepping into a studio exhibition. Mouse tracking creates subtle gyroscopic parallax. Typing in the email field immediately engages **85% focus damping** to freeze distracting motion.
* **Aris Identity:**
  Celebrates the continuous loop of career growth, connecting candidate potential with employer opportunity.
* **Biggest Risk of Generic / Past Failure:**
  The v2 issue identified by Claude (#F8FAFC ribbon on #FAFBFC canvas causing a 1% contrast drop) must be completely avoided by anchoring the ribbon with darker ambient occlusion, distinct roughness, and dedicated rim lighting.

### Direction C: The Luminous Horizon ("Cửa Sổ Cơ Hội")
* **First-frame composition:**
  A minimalist spatial horizon. An architectural portal/aperture through which a radiant morning light shines onto the floor plane, casting a warm Aris blue gradient path toward the user.
* **Memorable 2-second motion gesture:**
  The aperture smoothly parts open on page load (1.8s ease-out), spilling light forward into the viewport. As the user moves their mouse, the angle of the light beam gently shifts, illuminating different focal highlights.
* **Aris Identity:**
  Symbolizes stepping forward through a doorway into new career opportunities.
* **Biggest Risk of Generic:**
  Without physical geometry to anchor it, light gradients can easily devolve into generic CSS blurred blobs commonly seen in standard AI templates.

---

## 3. Antigravity's Recommended Direction & Technical Stance

* **Recommendation:** We endorse **Direction A (Architectural Trajectory)** or **Direction B with High-Contrast Studio Finish**.
* **Technical Commitment:**
  * Three.js is chosen only if it serves volumetric depth, studio lighting, and smooth parallax. All assets will be 100% offline.
  * Form is completely functional on frame 0 with instant keyboard focusability.
  * Full support for `prefers-reduced-motion` (renders a composed static monument).
  * 100% isolated inside `docs/design-lab/aris-login-v3/`.
* **Immediate Next Step:**
  * Scaffold `docs/design-lab/aris-login-v3/` directory.
  * Await `docs/agent-bridge/approved-login-concept.md` from Codex before building the final animation system.
