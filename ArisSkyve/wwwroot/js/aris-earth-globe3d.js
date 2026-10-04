/**
 * ArisSkyve — Earth from low orbit (cinematic).
 *
 * Concept: the camera sits ~0.6 earth-radii above the surface and looks out at
 * the limb, so the planet fills the lower frame with a curved horizon and the
 * sun burns in the upper right — the reference photo framing.
 *
 * The sphere is a real textured globe (NASA day map + city lights + clouds),
 * spinning continuously about its tilted axis, so it turns a full 360° like a
 * desk globe. Dragging the empty background spins it by hand with inertia.
 */
(function () {
  "use strict";
  if (window.ArisEarthGlobe3D) return;

  var DEG = Math.PI / 180;

  var MAPS = {
    day8k: "/img/cosmos/maps/earth-day-8k.jpg",
    day4k: "/img/cosmos/maps/earth-day-4k.jpg",
    night: "/img/cosmos/maps/earth-night.jpg",
    clouds: "/img/cosmos/maps/earth-clouds.jpg",
    // R,G = tangent-space normal XY (terrain relief); B = water mask
    surface: "/img/cosmos/maps/earth-surface.jpg",
    fallback: "/img/cosmos/maps/earth.jpg"
  };

  // Framing: full centered globe (smaller), not a cropped limb.
  var VIEW = {
    desktop: { dist: 5.6, fov: 30 },
    mobile:  { dist: 6.2, fov: 34 }
  };

  // Sun sits up-right and slightly toward the camera: lit limb up-right,
  // terminator sliding off to the lower left. Matches the CSS flare position.
  var SUN_DIR = [0.80, 0.31, 0.52];

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var VERT = [
    "varying vec2 vUv;",
    "varying vec3 vN;",
    "varying vec3 vV;",
    "varying vec3 vW;",
    "varying vec3 vNO;",
    "void main(){",
    "  vUv = uv;",
    "  vNO = normalize(normal);",
    "  vec4 wp = modelMatrix * vec4(position, 1.0);",
    "  vW = wp.xyz;",
    "  vN = normalize(mat3(modelMatrix) * normal);",
    "  vV = normalize(cameraPosition - wp.xyz);",
    "  gl_Position = projectionMatrix * viewMatrix * wp;",
    "}"
  ].join("\n");

  var SURFACE_FRAG = [
    "uniform sampler2D dayMap;",
    "uniform sampler2D nightMap;",
    "uniform sampler2D cloudMap;",
    "uniform sampler2D surfMap;",
    "uniform vec3 sunDir;",
    "uniform vec3 sunTint;",
    "uniform float cloudShift;",
    "uniform float warm;",
    "uniform vec3 pole;",
    "varying vec2 vUv;",
    "varying vec3 vN;",
    "varying vec3 vV;",
    "void main(){",
    "  vec3 V = normalize(vV);",
    "  vec3 L = normalize(sunDir);",
    "",
    "  vec3 dayC = texture2D(dayMap, vUv).rgb;",
    "  vec3 surf = texture2D(surfMap, vUv).rgb;",
    "  float water = smoothstep(0.35, 0.75, surf.b);",
    "",
    "  /* relief: tangent frame around the planet's world-space pole, */",
    "  /* flattened to nothing over open water */",
    "  vec3 Ng = normalize(vN);",
    "  vec3 east = normalize(cross(pole, Ng) + vec3(1e-5));",
    "  vec3 north = cross(Ng, east);",
    "  vec2 nxy = (surf.rg * 2.0 - 1.0) * (1.0 - water) * 1.25;",
    "  float nz = sqrt(max(1.0 - dot(nxy, nxy), 0.02));",
    "  vec3 N = normalize(east * nxy.x + north * nxy.y + Ng * nz);",
    "",
    "  float ndl = dot(N, L);",
    "  float ndlG = dot(Ng, L);",
    "  float day = smoothstep(-0.16, 0.30, ndlG);",
    "  float lamb = max(ndl, 0.0);",
    "",
    "  vec3 nightC = texture2D(nightMap, vUv).rgb;",
    "  float cloud = texture2D(cloudMap, vec2(vUv.x + cloudShift, vUv.y)).r;",
    "  cloud = smoothstep(0.20, 0.93, cloud);",
    "  /* deck shadow cast a little to the anti-sun side — gives the clouds body */",
    "  float shadow = texture2D(cloudMap, vec2(vUv.x + cloudShift - 0.0045, vUv.y - 0.0022)).r;",
    "  shadow = smoothstep(0.30, 0.95, shadow) * (1.0 - cloud);",
    "",
    "  /* ocean reads darker and bluer than the map alone; land keeps its albedo */",
    "  vec3 albedo = mix(dayC * 1.04, dayC * vec3(0.62, 0.78, 1.04), water * 0.7);",
    "  vec3 lit = albedo * sunTint * (0.15 + 1.04 * lamb) * (1.0 - 0.45 * shadow);",
    "  vec3 dark = dayC * 0.05 + nightC * nightC * 1.5 * (1.0 - day);",
    "  vec3 col = mix(dark, lit, day);",
    "",
    "  /* cloud deck */",
    "  vec3 cloudCol = sunTint * (0.30 + 0.92 * max(ndlG, 0.0));",
    "  col = mix(col, cloudCol, cloud * (0.86 * day + 0.05));",
    "",
    "  /* two-lobe specular: a tight sun glint on water, a broad sheen on land */",
    "  vec3 H = normalize(L + V);",
    "  float nh = max(dot(N, H), 0.0);",
    "  float glint = pow(nh, 220.0) * water;",
    "  float sheen = pow(nh, 18.0) * (1.0 - water) * 0.12;",
    "  float viewFres = pow(1.0 - max(dot(Ng, V), 0.0), 4.0);",
    "  /* grazing water mirrors the sky — that is what kills the flat-paint look */",
    "  float mirror = water * viewFres * day * 0.38;",
    "  col += sunTint * (glint * 1.45 + sheen) * (1.0 - cloud) * day;",
    "  col += vec3(0.34, 0.55, 0.92) * mirror * (1.0 - cloud);",
    "",
    "  /* aerial perspective + warm twilight along the terminator */",
    "  float fres = pow(1.0 - max(dot(Ng, V), 0.0), 2.1);",
    "  vec3 haze = mix(vec3(0.16, 0.38, 0.88), vec3(0.78, 0.88, 1.0) * sunTint, smoothstep(0.1, 0.9, ndlG));",
    "  col += haze * fres * day * 0.66;",
    "  float term = smoothstep(-0.05, 0.16, ndlG) * (1.0 - smoothstep(0.16, 0.46, ndlG));",
    "  col += vec3(1.0, 0.48, 0.20) * term * (0.18 + fres * 0.9) * (0.30 + warm);",
    "",
    "  /* filmic roll-off: highlights bloom out, shadows keep their weight */",
    "  col = col / (col + vec3(0.88)) * 1.86;",
    "  col = clamp(col, 0.0, 1.0);",
    "  col = mix(col, col * col * (3.0 - 2.0 * col), 0.32);",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function shellMaterial(THREE, uniforms, radius, shape, gain, nightGain) {
    var norm = Math.sqrt(radius * radius - 1);
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: uniforms,
      vertexShader: VERT,
      fragmentShader: [
        "uniform vec3 sunDir;",
        "uniform vec3 sunTint;",
        "varying vec3 vW;",
        "void main(){",
        "  vec3 rd = normalize(vW - cameraPosition);",
        "  float t = dot(-cameraPosition, rd);",
        "  vec3 near = cameraPosition + rd * t;",   // closest point to planet centre
        "  float b = length(near);",
        "  float R = " + radius.toFixed(4) + ";",
        "  float depth = sqrt(max(R * R - b * b, 0.0)) / " + norm.toFixed(4) + ";",
        "  depth = pow(clamp(depth, 0.0, 1.0), " + shape.toFixed(2) + ");",
        "  float ndl = dot(normalize(near), normalize(sunDir));",
        "  float lit = smoothstep(-0.42, 0.30, ndl);",
        "  float hot = smoothstep(0.15, 0.95, ndl);",
        "  vec3 deep = vec3(0.03, 0.09, 0.26);",
        "  vec3 mid  = vec3(0.16, 0.42, 0.95);",
        "  vec3 high = vec3(0.72, 0.87, 1.0);",
        "  vec3 col = mix(deep, mid, lit);",
        "  col = mix(col, high * sunTint, hot * 0.75);",
        "  /* thin incandescent horizon line, only where the sun reaches it */",
        "  float edge = pow(depth, 6.0) * (0.04 + 1.15 * hot + 0.30 * lit);",
        "  col += vec3(1.0, 0.97, 0.92) * edge * 0.55;",
        "  float a = depth * (" + nightGain.toFixed(3) + " + " + gain.toFixed(3) + " * lit) + edge * 0.30;",
        "  gl_FragColor = vec4(col * a, a);",
        "}"
      ].join("\n")
    });
  }

  function starField(THREE) {
    var count = 420;
    var pos = new Float32Array(count * 3);
    var siz = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      var u = Math.random() * 2 - 1;
      var t = Math.random() * Math.PI * 2;
      var r = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(t) * r * 60;
      pos[i * 3 + 1] = Math.sin(t) * r * 60;
      pos[i * 3 + 2] = u * 60;
      siz[i] = Math.pow(Math.random(), 3.2) * 1.5 + 0.18;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
    var mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { pixel: { value: 1 } },
      vertexShader: [
        "attribute float aSize;",
        "uniform float pixel;",
        "varying float vA;",
        "void main(){",
        "  vA = clamp(aSize * 0.62, 0.05, 0.9);",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        "  gl_PointSize = aSize * pixel;",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying float vA;",
        "void main(){",
        "  vec2 d = gl_PointCoord - vec2(0.5);",
        "  float f = 1.0 - smoothstep(0.12, 0.5, length(d));",
        "  gl_FragColor = vec4(vec3(0.82, 0.90, 1.0), f * vA);",
        "}"
      ].join("\n")
    });
    return new THREE.Points(geo, mat);
  }

  function mount(host) {
    if (!host || !window.THREE) return null;
    var THREE = window.THREE;

    var canvas = host.querySelector("canvas.aris-earth-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "aris-earth-canvas";
      canvas.setAttribute("aria-hidden", "true");
      host.appendChild(canvas);
    }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: false,
        alpha: true,
        powerPreference: "high-performance"
      });
    } catch (e) {
      return null;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setClearColor(0x000000, 0);

    host.classList.add("is-live");

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(46, 1, 0.01, 200);

    var stars = starField(THREE);
    scene.add(stars);

    var sunDir = new THREE.Vector3(SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]).normalize();
    var shared = {
      sunDir: { value: sunDir },
      sunTint: { value: new THREE.Color(0xfff2e2) }
    };

    // latGroup (viewpoint latitude) > axisGroup (23.4° tilt) > globe (spin)
    var latGroup = new THREE.Group();
    scene.add(latGroup);
    var axisGroup = new THREE.Group();
    axisGroup.rotation.z = 18 * DEG;
    latGroup.add(axisGroup);

    var uniforms = {
      dayMap: { value: null },
      nightMap: { value: null },
      cloudMap: { value: null },
      surfMap: { value: null },
      sunDir: shared.sunDir,
      sunTint: shared.sunTint,
      cloudShift: { value: 0 },
      warm: { value: 0 },
      pole: { value: new THREE.Vector3(Math.sin(23.4 * DEG), Math.cos(23.4 * DEG), 0) }
    };

    var globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 72, 72),
      new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: VERT,
        fragmentShader: SURFACE_FRAG
      })
    );
    axisGroup.add(globe);

    // Thin airglow hugging the limb + wide halo bleeding into space.
    var airglow = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 48, 48),
      shellMaterial(THREE, shared, 1.055, 2.4, 1.15, 0.10)
    );
    var halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.22, 32, 32),
      shellMaterial(THREE, shared, 1.26, 2.6, 0.34, 0.035)
    );
    latGroup.add(airglow);
    latGroup.add(halo);

    var loader = new THREE.TextureLoader();
    function load(url, key, wrap) {
      loader.load(url, function (tex) {
        tex.wrapS = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearMipMapLinearFilter;
        tex.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
        uniforms[key].value = tex;
      }, undefined, function () {
        if (key === "dayMap" && url !== MAPS.day4k) load(MAPS.day4k, "dayMap", true);
        else if (key === "dayMap") load(MAPS.fallback, "dayMap", true);
      });
    }
    // 8K plate on roomy, capable screens; 4K everywhere else
    var big = Math.max(window.innerWidth, window.innerHeight) >= 1100 &&
      !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) &&
      (navigator.deviceMemory === undefined || navigator.deviceMemory >= 4) &&
      renderer.capabilities.maxTextureSize >= 8192;
    load(big ? MAPS.day8k : MAPS.day4k, "dayMap", true);
    load(MAPS.night, "nightMap", true);
    load(MAPS.clouds, "cloudMap", true);
    load(MAPS.surface, "surfMap", true);

    // ---- framing -----------------------------------------------------------
    var view = VIEW.desktop;
    
    function frame() {
      var w = window.innerWidth || 1280;
      var h = window.innerHeight || 720;
      view = w < 760 ? VIEW.mobile : VIEW.desktop;

      camera.fov = view.fov;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      // Pull back so the whole sphere fits with margin; aim at center.
      var d = view.dist;
      camera.position.set(0, 0.02, d);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);

      renderer.setSize(w, h, false);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      needsDraw = true;
    }

    // ---- motion ------------------------------------------------------------
    var BASE_SPIN = 0.00042;          // rad/frame — a full turn in ~4 minutes
    var lon = 2.35;                   // start over the Pacific/Asia rim
    var lat = 0;
    var spinVel = BASE_SPIN;
    var latVel = 0;
    var nudgeLon = 0, nudgeLat = 0, nudgeLonT = 0, nudgeLatT = 0;
    var cloudShift = 0;
    var alive = true;
    var dragging = false;
    var lastX = 0, lastY = 0, lastT = 0;
    var scrollBoost = 0, scrollTarget = 0;
    var lastScroll = window.scrollY || 0;

    function scrollables() {
      return document.querySelectorAll(".dash-center-feed, .dash-workspace-grid, main#mainContent, main");
    }

    function onScroll(e) {
      needsDraw = true;
      needsDraw = true;
      var sy = window.scrollY || document.documentElement.scrollTop || 0;
      scrollables().forEach(function (el) {
        if (el.scrollHeight > el.clientHeight + 40) sy = Math.max(sy, el.scrollTop);
      });
      var dy = sy - lastScroll;
      lastScroll = sy;
      scrollTarget = Math.max(-0.0022, Math.min(0.0022, dy * 0.00012));
      /* pitchBias removed — centered globe */
    }

    // Drag anywhere that is not a piece of UI — the sky and the planet itself.
    var BLOCK = "a,button,input,textarea,select,label,summary,[role=button]," +
      ".post-card,.feed-composer-card,.feed-header-bar,.feed-empty-state," +
      ".dash-right-rail,.dash-left-rail,.dashboard-reminder,.navbar,.aris-navbar," +
      "footer,.modal,.offcanvas,.dropdown-menu,.aris-earth-peek-wrap";

    function draggableTarget(t) {
      if (!t || !t.closest) return true;
      return !t.closest(BLOCK);
    }

    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.pointerType === "touch") return;   // let touch scroll the feed
      if (!draggableTarget(e.target)) return;
      dragging = true;
      document.body.classList.add("aris-earth-dragging");
      lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
      spinVel = 0;
    }

    function onMove(e) {
      needsDraw = true;
      needsDraw = true;
      if (!dragging) return;
      var now = performance.now();
      var dt = Math.max(8, now - lastT);
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY; lastT = now;

      lon -= dx * 0.0032;
      lat = Math.max(-0.62, Math.min(0.62, lat + dy * 0.0018));
      spinVel = -dx * 0.0032 * (16 / dt);
      latVel = dy * 0.0018 * (16 / dt);
      if (Math.abs(dx) > 2) document.body.classList.add("aris-earth-spun");
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("aris-earth-dragging");
      spinVel = Math.max(-0.05, Math.min(0.05, spinVel));
    }

    var inView = true;
    var needsDraw = true;
    var lastDraw = 0;
    if ("IntersectionObserver" in window) {
      try {
        var io = new IntersectionObserver(function (entries) {
          inView = !!(entries[0] && entries[0].isIntersecting);
          if (inView) needsDraw = true;
        }, { root: null, threshold: 0.02 });
        io.observe(host);
      } catch (e) {}
    }

    function tick(now) {
      if (!alive) return;
      requestAnimationFrame(tick);

      if (document.hidden || !inView) return;
      if (reduce) {
        if (needsDraw) {
          renderer.render(scene, camera);
          needsDraw = false;
        }
        return;
      }

      if (!dragging) {
        scrollBoost += (scrollTarget - scrollBoost) * 0.1;
        scrollTarget *= 0.93;
        spinVel += (BASE_SPIN - spinVel) * 0.022;
        latVel *= 0.90;
        lat += latVel;
        lat *= 0.9965;
        lon += spinVel + scrollBoost;
      }

      var moving = dragging ||
        Math.abs(spinVel - BASE_SPIN) > 0.00004 ||
        Math.abs(latVel) > 0.00002 ||
        Math.abs(scrollBoost) > 0.00001 ||
        Math.abs(scrollTarget) > 0.00001;

      // Idle drift: ~30fps. Dragging: every frame.
      if (!moving && !needsDraw && now - lastDraw < 33) return;
      lastDraw = now || performance.now();
      needsDraw = false;

      nudgeLon += (nudgeLonT - nudgeLon) * 0.06;
      nudgeLat += (nudgeLatT - nudgeLat) * 0.06;
      globe.rotation.y = lon + nudgeLon;
      latGroup.rotation.x = lat + nudgeLat;
      latGroup.updateMatrixWorld(true);
      uniforms.pole.value.set(0, 1, 0).transformDirection(globe.matrixWorld);
      stars.rotation.y = lon * 0.02;
      cloudShift = (cloudShift + 0.0000075) % 1;
      uniforms.cloudShift.value = cloudShift;

      renderer.render(scene, camera);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    scrollables().forEach(function (el) { el.addEventListener("scroll", onScroll, { passive: true }); });
    window.addEventListener("resize", frame);
    window.addEventListener("orientationchange", frame);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);

    frame();
    tick();

    return {
      dispose: function () { alive = false; renderer.dispose(); },
      pulse: function () { scrollTarget = 0.0018; needsDraw = true; },
      nudge: function (nx, ny) {
        nudgeLonT = Math.max(-0.12, Math.min(0.12, nx || 0));
        nudgeLatT = Math.max(-0.08, Math.min(0.08, ny || 0));
        needsDraw = true;
      },
      spinTo: function (radians) { lon = radians; },
      state: function () { return { lon: lon, lat: lat, spin: spinVel, dragging: dragging }; },
      sunrise: function (on) {
        shared.sunTint.value.set(on ? 0xffd7a6 : 0xfff2e2);
        uniforms.warm.value = on ? 0.55 : 0;
      }
    };
  }

  window.ArisEarthGlobe3D = { mount: mount, maps: MAPS, view: VIEW };
})();
