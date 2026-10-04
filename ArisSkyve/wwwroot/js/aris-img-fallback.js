/**
 * When AiCore (localhost:8001) is down, remote avatars/media 404.
 * Swap broken imgs to local defaults so the UI stays usable.
 */
(function () {
  "use strict";
  if (window.__arisImgFallback) return;
  window.__arisImgFallback = true;

  var DEFAULT_AVATAR = "/images/default-avatar.png";
  var DEFAULT_BROKEN = "/images/default-avatar.png";

  function isAvatar(img) {
    if (!img) return false;
    if (img.id === "navAvatar") return true;
    var cls = img.className || "";
    if (/avatar|rounded-circle|profile-rail|msg-avatar|chat-head/i.test(cls)) return true;
    if (/avatar/i.test(img.getAttribute("alt") || "")) return true;
    var w = parseInt(img.getAttribute("width") || "0", 10);
    var h = parseInt(img.getAttribute("height") || "0", 10);
    if (w && h && w <= 96 && h <= 96) return true;
    return false;
  }

  function fix(img) {
    if (!img || img.dataset.arisFallbackApplied === "1") return;
    var src = img.currentSrc || img.src || "";
    // already on default
    if (src.indexOf("default-avatar") !== -1) {
      img.dataset.arisFallbackApplied = "1";
      return;
    }
    img.dataset.arisFallbackApplied = "1";
    img.onerror = null;
    img.src = isAvatar(img) ? DEFAULT_AVATAR : DEFAULT_BROKEN;
    img.classList.add("aris-img-fallback");
  }

  function onError(e) {
    var t = e.target;
    if (t && t.tagName === "IMG") fix(t);
  }

  // Capture phase so we catch errors even with other handlers
  document.addEventListener("error", onError, true);

  // Heal already-broken remote AiCore urls on load (cached error state)
  function healExisting() {
    document.querySelectorAll('img[src*="localhost:8001"], img[src*="/storage/"]').forEach(function (img) {
      if (!img.complete) return;
      // naturalWidth 0 => failed decode/load
      if (img.naturalWidth === 0) fix(img);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", healExisting);
  } else {
    healExisting();
  }
  window.addEventListener("load", healExisting);
})();