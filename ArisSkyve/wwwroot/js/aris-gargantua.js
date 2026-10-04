/**
 * ArisSkyve Chat - Gargantua connection-well (B).
 * Strong pulse on typing/message, push-in on thread, cyan call halo, idle dim, peek caption.
 */
(function () {
  "use strict";
  if (window.__arisGargantuaInit) return;
  window.__arisGargantuaInit = true;

  var BASE = { speed: 1.45, motion: 1.95, glow: 1.15 };
  var LIVE = { speed: 2.85, motion: 2.9, glow: 2.05 };
  var CALL = { speed: 2.4, motion: 2.5, glow: 2.2 };
  var IDLE = { speed: 1.05, motion: 1.35, glow: 0.85 };
  var PEEK = { speed: 1.65, motion: 2.15, glow: 1.55 };
  var SCALE = "1.12";
  var boostUntil = 0;
  var callActive = false;
  var idleTimer = null;
  var signalTimer = null;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function killLegacy() {
    document.documentElement.classList.add("aris-gargantua-cinematic");
    document.body.classList.add("aris-chat-bh-stage");
    ["#canvasContainer","#resonanceCanvas",".canvas-container","#aris-constellation-canvas","canvas.aris-constellation","#arisCosmicCanvas","canvas.aris-cosmos-canvas","#arisCosmicConstellationStage","#arisConstellationStage","#cosmosCanvas","#aris-gargantua-gl","#aris-gargantua-video"].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (n) { n.style.setProperty("display", "none", "important"); });
    });
  }

  function ensureMount() {
    var root = document.getElementById("aris-gargantua-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "aris-gargantua-root";
      root.className = "aris-gargantua-root";
      root.setAttribute("aria-hidden", "true");
      document.body.insertBefore(root, document.body.firstChild);
    }
    root.innerHTML =
      '<black-hole-scene id="aris-black-hole-scene" src="/img/cosmos/black-hole/black-hole.png"' +
      ' speed="' + BASE.speed + '" motion="' + BASE.motion + '" glow="' + BASE.glow + '" scale="' + SCALE + '"' +
      ' style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></black-hole-scene>' +
      '<div class="aris-gargantua-readability"></div>' +
      '<div class="aris-bh-activity-halo" aria-hidden="true"></div>';
    return root;
  }

  function ensureSignal() {
    var signal = document.getElementById("arisBhSignal");
    if (signal) return signal;
    signal = document.createElement("div");
    signal.id = "arisBhSignal";
    signal.className = "aris-bh-signal is-connecting";
    signal.setAttribute("role", "status");
    signal.setAttribute("aria-live", "polite");
    signal.innerHTML = '<span class="aris-bh-signal-dot" aria-hidden="true"></span><span class="aris-bh-signal-label">\u0110ang k\u1ebft n\u1ed1i...</span>';
    document.body.appendChild(signal);
    return signal;
  }

  function setSignal(mode, label, transient) {
    var signal = ensureSignal();
    signal.className = "aris-bh-signal is-" + mode;
    var text = signal.querySelector(".aris-bh-signal-label");
    if (text) text.textContent = label;
    clearTimeout(signalTimer);
    if (transient) {
      signalTimer = setTimeout(function () { syncConnectionSignal(); }, 1800);
    }
  }

  function syncConnectionSignal(state) {
    if (callActive) {
      setSignal("call", "Cu\u1ed9c g\u1ecdi \u0111ang ho\u1ea1t \u0111\u1ed9ng");
      return;
    }
    var current = state || (window.ArisChat && typeof ArisChat.getConnectionState === "function"
      ? ArisChat.getConnectionState()
      : "connecting");
    if (current === "connected") setSignal("connected", "K\u1ebft n\u1ed1i th\u1eddi gian th\u1ef1c");
    else if (current === "reconnecting") setSignal("reconnecting", "\u0110ang k\u1ebft n\u1ed1i l\u1ea1i...");
    else if (current === "disconnected") setSignal("disconnected", "M\u1ea5t k\u1ebft n\u1ed1i");
    else setSignal("connecting", "\u0110ang k\u1ebft n\u1ed1i...");
  }

  function ensurePeek() {
    if (document.getElementById("arisBhPeekCaption")) return;
    var wrap = document.createElement("div");
    wrap.className = "aris-bh-peek-wrap";
    wrap.id = "arisBhPeekWrap";
    wrap.innerHTML = '<span class="aris-bh-peek-caption" id="arisBhPeekCaption" hidden></span>';
    document.body.appendChild(wrap);
    var cap = document.getElementById("arisBhPeekCaption");
    var on = "\u0110ang quan s\u00e1t \u2014 Esc \u0111\u1ec3 tho\u00e1t";

    function setPeek(v) {
      document.body.classList.toggle("aris-bh-peek", v);
      if (v) {
        clearTimeout(idleTimer);
        document.body.classList.remove("aris-bh-idle", "aris-bh-pushin");
        if (!callActive) applyScene(PEEK.speed, PEEK.motion, PEEK.glow);
      } else if (callActive) {
        applyScene(CALL.speed, CALL.motion, CALL.glow);
      } else {
        applyScene(BASE.speed, BASE.motion, BASE.glow);
        scheduleIdle();
      }
      if (cap) {
        if (v) {
          cap.hidden = false;
          cap.textContent = on;
        } else {
          cap.hidden = true;
          cap.textContent = "";
        }
      }
    }
    window.__arisBhTogglePeek = function () {
      setPeek(!document.body.classList.contains("aris-bh-peek"));
    };
    window.__arisBhSetPeek = setPeek;
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("aris-bh-peek")) setPeek(false);
    });
  }

  function bindSkyPeek() {
    var BLOCK = "a,button,input,textarea,select,label,summary,[role='button'],.navbar,.aris-navbar,.modal,.dropdown-menu,.offcanvas,.conversation-item,.chat-conversation,.message-bubble,.message-row,.composer-toolbar,.chat-composer,textarea,.emoji-picker,.dropdown-item";
    document.addEventListener("dblclick", function (e) {
      var t = e.target;
      if (t && t.closest && t.closest(BLOCK)) return;
      if (window.__arisBhTogglePeek) window.__arisBhTogglePeek();
    });
  }
  function applyScene(speed, motion, glow) {
    var scene = document.getElementById("aris-black-hole-scene");
    if (!scene) return;
    try {
      scene.setAttribute("speed", String(speed));
      scene.setAttribute("motion", String(motion));
      scene.setAttribute("glow", String(glow));
    } catch (e) {}
  }

  function scheduleIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (callActive) return;
      if (document.body.classList.contains("aris-bh-peek")) return;
      if (performance.now() < boostUntil) return;
      document.body.classList.add("aris-bh-idle");
      document.body.classList.remove("aris-bh-live", "aris-bh-call");
      applyScene(IDLE.speed, IDLE.motion, IDLE.glow);
    }, 5000);
  }

  function pulse(kind) {
    if (callActive) { scheduleIdle(); return; }
    if (reduce) {
      if (kind === "message") setSignal("activity", "Tin nh\u1eafn \u0111\u00e3 \u0111\u1ed3ng b\u1ed9", true);
      else setSignal("activity", "\u0110ang truy\u1ec1n t\u00edn hi\u1ec7u...", true);
      scheduleIdle();
      return;
    }
    var ms = kind === "message" ? 2200 : 1600;
    boostUntil = performance.now() + ms;
    document.body.classList.remove("aris-bh-idle");
    document.body.classList.add("aris-bh-live");
    applyScene(LIVE.speed, LIVE.motion, LIVE.glow);
    // force halo reflow for visibility
    var halo = document.querySelector(".aris-bh-activity-halo");
    if (halo) {
      halo.classList.remove("is-pulse");
      void halo.offsetWidth;
      halo.classList.add("is-pulse");
    }
    if (kind === "message") setSignal("activity", "Tin nh\u1eafn \u0111\u00e3 \u0111\u1ed3ng b\u1ed9", true);
    else setSignal("activity", "\u0110ang truy\u1ec1n t\u00edn hi\u1ec7u...", true);
    scheduleIdle();
  }

  function pushIn() {
    if (reduce) return;
    document.body.classList.add("aris-bh-pushin");
    setTimeout(function () { document.body.classList.remove("aris-bh-pushin"); }, 700);
    pulse("message");
    setSignal("activity", "\u0110\u00e3 m\u1edf cu\u1ed9c tr\u00f2 chuy\u1ec7n", true);
  }

  function setCall(on) {
    callActive = !!on;
    document.body.classList.toggle("aris-bh-call", callActive);
    document.body.classList.remove("aris-bh-idle");
    if (callActive) {
      applyScene(CALL.speed, CALL.motion, CALL.glow);
      setSignal("call", "Cu\u1ed9c g\u1ecdi \u0111ang ho\u1ea1t \u0111\u1ed9ng");
    } else if (document.body.classList.contains("aris-bh-peek")) {
      applyScene(PEEK.speed, PEEK.motion, PEEK.glow);
      syncConnectionSignal();
    } else {
      applyScene(BASE.speed, BASE.motion, BASE.glow);
      syncConnectionSignal();
      scheduleIdle();
    }
  }

  function bindPointerResponse() {
    if (reduce || !window.matchMedia("(pointer: fine)").matches) return;
    var tx = 0, ty = 0, ts = 0, x = 0, y = 0, strength = 0, raf = 0;
    function frame() {
      raf = 0;
      x += (tx - x) * 0.09;
      y += (ty - y) * 0.09;
      strength += (ts - strength) * 0.08;
      var scene = document.getElementById("aris-black-hole-scene");
      if (scene && typeof scene.setPointer === "function") scene.setPointer(x, y, strength);
      if (Math.abs(tx - x) > 0.002 || Math.abs(ty - y) > 0.002 || Math.abs(ts - strength) > 0.002) {
        raf = requestAnimationFrame(frame);
      }
    }
    function requestFrame() { if (!raf) raf = requestAnimationFrame(frame); }
    document.addEventListener("pointermove", function (e) {
      tx = e.clientX / Math.max(1, window.innerWidth) * 2 - 1;
      ty = e.clientY / Math.max(1, window.innerHeight) * 2 - 1;
      ts = 1;
      requestFrame();
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () {
      ts = 0;
      requestFrame();
    }, { passive: true });
  }

  function activityTick() {
    if (!callActive && boostUntil && performance.now() > boostUntil) {
      boostUntil = 0;
      document.body.classList.remove("aris-bh-live");
      if (document.body.classList.contains("aris-bh-peek")) {
        applyScene(PEEK.speed, PEEK.motion, PEEK.glow);
      } else {
        applyScene(BASE.speed, BASE.motion, BASE.glow);
        scheduleIdle();
      }
    }
    requestAnimationFrame(activityTick);
  }

  var wired = false;
  function wireChat() {
    var input = document.getElementById("composerInput");
    if (input && !input.__arisBhWired) {
      input.__arisBhWired = true;
      input.addEventListener("input", function () { pulse("typing"); });
      input.addEventListener("focus", function () { pulse("typing"); });
      wired = true;
    }
    if (window.ArisChat) {
      if (typeof ArisChat.onMessage === "function" && !window.__arisBhMsgWired) {
        window.__arisBhMsgWired = true;
        ArisChat.onMessage(function () { pulse("message"); });
      }
      if (typeof ArisChat.onTyping === "function" && !window.__arisBhTypWired) {
        window.__arisBhTypWired = true;
        ArisChat.onTyping(function () { pulse("typing"); });
      }
      if (typeof ArisChat.onConnectionState === "function" && !window.__arisBhStateWired) {
        window.__arisBhStateWired = true;
        ArisChat.onConnectionState(syncConnectionSignal);
      }
    }
    // Thread open: conversation list clicks
    if (!window.__arisBhClickWired) {
      window.__arisBhClickWired = true;
      document.addEventListener("click", function (e) {
        var row = e.target.closest(".conversation-item, [data-user-id], .chat-user-item, .thread-list-item");
        if (row && row.closest(".conversation-pane, #conversationList, .chat-sidebar")) {
          pushIn();
        }
        if (e.target.closest("#startCallBtn")) {
          setCall(true);
        }
        if (e.target.closest("#callLeaveBtn, #incomingCallDecline, #endCallBtn, .btn-end-call, [data-end-call]")) {
          setCall(false);
        }
        if (e.target.closest("#incomingCallAccept")) setCall(true);
      }, true);
    }

    var callOverlay = document.getElementById("callOverlay");
    if (callOverlay && !callOverlay.__arisBhObserved) {
      callOverlay.__arisBhObserved = true;
      new MutationObserver(function () {
        setCall(getComputedStyle(callOverlay).display !== "none");
      }).observe(callOverlay, { attributes: true, attributeFilter: ["style", "class"] });
    }
  }

  function loadScene(cb) {
    if (window.customElements && customElements.get("black-hole-scene")) { cb(); return; }
    var existing = document.querySelector("script[data-aris-bh-scene]");
    if (existing) { existing.addEventListener("load", cb); return; }
    var s = document.createElement("script");
    s.src = "/js/black-hole-scene.js";
    s.async = true;
    s.dataset.arisBhScene = "1";
    s.onload = cb;
    s.onerror = function () {
      var root = document.getElementById("aris-gargantua-root");
      if (root) {
        root.innerHTML = '<img class="aris-gargantua-plate" src="/img/cosmos/black-hole/black-hole.png" alt=""><div class="aris-gargantua-readability"></div><div class="aris-bh-activity-halo"></div>';
      }
    };
    document.head.appendChild(s);
  }

  function init() {
    killLegacy();
    ensureMount();
    ensureSignal();
    ensurePeek();
    bindSkyPeek();
    bindPointerResponse();
    loadScene(function () {
      var scene = document.getElementById("aris-black-hole-scene");
      if (!scene) return;
      try {
        applyScene(BASE.speed, BASE.motion, BASE.glow);
        scene.setAttribute("scale", SCALE);
        if (typeof scene.play === "function") scene.play();
      } catch (e) {}
    });
    setTimeout(killLegacy, 200);
    wireChat();
    setTimeout(wireChat, 500);
    setTimeout(wireChat, 2000);
    requestAnimationFrame(activityTick);
    scheduleIdle();

    window.ArisGargantua = {
      pulse: pulse,
      pushIn: pushIn,
      setCall: setCall,
      reset: function () {
        callActive = false;
        boostUntil = 0;
        document.body.classList.remove("aris-bh-live", "aris-bh-call", "aris-bh-pushin", "aris-bh-idle");
        if (document.body.classList.contains("aris-bh-peek")) applyScene(PEEK.speed, PEEK.motion, PEEK.glow);
        else applyScene(BASE.speed, BASE.motion, BASE.glow);
      }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
