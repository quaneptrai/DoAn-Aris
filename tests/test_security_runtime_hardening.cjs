const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const config = (...parts) => JSON.parse(read('ArisSkyve', ...parts));

function valueAt(source, dottedPath) {
    return dottedPath.split('.').reduce((value, key) => value && value[key], source);
}

function assertBlank(source, dottedPath, label) {
    const value = valueAt(source, dottedPath);
    assert.strictEqual(typeof value, 'string', `${label} must remain a string setting`);
    assert.strictEqual(value.trim(), '', `${label} must be supplied by environment/User Secrets, not tracked JSON`);
}

console.log('--- RUNNING SECURITY + LOCAL RUNTIME HARDENING ---');

const base = config('appsettings.json');
[
    'ConnectionStrings.DefaultConnection',
    'AiCore.ApiKey',
    'Smtp.Host',
    'Smtp.User',
    'Smtp.Password',
    'Smtp.FromEmail',
    'Smtp.ApiKey',
    'Auth.MagicLinkSecret',
    'Metered.AppName',
    'Metered.SecretKey',
    'Authentication.Google.ClientId',
    'Authentication.Google.ClientSecret',
    'Authentication.Facebook.ClientId',
    'Authentication.Facebook.ClientSecret',
    'Social.Facebook.AppId',
    'Social.Facebook.AppSecret',
    'Social.Facebook.LoginConfigId',
    'Social.ZaloOa.AppId',
    'Social.ZaloOa.AppSecret',
    'Social.ZaloBot.Token',
    'Social.ZaloBot.GroupInviteLink',
    'Social.ZaloBot.WebhookSecretToken',
    'Social.N8n.WebhookUrl',
    'Social.N8n.WebhookSecret'
].forEach(key => assertBlank(base, key, `appsettings.json:${key}`));

const development = config('appsettings.Development.json');
assert.strictEqual(development.DemoData.SeedCompaniesAndJobs, false, 'Development must not auto-seed jobs');
assert.strictEqual(development.DemoData.SeedSocial, false, 'Development must not auto-seed social data');
const production = config('appsettings.Production.json');
assert.deepStrictEqual(Object.keys(production).sort(), ['AllowedHosts'], 'Production config must not carry deployment credentials');
console.log('PASS: tracked configuration contains no deployment credential values');

const program = read('ArisSkyve', 'Program.cs');
assert.match(program, /E2E:UseInMemoryDatabase/, 'Program must expose the explicit E2E opt-in');
assert.match(program, /useEphemeralE2E\s*&&\s*!builder\.Environment\.IsDevelopment\(\)/, 'In-memory E2E must fail outside Development');
assert.match(program, /options\.UseInMemoryDatabase\(e2eDatabaseName!\)/, 'E2E must use a process-local EF InMemory database');
assert.match(program, /ConnectionStrings:DefaultConnection must be supplied/, 'normal runtime must fail closed without a configured database');
assert.match(program, /if \(!disableE2EBackgroundServices\)/, 'E2E must be able to disable background workers');
assert.match(program, /IPAddress\.IsLoopback\(remoteIp\)/, 'E2E requests must be restricted to loopback');
assert.match(program, /if \(!string\.IsNullOrWhiteSpace\(google\["ClientId"\]\)/, 'Google registration must require configured credentials');
assert.match(program, /if \(!string\.IsNullOrWhiteSpace\(facebook\["ClientId"\]\)/, 'Facebook registration must require configured credentials');
assert.match(program, /PublicMediaValidator\.IsAllowedMediaExtension\(Path\.GetExtension\(requestPath\)\)/, 'legacy uploads must be restricted to recognized binary media extensions');
assert.match(program, /X-Content-Type-Options"\]\s*=\s*"nosniff"/, 'legacy upload responses must prevent MIME sniffing');
console.log('PASS: local E2E is explicit, Development-only, loopback-only, and isolated from workers');

const account = read('ArisSkyve', 'Controllers', 'AccountController.cs');
const emailService = read('ArisSkyve', 'Infrastructure', 'Services', 'EmailService.cs');
assert.match(account, /IPAddress\.IsLoopback\(remoteIp\)/, 'development quick-login endpoints must require loopback');
assert.match(account, /secret\.Length >= 32/, 'magic-link signing must require a sufficiently long configured secret');
assert.doesNotMatch(account, /MagicLinkSecret"\]\s*\?\?/, 'magic-link signing must not fall back to a source literal');
assert.match(account, /HasExternalLoginConfiguration\("Google"\)/, 'Google endpoints must fail closed when unavailable');
assert.match(account, /HasExternalLoginConfiguration\("Facebook"\)/, 'Facebook endpoints must fail closed when unavailable');
assert.doesNotMatch(emailService, /Smtp:(?:Password|ApiKey)"\]\s*\?\?/, 'email credentials must not fall back to source literals');
assert.match(emailService, /SMTP verification email is disabled because its configuration is incomplete/, 'missing SMTP config must disable delivery');
console.log('PASS: login and mail integrations fail closed without configured secrets');
