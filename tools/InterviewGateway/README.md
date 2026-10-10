# Aris interview gateway

Aris on IIS calls one HTTPS endpoint and a dedicated gateway key. This process replaces that key with the local provider keys and runs FFmpeg on the Windows PC. No dependency packages are required; Node 22+ and FFmpeg are needed. The key and local service settings must never be shipped to the browser or committed.

## Local setup

Copy `config.example.json` to ignored `config.local.json`, set a random key from `node gateway.mjs new-key`, and configure the upstreams. URLs are roots for each service: LLM/video include `/v1`; speech excludes the terminal `/v1`. Relative paths are relative to the configuration file.

```powershell
node tools/InterviewGateway/gateway.mjs --config tools/InterviewGateway/config.local.json
powershell -NoProfile -File tools/InterviewGateway/start-windows.ps1 -Register
```

The scheduled task runs in the current user's interactive session after login. It starts the gateway and F2A if their ports are closed and retries after crashes. It adopts existing listeners without stopping them. 9router already uses its own Startup entry; Tailscale runs as a Windows service. No task automatically generates media. The PC must remain awake and connected.

Add a persistent Funnel mount without changing the existing MuseFlow `/v1` mount:

```powershell
tailscale funnel --bg --set-path=/gw http://127.0.0.1:8780
```

The gateway supports either retained or stripped `/gw` prefixes. All routes require `Authorization: Bearer <gateway-key>`, including health and cached files. Only named operations are reachable; provider dashboards/admin APIs are not proxied.

## Per-account credits

`perAccountDailyCredits: 300` applies separately to each verified Aris account. Aris derives `X-Aris-Account` as SHA-256 of `aris:user:<UserId>` read from its database, stores it with each quote and sends it from the backend; browser-supplied identity is ignored. `unlimitedAccounts` contains the hash for the user ID resolved from the owner's verified email. No monthly or global cap is set unless configured explicitly. This header is never forwarded to providers.

The durable ledger is at `dataDir/ledger.json` on the gateway PC, independent of the Aris database, preview servers and kit deletion. All kits and both image/video generation share the same account's allowance. Usage resets at midnight in `Asia/Ho_Chi_Minh`. Reservations count immediately, including concurrent renders; after timeout, disconnect or HTTP 5xx the amount remains counted as `uncertain`. Explicit HTTP 4xx refusals release it. Restart preserves usage and invalidates outstanding quotes; a process lock prevents multiple gateways sharing one ledger. Account identity survives email changes.

An unknown provider price is refused for limited accounts when `unknownCostCredits` is null. The exempt owner may approve an unknown price if no global cap is configured; it is logged as unknown, not displayed as free. A configured unknown-cost allowance is a conservative reservation, not proof of the actual provider charge. The cap applies to renderer credits, not token/TTS charges.

```powershell
node tools/InterviewGateway/gateway.mjs status
node tools/InterviewGateway/gateway.mjs pause
node tools/InterviewGateway/gateway.mjs resume
```

Pause blocks new previews and renders; already submitted requests may complete and cost credits. `gateway.log` contains status, timing and reservations, not prompts, keys or audio. Keep the ledger directory when moving/updating the service.

## Aris production settings

Use the public gateway root with `/gw/llm`, `/gw/video`, `/gw/tts` and `/gw/media` in the corresponding `InterviewEngine__*__BaseUrl` settings, with the dedicated gateway key in each `ApiKey`. Set `InterviewEngine__Video__BillingIdentityRequired=true`. Image generation uses the same video gateway root. Leave dedicated STT disabled to transcribe through the configured LLM; `/media/speech-mp3` prepares the recording first. IIS needs no FFmpeg.

## Checks

```powershell
node --test tools/InterviewGateway/gateway.test.mjs
node tests/InterviewFlowTests/fake-services.mjs
powershell -NoProfile -File tests/InterviewFlowTests/run-gateway-e2e.ps1
```

Run the fake-services command in a separate terminal. The E2E runner uses a fresh ephemeral database for each suite on port 5030, starts its own gateway on 5311 with a fresh test ledger, checks readiness and cleans only its own processes. It tests flow, credit selection, stop, browser interactions and per-account allowance. Build Aris to `.local/gateway-continuation-build` first (or pass `-AppDll`). No paid API or shared database is involved.

## Public connectivity failures

A successful HTTPS call from the gateway PC does not prove Internet Funnel connectivity: Tailscale MagicDNS can resolve the hostname to its private tailnet IP. Verify from the Aris hosting, or resolve through a public DNS server and connect to that address while retaining the original hostname for TLS SNI.

On 10 October 2026, IIS media/voice/video preflight failed with SSL unexpected EOF before any request reached the gateway, while tailnet calls succeeded. Restarting the Windows Tailscale service restored public ingress without changing mounts. Run the following in an Administrator PowerShell only when diagnosing this condition:

```powershell
Restart-Service -Name Tailscale
& 'C:\Program Files\Tailscale\tailscale.exe' funnel status
```

Check both `/` → `127.0.0.1:20128` and `/gw` → `127.0.0.1:8780` still exist, then verify media health and the employer quote from the hosting. A service restart briefly interrupts Tailscale connectivity. Local gateway health alone and the historical 180-second tailnet probe do not verify public ingress or its long-request timeout.

## Admin portal connection

The website's `/Admin` area is restricted to DB users with role `Admin` and one of the two explicitly designated emails. The sidebar, account menu and mobile navigation use the same decision. The two protected admins cannot be suspended or downgraded from the portal; employer permissions remain available when they have a business profile.

Set a second random `adminKey` in ignored gateway configuration. Supply it only in `InterviewEngine__Administration__ApiKey` with `InterviewEngine__Administration__BaseUrl=https://<gateway-host>/gw/admin`. The normal application key cannot use `/admin/status`, `/admin/pause`, `/admin/resume` or `/admin/credit-grants`. Keys are never rendered to a page.

Approved credit requests add to the requesting user's daily allowance until midnight in Vietnam. The grant journal shares the durable ledger and uses the support request ID to reject conflicting grants and deduplicate retries, even across restart. Granting is persisted before the remote call; if acknowledgment is lost, the portal offers Duyệt lại for the same amount/day instead of creating a second grant. Global spending caps still apply. This allowance is permission to consume provider credits, not a purchase or provider balance top-up.

Run the admin HTTP and Chrome suites separately with the isolated gateway runner and fake providers:

```powershell
powershell -NoProfile -File tests/InterviewFlowTests/run-gateway-e2e.ps1 -AppDll ArisSkyve/bin/AdminPortal/net10.0/ArisSkyve.dll -Suites admin-e2e.mjs
powershell -NoProfile -File tests/InterviewFlowTests/run-gateway-e2e.ps1 -AppDll ArisSkyve/bin/AdminPortal/net10.0/ArisSkyve.dll -Suites admin-browser.cjs
```

Admin fixtures exist only in the explicitly enabled Development/InMemory seeding mode; they do not create or modify production accounts. The tests cover notifications, ticket privacy, CSRF, role management, suspended sessions, service controls and real browser forms.
