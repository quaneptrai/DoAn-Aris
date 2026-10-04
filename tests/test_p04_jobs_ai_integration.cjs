const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing P04 Jobs AI Integration ---');

const repoRoot = path.resolve(__dirname, '..');
const indexViewPath = path.join(repoRoot, 'ArisSkyve', 'Views', 'Jobs', 'Index.cshtml');
const jobsJsPath = path.join(repoRoot, 'ArisSkyve', 'wwwroot', 'js', 'pages', 'jobs.js');

// Test 1: Views/Jobs/Index.cshtml has AI tab controls
const indexHtml = fs.readFileSync(indexViewPath, 'utf8');
assert(indexHtml.includes('id="tabAllJobs"'), 'Index.cshtml must have #tabAllJobs');
assert(indexHtml.includes('id="tabAiJobs"'), 'Index.cshtml must have #tabAiJobs');
assert(indexHtml.includes('id="paneAllJobs"'), 'Index.cshtml must have #paneAllJobs');
assert(indexHtml.includes('id="paneAiJobs"'), 'Index.cshtml must have #paneAiJobs');
assert(indexHtml.includes('id="aiRecommendationsContent"'), 'Index.cshtml must have #aiRecommendationsContent');
assert(indexHtml.includes('id="refreshAiBtn"'), 'Index.cshtml must have #refreshAiBtn');
console.log('✓ Test 1: Views/Jobs/Index.cshtml has AI tab controls, panes, and containers');

// Test 2: jobs.js handles tab switching
const jobsJs = fs.readFileSync(jobsJsPath, 'utf8');
assert(jobsJs.includes('switchJobsTab'), 'jobs.js must implement switchJobsTab');
assert(jobsJs.includes("tab === 'ai'"), 'jobs.js switchJobsTab must support ai tab');
assert(jobsJs.includes("loadAiRecommendations()"), 'jobs.js switchJobsTab must trigger loadAiRecommendations');
console.log('✓ Test 2: jobs.js correctly handles tab switching to AI view');

// Test 3: jobs.js uses AbortController & sequence token to prevent race conditions
assert(jobsJs.includes('aiAbortController.abort()'), 'jobs.js must abort previous in-flight AI recommendation calls');
assert(jobsJs.includes('currentSeq = ++aiSeq'), 'jobs.js must increment sequence token for AI loading');
assert(jobsJs.includes('if (currentSeq !== aiSeq) return;'), 'jobs.js must ignore outdated AI responses');
console.log('✓ Test 3: jobs.js uses AbortController and sequence tokens to prevent race conditions');

assert(jobsJs.includes('window.refreshAiRecommendations = () => loadAiRecommendations(true);'), 'jobs.js must expose window.refreshAiRecommendations');
assert(jobsJs.includes("force ? '&force=true' : ''"), 'jobs.js loadAiRecommendations must pass force param');
assert(jobsJs.includes('onclick="refreshAiRecommendations()"'), 'jobs.js must wire retry button to refreshAiRecommendations');

// CV-match vector-pending retry targets the actual locally scoped score control.
assert(!jobsJs.includes("getElementById('scoreCvBtn')"), 'jobs.js must not target the nonexistent #scoreCvBtn');
assert(jobsJs.includes('data-retry-score-cv'), 'jobs.js must render a retry marker for vector-pending CV matching');
assert(jobsJs.includes("resultBox.querySelector('[data-retry-score-cv]')"), 'jobs.js must bind vector-pending retry within its result box');
assert(jobsJs.includes('scoreBtn.isConnected'), 'jobs.js must handle a detached score control gracefully');
assert(jobsJs.includes('scoreBtn.click()'), 'jobs.js must retry using the actual CV score control');
console.log('✓ Test 4: jobs.js has error handling with retry, force refresh parameter, and global refresh handler');

// Test 5: jobs.js handles click on AI recommendation cards to select job
assert(jobsJs.includes("aiContent?.addEventListener('click'"), 'jobs.js must attach click listener to aiContent');
assert(jobsJs.includes("selectJob(jobId)"), 'jobs.js must call selectJob when recommendation is clicked');
console.log('✓ Test 5: jobs.js integrates card selection with detail pane');

console.log('\n--- All P04 tests passed successfully! ---');
