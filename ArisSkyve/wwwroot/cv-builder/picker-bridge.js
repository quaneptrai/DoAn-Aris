// Runs before picker.js. The Profile page's "Create CV from scratch" link points
// here with ?scratch=1 — clear any local draft first so picker.js's "Welcome
// back — continue your CV?" banner doesn't reappear with old data, and so the
// template the user picks next starts genuinely blank.
(function () {
  var params = new URLSearchParams(location.search);
  if (params.get("scratch") === "1") {
    localStorage.removeItem("cv-builder-data");
    // The local draft and its server target are a pair.  Keeping the old id here
    // would let a newly chosen template inherit an unrelated CV's save target.
    localStorage.removeItem("cv-builder-resume-id");
  }

  var topbarLeft = document.querySelector(".topbar-left");
  if (topbarLeft) {
    var back = document.createElement("a");
    back.href = "/Profile/Index";
    back.className = "btn btn-ghost cv-builder-back-link";
    back.textContent = "← Back to profile";
    topbarLeft.appendChild(back);
  }
})();
