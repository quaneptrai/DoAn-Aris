/**
 * ArisSkyve Home — the orbital Earth stage.
 * Mounts the WebGL globe, keeps the app shell transparent over it, and wires
 * the small narrative beats: job spotlight, post ripple, interview golden hour,
 * and a peek mode that clears the feed so you can just watch the planet turn.
 */
(function () {
  "use strict";
  if (window.__arisEarthInit) return;
  window.__arisEarthInit = true;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


  // sun → centre axis positions, sizes and opacities of the lens ghosts
  var GHOSTS = [
    { p: 0.22, s: "18px", o: 0.28, cls: "" },
    { p: 0.38, s: "46px", o: 0.16, cls: "is-warm" },
    { p: 0.52, s: "26px", o: 0.22, cls: "" },
    { p: 0.72, s: "92px", o: 0.1, cls: "is-veil" },
    { p: 0.95, s: "34px", o: 0.18, cls: "is-warm" },
    { p: 1.18, s: "140px", o: 0.07, cls: "is-veil" },
    { p: 1.42, s: "22px", o: 0.14, cls: "" }
  ];

  function ghostMarkup() { return ''; }

  function stageMarkup() {
    return '' +
      '<div class="aris-earth-space"></div>' +
      '<div class="aris-earth-stars"></div>' +
      '<div class="aris-earth-stage" id="arisEarthGlobeHost">' +
        '<div class="aris-earth-fallback"></div>' +
      '</div>' +
      '<div class="aris-earth-airbleed"></div>' +
      '<div class="aris-earth-vignette"></div>' +
      '<div class="aris-earth-grain"></div>' +
      
      '' +
      '<div class="aris-earth-readability"></div>' +
      '<div class="aris-earth-spotlight" hidden></div>' +
      '<div class="aris-earth-ripple" hidden></div>';
  }

  function clearShell() {
    document.documentElement.classList.add("aris-earth-cinematic");
    document.body.classList.add("aris-home-earth-stage");
    document.documentElement.style.setProperty("background", "transparent", "important");
    document.body.style.setProperty("background", "transparent", "important");
    document.body.style.setProperty("background-image", "none", "important");
    document.body.style.setProperty("background-color", "transparent", "important");
    var haze = document.querySelector(".aris-volumetric-haze");
    if (haze) haze.style.setProperty("opacity", "0.08", "important");
    var main = document.getElementById("mainContent") || document.querySelector("main");
    if (main) main.style.setProperty("background", "transparent", "important");
  }

  function ensureMount() {
    clearShell();
    var root = document.getElementById("aris-earth-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "aris-earth-root";
      root.className = "aris-earth-root";
      root.setAttribute("aria-hidden", "true");
      document.body.insertBefore(root, document.body.firstChild);
    }
    // The view ships the same skeleton; only fill in if it is missing.
    if (!root.querySelector(".aris-earth-stage")) root.innerHTML = stageMarkup();
    if (false && !root.querySelector(".aris-earth-ghosts")) {
      // ghosts disabled for perf
    }
    return root;
  }

  function ensurePeek() {
    if (document.getElementById("arisEarthPeekCaption")) return;
    var wrap = document.createElement("div");
    wrap.className = "aris-earth-peek-wrap";
    wrap.id = "arisEarthPeekWrap";
    wrap.innerHTML = '<span class="aris-earth-peek-caption" id="arisEarthPeekCaption" hidden></span>';
    document.body.appendChild(wrap);

    var cap = document.getElementById("arisEarthPeekCaption");
    var labelOn = "\u0110ang xoay \u2014 Esc \u0111\u1ec3 tho\u00e1t";

    function setPeek(on) {
      document.body.classList.toggle("aris-earth-peek", on);
      if (cap) {
        if (on) {
          cap.hidden = false;
          cap.textContent = labelOn;
        } else {
          cap.hidden = true;
          cap.textContent = "";
        }
      }
    }
    window.__arisEarthTogglePeek = function () {
      setPeek(!document.body.classList.contains("aris-earth-peek"));
    };
    window.__arisEarthSetPeek = setPeek;
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("aris-earth-peek")) setPeek(false);
    });
  }
  function bindGlobe() {
    var host = document.getElementById("arisEarthGlobeHost") || document.querySelector(".aris-earth-stage");
    if (!host) return;

    function start() {
      if (!window.ArisEarthGlobe3D || !window.THREE) return false;
      window.__arisEarthGlobe = window.ArisEarthGlobe3D.mount(host);
      return !!window.__arisEarthGlobe;
    }

    if (!start()) {
      var tries = 0;
      var t = setInterval(function () {
        tries++;
        if (start() || tries > 40) clearInterval(t);
      }, 100);
    }
  }

  function bindJobSpotlight() {
    var spot = document.querySelector(".aris-earth-spotlight");
    if (!spot) return;
    var sel = ".jobs-rail-card a, .jobs-rail-card li, .jobs-rail-card, .job-card, .profile-rail-card, .post-card, a[href*='/Jobs/'], a[href*='/Job']";

    function moveTo(el) {
      var r = el.getBoundingClientRect();
      spot.hidden = false;
      spot.classList.add("is-on");
      spot.style.left = r.left + r.width / 2 + "px";
      spot.style.top = r.top + r.height / 2 + "px";
      document.body.classList.add("aris-earth-spotlight-active");
    }
    function clear() {
      spot.classList.remove("is-on");
      document.body.classList.remove("aris-earth-spotlight-active");
      setTimeout(function () { if (!spot.classList.contains("is-on")) spot.hidden = true; }, 280);
    }

    document.addEventListener("pointerover", function (e) {
      var el = e.target.closest && e.target.closest(sel);
      if (el) moveTo(el);
    }, true);
    document.addEventListener("pointerout", function (e) {
      var el = e.target.closest && e.target.closest(sel);
      if (el && !el.contains(e.relatedTarget)) clear();
    }, true);
  }

  function ripple() {
    var el = document.querySelector(".aris-earth-ripple");
    if (!el) return;
    el.hidden = false;
    el.classList.remove("is-fire");
    void el.offsetWidth;
    el.classList.add("is-fire");
    if (window.__arisEarthGlobe && window.__arisEarthGlobe.pulse) window.__arisEarthGlobe.pulse();
    setTimeout(function () { el.classList.remove("is-fire"); el.hidden = true; }, 760);
  }

  function bindPostRipple() {
    function maybe(msg, type) {
      var t = String(type || "") + " " + String(msg || "");
      if (/success|thanh cong|thành công|đăng|dang bai/i.test(t)) ripple();
    }
    if (typeof window.showToast === "function") {
      var _toast = window.showToast;
      window.showToast = function (msg, type) { maybe(msg, type); return _toast.apply(this, arguments); };
    }
    if (window.fetch && !window.__arisEarthFetchPatched) {
      window.__arisEarthFetchPatched = true;
      var _fetch = window.fetch.bind(window);
      window.fetch = function (input) {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        return _fetch.apply(this, arguments).then(function (res) {
          if (/CreatePost/i.test(url)) {
            res.clone().json().then(function (j) { if (j && j.success) ripple(); }).catch(function () {});
          }
          return res;
        });
      };
    }
  }

  function sunrise(on) {
    document.body.classList.toggle("aris-earth-sunrise", !!on);
    if (window.__arisEarthGlobe && window.__arisEarthGlobe.sunrise) window.__arisEarthGlobe.sunrise(!!on);
  }

  function bindInterviewSunrise() {
    if (!document.querySelector(".dashboard-reminder")) return;
    // wait for the globe so the shader tint lands too
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (window.__arisEarthGlobe || tries > 50) {
        clearInterval(t);
        sunrise(true);
      }
    }, 100);
  }


  function bindCursorParallax() {
    if (reduce) return;
    var raf = 0;
    var nx = 0, ny = 0;
    document.addEventListener("pointermove", function (e) {
      nx = (e.clientX / window.innerWidth - 0.5) * 2;
      ny = (e.clientY / window.innerHeight - 0.5) * 2;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var g = window.__arisEarthGlobe;
        if (g && g.nudge) g.nudge(nx * 0.1, -ny * 0.07);
      });
    }, { passive: true });
  }

  function bindComposerPulse() {
    var input = document.getElementById("postInput") || document.querySelector("textarea.composer-textarea");
    if (!input) return;
    var cool = 0;
    function beat() {
      var now = Date.now();
      if (now - cool < 420) return;
      cool = now;
      var g = window.__arisEarthGlobe;
      if (g && g.pulse) g.pulse();
      document.body.classList.add("aris-earth-live");
      clearTimeout(beat._t);
      beat._t = setTimeout(function () { document.body.classList.remove("aris-earth-live"); }, 900);
    }
    input.addEventListener("focus", beat);
    input.addEventListener("input", beat);
  }

  function bindSkyGrabHint() {
    var BLOCK = "a,button,input,textarea,select,label,summary,[role='button'],.post-card,.feed-composer-card,.profile-rail-card,.jobs-rail-card,.dashboard-heading,.navbar,.aris-navbar,.modal,.dropdown-menu,.composer-toolbar,.feed-header-bar";
    document.addEventListener("pointermove", function (e) {
      var t = e.target;
      var overUi = t && t.closest && t.closest(BLOCK);
      document.body.classList.toggle("aris-earth-can-grab", !overUi);
    }, { passive: true });
    document.addEventListener("dblclick", function (e) {
      var t = e.target;
      if (t && t.closest && t.closest(BLOCK)) return;
      if (window.__arisEarthTogglePeek) window.__arisEarthTogglePeek();
    });
  }

  function init() {
    ensureMount();
    ensurePeek();
    bindGlobe();
    bindJobSpotlight();
    bindPostRipple();
    bindInterviewSunrise();
    bindCursorParallax();
    bindComposerPulse();
    bindSkyGrabHint();
    window.ArisEarth = {
      ripple: ripple,
      sunrise: sunrise,
      reduced: reduce
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
