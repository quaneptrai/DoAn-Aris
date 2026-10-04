# Safe local runtime and secret handling

Tracked `appsettings*.json` files deliberately contain no deployment credentials. Supply secrets through the environment, a managed secret store, or .NET User Secrets in Development. Never put them back into tracked JSON, screenshots, test fixtures, or browser artifacts.

## Normal Development setup

From `ArisSkyve`, configure the values your local workflow actually needs with User Secrets. Examples below are key names only; provide real values through your own terminal or secret manager.

```powershell
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<local-or-approved-development-connection-string>"
dotnet user-secrets set "Auth:MagicLinkSecret" "<at-least-32-random-characters>"
dotnet user-secrets set "Authentication:Google:ClientId" "<optional-client-id>"
dotnet user-secrets set "Authentication:Google:ClientSecret" "<optional-client-secret>"
```

Other optional integrations use the same double-underscore environment mapping in deployment, for example `Smtp__Password`, `AiCore__ApiKey`, and `Social__ZaloBot__WebhookSecretToken`.

The app fails at startup when a normal SQL runtime lacks `ConnectionStrings:DefaultConnection`. Google and Facebook handlers are registered only when both values for a provider exist. Magic-link signing requires a configured secret of at least 32 characters, and email delivery is disabled rather than using an embedded fallback credential.

## Isolated E2E smoke runtime

This mode is only for local Development. It uses a unique EF InMemory database, disables all hosted background workers and demo seeders, accepts only loopback requests, and should bind only to `127.0.0.1`. It does not exercise SQL Server migrations, constraints, or external integrations.

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:E2E__UseInMemoryDatabase = 'true'
$env:E2E__DisableBackgroundServices = 'true'
$env:E2E__DatabaseName = "aris-e2e-$PID"
$env:DemoData__SeedCompaniesAndJobs = 'false'
$env:DemoData__SeedSocial = 'false'
$env:AiCore__BaseUrl = 'http://127.0.0.1:9'
$env:ResumeEngine__ParserUrl = 'http://127.0.0.1:9'
dotnet run --project ArisSkyve/ArisSkyve.csproj --urls http://127.0.0.1:5031
```

Use a new browser profile/context and `GET /Account/QuickLogin?returnUrl=/Resume/Studio` only on this loopback instance. It creates an in-memory user and lets you test login cookies, antiforgery, Resume Studio save/publish, and public portfolio routes without touching a real database or CV upload. Do not use the development quick-login endpoints on a network-exposed server.

## Health probes

`GET /health/live` reports only that the process can answer HTTP. `GET /health/ready` performs a bounded, non-mutating database/schema query and returns `503 {"status":"not_ready"}` when it cannot safely verify readiness. Both responses deliberately omit configuration, connection, and provider details. Configure the load balancer to use readiness for traffic admission and liveness only for restart detection.

## Public media uploads

New post, story, avatar, cover, and chat media is checked against its declared type, file extension, and binary signature; it receives a server-generated filename and is stored outside `wwwroot`. The public `/media/...` endpoint serves only those allowlisted files with an explicit MIME type and `X-Content-Type-Options: nosniff`. Legacy `/uploads/...` links remain available only for recognized image/video extensions, so a previously stored active file cannot be served as HTML or script.

Run the full isolated runtime smoke test with:

```powershell
node tests/runtime_e2e_local.cjs
```

## Production release checklist

1. Rotate/revoke every credential that was previously present in tracked configuration or source code: database, SMTP/API, OAuth, magic-link, social, webhook, and metering credentials.
2. Put replacement values in the deployment secret store/environment; never commit them.
3. Run the test suite and an isolated relational staging E2E run before deployment.
4. Verify the deployed process uses the intended environment and database identity without logging connection strings or secret values.
