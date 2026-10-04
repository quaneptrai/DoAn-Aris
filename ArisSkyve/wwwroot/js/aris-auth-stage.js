/**
 * Aris Career Platform — Nano Auth Stage (revision "lusion-grade")
 * Three.js interactive WebGL stage + accessible DOM form manager.
 *
 * Core idea of this revision: the sign-in / sign-up form is not a card that sits
 * on top of an animation. The form's own geometry — card edge, social buttons,
 * divider, input fields, primary action — is DRAWN BY NANO BODIES measured from
 * the real DOM rects on every layout. Switching Login <-> Register does not fade
 * one panel out and another in: the same bodies travel to the new element
 * outlines, and the DOM text only fades in after its outline has been drawn.
 *
 * 1. Real DOM -> world paths. Every control in the active panel contributes a
 *    rounded-rectangle (or line) path. Bodies are distributed along those paths
 *    by arc length, and keep flowing along them at rest.
 * 2. One stateful integrator. Every body has position + velocity. Pointer input
 *    applies a LOCAL bounded force with a curl component; release settles with
 *    inertia, never a snap. No whole-group rotation standing in for interaction.
 * 3. Material depth. PMREM environment probe built procedurally (nothing fetched
 *    at runtime), sRGB output, ACES tone mapping, additive glow companions, and
 *    three body materials interleaved by index so every outline mixes silver,
 *    cobalt and ice instead of banding.
 * 4. Authored entrance in five beats, slower than the previous revision:
 *    ignition -> DNA helix -> ARIS wordmark -> the wordmark disassembling into
 *    the form's own outlines -> living settled state. Full sequence once per
 *    session, short build on return. Skip and Replay always available.
 * 5. Accessibility preserved: real focus rings, reduced-motion path, WebGL
 *    fallback, and no pointer interception over the controls.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // ENGINE STATE
  // ---------------------------------------------------------------------------
  let scene, camera, renderer, envRT;
  let cardGroup;
  let cardPlateMesh, cardPlateShaderMat;
  let cardThicknessMesh, cardThicknessMat;
  let deepDust, deepDustFar;
  let keyLight, fillLight, cobaltLight;
  let atmosOverlay;

  // Three interleaved body meshes: body i -> mesh (i % 3), instance floor(i / 3).
  // Interleaving is deliberate: it guarantees every outline carries all three
  // materials, instead of the index-range banding of the previous revision.
  const MESHES = [];
  const GLOW = { mesh: null, mesh2: null, mat: null };
  const LINKS = { mesh: null, mat: null, geo: null, pos: null, col: null, max: 900 };

  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const isNarrow = window.matchMedia('(max-width: 768px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PER_MESH = isNarrow ? 1080 : 1900;
  const NUM_BODIES = PER_MESH * 3;
  const STRUCTURE_RATIO = 0.93;              // remainder becomes the depth field
  const NUM_STRUCTURE = Math.floor(NUM_BODIES * STRUCTURE_RATIO);
  const BODY_RADIUS = isNarrow ? 0.0074 : 0.0060;

  // Per-body simulation state
  const pX = new Float32Array(NUM_BODIES);
  const pY = new Float32Array(NUM_BODIES);
  const pZ = new Float32Array(NUM_BODIES);
  const vX = new Float32Array(NUM_BODIES);
  const vY = new Float32Array(NUM_BODIES);
  const vZ = new Float32Array(NUM_BODIES);
  const tX = new Float32Array(NUM_BODIES);
  const tY = new Float32Array(NUM_BODIES);
  const tZ = new Float32Array(NUM_BODIES);

  // Per-body assignment
  const bodyPath = new Int16Array(NUM_BODIES);      // index into nanoPaths, -1 = ambient
  const bodyU = new Float32Array(NUM_BODIES);       // base position along its path
  const bodyFlow = new Float32Array(NUM_BODIES);    // per-body flow speed multiplier
  const bodyPhase = new Float32Array(NUM_BODIES);   // noise phase
  const bodySize = new Float32Array(NUM_BODIES);    // scale multiplier
  const bodyDepth = new Float32Array(NUM_BODIES);   // ambient layer depth
  const bodyKind = new Uint8Array(NUM_BODIES);      // 0 edge, 1 surface, 2 glyph
  const bodyAnchor = new Uint8Array(NUM_BODIES);    // 1 = named star of an asterism
  const bodyOffset = new Float32Array(NUM_BODIES);  // push off the outline, world units
  const bodyFX = new Float32Array(NUM_BODIES);      // fill coord, -0.5..0.5 of width
  const bodyFY = new Float32Array(NUM_BODIES);      // fill coord, -0.5..0.5 of height

  // Mini-universe state, used by the DNA beat: every loop of the helix carries
  // its own little rotating disc instead of straight ladder rungs.
  const galIdx = new Int8Array(NUM_BODIES);         // -1 = not part of a disc
  const galR = new Float32Array(NUM_BODIES);
  const galA = new Float32Array(NUM_BODIES);
  const galZ = new Float32Array(NUM_BODIES);
  const galSpin = new Float32Array(NUM_BODIES);
  const galType = new Uint8Array(NUM_BODIES);       // 0 bulge, 1 disc, 2 halo, 3 satellite
  const GAL_COUNT = 3;
  let galDiscRadius = 0.6;
  const galCenterY = new Float32Array(GAL_COUNT);
  const galTilt = new Float32Array(GAL_COUNT);      // inclination: how edge-on
  const galPA = new Float32Array(GAL_COUNT);        // position angle on screen
  let helixFreezeRot = 0;

  // Choreography targets
  const dnaX = new Float32Array(NUM_BODIES);
  const dnaY = new Float32Array(NUM_BODIES);
  const dnaZ = new Float32Array(NUM_BODIES);
  const wordX = new Float32Array(NUM_BODIES);
  const wordY = new Float32Array(NUM_BODIES);
  const wordZ = new Float32Array(NUM_BODIES);

  // Morph bookkeeping
  const morphFromX = new Float32Array(NUM_BODIES);
  const morphFromY = new Float32Array(NUM_BODIES);
  const morphFromZ = new Float32Array(NUM_BODIES);
  const morphDelay = new Float32Array(NUM_BODIES);

  // Card plate dimensions in world units
  let cardDimW = 3.2;
  let cardDimH = 4.2;
  let cardDimR = 0.22;
  let cardCX = 0;
  let cardCY = 0;
  let cameraBaseZ = 7.2;

  // ---------------------------------------------------------------------------
  // CHOREOGRAPHY CLOCK
  // Cinematic opening sequence:
  // Inward vortex accretion rings -> Supernova detonation flash -> 3D DNA -> ARIS -> Form outlines
  // ---------------------------------------------------------------------------
  const T_VORTEX = 1.55;       // Concentric accretion rings coiling inward with accelerating spin
  const T_SUPERNOVA = 2.10;    // Blinding supernova explosion & radial shockwave detonation
  const T_DNA = 4.80;          // Cosmic debris captured & crystallized into rotating 3D DNA double helix
  const T_WORD = 7.40;         // DNA helix unwinds into ARIS wordmark
  const T_BUILD = 10.40;       // ARIS builds into the form's living outlines
  const SHORT_INTRO_AT = T_WORD - 0.35;  // returning visitors join near the build
  const MORPH_DURATION = 1.15;           // staged, elegant panel morph

  let animClock = 0;
  let isReplayMode = false;
  let introActive = false;
  let isPaused = false;
  let isTyping = false;
  let typingDamp = 1.0;
  let currentAuthMode = 'login';
  let isMorphing = false;
  let morphClock = 0;
  let switchGeneration = 0;
  let qaProgressOverride = null;
  let buildProgress = 1.0;        // 0..1 spatial construction of the plate
  let focusedPathId = -1;
  let submitPulse = 0;

  // Pointer
  const targetPointer = new THREE.Vector2(0, 0);   // normalised device coords
  const currentPointer = new THREE.Vector2(0, 0);
  const pointerWorld = new THREE.Vector3(0, 0, 0);
  const pointerWorldPrev = new THREE.Vector3(0, 0, 0);
  let pointerSpeed = 0;
  let pointerInside = false;
  let pointerHeld = false;

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  // ---------------------------------------------------------------------------
  // GEOMETRY HELPERS
  // ---------------------------------------------------------------------------
  /**
   * Screen pixels -> world units on the z = 0 plane.
   *
   * This deliberately does NOT use the live camera. The camera dollies and
   * parallaxes during the entrance, and measuring against it produced outlines
   * scaled by exactly (cameraZ / cameraBaseZ) — the geometry no longer sat on
   * the controls it was drawn from. The mapping below is the analytic one for
   * the reference pose (0, 0, cameraBaseZ) looking at the origin, so a rect
   * measured at any moment lands in the same place at rest.
   */
  function screenToPlane(screenX, screenY, out) {
    const fov = camera ? camera.fov : 40;
    const h = 2.0 * cameraBaseZ * Math.tan((fov * 0.5 * Math.PI) / 180);
    const w = h * (camera ? camera.aspect : (window.innerWidth / window.innerHeight));
    out.x = (screenX / window.innerWidth - 0.5) * w;
    out.y = -(screenY / window.innerHeight - 0.5) * h;
    return out;
  }

  const _proj = { x: 0, y: 0 };

  function worldPerPixel() {
    const fov = camera ? camera.fov : 40;
    const h = 2.0 * cameraBaseZ * Math.tan((fov * 0.5 * Math.PI) / 180);
    return h / window.innerHeight;
  }

  function createRoundedRectShape(w, h, r) {
    const shape = new THREE.Shape();
    const hw = w * 0.5;
    const hh = h * 0.5;
    r = Math.min(r, hw * 0.45, hh * 0.45);
    shape.moveTo(-hw + r, -hh);
    shape.lineTo(hw - r, -hh);
    shape.absarc(hw - r, -hh + r, r, -Math.PI * 0.5, 0, false);
    shape.lineTo(hw, hh - r);
    shape.absarc(hw - r, hh - r, r, 0, Math.PI * 0.5, false);
    shape.lineTo(-hw + r, hh);
    shape.absarc(-hw + r, hh - r, r, Math.PI * 0.5, Math.PI, false);
    shape.lineTo(-hw, -hh + r);
    shape.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
    shape.closePath();
    return shape;
  }

  function normalizePlateUVs(geo) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const sx = Math.max(1e-6, bb.max.x - bb.min.x);
    const sy = Math.max(1e-6, bb.max.y - bb.min.y);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) - bb.min.x) / sx, (pos.getY(i) - bb.min.y) / sy);
    }
    uv.needsUpdate = true;
    return geo;
  }

  /**
   * Rounded rectangle outline sampled at even arc length, centred on the origin.
   * Returns a flat [x0,y0, x1,y1, ...] array plus the total perimeter.
   */
  function sampleRoundedRect(w, h, r, count) {
    r = Math.max(0.0, Math.min(r, w * 0.5 - 1e-4, h * 0.5 - 1e-4));
    const sw = Math.max(0.0, w - 2 * r);
    const sh = Math.max(0.0, h - 2 * r);
    const arc = 0.5 * Math.PI * r;
    const total = 2 * sw + 2 * sh + 4 * arc;
    const out = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      let s = (i / count) * total;
      let x = 0, y = 0;

      if (s < sw) {                                   // top edge, left -> right
        x = -sw * 0.5 + s; y = h * 0.5;
      } else if ((s -= sw) < arc) {                   // top-right corner
        const a = (s / arc) * Math.PI * 0.5;
        x = sw * 0.5 + Math.sin(a) * r; y = sh * 0.5 + Math.cos(a) * r;
      } else if ((s -= arc) < sh) {                   // right edge, top -> bottom
        x = w * 0.5; y = sh * 0.5 - s;
      } else if ((s -= sh) < arc) {                   // bottom-right corner
        const a = (s / arc) * Math.PI * 0.5;
        x = sw * 0.5 + Math.cos(a) * r; y = -sh * 0.5 - Math.sin(a) * r;
      } else if ((s -= arc) < sw) {                   // bottom edge, right -> left
        x = sw * 0.5 - s; y = -h * 0.5;
      } else if ((s -= sw) < arc) {                   // bottom-left corner
        const a = (s / arc) * Math.PI * 0.5;
        x = -sw * 0.5 - Math.sin(a) * r; y = -sh * 0.5 - Math.cos(a) * r;
      } else if ((s -= arc) < sh) {                   // left edge, bottom -> top
        x = -w * 0.5; y = -sh * 0.5 + s;
      } else {                                        // top-left corner
        const a = ((s - sh) / arc) * Math.PI * 0.5;
        x = -sw * 0.5 - Math.cos(a) * r; y = sh * 0.5 + Math.sin(a) * r;
      }

      out[i * 2] = x;
      out[i * 2 + 1] = y;
    }
    return { pts: out, length: total };
  }

  function sampleLine(len, count) {
    const out = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      out[i * 2] = -len * 0.5 + (i / count) * len;
      out[i * 2 + 1] = 0;
    }
    return { pts: out, length: len };
  }

  function sampleAsteroidBelt(w, h, count) {
    const rx = w * 0.65;
    const ry = h * 0.60;
    const total = Math.PI * (rx + ry);
    const out = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2.0;
      const ripple = 1.0 + Math.sin(theta * 3.0) * 0.08 + Math.cos(theta * 5.0) * 0.04;
      out[i * 2] = Math.cos(theta) * rx * ripple;
      out[i * 2 + 1] = Math.sin(theta) * ry * ripple;
    }
    return { pts: out, length: total };
  }

  function sampleButtonMoons(w, h, r, count) {
    // Generates an organic constellation orbit for child planets (hành tinh con)
    // around each button, with soft curved corners and gentle orbital breathing.
    r = Math.max(0.0, Math.min(r, w * 0.5 - 1e-4, h * 0.5 - 1e-4));
    const sw = Math.max(0.0, w - 2 * r);
    const sh = Math.max(0.0, h - 2 * r);
    const arc = 0.5 * Math.PI * r;
    const total = 2 * sw + 2 * sh + 4 * arc;
    const out = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      const u = i / count;
      let s = u * total;
      let x = 0, y = 0;

      if (s < sw) {
        x = -sw * 0.5 + s; y = h * 0.5;
      } else if ((s -= sw) < arc) {
        const a = (s / arc) * Math.PI * 0.5;
        x = sw * 0.5 + Math.sin(a) * r; y = sh * 0.5 + Math.cos(a) * r;
      } else if ((s -= arc) < sh) {
        x = w * 0.5; y = sh * 0.5 - s;
      } else if ((s -= sh) < arc) {
        const a = (s / arc) * Math.PI * 0.5;
        x = sw * 0.5 + Math.cos(a) * r; y = -sh * 0.5 - Math.sin(a) * r;
      } else if ((s -= arc) < sw) {
        x = sw * 0.5 - s; y = -h * 0.5;
      } else if ((s -= sw) < arc) {
        const a = (s / arc) * Math.PI * 0.5;
        x = -sw * 0.5 - Math.sin(a) * r; y = -sh * 0.5 - Math.cos(a) * r;
      } else if ((s -= arc) < sh) {
        x = -w * 0.5; y = -sh * 0.5 + s;
      } else {
        const a = ((s - sh) / arc) * Math.PI * 0.5;
        x = -sw * 0.5 - Math.cos(a) * r; y = sh * 0.5 + Math.sin(a) * r;
      }

      const theta = u * Math.PI * 2.0;
      const orbitalDrift = 1.0 + Math.sin(theta * 4.0) * 0.035;
      out[i * 2] = x * orbitalDrift;
      out[i * 2 + 1] = y * orbitalDrift;
    }
    return { pts: out, length: total };
  }

  // ---------------------------------------------------------------------------
  // NANO PATHS — measured from the live DOM
  // ---------------------------------------------------------------------------
  //
  // nanoPaths[k] = { key, el, cx, cy, z, pts, count, length, slots, flow, energy }
  //
  let nanoPaths = [];

  //
  // Buttons are made from child planets (hành tinh con): discrete orbiting celestial
  // spheres framing each interactive control without harsh CSS borders.
  //
  const PATH_SPEC = [
    { sel: '.auth-glass-card', key: 'frame', weight: 4.5, self: true },
    { sel: '.btn-social-item', key: 'btn-social', isButton: true, moonCount: 40 },
    { sel: '.auth-input-field', key: 'field-input', isButton: true, moonCount: 54 },
    { sel: '.btn-auth-primary', key: 'btn-primary', isButton: true, moonCount: 62 },
    { sel: '.btn-demo-link', key: 'btn-demo', isButton: true, moonCount: 18 }
  ];

  //
  // Text is turned into bodies by rasterising each single-line text element with
  // its own computed font, then sampling the coverage. The DOM text stays in
  // place and stays in the accessibility tree — it is only painted transparent —
  // so screen readers, selection and translation keep working while what the eye
  // sees is written in small lit bodies.
  //
  const TEXT_SEL = 'h1, h2, p, label, span, a, button';
  const textCanvas = document.createElement('canvas');
  const textCtx = textCanvas.getContext('2d', { willReadFrequently: true });

  function isLeafText(el) {
    if (!el.firstChild) return false;
    let hasText = false;
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.nodeValue.trim().length) hasText = true;
      if (n.nodeType === 1 && n.textContent.trim().length) return false;  // not a leaf
    }
    return hasText;
  }

  /**
   * Sample one single-line text element into normalised coverage points.
   * Multi-line elements are left to the DOM: reproducing wrapping here would be
   * guesswork, and illegible copy is a worse outcome than visible copy.
   */
  function sampleTextElement(el, rect) {
    let cs;
    try { cs = window.getComputedStyle(el); } catch (e) { return null; }
    const fontSize = parseFloat(cs.fontSize) || 14;
    if (rect.height > fontSize * 1.85) return null;         // wrapped, skip
    if (rect.width < 4 || rect.height < 4) return null;

    const SS = 2;                                            // supersample
    const w = Math.min(1400, Math.ceil(rect.width * SS));
    const h = Math.min(220, Math.ceil(rect.height * SS));
    textCanvas.width = w;
    textCanvas.height = h;
    textCtx.clearRect(0, 0, w, h);
    textCtx.fillStyle = '#fff';
    textCtx.textBaseline = 'middle';
    const align = cs.textAlign;
    textCtx.textAlign = (align === 'center') ? 'center' : (align === 'right' || align === 'end') ? 'right' : 'left';
    textCtx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + (fontSize * SS) + 'px ' + cs.fontFamily;
    if ('letterSpacing' in textCtx && cs.letterSpacing && cs.letterSpacing !== 'normal') {
      textCtx.letterSpacing = (parseFloat(cs.letterSpacing) * SS) + 'px';
    }
    const tx = textCtx.textAlign === 'center' ? w * 0.5 : textCtx.textAlign === 'right' ? w : 0;
    textCtx.fillText(el.textContent.trim(), tx, h * 0.5);

    let data;
    try { data = textCtx.getImageData(0, 0, w, h).data; } catch (e) { return null; }

    // Step scales with the type size: small copy needs a tighter grid or its
    // strokes fall apart into unreadable dots.
    const step = Math.max(2, Math.round(fontSize * SS / 11));
    const pts = [];
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] > 96) {
          pts.push((x / w) - 0.5, (y / h) - 0.5);
        }
      }
    }
    if (pts.length < 12) return null;
    return new Float32Array(pts);
  }

  function activePanel() {
    const card = document.getElementById('glassAuthCard');
    if (!card) return null;
    const panels = card.querySelectorAll('.auth-mode-panel, .check-email-section');
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i];
      if (p.offsetParent !== null || p.classList.contains('active')) return p;
    }
    return card;
  }

  function elementWorldBox(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    const wpp = worldPerPixel();
    screenToPlane(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5, _proj);
    let radiusPx = 10;
    try {
      radiusPx = parseFloat(window.getComputedStyle(el).borderTopLeftRadius) || 0;
    } catch (e) { /* computed style unavailable */ }
    return {
      cx: _proj.x,
      cy: _proj.y,
      w: rect.width * wpp,
      h: rect.height * wpp,
      r: radiusPx * wpp
    };
  }

  /**
   * Layout signature of everything we draw. Compared every throttle tick so a
   * font swap, a mode change, a scroll or a window chrome change re-registers
   * the geometry instead of leaving the outlines behind.
   */
  function layoutSignature() {
    const card = document.getElementById('glassAuthCard');
    if (!card) return '';
    const panel = activePanel() || card;
    let sig = '';
    const r0 = card.getBoundingClientRect();
    sig += (r0.left | 0) + ',' + (r0.top | 0) + ',' + (r0.width | 0) + ',' + (r0.height | 0) + '|';
    for (let s = 1; s < PATH_SPEC.length; s++) {
      const els = panel.querySelectorAll(PATH_SPEC[s].sel);
      for (let e = 0; e < els.length; e++) {
        const r = els[e].getBoundingClientRect();
        sig += (r.left | 0) + ',' + (r.top | 0) + ',' + (r.width | 0) + ',' + (r.height | 0) + ';';
      }
    }
    return sig;
  }

  /** Rebuild every path from the current DOM layout. Cheap enough for resize. */
  function rebuildNanoPaths() {
    if (!camera) return;
    const card = document.getElementById('glassAuthCard');
    if (!card) return;
    const panel = activePanel() || card;

    const collected = [];

    for (let s = 0; s < PATH_SPEC.length; s++) {
      const spec = PATH_SPEC[s];
      const els = spec.self ? [card] : panel.querySelectorAll(spec.sel);
      for (let e = 0; e < els.length; e++) {
        const box = elementWorldBox(els[e]);
        if (!box) continue;

        if (spec.key === 'frame') {
          cardDimW = box.w;
          cardDimH = box.h;
          cardDimR = box.r;
          cardCX = box.cx;
          cardCY = box.cy;
        }

        if (spec.split) {
          // The divider carries a centred label. Draw two hairline runs that
          // stop short of the text instead of one line straight through it.
          const label = els[e].querySelector('span');
          const lb = label ? elementWorldBox(label) : null;
          const gap = lb ? (lb.w * 0.5 + box.h * 0.30) : box.w * 0.18;
          const runW = Math.max(0.04, box.w * 0.5 - gap);
          for (let side = -1; side <= 1; side += 2) {
            collected.push({
              key: spec.key + ':' + e + ':' + (side < 0 ? 'l' : 'r'),
              el: els[e],
              box: { cx: box.cx + side * (gap + runW * 0.5), cy: box.cy, w: runW, h: 0, r: 0 },
              line: true, fill: false, dense: 1.0,
              weight: spec.weight, z: 0.030
            });
          }
          continue;
        }

        collected.push({
          key: spec.key + ':' + e,
          el: els[e],
          box: box,
          line: !!spec.line,
          fill: !!spec.fill,
          dense: spec.dense || 1.0,
          weight: spec.weight || 0.2,
          isButton: !!spec.isButton,
          moonCount: spec.moonCount || 16,
          z: spec.key === 'frame' ? 0.014 : 0.028
        });
      }
    }

    // Clean up any residual .nano-glyph classes so DOM typography remains 100% native, crisp, and readable
    const glyphs = panel.querySelectorAll('.nano-glyph');
    for (let g = 0; g < glyphs.length; g++) {
      glyphs[g].classList.remove('nano-glyph');
    }

    if (!collected.length) { nanoPaths = []; return; }

    // Allocate bodies: Buttons receive their discrete constellation of child planets (moonCount),
    // and the outer 3D Asteroid Belt receives all remaining particles (>97% of budget).
    let buttonMoonsTotal = 0;
    for (let i = 0; i < collected.length; i++) {
      if (collected[i].isButton) {
        collected[i].slots = collected[i].moonCount;
        buttonMoonsTotal += collected[i].slots;
      }
    }
    const frameBudget = Math.max(1000, NUM_STRUCTURE - buttonMoonsTotal);
    for (let i = 0; i < collected.length; i++) {
      if (!collected[i].isButton) {
        collected[i].slots = frameBudget;
      }
    }

    const built = [];
    for (let i = 0; i < collected.length; i++) {
      const c = collected[i];
      const isButton = !!c.isButton;
      const n = c.slots;
      const sampleCount = isButton ? n : Math.max(96, Math.min(512, n * 2));
      const geo = c.text
        ? { pts: c.samples, length: 0 }
        : c.line
          ? sampleLine(c.box.w, sampleCount)
          : (c.key && c.key.indexOf('frame') === 0)
            ? sampleAsteroidBelt(c.box.w, c.box.h, sampleCount)
            : isButton
              ? sampleButtonMoons(c.box.w, c.box.h, c.box.r, sampleCount)
              : sampleRoundedRect(c.box.w, c.box.h, c.box.r, sampleCount);

      built.push({
        key: c.key,
        el: c.el,
        cx: c.box.cx,
        cy: c.box.cy,
        w: c.box.w,
        h: c.box.h,
        z: c.z,
        pts: geo.pts,
        count: isButton ? n : (c.text ? (c.samples.length / 2) : sampleCount),
        length: geo.length,
        slots: n,
        fill: false,
        text: false,
        isButton: isButton,
        edgeShare: 1.0,
        flow: (i % 2 === 0) ? 1.0 : -1.0,
        energy: 0.0
      });
    }

    nanoPaths = built;
    assignBodiesToPaths();
    updatePlateGeometry();
  }

  /**
   * Bodies are handed out in canonical path order, so index ranges stay stable
   * across relayouts and the Login <-> Register morph stays coherent.
   */
  function assignBodiesToPaths() {
    let body = 0;
    for (let p = 0; p < nanoPaths.length && body < NUM_STRUCTURE; p++) {
      const path = nanoPaths[p];
      const n = Math.min(path.slots, NUM_STRUCTURE - body);

      if (path.isButton) {
        // One asterism per control, and a different one for each: the seed is
        // derived from the path so Google, Facebook, the field and the action
        // never resolve into the same figure.
        const seed = 1013 + p * 7919;
        const anchorEvery = 4 + Math.floor(hash01(seed) * 3);   // 4..6
        for (let k = 0; k < n && body < NUM_STRUCTURE; k++, body++) {
          const hu = hash01(seed + k * 31);
          const ho = hash01(seed + k * 57 + 3);
          bodyPath[body] = p;
          bodyKind[body] = 0;
          // Irregular spacing: an even ring reads as a dotted border.
          bodyU[body] = (k + 0.5) / n + (hu - 0.5) * (0.92 / n);
          bodyAnchor[body] = ((k + Math.floor(hash01(seed + 11) * 3)) % anchorEvery === 0) ? 1 : 0;
          // A few stars stand off the outline so the figure has its own shape.
          bodyOffset[body] = (ho - 0.5) * (bodyAnchor[body] ? 0.036 : 0.016);
          bodyFlow[body] = 0.85 + ((body * 37) % 100) / 250;
        }
        continue;
      }

      if (path.text) {
        // Walk the coverage points with a stride so that a shortfall thins the
        // whole word evenly instead of dropping its last letters.
        const total = path.count;
        const stride = total / n;
        for (let k = 0; k < n && body < NUM_STRUCTURE; k++, body++) {
          const si = Math.min(total - 1, Math.floor(k * stride));
          bodyPath[body] = p;
          bodyKind[body] = 2;
          bodyFX[body] = path.pts[si * 2];
          bodyFY[body] = -path.pts[si * 2 + 1];
          bodyFlow[body] = 0.25 + ((body * 37) % 100) / 400;
        }
        continue;
      }

      const edgeN = Math.max(12, Math.round(n * path.edgeShare));
      const fillN = Math.max(0, n - edgeN);

      for (let k = 0; k < edgeN && body < NUM_STRUCTURE; k++, body++) {
        bodyPath[body] = p;
        bodyKind[body] = 0;
        bodyU[body] = (k + 0.5) / edgeN;
        bodyFlow[body] = 0.55 + ((body * 37) % 100) / 220;
      }

      if (fillN > 0) {
        // Stratified lattice with a deterministic jitter: a plain grid reads as
        // a printed dot screen, pure random leaves holes and clumps.
        const ratio = Math.max(0.15, path.w / Math.max(1e-4, path.h));
        const cols = Math.max(2, Math.round(Math.sqrt(fillN * ratio)));
        const rows = Math.max(1, Math.ceil(fillN / cols));
        for (let k = 0; k < fillN && body < NUM_STRUCTURE; k++, body++) {
          const cx = k % cols;
          const cy = Math.floor(k / cols) % rows;
          const jx = (((body * 71) % 100) / 100 - 0.5) * 0.85;
          const jy = (((body * 149) % 100) / 100 - 0.5) * 0.85;
          bodyPath[body] = p;
          bodyKind[body] = 1;
          bodyFX[body] = ((cx + 0.5 + jx) / cols - 0.5) * 0.965;
          bodyFY[body] = ((cy + 0.5 + jy) / rows - 0.5) * 0.92;
          bodyFlow[body] = 0.35 + ((body * 37) % 100) / 300;
        }
      }
    }
    for (; body < NUM_BODIES; body++) { bodyPath[body] = -1; bodyKind[body] = 0; }
  }

  function samplePath(path, u, out) {
    u = u - Math.floor(u);
    const f = u * path.count;
    const i0 = Math.floor(f) % path.count;
    const i1 = (i0 + 1) % path.count;
    const t = f - Math.floor(f);
    out.x = path.cx + path.pts[i0 * 2] * (1 - t) + path.pts[i1 * 2] * t;
    out.y = path.cy + path.pts[i0 * 2 + 1] * (1 - t) + path.pts[i1 * 2 + 1] * t;
  }

  // ---------------------------------------------------------------------------
  // CHOREOGRAPHY TARGETS (DNA + ARIS wordmark)
  // ---------------------------------------------------------------------------
  function computeDnaTargets() {
    const fovRad = camera ? (camera.fov * 0.5 * Math.PI) / 180 : (20 * Math.PI / 180);
    const zCam = camera ? cameraBaseZ : 7.2;
    const visibleH = 2.0 * zCam * Math.tan(fovRad);
    const aspect = camera ? camera.aspect : (16 / 9);
    const visibleW = visibleH * aspect;

    const R = Math.min(0.78, visibleW * 0.17);
    const totalH = visibleH * 0.74;
    const turns = 2.6;

    const strand = Math.floor(NUM_BODIES * 0.22);

    for (let i = 0; i < strand; i++) {
      const u = i / strand;
      const t = (u - 0.5) * (turns * 2.0 * Math.PI);
      dnaX[i] = R * Math.cos(t);
      dnaY[i] = (u - 0.5) * totalH;
      dnaZ[i] = R * Math.sin(t);

      const j = strand + i;
      dnaX[j] = R * Math.cos(t + Math.PI);
      dnaY[j] = (u - 0.5) * totalH;
      dnaZ[j] = R * Math.sin(t + Math.PI);
    }

    // Everything that is not a strand becomes a miniature universe suspended
    // inside one loop of the helix, composed after the reference the user gave
    // (Andromeda): a steeply inclined disc that reads as a long oval, a bright
    // ellipsoidal bulge, several thin wound arms separated by darker lanes, a
    // scattering of bright halo stars, and a couple of small companions. Straight
    // ladder rungs read as a diagram; this reads as something alive that the
    // lettermark is later drawn out of.
    galDiscRadius = Math.min(R * 0.98, (totalH / GAL_COUNT) * 0.46);
    for (let g = 0; g < GAL_COUNT; g++) {
      galCenterY[g] = (((g + 0.5) / GAL_COUNT) - 0.5) * totalH * 0.98;
      // Inclination near 0.30 rad squashes the disc to roughly a 1:3 oval.
      galTilt[g] = 0.26 + ((g * 37) % 100) / 100 * 0.12;
      galPA[g] = -0.38 + ((g * 61) % 100) / 100 * 0.30;
    }

    for (let i = 0; i < NUM_BODIES; i++) galIdx[i] = -1;

    let idx = strand * 2;
    let k = 0;
    for (; idx < NUM_BODIES; idx++, k++) {
      const g = k % GAL_COUNT;                       // interleaved: every disc
      const u = ((idx * 263) % 1000) / 1000;         // gets all three materials
      const v = ((idx * 811) % 1000) / 1000;
      const w = ((idx * 397) % 1000) / 1000;

      let type, rNorm, ang, thick;

      if (u < 0.17) {
        // Bulge: a dense ellipsoid, not a flat ring. This is the part that
        // reads as the bright oval core of the reference.
        type = 0;
        rNorm = 0.02 + Math.pow(v, 0.75) * 0.20;
        ang = w * Math.PI * 2.0;
        thick = (w - 0.5) * 1.35;
      } else if (u < 0.86) {
        // Disc: four arms on a log-ish spiral, with a radial ridge so the arms
        // separate into bright lanes with darker gaps between them.
        type = 1;
        const armIdx = Math.floor(v * 4.0);
        rNorm = 0.24 + Math.pow((v * 4.0) % 1.0, 0.55) * 0.80;
        const ridge = Math.sin(rNorm * 14.0) * 0.022;
        rNorm += ridge;
        ang = armIdx * (Math.PI * 0.5) + rNorm * 4.9 + (w - 0.5) * 0.42;
        thick = (w - 0.5) * 0.30 * (1.0 - rNorm * 0.6);
      } else if (u < 0.955) {
        // Halo: bright isolated stars scattered well outside the disc. These
        // are the sparkles in the reference, and they twinkle in writeInstances.
        type = 2;
        rNorm = 1.05 + v * 0.75;
        ang = w * Math.PI * 2.0;
        thick = (v - 0.5) * 2.2;
      } else {
        // Two small companions, offset from the disc like M32 and M110.
        type = 3;
        const sat = idx % 2;
        rNorm = sat ? 1.30 : 0.95;
        ang = (sat ? 2.05 : -0.75) + (v - 0.5) * 0.22;
        thick = (sat ? 0.9 : -0.7) + (w - 0.5) * 0.30;
      }

      galIdx[idx] = g;
      galType[idx] = type;
      galR[idx] = rNorm * galDiscRadius;
      galA[idx] = ang;
      galZ[idx] = thick * galDiscRadius * 0.16;
      // Differential rotation; the halo barely turns, companions drift slowly.
      galSpin[idx] = type === 2 ? 0.10 : type === 3 ? 0.16 : (1.30 - rNorm * 0.82);

      // Static fallback pose, also used as the hand-off into the wordmark beat.
      galaxyLocal(idx, 0, _g);
      dnaX[idx] = _g.x; dnaY[idx] = _g.y; dnaZ[idx] = _g.z;
    }
  }

  /**
   * Position of one mini-universe body. The disc is built flat, inclined so it
   * projects as a long oval, then rotated by its position angle so it lies
   * across the loop at an angle instead of sitting square to the viewport.
   */
  function galaxyLocal(i, time, out) {
    const g = galIdx[i];
    const a = galA[i] + time * 0.30 * galSpin[i];
    const r = galR[i];
    const st = Math.sin(galTilt[g]), ct = Math.cos(galTilt[g]);

    // Flat disc coordinates.
    let dx = Math.cos(a) * r;
    let dy = Math.sin(a) * r;
    const dz = galZ[i];

    // Inclination: squash the in-plane Y and push it into depth.
    let y = dy * st + dz * ct;
    const z = dy * ct - dz * st;

    // Position angle on screen.
    const cp = Math.cos(galPA[g]), sp = Math.sin(galPA[g]);
    out.x = dx * cp - y * sp;
    out.y = galCenterY[g] + dx * sp + y * cp;
    out.z = z;
  }

  function computeArisGlyphTargets() {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 360;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1200, 360);
    ctx.fillStyle = '#FFF';
    ctx.font = "800 210px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '34px';
    ctx.fillText('ARIS', 600, 180);

    const data = ctx.getImageData(0, 0, 1200, 360).data;
    const px = [];
    let minX = 1200, maxX = 0, minY = 360, maxY = 0;
    for (let y = 0; y < 360; y += 2) {
      for (let x = 0; x < 1200; x += 2) {
        if (data[(y * 1200 + x) * 4] > 120) {
          px.push(x, y);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const n = px.length / 2;
    if (!n) return;

    const gw = Math.max(1, maxX - minX);
    const gh = Math.max(1, maxY - minY);
    const gcx = (minX + maxX) * 0.5;
    const gcy = (minY + maxY) * 0.5;
    const wordW = isNarrow ? 3.2 : 4.6;
    const wordH = wordW * (gh / gw);

    // Stride-shuffled sampling: breaks any correlation between body index (which
    // selects the material) and glyph Y, i.e. no light/dark banding across the
    // lettermark — the defect called out in the previous review.
    const stride = 7919;
    for (let i = 0; i < NUM_BODIES; i++) {
      const k = (i * stride) % n;
      const x = px[k * 2], y = px[k * 2 + 1];
      wordX[i] = ((x - gcx) / gw) * wordW;
      wordY[i] = -((y - gcy) / gh) * wordH;
      wordZ[i] = Math.sin(i * 0.37) * 0.06;
    }
  }

  // ---------------------------------------------------------------------------
  // PLATE (card body) — smoked material with a spatial construction sweep
  // ---------------------------------------------------------------------------
  const PlateVertexShader = [
    'varying vec2 vUv;',
    'varying vec3 vNormal;',
    'void main() {',
    '  vUv = uv;',
    '  vNormal = normalize(normalMatrix * normal);',
    '  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  const PlateFragmentShader = [
    'varying vec2 vUv;',
    'varying vec3 vNormal;',
    'uniform float uProgress;',
    'uniform vec2  uPointer;',
    'uniform float uTime;',
    'uniform vec3  uColorBase;',
    'uniform vec3  uColorCobalt;',
    'uniform vec3  uColorCyan;',
    'uniform vec3  uColorSatin;',
    'float field(vec2 uv) {',
    '  float diagonal = 0.52 * (1.0 - uv.y) + 0.48 * uv.x;',
    '  return diagonal + sin(uv.x * 6.283 + uv.y * 3.141) * 0.045',
    '                  + cos(uv.x * 12.566 - uv.y * 6.283) * 0.025;',
    '}',
    'void main() {',
    '  float edgeDist = field(vUv) - (uProgress * 1.25 - 0.10);',
    '  if (edgeDist > 0.0) discard;',
    '  float fusion = smoothstep(-0.075, 0.0, edgeDist);',
    '  vec3 base = mix(uColorBase * 1.22, uColorBase * 0.62, 1.0 - vUv.y);',
    '  vec3 viewDir  = vec3(0.0, 0.0, 1.0);',
    '  vec3 lightDir = normalize(vec3(-0.45 + uPointer.x * 0.22, 0.60 + uPointer.y * 0.18, 1.1));',
    '  float broadSpec = pow(max(0.0, dot(vNormal, normalize(lightDir + viewDir))), 10.0) * 0.20;',
    '  float fresnel   = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 3.5);',
    '  float edgeX = min(vUv.x, 1.0 - vUv.x);',
    '  float edgeY = min(vUv.y, 1.0 - vUv.y);',
    '  float edgeProx = 1.0 - smoothstep(0.0, 0.07, min(edgeX, edgeY));',
    '  float sweep = smoothstep(0.42, 0.0, abs(fract(uTime * 0.045) * 1.6 - 0.3 - vUv.x * 0.7 - vUv.y * 0.3));',
    '  vec3 col = base',
    '           + uColorSatin * broadSpec',
    '           + uColorCobalt * (fresnel * 0.38 + edgeProx * 0.20)',
    '           + uColorCyan * sweep * 0.045;',
    '  col = mix(col, mix(uColorCobalt, uColorCyan, 0.75) * 1.9, fusion * 0.80);',
    '  gl_FragColor = vec4(col, mix(0.80, 0.42, fusion * 0.5));',
    '}'
  ].join('\n');

  function updatePlateGeometry() {
    if (!cardPlateMesh) return;
    const shape = createRoundedRectShape(cardDimW, cardDimH, cardDimR);

    if (cardPlateMesh.geometry) cardPlateMesh.geometry.dispose();
    cardPlateMesh.geometry = normalizePlateUVs(new THREE.ShapeGeometry(shape));
    cardPlateMesh.position.set(cardCX, cardCY, 0.0);

    if (cardThicknessMesh) {
      if (cardThicknessMesh.geometry) cardThicknessMesh.geometry.dispose();
      cardThicknessMesh.geometry = normalizePlateUVs(new THREE.ShapeGeometry(shape));
      cardThicknessMesh.position.set(cardCX, cardCY, -0.030);
    }
  }

  // ---------------------------------------------------------------------------
  // ENVIRONMENT PROBE — built procedurally, nothing fetched at runtime
  // ---------------------------------------------------------------------------
  function buildEnvironment() {
    if (!renderer || !THREE.PMREMGenerator) return;
    try {
      const envScene = new THREE.Scene();

      // Enclosing shell: cold zenith falling to near-black floor. This is what
      // gives metal bodies something to reflect instead of reading as plastic.
      const shellGeo = new THREE.SphereGeometry(12, 32, 24);
      const shellCols = new Float32Array(shellGeo.attributes.position.count * 3);
      const top = new THREE.Color(0x2B3C63);
      const bottom = new THREE.Color(0x05080F);
      for (let i = 0; i < shellGeo.attributes.position.count; i++) {
        const y = shellGeo.attributes.position.getY(i) / 12;
        tmpColor.copy(top).lerp(bottom, 1.0 - (y * 0.5 + 0.5));
        shellCols[i * 3] = tmpColor.r;
        shellCols[i * 3 + 1] = tmpColor.g;
        shellCols[i * 3 + 2] = tmpColor.b;
      }
      shellGeo.setAttribute('color', new THREE.BufferAttribute(shellCols, 3));
      envScene.add(new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({
        vertexColors: true, side: THREE.BackSide
      })));

      // Broad key panel (upper left): one wide readable highlight per body.
      const key = new THREE.Mesh(new THREE.PlaneGeometry(9, 5),
        new THREE.MeshBasicMaterial({ color: 0xF2F7FF }));
      key.position.set(-5.5, 5.0, 3.0);
      key.lookAt(0, 0, 0);
      envScene.add(key);

      // Cobalt bounce (lower right): the brand colour reflected, not painted on.
      const bounce = new THREE.Mesh(new THREE.PlaneGeometry(8, 4),
        new THREE.MeshBasicMaterial({ color: 0x2F6FED }));
      bounce.position.set(5.5, -3.6, 2.4);
      bounce.lookAt(0, 0, 0);
      envScene.add(bounce);

      // Narrow ice rim behind, for a controlled back edge.
      const rim = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.1),
        new THREE.MeshBasicMaterial({ color: 0x9FD8FF }));
      rim.position.set(0, 1.2, -6.0);
      rim.lookAt(0, 0, 0);
      envScene.add(rim);

      const pmrem = new THREE.PMREMGenerator(renderer);
      envRT = pmrem.fromScene(envScene, 0.04);
      scene.environment = envRT.texture;
      pmrem.dispose();
      shellGeo.dispose();
    } catch (err) {
      console.warn('Aris auth stage: environment probe unavailable, using lights only.', err);
    }
  }

  function makeGlowTexture() {
    const size = 128;
    const h = size / 2;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');

    // Faint wide bloom — kept low so a dense field does not turn into haze.
    const halo = ctx.createRadialGradient(h, h, 0, h, h, h);
    halo.addColorStop(0.00, 'rgba(226,240,255,0.55)');
    halo.addColorStop(0.22, 'rgba(150,195,255,0.20)');
    halo.addColorStop(0.55, 'rgba(70,130,235,0.06)');
    halo.addColorStop(1.00, 'rgba(30,80,200,0.0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, size, size);

    // Hard small core: this is what makes a point read as a star rather than
    // as a lit ball.
    const core = ctx.createRadialGradient(h, h, 0, h, h, h * 0.13);
    core.addColorStop(0.00, 'rgba(255,255,255,1.0)');
    core.addColorStop(0.55, 'rgba(232,245,255,0.75)');
    core.addColorStop(1.00, 'rgba(200,228,255,0.0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);

    // Thin diffraction spikes, the way a bright star records through a lens.
    ctx.globalCompositeOperation = 'lighter';
    const spike = ctx.createLinearGradient(0, h, size, h);
    spike.addColorStop(0.00, 'rgba(180,215,255,0.0)');
    spike.addColorStop(0.42, 'rgba(214,236,255,0.30)');
    spike.addColorStop(0.50, 'rgba(255,255,255,0.62)');
    spike.addColorStop(0.58, 'rgba(214,236,255,0.30)');
    spike.addColorStop(1.00, 'rgba(180,215,255,0.0)');
    ctx.fillStyle = spike;
    ctx.fillRect(0, h - 0.9, size, 1.8);
    ctx.save();
    ctx.translate(h, h);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-h, -h);
    ctx.fillRect(0, h - 0.7, size, 1.4);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    return new THREE.CanvasTexture(c);
  }


  // ---------------------------------------------------------------------------
  // MESHES
  // ---------------------------------------------------------------------------
  function buildBodyMeshes() {
    const seg = isNarrow ? [10, 7] : [14, 10];
    const bodyGeo = new THREE.SphereGeometry(BODY_RADIUS, seg[0], seg[1]);

    const defs = [
      { color: 0xE8F2FF, roughness: 0.62, metalness: 0.06, emissive: 0xBFD9FF, env: 0.45 },
      { color: 0x7FB0F5, roughness: 0.70, metalness: 0.04, emissive: 0x4C86E8, env: 0.35 },
      { color: 0xC9E4FF, roughness: 0.55, metalness: 0.02, emissive: 0x8FC4FF, env: 0.30 }
    ];

    for (let m = 0; m < 3; m++) {
      const d = defs[m];
      const mat = new THREE.MeshStandardMaterial({
        color: d.color,
        roughness: d.roughness,
        metalness: d.metalness,
        emissive: new THREE.Color(d.emissive),
        emissiveIntensity: 0.72,
        transparent: true,
        opacity: 1.0
      });
      mat.envMapIntensity = d.env;
      const mesh = new THREE.InstancedMesh(bodyGeo, mat, PER_MESH);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      cardGroup.add(mesh);
      MESHES.push({ mesh: mesh, mat: mat });
    }

    // Additive glow companions for the ice bodies. This is what reads as bloom
    // without a second render target, at the cost of one instanced quad set.
    GLOW.mat = new THREE.MeshBasicMaterial({
      map: makeGlowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      opacity: 0.0
    });
    const glowGeo = new THREE.PlaneGeometry(BODY_RADIUS * 8.4, BODY_RADIUS * 8.4);
    GLOW.mesh = new THREE.InstancedMesh(glowGeo, GLOW.mat, PER_MESH);
    GLOW.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    GLOW.mesh.frustumCulled = false;
    GLOW.mesh.renderOrder = 4;
    cardGroup.add(GLOW.mesh);

    // Hairlines between neighbouring bodies of the same control.
    LINKS.pos = new Float32Array(LINKS.max * 6);
    LINKS.col = new Float32Array(LINKS.max * 6);
    LINKS.geo = new THREE.BufferGeometry();
    LINKS.geo.setAttribute('position', new THREE.BufferAttribute(LINKS.pos, 3));
    LINKS.geo.setAttribute('color', new THREE.BufferAttribute(LINKS.col, 3));
    LINKS.geo.setDrawRange(0, 0);
    // Additive + vertex colours: a dim colour is a dim line, which is how each
    // segment gets its own brightness without a material per segment.
    LINKS.mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    LINKS.mesh = new THREE.LineSegments(LINKS.geo, LINKS.mat);
    LINKS.mesh.frustumCulled = false;
    LINKS.mesh.renderOrder = 3;
    cardGroup.add(LINKS.mesh);

    GLOW.mesh2 = new THREE.InstancedMesh(glowGeo, GLOW.mat, PER_MESH);
    GLOW.mesh2.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    GLOW.mesh2.frustumCulled = false;
    GLOW.mesh2.renderOrder = 4;
    cardGroup.add(GLOW.mesh2);

    // Per-instance colour variation keyed to index parity, never to position, so
    // it cannot correlate with where a body sits on a path.
    const cA = new THREE.Color(0xF4F8FF);
    const cB = new THREE.Color(0x2F6FED);
    const cC = new THREE.Color(0x8FC9FF);
    for (let i = 0; i < NUM_BODIES; i++) {
      const m = i % 3;
      const inst = (i - m) / 3;
      const t = ((i * 61) % 100) / 100;
      if (m === 0) tmpColor.copy(cA).lerp(cC, t * 0.45);
      else if (m === 1) tmpColor.copy(cB).lerp(cA, t * 0.22);
      else tmpColor.copy(cC).lerp(cB, t * 0.5);
      MESHES[m].mesh.setColorAt(inst, tmpColor);
    }
    for (let m = 0; m < 3; m++) {
      if (MESHES[m].mesh.instanceColor) MESHES[m].mesh.instanceColor.needsUpdate = true;
    }
  }

  function buildPlate() {
    // Card plate and thickness meshes are disabled because the form is completely
    // unboxed ("không bị bó trong card"), floating weightlessly in deep space.
    cardPlateShaderMat = new THREE.ShaderMaterial({
      vertexShader: PlateVertexShader,
      fragmentShader: PlateFragmentShader,
      uniforms: {
        uProgress: { value: 0.0 },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uTime: { value: 0.0 },
        uColorBase: { value: new THREE.Color(0x050A14) },
        uColorCobalt: { value: new THREE.Color(0x2F6FED) },
        uColorCyan: { value: new THREE.Color(0x7EC8F5) },
        uColorSatin: { value: new THREE.Color(0xF0F4FA) }
      },
      transparent: true,
      depthWrite: false
    });

    const shape = createRoundedRectShape(cardDimW, cardDimH, cardDimR);
    cardPlateMesh = new THREE.Mesh(normalizePlateUVs(new THREE.ShapeGeometry(shape)), cardPlateShaderMat);
    cardPlateMesh.visible = false;
    cardGroup.add(cardPlateMesh);

    cardThicknessMat = new THREE.MeshStandardMaterial({
      color: 0x03060E, roughness: 0.55, metalness: 0.10,
      transparent: true, opacity: 0.0, depthWrite: false
    });
    cardThicknessMesh = new THREE.Mesh(normalizePlateUVs(new THREE.ShapeGeometry(shape)), cardThicknessMat);
    cardThicknessMesh.visible = false;
    cardThicknessMesh.position.z = -0.030;
    cardGroup.add(cardThicknessMesh);
  }

  function buildDepthField() {
    // Two point layers at different depths moving at different rates. With the
    // ambient bodies these are the far depth layers that keep the resting stage
    // from collapsing into a flat backdrop.
    function layer(count, spreadX, spreadY, zBase, zRange, size, color, opacity) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count * 3; i += 3) {
        pos[i] = (Math.random() - 0.5) * spreadX;
        pos[i + 1] = (Math.random() - 0.5) * spreadY;
        pos[i + 2] = zBase - Math.random() * zRange;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        color: color, size: size, transparent: true, opacity: opacity,
        depthWrite: false, blending: THREE.AdditiveBlending
      }));
      scene.add(pts);
      return pts;
    }
    deepDust = layer(380, 18, 12, -2.2, 3.0, 0.026, 0xA5B4FC, 0.60);
    deepDustFar = layer(520, 26, 18, -6.0, 6.0, 0.018, 0x60A5FA, 0.45);
  }

  // ---------------------------------------------------------------------------
  // ATMOSPHERE OVERLAY (vignette + grain) — DOM, so it costs no GPU passes
  // ---------------------------------------------------------------------------
  function buildAtmosphereOverlay() {
    if (document.getElementById('arisAtmosOverlay')) return;
    atmosOverlay = document.createElement('div');
    atmosOverlay.id = 'arisAtmosOverlay';
    atmosOverlay.className = 'aris-atmos-overlay';
    atmosOverlay.setAttribute('aria-hidden', 'true');
    atmosOverlay.innerHTML = '<span class="aris-atmos-grain"></span><span class="aris-atmos-vignette"></span>';
    document.body.appendChild(atmosOverlay);
  }

  // ---------------------------------------------------------------------------
  // TARGET RESOLUTION PER FRAME
  // ---------------------------------------------------------------------------
  const _s = { x: 0, y: 0 };
  const _g = { x: 0, y: 0, z: 0 };

  function ambientTarget(i, time) {
    const d = bodyDepth[i];
    const ang = bodyPhase[i] + time * (0.030 + d * 0.055) * (i % 2 ? 1 : -1);
    const radius = 2.6 + d * 4.2 + Math.sin(bodyPhase[i] * 3.1) * 0.7;
    tX[i] = Math.cos(ang) * radius * 1.22;
    tY[i] = Math.sin(ang * 0.82 + bodyPhase[i]) * radius * 0.72;
    tZ[i] = -0.9 - d * 4.4 + Math.sin(time * 0.22 + bodyPhase[i]) * 0.25;
  }

  function resolveRestTargets(time) {
    for (let i = 0; i < NUM_BODIES; i++) {
      const p = bodyPath[i];
      if (p < 0 || p >= nanoPaths.length) { ambientTarget(i, time); continue; }

      const path = nanoPaths[p];

      if (bodyKind[i] === 2) {
        // Glyph bodies hold their coverage point almost exactly: legibility is
        // the constraint, so they only drift by a fraction of a stroke width.
        tX[i] = path.cx + bodyFX[i] * path.w + Math.sin(time * 0.9 + bodyPhase[i]) * 0.0022;
        tY[i] = path.cy + bodyFY[i] * path.h + Math.cos(time * 0.8 + bodyPhase[i]) * 0.0020;
        tZ[i] = path.z + Math.sin(time * 1.1 + bodyPhase[i]) * 0.006;
        continue;
      }

      if (bodyKind[i] === 1) {
        // Surface bodies hold their lattice slot and breathe in place, so the
        // control reads as a coherent membrane rather than as drifting dust.
        const br = 1.0 + path.energy * 0.05;
        tX[i] = path.cx + bodyFX[i] * path.w * br
              + Math.sin(time * 0.75 * bodyFlow[i] + bodyPhase[i]) * 0.0045;
        tY[i] = path.cy + bodyFY[i] * path.h * br
              + Math.cos(time * 0.68 * bodyFlow[i] + bodyPhase[i] * 1.4) * 0.0040;
        tZ[i] = path.z - 0.014 + Math.sin(time * 0.9 + bodyPhase[i]) * 0.010 + path.energy * 0.04;
        continue;
      }

      const isFrame = path.key && path.key.indexOf('frame') === 0;
      if (isFrame) {
        // Celestial 3D Inclined Asteroid Belt encircling the unboxed floating form
        // Keplerian differential orbital velocity: inner belt moves faster, outer belt slower
        const d = bodyDepth[i];
        const radialBand = 1.16 + d * 0.44; // inner edge now clears the form's own content
        const orbitSpeed = (0.016 + (1.0 - d) * 0.014) * bodyFlow[i];
        const theta = (bodyU[i] + time * orbitSpeed) * Math.PI * 2.0;

        // Elliptical axes framing the unboxed form comfortably. On a narrow
        // screen the card nearly fills the viewport, so a belt sized from the
        // card lands entirely off-screen top and bottom; there the belt is
        // sized from the viewport instead and reads as two curtains of stars
        // down the sides.
        let rx = (path.w * 0.78) * radialBand;
        let ry = (path.h * 0.74) * radialBand;
        if (isNarrow) {
          const visH = 2.0 * cameraBaseZ * Math.tan((camera.fov * 0.5 * Math.PI) / 180);
          const visW = visH * camera.aspect;
          rx = (visW * 0.46) * radialBand;
          ry = (visH * 0.52) * radialBand;
        }
        const ripple = 1.0 + Math.sin(theta * 3.0 + bodyPhase[i]) * 0.07 + Math.cos(theta * 5.0) * 0.035;

        // Inclined 3D orbital plane (tilt ~25 degrees into depth)
        const inPlaneX = Math.cos(theta) * rx * ripple;
        const inPlaneY = Math.sin(theta) * ry * ripple;
        const tilt = 0.44; // radians inclination

        tX[i] = path.cx + inPlaneX + Math.sin(time * 0.8 + bodyPhase[i]) * 0.008;
        tY[i] = path.cy + inPlaneY * Math.cos(tilt) + Math.cos(time * 0.7 + bodyPhase[i]) * 0.008;
        tZ[i] = path.z + inPlaneY * Math.sin(tilt) + (d - 0.5) * 0.18 + Math.sin(time * 0.6 + bodyPhase[i]) * 0.015;
        continue;
      }

      if (path.isButton) {
        // Child planets (Hành tinh con) orbiting the button in 3D space
        const orbitSpeed = (0.016 + (bodyFlow[i] * 0.012) + path.energy * 0.045) * path.flow;
        samplePath(path, bodyU[i] + time * orbitSpeed, _s);

        const orbitPhase = bodyU[i] * Math.PI * 2.0;
        const zOrbit = Math.sin(orbitPhase + time * 0.9) * 0.024 + path.energy * 0.035;

        // Push the star off the outline along the direction from the control's
        // centre, so the figure is not glued to a rectangle.
        const ox = _s.x - path.cx;
        const oy = _s.y - path.cy;
        const ol = Math.sqrt(ox * ox + oy * oy) + 1e-5;
        // Kept tight on hover: a figure that grows too far starts crossing the
        // line of text under the control.
        const off = bodyOffset[i] * (1.0 + path.energy * 0.30);

        tX[i] = _s.x + (ox / ol) * off + Math.sin(time * 1.1 + bodyPhase[i]) * 0.0025;
        tY[i] = _s.y + (oy / ol) * off * 0.65 + Math.cos(time * 0.95 + bodyPhase[i]) * 0.0025;
        tZ[i] = path.z + zOrbit;
        continue;
      }

      // Edge bodies stream continuously along the outline they belong to.
      samplePath(path, bodyU[i] + time * 0.0185 * bodyFlow[i] * path.flow, _s);

      tX[i] = _s.x + Math.sin(time * 1.15 + bodyPhase[i]) * 0.0045;
      tY[i] = _s.y + Math.cos(time * 0.95 + bodyPhase[i] * 1.7) * 0.0045;
      tZ[i] = path.z + Math.sin(time * 0.8 + bodyPhase[i]) * 0.008 + path.energy * 0.05;
    }
  }

  function setCardVeil(card, reveal) {
    const r = Math.max(0, Math.min(1, reveal));
    card.style.opacity = String(r);
    card.style.pointerEvents = r > 0.9 ? 'auto' : 'none';
    card.style.transform = r >= 1 ? 'none' : 'translateY(' + ((1 - r) * 14).toFixed(2) + 'px)';
  }

  function resolveIntroTargets(time) {
    const card = document.getElementById('glassAuthCard');

    if (animClock < T_VORTEX) {
      // Beat 1: Inward Swirling Vortex Rings (Các vòng xoay cuộn vào)
      // 4 concentric accretion rings coiling inward with accelerating spin into singularity
      const k = animClock / T_VORTEX;
      const kIn = k * k * (1.6 - 0.6 * k); // accelerating gravitational suction

      for (let i = 0; i < NUM_BODIES; i++) {
        const ringId = i % 4;
        let tilt, pa, dir;
        if (ringId === 0) {
          tilt = 0.22; pa = 0.35; dir = 1.0;
        } else if (ringId === 1) {
          tilt = 0.85; pa = -0.90; dir = -1.15;
        } else if (ringId === 2) {
          tilt = 1.30; pa = 1.20; dir = 1.25;
        } else {
          tilt = -0.55; pa = 2.30; dir = -0.95;
        }

        const rStart = 4.8 + bodyDepth[i] * 2.6;
        const rCore = 0.06 + ((i * 19) % 100) / 100 * 0.08;
        const r = rStart * (1.0 - kIn) + rCore * kIn;

        // Angular velocity accelerates as radius shrinks (conservation of angular momentum)
        const spinSpeed = 3.5 + 22.0 * (k * k);
        const theta = bodyPhase[i] * 2.4 + animClock * spinSpeed * dir;

        // 3D tilted ring coordinate
        const xRing = Math.cos(theta) * r;
        const yRing = Math.sin(theta) * r * Math.cos(tilt);
        const zRing = Math.sin(theta) * r * Math.sin(tilt) + ((i % 11) - 5) * 0.012 * (1.0 - k);

        // Rotate by position angle (PA)
        const cp = Math.cos(pa), sp = Math.sin(pa);
        tX[i] = xRing * cp - yRing * sp;
        tY[i] = (xRing * sp + yRing * cp) * 0.88;
        tZ[i] = zRing;
      }
      buildProgress = 0.0;
      if (card) setCardVeil(card, 0);

    } else if (animClock < T_DNA) {
      // Beat 2: Supernova Detonation -> DNA Helix Creation
      // At T_VORTEX, singularity detonates in a blinding supernova blast!
      // Spherical shockwave explodes outward, then captured by harmonic fields to crystallize into DNA.
      const elapsed = animClock - T_VORTEX;
      const totalNova = T_DNA - T_VORTEX;
      const blastSpan = T_SUPERNOVA - T_VORTEX;

      // Blast expansion curve
      const blastT = Math.min(1.0, elapsed / blastSpan);
      const blastEase = Math.pow(blastT, 0.40); // high explosive velocity at detonation

      // Crystallization into DNA begins after shockwave peak
      const dnaStartT = blastSpan * 0.70;
      const dnaProgress = Math.max(0, Math.min(1.0, (elapsed - dnaStartT) / (totalNova - dnaStartT)));
      const eDna = dnaProgress * dnaProgress * (3 - 2 * dnaProgress);

      // Rotating double helix reference
      const rot = (animClock - T_VORTEX) * 0.62;
      helixFreezeRot = rot;
      const cosD = Math.cos(rot), sinD = Math.sin(rot);

      for (let i = 0; i < NUM_BODIES; i++) {
        // Spherical shockwave direction
        const elev = ((bodyPhase[i] * 1.7) % Math.PI) - Math.PI * 0.5;
        const azim = bodyPhase[i] * 3.1 + i * 0.05;
        const dirX = Math.cos(elev) * Math.cos(azim);
        const dirY = Math.sin(elev) * 0.95;
        const dirZ = Math.cos(elev) * Math.sin(azim);

        const rB = (2.2 + bodyDepth[i] * 2.2) * blastEase;
        const bx = dirX * rB;
        const by = dirY * rB;
        const bz = dirZ * rB;

        if (galIdx[i] >= 0) {
          galaxyLocal(i, animClock, _g);
          tX[i] = bx * (1.0 - eDna) + _g.x * eDna;
          tY[i] = by * (1.0 - eDna) + _g.y * eDna;
          tZ[i] = bz * (1.0 - eDna) + _g.z * eDna;
          dnaX[i] = _g.x; dnaY[i] = _g.y; dnaZ[i] = _g.z;
          continue;
        }

        const rotDnaX = dnaX[i] * cosD - dnaZ[i] * sinD;
        const rotDnaZ = dnaX[i] * sinD + dnaZ[i] * cosD;
        const rotDnaY = dnaY[i];

        tX[i] = bx * (1.0 - eDna) + rotDnaX * eDna;
        tY[i] = by * (1.0 - eDna) + rotDnaY * eDna;
        tZ[i] = bz * (1.0 - eDna) + rotDnaZ * eDna;
      }

      buildProgress = 0.0;
      if (card) setCardVeil(card, 0);

    } else if (animClock < T_WORD) {
      // Beat 3 — the helix unwinds into the lettermark, staggered by body index
      const k = (animClock - T_DNA) / (T_WORD - T_DNA);
      const cosF = Math.cos(helixFreezeRot), sinF = Math.sin(helixFreezeRot);
      for (let i = 0; i < NUM_BODIES; i++) {
        const stagger = ((i * 29) % 100) / 100 * 0.35;
        const kk = Math.max(0, Math.min(1, (k - stagger) / (1 - stagger)));
        const e = kk * kk * (3 - 2 * kk);
        const rot = galIdx[i] < 0;
        const sx = rot ? (dnaX[i] * cosF - dnaZ[i] * sinF) : dnaX[i];
        const sz = rot ? (dnaX[i] * sinF + dnaZ[i] * cosF) : dnaZ[i];
        tX[i] = sx * (1 - e) + wordX[i] * e;
        tY[i] = dnaY[i] * (1 - e) + wordY[i] * e;
        tZ[i] = sz * (1 - e) + wordZ[i] * e;
      }
      buildProgress = 0.0;
      if (card) setCardVeil(card, 0);

    } else if (animClock < T_BUILD) {
      // Beat 4 — the lettermark becomes the interface. Each body flies from its
      // glyph position to the outline of a real control, arcing outward on the
      // way so the transfer is visible rather than a straight interpolation.
      const k = (animClock - T_WORD) / (T_BUILD - T_WORD);
      buildProgress = Math.max(0, Math.min(1, (k - 0.10) / 0.62));
      resolveRestTargets(time);

      for (let i = 0; i < NUM_BODIES; i++) {
        const stagger = ((i * 53) % 100) / 100 * 0.42;
        const kk = Math.max(0, Math.min(1, (k - stagger) / (1 - stagger)));
        const e = kk * kk * (3 - 2 * kk);
        const arc = Math.sin(e * Math.PI) * 0.55;
        const dir = ((i % 7) - 3) / 3;
        tX[i] = wordX[i] * (1 - e) + tX[i] * e + dir * arc * 0.35;
        tY[i] = wordY[i] * (1 - e) + tY[i] * e + arc * 0.22 * (i % 2 ? 1 : -1);
        tZ[i] = wordZ[i] * (1 - e) + tZ[i] * e + arc * 0.5;
      }

      // The DOM only appears once its outlines exist underneath it.
      if (card) setCardVeil(card, Math.max(0, (k - 0.55) / 0.35));

    } else {
      introActive = false;
      isReplayMode = false;
      buildProgress = 1.0;
      if (card) setCardVeil(card, 1);
      resolveRestTargets(time);
    }
  }

  // ---------------------------------------------------------------------------
  // SIMULATION
  // ---------------------------------------------------------------------------
  function integrate(dt, stiffness, damping) {
    const pointerRadius = isCoarsePointer ? 1.15 : 0.95;
    const pr2 = pointerRadius * pointerRadius;
    const pointerGain = (pointerInside && !prefersReducedMotion ? 1.0 : 0.0) * typingDamp;
    const holdGain = pointerHeld ? 1.9 : 1.0;
    const swirl = Math.min(1.0, pointerSpeed * 2.4);

    for (let i = 0; i < NUM_BODIES; i++) {
      let ax = (tX[i] - pX[i]) * stiffness - vX[i] * damping;
      let ay = (tY[i] - pY[i]) * stiffness - vY[i] * damping;
      let az = (tZ[i] - pZ[i]) * stiffness - vZ[i] * damping;

      if (pointerGain > 0.001) {
        const dx = pX[i] - pointerWorld.x;
        const dy = pY[i] - pointerWorld.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < pr2) {
          const d = Math.sqrt(d2) + 1e-4;
          let f = 1.0 - d / pointerRadius;
          f = f * f;
          const nx = dx / d, ny = dy / d;
          // How much a body yields depends on what it is doing. Glyph bodies
          // barely move: the pointer resting on the form must not shred the
          // words someone is reading. The free field reacts fully.
          const yield_ = bodyPath[i] < 0 ? 1.35
                       : bodyKind[i] === 2 ? 0.10
                       : 0.55;
          // Radial: the region immediately under the pointer parts around it.
          const push = f * 20.0 * pointerGain * holdGain * yield_;
          ax += nx * push;
          ay += ny * push;
          // Tangential: movement leaves a curling wake behind it.
          const curl = f * 16.0 * swirl * pointerGain * yield_;
          ax += -ny * curl;
          ay += nx * curl;
          az += f * 3.5 * pointerGain * yield_;
        }
      }

      if (submitPulse > 0.001) {
        const dx = pX[i] - cardCX;
        const dy = pY[i] - cardCY;
        const d = Math.sqrt(dx * dx + dy * dy) + 1e-4;
        const w = submitPulse * Math.exp(-Math.abs(d - (1 - submitPulse) * 3.0) * 3.0);
        ax += (dx / d) * w * 12.0;
        ay += (dy / d) * w * 12.0;
      }

      vX[i] += ax * dt; vY[i] += ay * dt; vZ[i] += az * dt;
      pX[i] += vX[i] * dt; pY[i] += vY[i] * dt; pZ[i] += vZ[i] * dt;
    }
  }

  function writeInstances(time) {
    const twinkle = introActive ? 0.0 : 1.0;
    
    // Supernova Detonation Flash Curve (T_VORTEX -> T_SUPERNOVA + 0.9s)
    let supernovaFlash = 0.0;
    if (introActive && animClock >= T_VORTEX && animClock < T_SUPERNOVA + 0.9) {
      const elapsed = animClock - T_VORTEX;
      if (elapsed < 0.12) {
        // Fast explosive flash rise (0 -> 1.0 in 120ms)
        supernovaFlash = Math.sin((elapsed / 0.12) * Math.PI * 0.5);
      } else {
        // Cosmic exponential afterglow decay
        const decayT = (elapsed - 0.12) / (T_SUPERNOVA + 0.9 - T_VORTEX - 0.12);
        supernovaFlash = Math.pow(Math.max(0, 1.0 - decayT), 2.2);
      }
    }
    const stageScale = introActive ? (1.55 + supernovaFlash * 1.8) : 1.0;

    for (let i = 0; i < NUM_BODIES; i++) {
      const m = i % 3;
      const inst = (i - m) / 3;
      const p = bodyPath[i];

      const isButtonMoon = (p >= 0 && p < nanoPaths.length && nanoPaths[p].isButton);
      let scale = bodySize[i];
      if (isButtonMoon) {
        // A constellation is read from a few bright stars with fainter ones
        // between them, not from a row of identical dots.
        scale = bodyAnchor[i]
          ? Math.max(1.85, bodySize[i] * 2.15)
          : Math.max(0.78, bodySize[i] * 0.95);
        scale *= (1.0 + nanoPaths[p].energy * (bodyAnchor[i] ? 0.55 : 0.80));
      } else if (introActive && galIdx[i] >= 0) {
        const gt = galType[i];
        if (gt === 2) {
          // Halo stars: bigger, and they actually twinkle. Sparse enough that
          // the cost is a few dozen bodies.
          scale *= 1.15 + 0.55 * Math.sin(time * 3.1 + bodyPhase[i] * 6.0);
        } else if (gt === 0) {
          scale *= 0.72;                         // bulge: dense but fine
        } else if (gt === 3) {
          scale *= 0.80;                         // companions
        } else {
          scale *= 0.54;                         // disc dust
        }
      }
      if (p >= 0 && p < nanoPaths.length && !isButtonMoon) {
        scale *= 1.0 + nanoPaths[p].energy * 0.85;   // focused control tightens
        if (bodyKind[i] === 1) scale *= 0.62;        // surface finer than edge
        else if (bodyKind[i] === 2) scale *= 0.58;   // glyphs need fine bodies
      } else if (!isButtonMoon) {
        scale *= 0.68 + bodyDepth[i] * 0.60;         // ambient bodies sit back
      }
      scale *= (0.88 + 0.12 * Math.sin(time * 1.7 + bodyPhase[i] * 4.0) * twinkle) * stageScale;

      dummy.position.set(pX[i], pY[i], pZ[i]);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, 0, bodyPhase[i] + time * 0.12);
      dummy.updateMatrix();
      MESHES[m].mesh.setMatrixAt(inst, dummy.matrix);

      if ((m === 2 || m === 0) && GLOW.mesh) {
        const isPlanetoid = bodySize[i] > 1.8 || isButtonMoon;
        const isSurface = bodyKind[i] === 1;
        const pEnergy = (p >= 0 && p < nanoPaths.length ? nanoPaths[p].energy : 0.0);
        let gs = bodyKind[i] === 2
          ? 0.0
          : scale * (0.85 + pEnergy * 1.2 + (isPlanetoid ? 0.35 : 0.0) + supernovaFlash * 2.2);
        if (isSurface) gs *= 0.18; // Surface bodies stay subtle to preserve high contrast

        if (m === 2) {
          // Delicate Streaming Light Ribbons / Satellite Trails
          const vx = vX[i];
          const vy = vY[i];
          const speedSq = vx * vx + vy * vy;
          let streakAngle = 0;
          let streakLen = gs * 1.1;
          let streakWid = gs * 0.44;

          if (isButtonMoon) {
            streakAngle = bodyPhase[i] + time * 0.25;
            streakLen = gs * 1.35;
            streakWid = gs * 0.40;
          } else if (!isSurface && speedSq > 0.00005) {
            streakAngle = Math.atan2(vy, vx);
            const speed = Math.sqrt(speedSq);
            // Refined starlight ribbons: fine, delicate, luminous filaments
            streakLen = gs * Math.min(3.6, 1.4 + speed * 22.0);
            streakWid = gs * Math.max(0.30, 0.52 - speed * 2.0);
          } else if (!isSurface && p >= 0) {
            streakAngle = bodyPhase[i];
            streakLen = gs * 1.2;
            streakWid = gs * 0.40;
          }

          dummy.position.set(pX[i], pY[i], pZ[i] + 0.005);
          dummy.scale.set(streakLen, streakWid, 1.0);
          dummy.rotation.set(0, 0, streakAngle);
          dummy.updateMatrix();
          GLOW.mesh.setMatrixAt(inst, dummy.matrix);
        } else {
          // Circular planetary atmospheric corona & asteroid halo
          const coronaScale = isButtonMoon
            ? gs * 1.50
            : (isPlanetoid ? gs * 1.75 : gs * 1.05);
          dummy.position.set(pX[i], pY[i], pZ[i] + 0.003);
          dummy.scale.set(coronaScale, coronaScale, 1.0);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          GLOW.mesh2.setMatrixAt(inst, dummy.matrix);
        }
      }
    }

    updateConstellationLines();

    for (let m = 0; m < 3; m++) MESHES[m].mesh.instanceMatrix.needsUpdate = true;
    if (GLOW.mesh) GLOW.mesh.instanceMatrix.needsUpdate = true;
    if (GLOW.mesh2) GLOW.mesh2.instanceMatrix.needsUpdate = true;
  }

  /**
   * Walks the bodies in assignment order and joins consecutive ones that belong
   * to the same control, closing each loop. Bodies of one control are laid out
   * in order around it, so consecutive indices are neighbours on its outline.
   */
  function updateConstellationLines() {
    if (!LINKS.mesh || introActive) {
      if (LINKS.geo) LINKS.geo.setDrawRange(0, 0);
      return;
    }
    const pos = LINKS.pos;
    const col = LINKS.col;
    let seg = 0;
    let runStart = -1;
    let prev = -1;

    function put(a, b, bright) {
      if (seg >= LINKS.max) return;
      const o = seg * 6;
      pos[o] = pX[a]; pos[o + 1] = pY[a]; pos[o + 2] = pZ[a];
      pos[o + 3] = pX[b]; pos[o + 4] = pY[b]; pos[o + 5] = pZ[b];
      const r = bright * 0.66, g = bright * 0.82, bl = bright;
      col[o] = r; col[o + 1] = g; col[o + 2] = bl;
      col[o + 3] = r; col[o + 4] = g; col[o + 5] = bl;
      seg++;
    }

    function brightness(p, a, b) {
      const path = nanoPaths[p];
      const e = path.energy;
      const skeleton = bodyAnchor[a] || bodyAnchor[b];
      // At rest only the skeleton between bright stars is faintly drawn. The
      // rest of the figure is written in as the pointer sweeps across, running
      // around the shape rather than switching on all at once.
      const front = e * 1.55;
      const reveal = Math.max(0, Math.min(1, (front - bodyU[a] * 0.85) * 2.2));
      const base = skeleton ? 0.115 : 0.012;
      return base + reveal * (skeleton ? 0.38 : 0.52);
    }

    for (let i = 0; i <= NUM_STRUCTURE; i++) {
      const p = (i < NUM_STRUCTURE) ? bodyPath[i] : -1;
      const linkable = p >= 0 && p < nanoPaths.length && nanoPaths[p].isButton;
      const samePath = linkable && prev >= 0 && bodyPath[prev] === p;

      if (samePath) {
        put(prev, i, brightness(p, prev, i));
      } else if (prev >= 0 && runStart >= 0) {
        const pp = bodyPath[prev];
        put(prev, runStart, brightness(pp, prev, runStart));
      }

      if (linkable) {
        if (!samePath) runStart = i;
        prev = i;
      } else {
        prev = -1;
        runStart = -1;
      }
    }

    LINKS.geo.attributes.position.needsUpdate = true;
    LINKS.geo.attributes.color.needsUpdate = true;
    LINKS.geo.setDrawRange(0, seg * 2);
  }

  function updateMaterialState(dt, time) {
    if (cardPlateShaderMat) {
      cardPlateShaderMat.uniforms.uProgress.value = buildProgress;
      cardPlateShaderMat.uniforms.uPointer.value.copy(currentPointer);
      cardPlateShaderMat.uniforms.uTime.value = time;
      cardPlateMesh.visible = false;
    }
    if (cardThicknessMat) {
      cardThicknessMat.opacity = 0.0;
      cardThicknessMesh.visible = false;
    }

    // Dynamic Supernova Light Intensity and Exposure Surge
    let supernovaFlash = 0.0;
    if (introActive && animClock >= T_VORTEX && animClock < T_SUPERNOVA + 0.9) {
      const elapsed = animClock - T_VORTEX;
      if (elapsed < 0.12) {
        supernovaFlash = Math.sin((elapsed / 0.12) * Math.PI * 0.5);
      } else {
        const decayT = (elapsed - 0.12) / (T_SUPERNOVA + 0.9 - T_VORTEX - 0.12);
        supernovaFlash = Math.pow(Math.max(0, 1.0 - decayT), 2.2);
      }
    }

    if (renderer) {
      renderer.toneMappingExposure = 0.86 + supernovaFlash * 1.45;
    }
    if (keyLight) {
      keyLight.intensity = 1.65 + supernovaFlash * 5.0;
    }
    if (cobaltLight) {
      cobaltLight.intensity = 1.35 + supernovaFlash * 6.2;
    }

    if (GLOW.mat) {
      const baseWant = introActive ? 0.72 : 0.48;
      const want = Math.min(1.0, baseWant + supernovaFlash * 0.45);
      GLOW.mat.opacity += (want - GLOW.mat.opacity) * Math.min(1, dt * 6.0);
    }
    for (let p = 0; p < nanoPaths.length; p++) {
      const want = (p === focusedPathId) ? 1.0 : 0.0;
      nanoPaths[p].energy += (want - nanoPaths[p].energy) * Math.min(1, dt * 4.5);
    }
  }

  // ---------------------------------------------------------------------------
  // CAMERA & LAYOUT
  // ---------------------------------------------------------------------------
  function updateCameraFraming() {
    if (!camera || !renderer) return;
    const container = document.getElementById('canvasContainer');
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
    const aspect = Math.max(0.2, width / height);

    camera.aspect = aspect;
    const isMobileView = (width <= 768) || (aspect < 1.0);
    const targetOccupancy = isMobileView ? 0.85 : 0.72;
    const tanHalfFov = Math.tan((camera.fov * 0.5 * Math.PI) / 180);
    let z = 4.2 / (2.0 * tanHalfFov * aspect * targetOccupancy);
    z = Math.min(10.5, Math.max(5.6, z));

    cameraBaseZ = z;
    camera.position.set(0, 0, z);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    computeDnaTargets();
    rebuildNanoPaths();
  }

  function onResize() {
    if (!renderer || !camera) return;
    const container = document.getElementById('canvasContainer');
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    updateCameraFraming();
  }

  // ---------------------------------------------------------------------------
  // INPUT
  // ---------------------------------------------------------------------------
  function onPointerMove(e) {
    const x = e.clientX, y = e.clientY;
    targetPointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    screenToPlane(x, y, _proj);
    pointerWorldPrev.copy(pointerWorld);
    pointerWorld.set(_proj.x, _proj.y, 0);
    pointerSpeed = pointerWorld.distanceTo(pointerWorldPrev);
    pointerInside = true;
  }

  function onPointerLeave() { pointerInside = false; pointerHeld = false; }

  function pathIdForElement(el) {
    if (!el || !el.nodeType) return -1;
    for (let i = 0; i < nanoPaths.length; i++) {
      if (nanoPaths[i].key.indexOf('frame') === 0) continue;
      if (nanoPaths[i].el === el || nanoPaths[i].el.contains(el)) return i;
    }
    return -1;
  }

  function bindFocusTracking() {
    const card = document.getElementById('glassAuthCard');
    if (!card) return;
    card.addEventListener('focusin', function (e) {
      isTyping = true;
      focusedPathId = pathIdForElement(e.target);
    });
    card.addEventListener('focusout', function () {
      isTyping = false;
      focusedPathId = -1;
    });
    card.addEventListener('pointerover', function (e) {
      if (document.activeElement && card.contains(document.activeElement)) return;
      const id = pathIdForElement(e.target);
      if (id >= 0) focusedPathId = id;
    });
    card.addEventListener('pointerout', function () {
      if (document.activeElement && card.contains(document.activeElement)) return;
      focusedPathId = -1;
    });
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API (kept identical to the previous revision)
  // ---------------------------------------------------------------------------
  window.handleFocus = function (focused) { isTyping = !!focused; };

  window.triggerSubmitPulse = function () {
    submitPulse = 1.0;
    if (cobaltLight) {
      cobaltLight.intensity = 2.4;
      setTimeout(function () { if (cobaltLight) cobaltLight.intensity = 0.9; }, 700);
    }
  };

  window.skipIntro = function () {
    isReplayMode = false;
    introActive = false;
    animClock = Math.max(animClock, T_BUILD + 0.1);
    qaProgressOverride = null;
    buildProgress = 1.0;

    if (renderer) renderer.toneMappingExposure = 0.86;
    if (keyLight) keyLight.intensity = 1.65;
    if (cobaltLight) cobaltLight.intensity = 1.35;
    if (GLOW.mat) GLOW.mat.opacity = 0.24;

    if (camera) {
      camera.position.set(0, 0, cameraBaseZ);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
    }

    const card = document.getElementById('glassAuthCard');
    if (card) { setCardVeil(card, 1); card.classList.add('revealed'); }
    enhanceAuthDom();

    rebuildNanoPaths();
    resolveRestTargets(animClock);
    for (let i = 0; i < NUM_BODIES; i++) {
      pX[i] = tX[i]; pY[i] = tY[i]; pZ[i] = tZ[i];
      vX[i] = vY[i] = vZ[i] = 0;
    }
    try { sessionStorage.setItem('arisAuthIntroSeen', '1'); } catch (e) { /* private mode */ }
  };

  window.replayChoreography = function () {
    if (prefersReducedMotion) { window.skipIntro(); return; }
    isReplayMode = true;
    introActive = true;
    animClock = 0;
    qaProgressOverride = null;
    buildProgress = 0;

    if (renderer) renderer.toneMappingExposure = 0.86;
    if (keyLight) keyLight.intensity = 1.15;
    if (cobaltLight) cobaltLight.intensity = 0.90;

    const card = document.getElementById('glassAuthCard');
    if (card) setCardVeil(card, 0);

    computeDnaTargets();
    computeArisGlyphTargets();
    rebuildNanoPaths();

    // Seed off-frame for inward vortex accretion rings
    for (let i = 0; i < NUM_BODIES; i++) {
      const a = bodyPhase[i] * 2.4;
      const r = 5.2 + bodyDepth[i] * 2.8;
      pX[i] = Math.cos(a) * r;
      pY[i] = Math.sin(a * 0.85) * r * 0.65;
      pZ[i] = Math.sin(a * 1.5) * 1.4;
      vX[i] = vY[i] = vZ[i] = 0;
    }
  };

  window.togglePause = function () {
    isPaused = !isPaused;
    const btn = document.getElementById('btnPauseMotion');
    const txt = document.getElementById('txtPauseMotion');
    if (isPaused) {
      if (btn) btn.classList.add('active');
      if (txt) txt.textContent = 'Phát tiếp';
    } else {
      if (btn) btn.classList.remove('active');
      if (txt) txt.textContent = 'Tạm dừng';
      lastTime = performance.now();
    }
  };

  /**
   * Login <-> Register as one continuous rearrangement of the same bodies.
   * Order of operations matters: the outgoing text leaves first, the bodies
   * travel while the panel is swapped behind them, and the incoming text only
   * fades in once its outline has been redrawn.
   */
  window.switchAuthMode = function (targetMode, skipPushState) {
    if (currentAuthMode === targetMode && !isMorphing) return;

    const gen = ++switchGeneration;
    currentAuthMode = targetMode;

    const card = document.getElementById('glassAuthCard');
    const loginSec = document.getElementById('formSectionLogin');
    const regSec = document.getElementById('formSectionRegister');
    if (!loginSec || !regSec) return;

    const isReg = (targetMode === 'register');
    const outgoing = isReg ? loginSec : regSec;
    const incoming = isReg ? regSec : loginSec;

    const lEmail = document.getElementById('loginEmail');
    const rEmail = document.getElementById('registerEmail');
    if (isReg && lEmail && rEmail && lEmail.value) rEmail.value = lEmail.value;
    else if (!isReg && lEmail && rEmail && rEmail.value) lEmail.value = rEmail.value;

    if (!skipPushState && window.history && window.history.pushState) {
      const base = isReg ? '/Account/Register' : '/Account/Login';
      const ret = new URLSearchParams(window.location.search).get('returnUrl');
      window.history.pushState({ mode: targetMode }, '',
        ret ? base + '?returnUrl=' + encodeURIComponent(ret) : base);
    }

    if (prefersReducedMotion || !camera || !renderer) {
      outgoing.style.display = 'none';
      incoming.style.display = 'block';
      if (card) card.classList.toggle('mode-register', isReg);
      rebuildNanoPaths();
      resolveRestTargets(animClock);
      for (let i = 0; i < NUM_BODIES; i++) { pX[i] = tX[i]; pY[i] = tY[i]; pZ[i] = tZ[i]; }
      return;
    }

    for (let i = 0; i < NUM_BODIES; i++) {
      morphFromX[i] = pX[i]; morphFromY[i] = pY[i]; morphFromZ[i] = pZ[i];
      morphDelay[i] = ((i * 47) % 100) / 100 * 0.34;
    }

    outgoing.classList.add('is-leaving');
    isMorphing = true;
    morphClock = 0;

    // Swap the panel while the bodies are mid-flight and the text is gone.
    setTimeout(function () {
      if (gen !== switchGeneration) return;
      outgoing.style.display = 'none';
      outgoing.classList.remove('is-leaving');
      incoming.style.display = 'block';
      incoming.classList.add('is-entering');
      if (card) card.classList.toggle('mode-register', isReg);
      enhanceAuthDom();
      rebuildNanoPaths();

      setTimeout(function () {
        if (gen !== switchGeneration) return;
        incoming.classList.remove('is-entering');
        incoming.classList.add('is-materializing');
        setTimeout(function () { incoming.classList.remove('is-materializing'); }, 900);
      }, 380);
    }, 250);
  };

  window.addEventListener('popstate', function () {
    const isReg = window.location.pathname.toLowerCase().indexOf('register') >= 0;
    const mode = isReg ? 'register' : 'login';
    if (currentAuthMode !== mode) window.switchAuthMode(mode, true);
  });

  // Inspection hook for QA captures: reports how the budget was distributed.
  window.__nanoDebug = function () {
    const counts = {};
    for (let i = 0; i < NUM_BODIES; i++) {
      const p = bodyPath[i];
      const key = p < 0 ? 'ambient' : (nanoPaths[p] ? nanoPaths[p].key : ('STALE:' + p));
      const k = key + '/' + bodyKind[i];
      counts[k] = (counts[k] || 0) + 1;
    }
    return {
      paths: nanoPaths.map(function (p) {
        return { key: p.key, text: !!p.text, fill: !!p.fill, slots: p.slots, count: p.count,
                 w: +p.w.toFixed(3), h: +p.h.toFixed(3) };
      }),
      bodies: counts
    };
  };

  window.__qaSetProgress = function (progress) {
    qaProgressOverride = Math.max(0, Math.min(1, progress));
    introActive = false;
    isReplayMode = false;
    buildProgress = qaProgressOverride;

    const card = document.getElementById('glassAuthCard');
    if (card) setCardVeil(card, qaProgressOverride >= 0.85 ? 1 : 0);

    rebuildNanoPaths();
    resolveRestTargets(animClock);
    for (let i = 0; i < NUM_BODIES; i++) {
      const e = qaProgressOverride;
      pX[i] = wordX[i] * (1 - e) + tX[i] * e;
      pY[i] = wordY[i] * (1 - e) + tY[i] * e;
      pZ[i] = wordZ[i] * (1 - e) + tZ[i] * e;
      vX[i] = vY[i] = vZ[i] = 0;
    }
    writeInstances(animClock);
    updateMaterialState(0.016, animClock);
    if (renderer && scene && camera) renderer.render(scene, camera);
  };

  // ---------------------------------------------------------------------------
  // MAIN LOOP
  // ---------------------------------------------------------------------------
  let lastTime = performance.now();
  let layoutWatch = 0;
  let lastLayoutSig = '';

  function simulationLoop(now) {
    requestAnimationFrame(simulationLoop);
    if (document.hidden || isPaused || !renderer || !scene || !camera) { lastTime = now; return; }

    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    if (qaProgressOverride !== null) {
      renderer.render(scene, camera);
      return;
    }

    animClock += dt;
    const time = animClock;

    layoutWatch -= dt;
    if (layoutWatch <= 0) {
      layoutWatch = 0.25;
      const sig = layoutSignature();
      if (sig && sig !== lastLayoutSig) {
        lastLayoutSig = sig;
        rebuildNanoPaths();
      }
    }

    const pDamp = 1.0 - Math.exp(-5.0 * dt);
    currentPointer.lerp(targetPointer, pDamp);
    pointerSpeed *= Math.exp(-4.0 * dt);
    submitPulse *= Math.exp(-1.6 * dt);

    const wantTypingDamp = isTyping ? 0.18 : 1.0;
    typingDamp += (wantTypingDamp - typingDamp) * Math.min(1, dt * 6.0);

    // Camera parallax is depth cueing only — it is NOT the interaction.
    if (!prefersReducedMotion) {
      const amp = introActive ? 0.30 : 0.0;
      camera.position.x += (currentPointer.x * amp - camera.position.x) * Math.min(1, dt * 1.8);
      camera.position.y += (currentPointer.y * amp * 0.7 - camera.position.y) * Math.min(1, dt * 1.8);
      if (introActive && animClock < T_DNA) {
        const k = Math.min(1, animClock / T_DNA);
        camera.position.z = cameraBaseZ + 2.1 * (1 - k * k);
      } else {
        camera.position.z += (cameraBaseZ - camera.position.z) * Math.min(1, dt * 1.2);
      }
      camera.lookAt(0, 0, 0);
    }

    if (introActive) {
      resolveIntroTargets(time);
      integrate(dt, 52.0, 10.5);
    } else if (isMorphing) {
      morphClock += dt;
      const k = Math.min(1, morphClock / MORPH_DURATION);
      resolveRestTargets(time);
      for (let i = 0; i < NUM_BODIES; i++) {
        const d = morphDelay[i];
        const kk = Math.max(0, Math.min(1, (k - d) / (1 - d)));
        const e = kk * kk * (3 - 2 * kk);
        // Arc outward mid-flight: the bodies visibly travel instead of sliding.
        const arc = Math.sin(e * Math.PI);
        tX[i] = morphFromX[i] * (1 - e) + tX[i] * e + arc * 0.16 * ((i % 5) - 2) / 2;
        tY[i] = morphFromY[i] * (1 - e) + tY[i] * e;
        tZ[i] = morphFromZ[i] * (1 - e) + tZ[i] * e + arc * 0.34;
      }
      integrate(dt, 34.0, 8.0);
      if (k >= 1) isMorphing = false;
    } else {
      resolveRestTargets(time);
      integrate(dt, prefersReducedMotion ? 60.0 : 28.0, prefersReducedMotion ? 14.0 : 6.6);
    }

    updateMaterialState(dt, time);
    writeInstances(time);

    if (deepDust) { deepDust.rotation.z = time * 0.010; deepDust.position.x = currentPointer.x * 0.22; }
    if (deepDustFar) { deepDustFar.rotation.z = -time * 0.005; deepDustFar.position.x = currentPointer.x * 0.08; }

    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------------------
  // INIT
  // ---------------------------------------------------------------------------
  function hash01(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = (n + (n << 3)) | 0;
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  }

  function seedBodyConstants() {
    for (let i = 0; i < NUM_BODIES; i++) {
      // Arithmetic sequences here aliased the ambient field into visible arcs,
      // because those bodies occupy one contiguous block of indices.
      bodyPhase[i] = hash01(i * 3 + 1) * Math.PI * 2;
      bodyDepth[i] = hash01(i * 3 + 2);

      // Power-law celestial size distribution (Asteroids & Glowing Planetoids):
      // 60% micro cosmic stardust (0.35 - 0.70)
      // 28% medium rocky asteroids (0.85 - 1.65)
      // 12% radiant glowing planetoids (2.20 - 3.40)
      const rSize = hash01(i * 3 + 3);
      if (rSize < 0.68) {
        bodySize[i] = 0.32 + (rSize / 0.68) * 0.34;
      } else if (rSize < 0.945) {
        bodySize[i] = 0.78 + ((rSize - 0.68) / 0.265) * 0.62;
      } else {
        // Kept rare and much smaller: a handful of anchors for scale, not a
        // field of clipped white discs.
        bodySize[i] = 1.60 + ((rSize - 0.945) / 0.055) * 0.55;
      }

      bodyPath[i] = -1;
      bodyU[i] = 0;
      bodyFlow[i] = 1;
    }
  }

  // ---------------------------------------------------------------------------
  // AUTH CARD DOM ENHANCEMENT (Executive & Luxury Craftsmanship)
  // ---------------------------------------------------------------------------
  function enhanceAuthDom() {
    const card = document.getElementById('glassAuthCard');
    if (!card) return;

    const panels = card.querySelectorAll('.auth-mode-panel');
    for (let p = 0; p < panels.length; p++) {
      const panel = panels[p];

      // 1. The brand/status badge is deliberately not built. It repeated the
      //    brand already in the header and pushed the greeting down the page.
      //    Any copy left over from an earlier render is removed here.
      const staleBadge = panel.querySelector('.auth-brand-badge');
      if (staleBadge) staleBadge.parentNode.removeChild(staleBadge);

      // 2. Enhance input label with passwordless tag
      const label = panel.querySelector('.auth-input-label');
      if (label && !panel.querySelector('.auth-label-badge')) {
        const labelWrap = document.createElement('div');
        labelWrap.className = 'auth-label-header';
        label.parentNode.insertBefore(labelWrap, label);
        labelWrap.appendChild(label);
        const tag = document.createElement('span');
        tag.className = 'auth-label-badge';
        tag.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.2" y="10.4" width="15.6" height="9.8" rx="2.6"/><path d="M8.1 10.4V7.5a3.9 3.9 0 0 1 7.8 0v2.9"/><circle cx="12" cy="15.3" r="1.15" fill="currentColor" stroke="none"/></svg> <span>Passwordless</span>';
        labelWrap.appendChild(tag);
      }

      // 3. Inject email prefix icon inside .field-wrap
      const fieldWrap = panel.querySelector('.field-wrap');
      if (fieldWrap && !fieldWrap.querySelector('.auth-input-prefix-icon')) {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'auth-input-prefix-icon';
        iconDiv.setAttribute('aria-hidden', 'true');
        iconDiv.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.6" y="5.2" width="18.8" height="13.6" rx="2.8"/><path d="m3.6 7.6 7.5 5.1a1.6 1.6 0 0 0 1.8 0l7.5-5.1"/></svg>';
        fieldWrap.appendChild(iconDiv);
      }

      // 4. Enhance Demo Tray with rich icons
      const demoLinks = panel.querySelector('.auth-demo-links');
      if (demoLinks && !panel.dataset.demoEnhanced) {
        panel.dataset.demoEnhanced = 'true';
        const btns = demoLinks.querySelectorAll('.btn-demo-link');
        if (btns.length >= 3) {
          // A comet for the fast path, a figure drawn from four stars for the
          // candidate, a ringed body for the employer.
          btns[0].innerHTML = '<span class="demo-pill-icon">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" aria-hidden="true">'
            + '<circle cx="16.4" cy="7.6" r="2.4" fill="currentColor" stroke="none"/>'
            + '<path d="M13.9 10.1 4.2 19.8"/><path d="M10.2 8.6 7.1 11.7"/><path d="M15.4 13.8 12.3 16.9"/>'
            + '</svg></span><span>Vào nhanh</span>';
          btns[1].innerHTML = '<span class="demo-pill-icon">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round" aria-hidden="true">'
            // Five dots and four lines turned to mush at 14px; one four-point
            // star holds its shape at that size and still belongs to the sky.
            + '<path d="M12 3.2c.95 4.8 2.75 6.6 7.55 7.55-4.8.95-6.6 2.75-7.55 7.55-.95-4.8-2.75-6.6-7.55-7.55 4.8-.95 6.6-2.75 7.55-7.55z"/>'
            + '</svg></span><span>Ứng viên</span>';
          btns[2].innerHTML = '<span class="demo-pill-icon">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" aria-hidden="true">'
            + '<circle cx="12" cy="11.6" r="4.3"/>'
            + '<ellipse cx="12" cy="11.6" rx="9.1" ry="3.15" transform="rotate(-20 12 11.6)"/>'
            + '</svg></span><span>Tuyển dụng</span>';
        }
      }

      // 4b. Replace the heavy stock arrow on the primary action.
      const primary = panel.querySelector('.btn-auth-primary');
      if (primary && !primary.dataset.arrowSwapped) {
        const oldArrow = primary.querySelector('svg');
        if (oldArrow) {
          const wrap = document.createElement('span');
          wrap.className = 'btn-arrow-mark';
          wrap.setAttribute('aria-hidden', 'true');
          wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 12h15.6"/><path d="m13.4 6.2 5.8 5.8-5.8 5.8"/></svg>';
          oldArrow.parentNode.replaceChild(wrap, oldArrow);
          primary.dataset.arrowSwapped = '1';
        }
      }

      // 5. Inject security trust footer below form
      const form = panel.querySelector('form');
      if (form && !panel.querySelector('.auth-security-seal')) {
        const seal = document.createElement('div');
        seal.className = 'auth-security-seal';
        seal.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21.1c4.5-2.2 6.7-5.1 6.7-8.7V5.7L12 3.1 5.3 5.7v6.7c0 3.6 2.2 6.5 6.7 8.7z"/><path d="m9.3 12.2 1.9 1.9 3.5-3.7"/></svg><span>Mã hóa TLS 1.3 &bull; Bảo mật danh tính doanh nghiệp</span>';
        form.appendChild(seal);
      }
    }
  }

  function initEngine() {
    const container = document.getElementById('canvasContainer');
    const canvas = document.getElementById('resonanceCanvas');
    if (!canvas || !container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    try {
      seedBodyConstants();
      enhanceAuthDom();
      buildAtmosphereOverlay();

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
      camera.position.set(0, 0, cameraBaseZ);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.86;

      cardGroup = new THREE.Group();
      scene.add(cardGroup);

      scene.add(new THREE.AmbientLight(0x122042, 1.25));

      keyLight = new THREE.DirectionalLight(0xFFFFFF, 1.65);
      keyLight.position.set(-3.5, 4.2, 4.0);
      scene.add(keyLight);

      fillLight = new THREE.DirectionalLight(0x2563EB, 0.85);
      fillLight.position.set(3.0, 1.5, 2.5);
      scene.add(fillLight);

      cobaltLight = new THREE.PointLight(0x3B82F6, 1.35, 20);
      cobaltLight.position.set(0.0, -1.2, 2.6);
      scene.add(cobaltLight);

      buildEnvironment();
      // No plate: the form used to sit on a smoked glass slab, which read as a
      // blurry panel behind it. The controls are drawn entirely by bodies now,
      // so the slab has nothing left to do and is not built at all.
      buildBodyMeshes();
      buildDepthField();

      updateCameraFraming();
      computeArisGlyphTargets();

      window.addEventListener('resize', onResize);
      window.addEventListener('scroll', rebuildNanoPaths, { passive: true });
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerdown', function () { pointerHeld = true; }, { passive: true });
      window.addEventListener('pointerup', function () { pointerHeld = false; }, { passive: true });
      document.addEventListener('mouseleave', onPointerLeave);
      bindFocusTracking();

      // Fonts change metrics; re-measure once they land or the outlines will sit
      // on rects that no longer exist.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { rebuildNanoPaths(); }).catch(function () { });
      }

      const card = document.getElementById('glassAuthCard');
      currentAuthMode = (card && card.dataset.initialMode) ? card.dataset.initialMode : 'login';
      const hasSentLink = card && card.dataset.hasSentLink === 'true';

      let introSeen = false;
      try { introSeen = sessionStorage.getItem('arisAuthIntroSeen') === '1'; } catch (e) { /* private mode */ }

      if (hasSentLink) {
        window.skipIntro();
        const checkSec = document.getElementById('checkEmailSection');
        if (checkSec) checkSec.classList.add('active');
        const l = document.getElementById('formSectionLogin');
        const r = document.getElementById('formSectionRegister');
        if (l) l.style.display = 'none';
        if (r) r.style.display = 'none';
        rebuildNanoPaths();
      } else if (prefersReducedMotion) {
        window.skipIntro();
      } else {
        window.replayChoreography();
        if (introSeen) {
          // Returning within the session: join near the build beat rather than
          // making someone watch the whole opening again just to sign in.
          animClock = SHORT_INTRO_AT;
        }
        try { sessionStorage.setItem('arisAuthIntroSeen', '1'); } catch (e) { /* private mode */ }
      }

      document.body.classList.add('nano-stage-ready');
      requestAnimationFrame(simulationLoop);

    } catch (err) {
      console.warn('WebGL initialization failed, falling back to CSS static stage:', err);
      document.body.classList.add('webgl-fallback');
      const card = document.getElementById('glassAuthCard');
      if (card) { card.style.opacity = '1'; card.style.pointerEvents = 'auto'; card.style.transform = 'none'; }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEngine);
  } else {
    initEngine();
  }

})();
