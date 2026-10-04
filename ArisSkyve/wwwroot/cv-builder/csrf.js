// The classic CV builder is a static page, so it does not receive the Razor
// layout's hidden antiforgery field.  Its authenticated session endpoint issues
// the normal request token and antiforgery cookie together before any mutation.
(function () {
  var cachedToken = "";
  var pendingToken = null;

  function requestToken() {
    if (cachedToken) return Promise.resolve(cachedToken);
    if (!pendingToken) {
      pendingToken = fetch("/api/resume-engine/session", { credentials: "same-origin" })
        .then(function (response) {
          if (!response.ok) throw new Error("Unable to obtain an antiforgery token (" + response.status + ")");
          return response.json();
        })
        .then(function (payload) {
          if (!payload || typeof payload.token !== "string" || !payload.token) {
            throw new Error("The antiforgery token response was invalid");
          }
          cachedToken = payload.token;
          return cachedToken;
        })
        .finally(function () { pendingToken = null; });
    }
    return pendingToken;
  }

  function headers(existingHeaders) {
    return requestToken().then(function (token) {
      var next = Object.assign({}, existingHeaders || {});
      next.RequestVerificationToken = token;
      return next;
    });
  }

  window.ArisCsrf = window.ArisCsrf || {};
  window.ArisCsrf.requestToken = requestToken;
  window.ArisCsrf.headers = headers;
  window.ArisCsrf.cachedToken = function () { return cachedToken; };
})();
