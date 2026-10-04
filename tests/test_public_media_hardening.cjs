const { execFileSync } = require('child_process');
const assert = require('assert');
const path = require('path');

console.log('--- TEST PUBLIC MEDIA UPLOAD HARDENING ---');

const root = path.resolve(__dirname, '..');
const projectPath = path.join(__dirname, 'PublicMediaValidationTests', 'PublicMediaValidationTests.csproj');
const outputPath = path.join(root, '.local', `public-media-validation-${process.pid}`);

try {
    execFileSync('dotnet', [
        'build', projectPath, '-p:UseAppHost=false', '-o', outputPath, '-v', 'quiet'
    ], { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

    const output = execFileSync('dotnet', [path.join(outputPath, 'PublicMediaValidationTests.dll')], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
    });
    assert.match(output, /PASS: public media validation, storage, and serving hardening/,
        'public media upload security scenarios must pass');
    console.log(output.trim());
} catch (error) {
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    throw error;
}
