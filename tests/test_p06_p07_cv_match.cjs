const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing P06 & P07 Single CV-JD Match Integration ---');

const repoRoot = path.resolve(__dirname, '..');
const controllerPath = path.join(repoRoot, 'ArisSkyve', 'Controllers', 'JobsController.cs');
const dtoPath = path.join(repoRoot, 'ArisSkyve', 'Application', 'DTOs', 'ScoreCvRequestDto.cs');
const detailsViewPath = path.join(repoRoot, 'ArisSkyve', 'Views', 'Jobs', 'Details.cshtml');
const jobsJsPath = path.join(repoRoot, 'ArisSkyve', 'wwwroot', 'js', 'pages', 'jobs.js');

// Test 1: ScoreCvRequestDto exists
assert(fs.existsSync(dtoPath), 'ScoreCvRequestDto.cs must exist');
const dtoContent = fs.readFileSync(dtoPath, 'utf8');
assert(dtoContent.includes('public int JobId { get; set; }'), 'DTO must contain JobId');
assert(dtoContent.includes('public int? ResumeId { get; set; }'), 'DTO must contain ResumeId');
console.log('✓ Test 1: ScoreCvRequestDto exists and is properly structured');

// Test 2: JobsController.cs endpoints & AntiForgeryToken enforcement
const controllerContent = fs.readFileSync(controllerPath, 'utf8');
assert(controllerContent.includes('public async Task<IActionResult> GetCandidateResumes()'), 'JobsController must contain GetCandidateResumes');
assert(controllerContent.includes('public async Task<IActionResult> ScoreCvForJob('), 'JobsController must contain ScoreCvForJob');
assert(controllerContent.includes('[ValidateAntiForgeryToken]'), 'ScoreCvForJob must enforce [ValidateAntiForgeryToken]');
assert(!controllerContent.includes('[IgnoreAntiforgeryToken]'), 'ScoreCvForJob must NOT bypass AntiForgery with [IgnoreAntiforgeryToken]');
console.log('✓ Test 2: JobsController has GetCandidateResumes and ScoreCvForJob actions with ValidateAntiForgeryToken');

// Test 3: Resume ownership security check & CV version tracking
assert(controllerContent.includes('resume.EmployeeId != profile.Id'), 'ScoreCvForJob must check that resume belongs to profile');
assert(controllerContent.includes('403'), 'ScoreCvForJob must return 403 Forbidden for unauthorized CV access');
assert(controllerContent.includes('cvModifiedDuringEvaluation'), 'ScoreCvForJob must check if CV was modified during evaluation');
console.log('✓ Test 3: Resume ownership check prevents unauthorized CV evaluation and tracks CV version');

// Test 4: AiCore proxy mapping and error handling
assert(controllerContent.includes('/score-cv-for-job'), 'ScoreCvForJob must call AiCore /score-cv-for-job');
assert(controllerContent.includes('posting_id = job.Id'), 'ScoreCvForJob must map posting_id');
assert(controllerContent.includes('status == "no_cv"'), 'ScoreCvForJob must handle status no_cv');
assert(controllerContent.includes('matchedSkills'), 'ScoreCvForJob must extract matched skills');
assert(controllerContent.includes('missingSkills'), 'ScoreCvForJob must extract missing skills');
assert(controllerContent.includes('evidence'), 'ScoreCvForJob must extract evidence');
console.log('✓ Test 4: JobsController proxies to AiCore, extracts skills and evidence');

// Test 5: Views/Jobs/Details.cshtml has CV Match section, Antiforgery token, and CV manager link
const detailsContent = fs.readFileSync(detailsViewPath, 'utf8');
assert(detailsContent.includes('id="cvMatchBox"'), 'Details.cshtml must contain #cvMatchBox');
assert(detailsContent.includes('cv-select'), 'Details.cshtml must contain cv-select');
assert(detailsContent.includes('btn-score-cv'), 'Details.cshtml must contain btn-score-cv');
assert(detailsContent.includes('cv-match-result'), 'Details.cshtml must contain cv-match-result');
assert(detailsContent.includes('@Html.AntiForgeryToken()'), 'Details.cshtml must emit AntiForgeryToken');
assert(detailsContent.includes('href="/Resume"'), 'Details.cshtml must contain link to CV manager');
console.log('✓ Test 5: Views/Jobs/Details.cshtml has matching box, AntiForgeryToken, and CV manage link');

// Test 6: jobs.js implements initCvMatcher with race protection, CSRF headers, and CV change reset
const jobsJs = fs.readFileSync(jobsJsPath, 'utf8');
assert(jobsJs.includes('function initCvMatcher('), 'jobs.js must define initCvMatcher');
assert(jobsJs.includes('matcherAbortController.abort()'), 'initCvMatcher must abort in-flight requests');
assert(jobsJs.includes('currentSeq !== matcherSeq'), 'initCvMatcher must ignore outdated responses');
assert(jobsJs.includes('/Jobs/ScoreCvForJob'), 'initCvMatcher must call /Jobs/ScoreCvForJob');
assert(jobsJs.includes('RequestVerificationToken'), 'initCvMatcher must pass RequestVerificationToken header');
assert(jobsJs.includes("cvSelect.addEventListener('change'"), 'initCvMatcher must handle cvSelect change event to reset stale results');
assert(jobsJs.includes('Bằng chứng đối chiếu (Evidence)'), 'initCvMatcher must render evidence quotes');
assert(jobsJs.includes('skill-chip-missing'), 'initCvMatcher must render missing skills chips');
console.log('✓ Test 6: jobs.js handles CV matching with race protection, CSRF headers, and stale result reset on CV change');

console.log('\n--- All P06 & P07 tests passed successfully! ---');
