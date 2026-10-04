# Claude — Phase A review file

Date: 2026-09-18. Reviewer role per `docs/agent-bridge/TEAM.md`. Concept per
`docs/agent-bridge/approved-login-concept.md` ("Nhịp vươn").

**Status: Phase A studies not yet received.** At the time of writing,
`docs/design-lab/aris-login-v3/` contains `index.html` (304 lines, form markup and styles, no 3D
scene yet), `README.md` and `vendor/three.min.js`. No `phase-a-report.md`, no
`evidence/phase-a/`, and nothing listening on 5181. Nothing has been reviewed yet; everything below
is published **before** the studies so the bar is not invented after the fact.

---

## 1. Defect found in the scaffold, before Phase A spending

`docs/design-lab/aris-login-v3/index.html:274`

```html
<input type="email" id="emailInput" class="form-input" placeholder="ban@example.com" required autofocus>
```

`autofocus` conflicts with the approved Phase B choreography. The brief says *"Typing eases the
scene into a quieter state"* and *"The sculpture is already legible at first paint... over
approximately 1.6–2.2 seconds a modest coordinated change... reveals a directed light progression
upward."* With `autofocus`, the field is focused **before the first frame**, so if focus damping is
wired as specified the entrance is suppressed the instant it starts, on every single load. The
entrance would only ever be seen by someone who clicks away first.

This is cheap to fix now and expensive to diagnose later, because it will present as "the entrance
animation doesn't play" rather than as a focus problem. Three options, Antigravity's call:

1. Drop `autofocus` and let the user click into the field.
2. Keep `autofocus` but gate damping on **typing** (`input` events) rather than on focus.
3. Keep `autofocus` and let the entrance run to completion before damping is armed.

I recommend 2: it matches the brief's wording more closely than focus does, and it keeps the
keyboard-first behaviour that `autofocus` gives.

---

## 2. Pre-registered Phase A rubric

Published now so it cannot be argued about afterwards. Phase A is a **geometry and composition**
milestone; I will not judge it on beauty of light, because the brief correctly forbids spending on
light yet.

### Gate 1 — the grey test (blocking)

At least one still per study, **flat grey material, no bloom, no colour, no glow, no motion, no
form, no type**.

- **G1a.** Is it obviously a deliberate object at rest, or a shape with an effect on it?
- **G1b.** With the Aris logo removed from the page entirely, does it still say "you advance"?

If a study needs glow to look intentional, it fails Gate 1 and no amount of Phase B work will save
it. This is the check Codex endorsed in `codex/review.md`.

### Gate 2 — named failure modes (blocking)

The brief names these; I will look for them specifically.

- **Equaliser:** fins of near-equal width at near-equal spacing. The tell is that you can predict
  fin *n+1* from fin *n*.
- **Slinky / coiled spring:** constant radius and constant pitch through the curved base.
- **Office staircase:** fins whose top faces are coplanar and horizontal.
- **Torus knot / stock primitive:** self-intersecting sweep with no directed start and end.

The pass condition is the one I put on record earlier and still stand behind: **orientation, width,
spacing and elevation must all be continuous functions of position along one curve, with no
repeated interval.**

### Gate 3 — volume is real, not implied

- Legible front/back occlusion: some fins must genuinely pass behind others.
- Visible thickness on at least one silhouette edge; fins must not read as zero-depth cards.
- The inner opening stays open at the study's camera angle and is not closed by fin width.

### Gate 4 — composition (non-blocking for Phase A, but recorded)

- Headline "Đi xa hơn. Theo cách của bạn." breaks intentionally, **not** into v2's accidental three
  heavy lines.
- Reserved bounds: the object's extreme projected position does not touch type or controls. Per
  Codex's correction, a grid with reserved bounds is acceptable; vertical separation is not the only
  legal answer. What I will check is the **extreme**, not the resting frame.
- The form reads as part of the scene rather than a thick outlined box sitting on top of it.
- 390 px crop shows the form early with an independently framed part of the sculpture.

### Gate 5 — honesty of evidence

- The build shown is identified, and screenshots are timestamped.
- The verified URL is stated, and it is actually 5181 (or whatever was really used), with 5025 and
  5180 untouched.
- Anything not checked is listed as not checked. A study frame is not an animation claim.

---

## 3. Concessions to Codex, and one point I maintain

**Conceded.** "Vertical separation is not the only collision-free layout." Correct. My v2 statement
was over-general — it was true of *my* implementation because I had no reserved bounds, not true of
layout in general. A grid with reserved artwork bounds and bounded transforms is equally safe, and
is the better answer here since the brief wants the object and type composed together rather than
stacked. I have written Gate 4 accordingly.

**Conceded.** "A light aperture is not inherently a gradient design." Fair; I argued from category
rather than from a rendered study, which is exactly what you told both of us not to do. My
objection to it was never really about gradients, it was about asserted versus intrinsic brand
meaning, and you already granted that point.

**Maintained.** Judging rendered studies over categorical labels cuts both ways: it is also why
Phase A must include the grey test. A rendered study with light will flatter any of the four
concepts. Grey is the only cheap discriminator we have, and it is the one thing that cannot be
argued with afterwards.

---

## 4. Open process question, flagged early rather than at acceptance

TEAM.md makes a real 12–20 s recording mandatory review evidence. I could not produce one (no
ffmpeg available to me; headless stills cost roughly 5 s each) and said so. Before Phase B
completes, the team should settle whether Antigravity can produce actual footage. If it cannot
either, we need to agree **now** whether a timestamped multi-frame capture is acceptable, rather
than discovering at acceptance that no motion evidence exists anywhere.

My position: for **Phase A selection**, no motion evidence is needed at all — the grey stills
decide it. For **Phase B acceptance**, a real recording should stay mandatory, because the user's
complaint from the start has been about animation quality, and that is the one thing a still cannot
show.

---

## 5. What I will do when the studies arrive

Inspect the actual images, run Gates 1–5, recommend one composition, name its single biggest
weakness, and state plainly which checks I could not perform. I will not edit v3 source.

— Claude
