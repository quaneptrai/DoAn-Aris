/*
 * Focused regression guard for B8: the standalone legacy CV builder must never
 * select the user's first resume just because its URL has no resumeId.  The
 * companion LegacyBuilderTargetingTests project exercises the controller with
 * EF InMemory; this fast source-level guard keeps the static-page hand-off from
 * reintroducing the unsafe no-id fallback.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const controller = read('ArisSkyve', 'Controllers', 'ResumeController.cs');
const preBridge = read('ArisSkyve', 'wwwroot', 'cv-builder', 'pre-bridge.js');
const postBridge = read('ArisSkyve', 'wwwroot', 'cv-builder', 'post-bridge.js');
const picker = read('ArisSkyve', 'wwwroot', 'cv-builder', 'picker.js');

const getBuilderData = controller.slice(
  controller.indexOf('public async Task<IActionResult> GetBuilderData'),
  controller.indexOf('[HttpPost("CreateBlank")]')
);
const saveBuilderData = controller.slice(
  controller.indexOf('public async Task<IActionResult> SaveBuilderData'),
  controller.indexOf('[HttpPost("AnalyzeCv")]')
);

assert.match(getBuilderData, /if \(!resumeId\.HasValue \|\| resumeId\.Value <= 0\)/,
  'GetBuilderData must reject a missing target instead of selecting the first CV');
assert.doesNotMatch(getBuilderData, /:\s*await resumeQuery\.FirstOrDefaultAsync\(\)/,
  'GetBuilderData must not contain a first-resume fallback');
assert.match(saveBuilderData, /:\s*null;/,
  'SaveBuilderData must treat a missing target as a new CV, not as FirstOrDefault');
assert.doesNotMatch(saveBuilderData, /FirstOrDefaultAsync\(r => r\.EmployeeId == user\.Profile\.Id\)/,
  'SaveBuilderData must not update the first owner CV when resumeId is absent');

assert.match(preBridge, /GetBuilderData\?resumeId=/,
  'pre-bridge must fetch only an explicit target');
assert.doesNotMatch(preBridge, /queryResumeId \|\| validResumeId\(localStorage\.getItem\(TARGET_KEY\)\)/,
  'a generic builder URL must not recover the last CV target from localStorage');
assert.match(postBridge, /rememberTarget\(json && json\.resumeId\)/,
  'post-bridge must retain the id returned after the first new-CV save');
assert.match(picker, /CreateBlank did not return a resume id/,
  'picker must reject a missing CreateBlank target');
assert.doesNotMatch(picker, /location\.href = "builder\.html\?template=" \+ encodeURIComponent\(selectedTemplateId\);/,
  'picker must not fall back to a builder URL without resumeId');

console.log('B8 legacy builder targeting guard: 9 checks passed.');
