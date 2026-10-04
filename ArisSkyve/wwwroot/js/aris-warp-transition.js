/**
 * ARIS scene bridge: Earth <-> Gargantua.
 * Components are pulled into the current scene, navigation stays native, and
 * the destination casts the same components back out from the portal.
 */
(function () {
  "use strict";
  if (typeof window === "undefined" || window.__arisWarpInitialized) return;
  window.__arisWarpInitialized = true;

  var STORAGE_KEY = "aris-scene-transition";
  var OUT_MS = 980;
  var IN_MS = 920;
  var leaving = false;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function isChatPath(pathname) {
    return /^\/chat(?:\/|$)/i.test(pathname || "");
  }

  function isEarthPage() {
    return document.body.classList.contains("aris-home-earth-stage") ||
      !!document.querySelector("#aris-earth-root, .aris-earth-root, .dashboard-page");
  }

  function sceneName() {
    if (isChatPath(location.pathname) || document.body.classList.contains("aris-chat-bh-stage")) return "hole";
    if (isEarthPage()) return "earth";
    return "page";
  }

  function portal() {
    var el = document.getElementById("arisScenePortal");
    if (!el) {
      el = document.createElement("div");
      el.id = "arisScenePortal";
      el.className = "aris-scene-portal";
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
    }
    return el;
  }

  function uniqueNodes(selectors) {
    var seen = new Set();
    var nodes = [];
    selectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (node) {
        if (!seen.has(node) && node.getClientRects().length) {
          seen.add(node);
          nodes.push(node);
        }
      });
    });
    return nodes.slice(0, 26);
  }

  function pieces(scene) {
    if (scene === "hole") {
      return uniqueNodes([
        "body > nav", ".aris-navbar", ".conversation-pane", ".thread-pane",
        ".aris-bh-signal", ".incoming-call-toast"
      ]);
    }
    if (scene === "earth") {
      return uniqueNodes([
        "body > nav", ".dashboard-heading", ".feed-composer-card",
        ".feed-header-bar", ".post-card", ".profile-rail-card",
        ".jobs-rail-card", "body > footer"
      ]);
    }
    return uniqueNodes([
      "body > nav", "main > .container", "main > .container-fluid",
      "main > section", "main > article", "body > footer"
    ]);
  }

  function preparePieces(nodes, entering) {
    var cx = window.innerWidth * 0.5;
    var cy = window.innerHeight * 0.48;
    nodes.forEach(function (node, index) {
      var rect = node.getBoundingClientRect();
      var nodeX = rect.left + rect.width * 0.5;
      var nodeY = rect.top + rect.height * 0.5;
      var dx = cx - nodeX;
      var dy = cy - nodeY;
      var side = nodeX < cx ? -1 : 1;
      var rotation = Math.max(-8, Math.min(8, dx / 90));
      node.style.setProperty("--aris-pull-x", dx.toFixed(1) + "px");
      node.style.setProperty("--aris-pull-y", dy.toFixed(1) + "px");
      node.style.setProperty("--aris-drift-x", (dx * 0.12).toFixed(1) + "px");
      node.style.setProperty("--aris-drift-y", (dy * 0.12).toFixed(1) + "px");
      node.style.setProperty("--aris-cast-x", (side * (22 + index % 4 * 7)) + "px");
      node.style.setProperty("--aris-cast-y", ((index % 3 - 1) * 12) + "px");
      node.style.setProperty("--aris-warp-rotate", rotation.toFixed(2) + "deg");
      node.style.setProperty("--aris-warp-delay", Math.min(index, 12) * (entering ? 24 : 18) + "ms");
      node.classList.add("aris-transition-piece");
    });
  }

  function clearPieces(nodes) {
    Array.from(nodes).forEach(function (node) {
      node.classList.remove("aris-transition-piece");
      ["--aris-pull-x", "--aris-pull-y", "--aris-drift-x", "--aris-drift-y", "--aris-cast-x", "--aris-cast-y", "--aris-warp-rotate", "--aris-warp-delay"]
        .forEach(function (name) { node.style.removeProperty(name); });
    });
  }

  function transitionTarget(event) {
    if (event.defaultPrevented || event.button !== 0) return null;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
    var anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!anchor || anchor.hasAttribute("download") || anchor.dataset.noWarp != null) return null;
    if (anchor.target && anchor.target !== "_self") return null;
    if (anchor.getAttribute("data-bs-toggle") || anchor.getAttribute("data-bs-dismiss") || anchor.getAttribute("role") === "button") return null;
    var raw = anchor.getAttribute("href") || "";
    if (!raw || raw.charAt(0) === "#" || /^(javascript|mailto|tel|sms|blob|data):/i.test(raw)) return null;
    if (anchor.origin !== location.origin) return null;
    if (anchor.pathname === location.pathname && anchor.search === location.search) return null;

    var from = sceneName();
    var to = isChatPath(anchor.pathname) ? "hole" : (/^\/dashboard(?:\/|$)/i.test(anchor.pathname) ? "earth" : "page");
    if (!((from === "earth" && to === "hole") || from === "hole")) return null;
    return { href: anchor.href, from: from, to: to };
  }

  function leave(target) {
    if (leaving) return;
    leaving = true;
    if (reduce) { location.href = target.href; return; }

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ from: target.from, to: target.to, at: Date.now() }));
    } catch (_) {}

    var nodes = pieces(target.from);
    preparePieces(nodes, false);
    portal();
    if (target.from === "hole") {
      var outgoingHole = document.getElementById("aris-black-hole-scene");
      if (outgoingHole) {
        outgoingHole.setAttribute("speed", "3.4");
        outgoingHole.setAttribute("motion", "3");
        outgoingHole.setAttribute("glow", "2.7");
      }
      if (window.ArisGargantua && typeof window.ArisGargantua.pulse === "function") {
        window.ArisGargantua.pulse("message");
      }
    }
    document.documentElement.setAttribute("aria-busy", "true");
    document.body.classList.add("aris-scene-leaving", "aris-leave-" + target.from);

    var jumped = false;
    function jump() {
      if (jumped) return;
      jumped = true;
      location.href = target.href;
    }
    setTimeout(jump, OUT_MS);
    setTimeout(jump, OUT_MS + 700);
  }

  function readArrival() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || Date.now() - data.at > 6000) return null;
      if (data.to === "hole" && !isChatPath(location.pathname)) return null;
      if (data.to === "earth" && !isEarthPage()) return null;
      return data;
    } catch (_) { return null; }
  }

  function arrive(data) {
    if (!data || reduce) return;
    var here = sceneName();
    var nodes = pieces(here);
    preparePieces(nodes, true);
    portal();
    if (here === "hole") {
      var arrivingHole = document.getElementById("aris-black-hole-scene");
      if (arrivingHole) {
        arrivingHole.setAttribute("speed", "3.2");
        arrivingHole.setAttribute("motion", "3");
        arrivingHole.setAttribute("glow", "2.6");
      }
    }
    document.documentElement.setAttribute("aria-busy", "true");
    document.body.classList.add("aris-scene-entering", "aris-enter-from-" + data.from);

    setTimeout(function () {
      document.body.classList.remove("aris-scene-entering", "aris-enter-from-" + data.from);
      document.documentElement.removeAttribute("aria-busy");
      clearPieces(nodes);
      if (here === "hole" && window.ArisGargantua && typeof window.ArisGargantua.reset === "function") {
        window.ArisGargantua.reset();
      }
      var scenePortal = document.getElementById("arisScenePortal");
      if (scenePortal) scenePortal.remove();
    }, IN_MS + 340);
  }

  document.addEventListener("click", function (event) {
    var target = transitionTarget(event);
    if (!target) return;
    event.preventDefault();
    leave(target);
  }, true);

  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    leaving = false;
    document.documentElement.removeAttribute("aria-busy");
    document.body.classList.remove("aris-scene-leaving", "aris-leave-earth", "aris-leave-hole");
    clearPieces(document.querySelectorAll(".aris-transition-piece"));
    var scenePortal = document.getElementById("arisScenePortal");
    if (scenePortal) scenePortal.remove();
  });

  function boot() { arrive(readArrival()); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
