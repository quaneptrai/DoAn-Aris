const { execFileSync } = require('child_process');
const path = require('path');
const assert = require('assert');

console.log('--- TEST F7 / F8: Backend Behavioral Tests (Real EF Core & Controller) ---');

const projectPath = path.resolve(__dirname, 'BackendEfTests', 'BackendEfTests.csproj');
const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, '.local', `backend-ef-behavioral-${process.pid}`);

try {
    // Build outside bin/Debug so the suite can run while the local Aris app is open.
    const buildArgs = ['build', projectPath, '-p:UseAppHost=false', '-o', outputPath, '-v', 'quiet'];
    console.log(`Executing: dotnet ${buildArgs.join(' ')}`);
    execFileSync('dotnet', buildArgs, { cwd: repoRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

    const output = execFileSync('dotnet', [path.join(outputPath, 'BackendEfTests.dll'), 'all'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(output);

    assert(output.includes('F7.1 PASSED'), 'Test F7.1 must pass');
    assert(output.includes('F7.2 PASSED'), 'Test F7.2 must pass');
    assert(output.includes('Subtest 3A') && output.includes('Subtest 3B'), 'Test F7.3 must pass');
    assert(output.includes('F7.4 PASSED'), 'Test F7.4 must pass');
    assert(output.includes('F7.5 PASSED'), 'Test F7.5 must pass');
    assert(output.includes('F7.6 PASSED'), 'Test F7.6 must pass');
    assert(output.includes('F7.7 PASSED'), 'Test F7.7 must pass');
    assert(output.includes('F7.8 PASSED'), 'Test F7.8 must pass');
    assert(output.includes('ALL REAL EF CORE & CONTROLLER TESTS PASSED CLEANLY'), 'Overall test suite must pass');

    console.log('✓ All F7 / F8 behavioral test scenarios passed cleanly!');
} catch (err) {
    console.error('Error running backend behavioral tests:');
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
}
