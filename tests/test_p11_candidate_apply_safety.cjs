const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- RUNNING P11: CANDIDATE APPLY / RE-APPLY SAFETY ---');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const controller = read('ArisSkyve/Controllers/JobApplicationsController.cs');
const jobsJs = read('ArisSkyve/wwwroot/js/pages/jobs.js');
const details = read('ArisSkyve/Views/Jobs/Details.cshtml');
const index = read('ArisSkyve/Views/Jobs/Index.cshtml');
const applicationActions = read('ArisSkyve/wwwroot/js/application-actions.js');

function actionHasCsrf(actionName) {
    const pattern = new RegExp(String.raw`\[HttpPost\]\s*\[ValidateAntiForgeryToken\]\s*public async Task<IActionResult> ${actionName}\(`);
    return pattern.test(controller);
}

// Candidate mutations must be protected at the controller, not only by the browser UI.
['Apply', 'Withdraw', 'RespondToInterview'].forEach((action) =>
    assert(actionHasCsrf(action), `${action} must require an anti-forgery token`));
assert(controller.includes('screeningAnswers.Count != screeningQuestions.Count') &&
       controller.includes('screeningAnswers.Any(string.IsNullOrWhiteSpace)'),
    'Apply must enforce required screening answers server-side');
console.log('PASS: candidate mutations use CSRF validation and server-side screening validation');

// Both entry points render a request token and attach it to the JSON Apply request.
assert(index.includes('id="applyAntiforgeryForm"') && details.includes('id="applyAntiforgeryForm"'),
    'Jobs index and direct details must render an Apply anti-forgery token');
assert(jobsJs.includes('#applyAntiforgeryForm input[name="__RequestVerificationToken"]') &&
       jobsJs.includes('headers.RequestVerificationToken = token'),
    'Index Apply request must send the anti-forgery header');
assert(details.includes('#applyAntiforgeryForm input[name="__RequestVerificationToken"]') &&
       details.includes('headers.RequestVerificationToken = token'),
    'Direct-details Apply request must send the anti-forgery header');
assert(applicationActions.includes("'RequestVerificationToken': antiForgeryToken()") &&
       applicationActions.includes("'/JobApplications/Withdraw'") &&
       applicationActions.includes("'/JobApplications/RespondToInterview'"),
    'My Applications mutation requests must retain their anti-forgery header');
console.log('PASS: all candidate UI mutation paths supply an anti-forgery token');

// A repeated application stays possible by policy, but only after a deliberate confirmation.
assert(jobsJs.includes('async function openApplyDialog(jobId, confirmedReapply = false)') &&
       jobsJs.includes('data.alreadyApplied && !confirmedReapply') &&
       jobsJs.includes('id="confirmReapplyBtn"') &&
       jobsJs.includes('openApplyDialog(jobId, true)'),
    'Index must render and require an explicit re-apply confirmation');
assert(details.includes('async function openApply(confirmedReapply = false)') &&
       details.includes('data.alreadyApplied && !confirmedReapply') &&
       details.includes('id="confirmReapplyBtn"') &&
       details.includes('openApply(true)'),
    'Direct details must render and require an explicit re-apply confirmation');
assert(details.includes('data-apply data-reapply id="mainApplyBtn"'),
    'A prior applicant must still have a visible re-apply entry point on direct details');
console.log('PASS: re-apply is visible, warned, and never submitted silently');

assert(jobsJs.includes("const b = e.target.closest('[data-share-job]');") &&
       !details.includes('navigator.share') && !details.includes('navigator.clipboard'),
    'Direct details must use the shared share handler exactly once');
console.log('PASS: job sharing has one authoritative click handler');

console.log('--- P11 candidate apply safety passed (4/4) ---');
