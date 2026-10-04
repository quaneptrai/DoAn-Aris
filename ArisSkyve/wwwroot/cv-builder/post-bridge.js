// Runs after builder.js.  It persists the legacy builder's local document while
// preserving one invariant: every update is addressed to the selected resume id.
// An id-less first save creates a new row and immediately remembers that id; it
// must never silently update the user's first CV.
(function () {
  var DEBOUNCE_MS = 1500;
  var TARGET_KEY = "cv-builder-resume-id";
  var timer = null;
  var dirty = false;
  var inFlight = false;
  var resyncAfterFlight = false;
  var changeVersion = 0;
  var statusEl = null;
  var saveBtn = null;

  function validResumeId(value) {
    var id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function rememberTarget(id) {
    id = validResumeId(id);
    if (!id) return null;
    window.__cvBuilderResumeId = id;
    try { localStorage.setItem(TARGET_KEY, String(id)); } catch (_) { }
    return id;
  }

  function ensureStatusEl() {
    if (statusEl) return statusEl;
    statusEl = document.createElement("span");
    statusEl.id = "serverSyncStatus";
    statusEl.className = "server-sync-status";
    var controls = document.querySelector(".topbar-controls");
    if (controls) controls.insertBefore(statusEl, controls.firstChild);
    return statusEl;
  }

  function setStatus(text, isError) {
    var element = ensureStatusEl();
    element.textContent = text;
    element.classList.toggle("is-error", !!isError);
  }

  // Read only the session target set by pre-bridge.js or a successful save.  Do
  // not recover an arbitrary first CV when it is absent.
  function currentResumeId() {
    return validResumeId(window.__cvBuilderResumeId);
  }

  function buildPayload() {
    var payload = { dataJson: JSON.stringify(data) };
    var resumeId = currentResumeId();
    if (resumeId) payload.resumeId = resumeId;
    return payload;
  }

  function csrfHeaders(headers) {
    if (window.ArisCsrf && typeof window.ArisCsrf.headers === "function") {
      return window.ArisCsrf.headers(headers);
    }
    return Promise.reject(new Error("CSRF token helper is unavailable"));
  }

  function pushToServer() {
    clearTimeout(timer);
    timer = null;
    if (inFlight) {
      resyncAfterFlight = true;
      return;
    }

    var savedVersion = changeVersion;
    inFlight = true;
    setStatus("Saving…", false);
    if (saveBtn) saveBtn.disabled = true;

    csrfHeaders({ "Content-Type": "application/json" })
      .then(function (headers) {
        return fetch("/Resume/SaveBuilderData", {
          method: "POST",
          headers: headers,
          body: JSON.stringify(buildPayload())
        });
      })
      .then(function (res) {
        if (!res.ok) throw new Error("Save failed (" + res.status + ")");
        return res.json();
      })
      .then(function (json) {
        // A successful endpoint response always identifies the new or updated
        // record.  Reject a malformed success response rather than lose the
        // target and risk an id-less follow-up write.
        if (!rememberTarget(json && json.resumeId)) {
          throw new Error("Save response did not include a valid resume id");
        }
        if (savedVersion === changeVersion) {
          dirty = false;
          setStatus("Saved to your profile ✓", false);
        } else {
          dirty = true;
          resyncAfterFlight = true;
          setStatus("Saving latest changes…", false);
        }
      })
      .catch(function () {
        dirty = true;
        setStatus("Couldn't save — will retry on next change", true);
      })
      .finally(function () {
        inFlight = false;
        if (saveBtn) saveBtn.disabled = false;
        if (resyncAfterFlight) {
          resyncAfterFlight = false;
          if (dirty) pushToServer();
        }
      });
  }

  // A beacon cannot carry an antiforgery header.  For an existing exact-owner
  // target, a keepalive fetch can; a new draft remains locally persisted until a
  // normal save creates its server row.
  function flushBeacon() {
    if (!dirty || !currentResumeId()) return;
    clearTimeout(timer);
    timer = null;
    var requestToken = window.ArisCsrf && typeof window.ArisCsrf.cachedToken === "function"
      ? window.ArisCsrf.cachedToken()
      : "";
    if (!requestToken) return;
    dirty = false;
    void fetch("/Resume/SaveBuilderData", {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "RequestVerificationToken": requestToken
      },
      body: JSON.stringify(buildPayload())
    }).catch(function () { });
  }

  function scheduleSync() {
    dirty = true;
    changeVersion += 1;
    clearTimeout(timer);
    timer = setTimeout(pushToServer, DEBOUNCE_MS);
  }

  var originalSaveData = window.saveData;
  if (typeof originalSaveData === "function") {
    window.saveData = function () {
      originalSaveData();
      scheduleSync();
    };
  }

  window.addEventListener("beforeunload", flushBeacon);
  window.addEventListener("pagehide", flushBeacon);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushBeacon();
  });

  function addSaveButton() {
    var exportBtn = document.getElementById("exportBtn");
    if (!exportBtn || !exportBtn.parentElement) return;
    saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.id = "serverSaveBtn";
    saveBtn.className = "btn btn-primary cv-builder-save-btn";
    saveBtn.textContent = "💾 Save";
    saveBtn.addEventListener("click", pushToServer);
    exportBtn.parentElement.insertBefore(saveBtn, exportBtn);
  }
  addSaveButton();

  var topbarLeft = document.querySelector(".topbar-left");
  if (topbarLeft) {
    var back = document.createElement("a");
    back.href = "/Profile/Index";
    back.className = "btn btn-ghost cv-builder-back-link";
    back.textContent = "← Back to profile";
    topbarLeft.insertBefore(back, topbarLeft.firstChild);
  }
})();
