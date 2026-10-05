/**
 * When a remote avatar/media source fails, keep the UI usable. Direct Google
 * Drive /uc URLs are rewritten to this app's same-origin media endpoint first:
 * Chrome blocks the Drive response with CORP/ORB when it is embedded here.
 */
(function () {
  "use strict";
  if (window.__arisImgFallback) return;
  window.__arisImgFallback = true;

  var DEFAULT_AVATAR = "/images/default-avatar.png";
  var DEFAULT_BROKEN = "/images/default-avatar.png";

  function driveProxyUrl(value) {
    if (!value) return "";
    try {
      var url = new URL(value, window.location.href);
      var host = String(url.hostname || "").toLowerCase();
      if (url.protocol !== "https:" || (host !== "drive.google.com" && host !== "drive.usercontent.google.com")) return "";
      var id = url.searchParams.get("id") || "";
      if (!/^[A-Za-z0-9_-]{5,256}$/.test(id)) return "";
      var videoMarker = /(?:^|[?&#])aris-media=video(?:[&#]|$)/i.test(url.hash || "") ? "#aris-media=video" : "";
      return "/media/drive/" + encodeURIComponent(id) + videoMarker;
    } catch (_) {
      return "";
    }
  }

  function rewriteDriveSource(element) {
    if (!element || !element.getAttribute) return false;
    var original = element.getAttribute("src") || "";
    var proxy = driveProxyUrl(original);
    if (!proxy || original === proxy || element.dataset.arisDriveProxyApplied === "1") return false;

    element.dataset.arisDriveProxyApplied = "1";
    element.setAttribute("src", proxy);
    if (element.tagName === "SOURCE" && element.parentElement && element.parentElement.tagName === "VIDEO") {
      element.parentElement.load();
    }
    return true;
  }

  function rewriteDriveLink(element) {
    if (!element || !element.getAttribute) return;
    var original = element.getAttribute("href") || "";
    var proxy = driveProxyUrl(original);
    if (proxy) element.setAttribute("href", proxy);
  }

  function rewriteDriveSources(root) {
    if (!root) return;
    if (root.nodeType === 1) {
      if (/^(IMG|VIDEO|SOURCE)$/.test(root.tagName)) rewriteDriveSource(root);
      if (root.tagName === "A") rewriteDriveLink(root);
    }
    if (!root.querySelectorAll) return;
    root.querySelectorAll("img[src], video[src], source[src]").forEach(rewriteDriveSource);
    root.querySelectorAll("a[href]").forEach(rewriteDriveLink);
  }

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
    // Current-user avatars are verified before their source is changed. Keep
    // the initials visible if an unexpected later load error occurs instead of
    // replacing the image and masking the root cause.
    if (img && img.dataset.arisAvatarManaged === "true") {
      img.hidden = true;
      return;
    }
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
    // This listener runs in capture phase, ahead of inline onerror handlers
    // such as `this.remove()`. Prevent that fallback from running while the
    // same asset is retried through /media/drive.
    if (t && /^(IMG|VIDEO|SOURCE)$/.test(t.tagName) && rewriteDriveSource(t)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (t && t.tagName === "IMG") fix(t);
  }

  // Capture phase so we catch errors even with other handlers
  document.addEventListener("error", onError, true);

  // Heal already-broken remote AiCore urls on load (cached error state)
  function healExisting() {
    rewriteDriveSources(document);
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

  // New posts, stories, chat bubbles, and notifications are inserted after
  // page load. Rewrite a legacy direct Drive URL before it can fall back to a
  // broken cross-site request.
  var observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      if (record.type === "attributes") {
        if (record.attributeName === "src") rewriteDriveSource(record.target);
        if (record.attributeName === "href") rewriteDriveLink(record.target);
        return;
      }
      record.addedNodes.forEach(rewriteDriveSources);
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "href"]
  });
})();
