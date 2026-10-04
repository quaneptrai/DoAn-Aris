const { execSync } = require('child_process');
const path = require('path');

const testFiles = [
    'test_p01_applicants_contract.cjs',
    'test_p02_recommendations_contract.cjs',
    'test_p03_payload_persistence.cjs',
    'test_p04_jobs_ai_integration.cjs',
    'test_p05_candidate_dashboard.cjs',
    'test_p06_p07_cv_match.cjs',
    'test_r1_details_cv_matcher.cjs',
    'test_r2_r3_r5_r6_cache_tracking.cjs',
    'test_r4_r7_recruitment_coordination.cjs',
    'test_r4_r5_r6_r2_edge_cases.cjs',
    'test_p08_p09_recruitment_flow.cjs',
    'test_f7_backend_behavioral.cjs',
    'test_p10_rejection_gap_flow.cjs',
    'test_p11_candidate_apply_safety.cjs',
    'test_p12_employer_csrf_contract.cjs',
    'test_csrf_global_coverage.cjs',
    'test_security_runtime_hardening.cjs',
    'test_health_endpoints.cjs',
    'test_public_media_hardening.cjs',
    'runtime_e2e_local.cjs'
];

console.log('===============================================================');
console.log('   ARIS & AICORE INTEGRATION TEST SUITE RUNNER (P01 - P12)     ');
console.log('===============================================================\n');

let totalPassed = 0;
let totalFailed = 0;

for (const testFile of testFiles) {
    const fullPath = path.join(__dirname, testFile);
    console.log(`>>> Running ${testFile}...`);
    try {
        const output = execSync(`node "${fullPath}"`, { encoding: 'utf8' });
        console.log(output.trim());
        totalPassed++;
    } catch (err) {
        console.error(`FAILED: ${testFile}`);
        console.error(err.stdout || err.message);
        totalFailed++;
    }
    console.log('---------------------------------------------------------------\n');
}

console.log(`TOTAL SUITES: ${testFiles.length} | PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
if (totalFailed > 0) {
    process.exit(1);
} else {
    console.log('\n>>> ALL REGRESSION & CONTRACT TEST SUITES PASSED CLEANLY! <<<');
}
