const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- RUNNING P08 & P09 RECRUITMENT FLOW & DESK POLISH TESTS ---');

const employerJsPath = path.join(__dirname, '../ArisSkyve/wwwroot/js/pages/employer.js');
const employerCssPath = path.join(__dirname, '../ArisSkyve/wwwroot/css/pages/employer.css');
const employerViewPath = path.join(__dirname, '../ArisSkyve/Views/Employer/Index.cshtml');

const employerJsContent = fs.readFileSync(employerJsPath, 'utf8');
const employerCssContent = fs.readFileSync(employerCssPath, 'utf8');
const employerViewContent = fs.readFileSync(employerViewPath, 'utf8');

// Test 1: P08 Optimistic status update & immediate persistence
assert(employerJsContent.includes('fetch(`/JobApplications/UpdateApplicationStatus?applicationId=${app.id}`'),
    'Test 1 Failed: Status update must call /JobApplications/UpdateApplicationStatus');
assert(employerJsContent.includes('const jobIdAtOperation = currentJobId;'),
    'Test 1 Failed: Must capture jobIdAtOperation to prevent cross-job board overwriting');
assert(employerJsContent.includes('app.status = prevStatus;'),
    'Test 1 Failed: Must rollback app.status on server failure or undo');
assert(employerJsContent.includes('isUndone = true;'),
    'Test 1 Failed: Must support undo action on optimistic toast');
console.log('PASS: Test 1 - P08 Optimistic status update, rollback on failure & undo action');

// Test 2: P08 Interview scheduling validations & isolation (client & backend)
const jobAppsControllerPath = path.join(__dirname, '../ArisSkyve/Controllers/JobApplicationsController.cs');
const jobAppsControllerContent = fs.readFileSync(jobAppsControllerPath, 'utf8');
assert(jobAppsControllerContent.includes('dto.ScheduledAt < DateTime.UtcNow.AddMinutes(-5)'),
    'Test 2 Failed: JobApplicationsController must reject past interview dates');
assert(employerJsContent.includes('scheduledDate.getTime() < Date.now() - 60000'),
    'Test 2 Failed: Interview scheduling must reject past dates on client');
assert(employerJsContent.includes('const jobIdAtSchedule = currentJobId;'),
    'Test 2 Failed: Interview scheduling must capture jobIdAtSchedule');
assert(employerJsContent.includes('currentJobId === jobIdAtSchedule'),
    'Test 2 Failed: Interview scheduling must check jobIdAtSchedule before updating pipeline state');
console.log('PASS: Test 2 - P08 Interview schedule past date validation (client & backend) & job board isolation');

// Test 3: P09 Keyboard navigation and role attributes on cards
assert(employerJsContent.includes("card.setAttribute('role', 'button');"),
    'Test 3 Failed: Candidate cards must have role="button"');
assert(employerJsContent.includes("card.setAttribute('tabindex', '0');"),
    'Test 3 Failed: Candidate cards must be focusable with tabindex="0"');
assert(employerJsContent.includes("e.key === 'Enter' || e.key === ' '"),
    'Test 3 Failed: Candidate cards must open drawer on Enter or Space');
assert(employerJsContent.includes("e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')"),
    'Test 3 Failed: Candidate cards must support keyboard stage moving with Alt+Arrow');
console.log('PASS: Test 3 - P09 Candidate card keyboard accessibility and stage navigation');

// Test 4: P09 Drawer focus management and return focus
assert(employerJsContent.includes('lastFocusedElement = triggerEl || document.activeElement;'),
    'Test 4 Failed: openDrawer must store trigger element for focus restoration');
assert(employerJsContent.includes('lastFocusedElement.focus();'),
    'Test 4 Failed: closeDrawer must return focus to trigger element');
assert(employerJsContent.includes('drawer.setAttribute(\'aria-hidden\', \'false\');'),
    'Test 4 Failed: openDrawer must set aria-hidden="false"');
assert(employerJsContent.includes('drawer.setAttribute(\'aria-hidden\', \'true\');'),
    'Test 4 Failed: closeDrawer must set aria-hidden="true"');
assert(employerJsContent.includes('closeBtn.focus()'),
    'Test 4 Failed: openDrawer must transfer focus to close button');
console.log('PASS: Test 4 - P09 Drawer focus management and accessible restoration');

// Test 5: P09 Drawer backdrop, escape key, and click outside
assert(employerJsContent.includes('const backdrop = document.getElementById(\'candidateDrawerBackdrop\');'),
    'Test 5 Failed: employer.js must bind backdrop element');
assert(employerJsContent.includes("e.key === 'Escape'"),
    'Test 5 Failed: Escape key must close drawer');
assert(employerJsContent.includes('!drawer.contains(e.target) && !e.target.closest(\'.candidate-card\') && !e.target.closest(\'.modal\')'),
    'Test 5 Failed: Clicking outside drawer must close drawer safely');
console.log('PASS: Test 5 - P09 Drawer backdrop, escape key, and outside click dismissal');

// Test 6: P09 Drawer interview details and status badge
assert(employerViewContent.includes('id="drawerStatusBadge"'),
    'Test 6 Failed: Drawer must have drawerStatusBadge');
assert(employerViewContent.includes('id="drawerInterviewInfo"'),
    'Test 6 Failed: Drawer must have drawerInterviewInfo container');
assert(employerViewContent.includes('id="drawerInterviewTime"'),
    'Test 6 Failed: Drawer must display scheduled interview time');
assert(employerJsContent.includes('drawerInterviewInfo'),
    'Test 6 Failed: employer.js must populate drawerInterviewInfo when interview is scheduled');
console.log('PASS: Test 6 - P09 Drawer renders current status badge and interview details');

// Test 7: P09 Empty state handling on employer board
assert(employerJsContent.includes('Chưa có tin tuyển dụng'),
    'Test 7 Failed: employer.js must handle zero-jobs state gracefully');
assert(employerViewContent.includes('Chưa có tin tuyển dụng nào'),
    'Test 7 Failed: Views/Employer/Index.cshtml must provide empty state message');
console.log('PASS: Test 7 - P09 Context-aware empty state when employer has no jobs');

// Test 8: P09 Mobile responsiveness and viewport rules in CSS
assert(employerCssContent.includes('.candidate-drawer-backdrop'),
    'Test 8 Failed: CSS must define candidate-drawer-backdrop');
assert(employerCssContent.includes('@media (max-width: 900px)'),
    'Test 8 Failed: CSS must provide tablet/mobile breakpoints');
assert(employerCssContent.includes('@media (max-width: 480px)'),
    'Test 8 Failed: CSS must provide 390px mobile viewport styling');
assert(employerCssContent.includes('-webkit-overflow-scrolling: touch'),
    'Test 8 Failed: Pipeline board must have smooth touch scrolling');
assert(employerCssContent.includes(':focus-visible'),
    'Test 8 Failed: CSS must specify clear focus-visible outlines for keyboard users');
console.log('PASS: Test 8 - P09 CSS responsive rules for 1440px desktop and 390px mobile');

console.log('\n--- All P08 & P09 tests passed successfully (8/8)! ---');
