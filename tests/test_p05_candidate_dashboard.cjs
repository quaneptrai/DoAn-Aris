const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing P05 Candidate Dashboard Overview ---');

const repoRoot = path.resolve(__dirname, '..');
const controllerPath = path.join(repoRoot, 'ArisSkyve', 'Controllers', 'DashboardController.cs');
const viewPath = path.join(repoRoot, 'ArisSkyve', 'Views', 'Dashboard', 'Index.cshtml');

const controllerContent = fs.readFileSync(controllerPath, 'utf8');
const viewContent = fs.readFileSync(viewPath, 'utf8');

// Test 1: DashboardController computes AppliedCount, HasCv, UpcomingInterview
assert(controllerContent.includes('ViewBag.HasCv = hasCv;'), 'Controller must set ViewBag.HasCv');
assert(controllerContent.includes('ViewBag.AppliedCount ='), 'Controller must set ViewBag.AppliedCount');
assert(controllerContent.includes('ViewBag.UpcomingInterview ='), 'Controller must set ViewBag.UpcomingInterview');
console.log('✓ Test 1: DashboardController computes candidate metrics');

// Test 2: DashboardController adds actionable todos for candidate
assert(controllerContent.includes('todos.Add(new("file-plus-2", "Tạo CV đầu tiên"'), 'Controller must prompt to create CV if !hasCv');
assert(controllerContent.includes('todos.Add(new("sparkles", "Việc làm phù hợp CV", "Khám phá các vị trí được Aris AI gợi ý riêng cho bạn", "/Jobs?tab=ai", "Xem gợi ý"));'), 'Controller must prompt to view AI jobs if hasCv');
assert(controllerContent.includes('todos.Add(new("send", $"{ViewBag.AppliedCount} hồ sơ đã nộp"'), 'Controller must prompt to track applications if appliedCount > 0');
console.log('✓ Test 2: DashboardController adds targeted todos for candidates');

// Test 3: Views/Dashboard/Index.cshtml displays application count and profile stats
assert(viewContent.includes('href="/JobApplications/MyApplications">Đơn nộp <b class="a-num">@(ViewBag.AppliedCount ?? 0)</b>'), 'View must display applied count badge');
assert(viewContent.includes('Hồ sơ <b class="a-num">@profilePercent%</b>'), 'View must display profile completion percentage');
console.log('✓ Test 3: Views/Dashboard/Index.cshtml renders applied count and profile stats');

console.log('\n--- All P05 tests passed successfully! ---');
