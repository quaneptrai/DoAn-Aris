const { execFileSync } = require('child_process');
const assert = require('assert');
const path = require('path');

console.log('--- TEST HEALTH / READINESS ENDPOINTS ---');

const root = path.resolve(__dirname, '..');
const projectPath = path.join(__dirname, 'HealthEndpointTests', 'HealthEndpointTests.csproj');
const outputPath = path.join(root, '.local', `health-endpoint-tests-${process.pid}`);

try {
    execFileSync('dotnet', [
        'build', projectPath, '-p:UseAppHost=false', '-o', outputPath, '-v', 'quiet'
    ], { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

    const output = execFileSync('dotnet', [path.join(outputPath, 'HealthEndpointTests.dll')], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
    });
    assert.match(output, /ALL HEALTH ENDPOINT TESTS PASSED \(4 checks\)/,
        'health endpoint behavioral contract must pass');
    console.log(output.trim());
} catch (error) {
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    throw error;
}
