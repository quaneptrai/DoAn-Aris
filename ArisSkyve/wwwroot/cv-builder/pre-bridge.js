// Runs before sections.js/templates.js/builder.js.  The legacy builder has no
// server-rendered state, so keep the target id next to its local draft.  A target
// is always explicit: never fall back to the user's first CV merely because a
// generic builder.html URL omitted ?resumeId=.
(function () {
  var DATA_KEY = "cv-builder-data";
  var TARGET_KEY = "cv-builder-resume-id";

  function validResumeId(value) {
    var id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  function rememberTarget(id) {
    if (!id) return;
    window.__cvBuilderResumeId = id;
    try { localStorage.setItem(TARGET_KEY, String(id)); } catch (_) { }
  }

  function forgetStoredTarget() {
    try { localStorage.removeItem(TARGET_KEY); } catch (_) { }
  }

  function clearDraft() {
    try { localStorage.removeItem(DATA_KEY); } catch (_) { }
  }

  var params = new URLSearchParams(location.search);
  var queryResumeId = validResumeId(params.get("resumeId"));
  if (queryResumeId) rememberTarget(queryResumeId);

  // `template` is only used by the "start from scratch" hand-off.  Ensure a
  // previous CV's local content cannot be saved into the freshly minted target.
  if (params.get("template")) {
    clearDraft();
    if (!queryResumeId) forgetStoredTarget();
    return;
  }

  // A query-string id is the only authority for an edit target.  The picker
  // renders its “continue editing” link with that id explicitly; recovering an
  // old id from localStorage here would make a generic builder.html URL update
  // the last CV that happened to be edited in this browser.
  var resumeId = queryResumeId;
  if (!resumeId) return;
  rememberTarget(resumeId);

  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/Resume/GetBuilderData?resumeId=" + encodeURIComponent(resumeId), false);
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xhr.send(null);
    if (xhr.status < 200 || xhr.status >= 300) return;

    var result = JSON.parse(xhr.responseText);
    if (result && result.hasResume && result.data) {
      localStorage.setItem(DATA_KEY, result.data);
      var resolvedResumeId = validResumeId(result.resumeId);
      if (resolvedResumeId) rememberTarget(resolvedResumeId);
      return;
    }

    // Do not render a stale draft belonging to a deleted CV or a previous signed-in
    // user.  Retain an explicit URL id so a later save fails safely rather than
    // creating/updating an unintended record.
    clearDraft();
    if (!queryResumeId) forgetStoredTarget();
  } catch (err) {
    console.warn("Could not load the selected CV, keeping the local draft.", err);
  }
})();
