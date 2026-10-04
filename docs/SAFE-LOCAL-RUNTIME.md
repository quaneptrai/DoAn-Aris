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

## Resume parser on FastAPI Cloud

The Python parser (`ArisSkyve/resume-engine/server`) is deployed as the FastAPI Cloud app `aris-resume-parser` (`https://aris-resume-parser.fastapicloud.dev`, region us-east-1). Every `/api/*` call must carry the shared key header `X-Resume-Parser-Key`; the cloud entrypoint refuses to start without `RESUME_PARSER_API_KEY` (32+ characters).

```powershell
# 1. Build a minimal bundle OUTSIDE this git repository (default ~/.aris/parser-deploy).
#    The FastAPI Cloud CLI honours the repo .gitignore, so a bundle under .local/ uploads nothing.
python ArisSkyve/resume-engine/build-parser-deploy.py
# 2. One-time setup per machine/account (already done for aris-resume-parser):
uvx --from "fastapi[standard]" fastapi login
uvx --from "fastapi[standard]" fastapi cloud link <app-id> --path ~/.aris/parser-deploy
# 3. Rotate the key: generate a new value, store it in both places, then redeploy.
#    Cloud:  fastapi cloud env set RESUME_PARSER_API_KEY --value-stdin --secret --path ~/.aris/parser-deploy
#    Aris:   dotnet user-secrets set "ResumeEngine:ParserApiKey" "<same value>"   (or env ResumeEngine__ParserApiKey)
# 4. Deploy:
uvx --from "fastapi[standard]" fastapi deploy ~/.aris/parser-deploy
```

Aris sends the key automatically (`ResumeParserKeyHandler`) only to the host in `ResumeEngine:ParserUrl`. Local development keeps `ResumeEngine:ParserUrl` at `http://127.0.0.1:8765` (local parser, no key needed); production sets `ResumeEngine__ParserUrl=https://aris-resume-parser.fastapicloud.dev` plus `ResumeEngine__ParserApiKey`. `OPENAI_API_KEY` is optional on the parser: without it the "Chuyển sang mẫu Studio" mode returns an error, while layout import keeps working. OCR stays off in the cloud.

## Privacy consent and sign-in limits

- `/privacy` is the public privacy policy. Set `Privacy:ContactEmail` (non-secret) so the page shows a contact address for data requests.
- New users must accept the policy in onboarding (`Users.PrivacyAcceptedAt`). AI processing of CVs is opt-in (`Users.CvAiConsentAt`). `AnalyzeCv`, Studio `coach`, `import-template` and `parse` with `mode=template` return `428 cv_ai_consent_required` until the user agrees, and Studio saves skip AI indexing (`aiSync: "consent_required"`). Revoking at `/privacy` also asks AiCore to delete the user's CV vectors.
- Apply the EF migration `AddPrivacyAndCvAiConsent` (two nullable columns on `Users`) together with the other pending migrations.
- Magic-link sign-in is rate limited: per IP 5 link requests and 20 confirm attempts per 15 minutes (`RateLimits:MagicLinkRequestsPerIp`, `RateLimits:MagicLinkConfirmsPerIp`), and per recipient 3 emails per 15 minutes / 10 per day (`RateLimits:MagicLinkEmailsPer15Minutes`, `RateLimits:MagicLinkEmailsPerDay`). Limits are partitioned by `RemoteIpAddress`: behind a reverse proxy, enable forwarded headers first, otherwise every user shares the proxy's IP. Counters are per process (fine for one server).

```powershell
node tests/runtime_e2e_privacy.cjs
```

## Production release checklist

1. Rotate/revoke every credential that was previously present in tracked configuration or source code: database, SMTP/API, OAuth, magic-link, social, webhook, and metering credentials.
2. Put replacement values in the deployment secret store/environment; never commit them.
3. Run the test suite and an isolated relational staging E2E run before deployment.
4. Verify the deployed process uses the intended environment and database identity without logging connection strings or secret values.
5. Point `ResumeEngine__ParserUrl`/`ResumeEngine__ParserApiKey` at the FastAPI Cloud parser and apply all pending EF migrations (including `AddPrivacyAndCvAiConsent`).
