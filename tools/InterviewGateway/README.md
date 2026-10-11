# Aris interview gateway

Aris on IIS calls one HTTPS endpoint and a dedicated gateway key. This process replaces that key with the local provider keys and runs FFmpeg on the Windows PC. Node 22+ and FFmpeg are needed; optional local voice conversion also needs its Python runtime and model files. The key and local service settings must never be shipped to the browser or committed.

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
node --test tools/InterviewGateway/voice-conversion.test.mjs
node tests/InterviewFlowTests/fake-services.mjs
powershell -NoProfile -File tests/InterviewFlowTests/run-gateway-e2e.ps1
```

Run the fake-services command in a separate terminal. The E2E runner uses a fresh ephemeral database for each suite on port 5030, starts its own gateway on 5311 with a fresh test ledger, checks readiness and cleans only its own processes. It tests flow, credit selection, stop, browser interactions and per-account allowance. Build Aris to `.local/gateway-continuation-build` first (or pass `-AppDll`). No paid API or shared database is involved.

## Local voice conversion for a speaking clip

`GET /media/voice-conversion/health` returns `{ready, voices:[{id,name}]}`. It advertises only configured references that the worker can read and encode using installed checkpoints. `POST /media/convert-voice` accepts multipart `video` and a target `voice` id from that list, and returns `video/mp4`. Both routes require the gateway key, share `mediaConcurrency`, and never call an upstream service. Missing libraries, models or references remain unavailable so Aris can reject the mode before spending renderer credits.

The video must already contain the desired spoken dialogue with synchronized lips. The gateway extracts its audio, changes tone locally, checks the audio sample duration, normalizes to about -14 LUFS, and remuxes the original encoded video with `-c:v copy`. It never loops the video or changes speech speed. Duration drift above `maxDurationDriftMs` (default and maximum 80 ms) is rejected. Only smaller codec rounding can be padded or trimmed at the end. A matching total duration does not establish word-by-word synchronization: watch a trial clip and check terms before generating a full kit.

Provision a separate Python environment with PyTorch appropriate to the host, NumPy, SoundFile, Librosa, and the official [OpenVoice source](https://github.com/myshell-ai/OpenVoice/tree/74a1d147b17a8c3092dd5430504bd83ef6c7eb23). The official API imports text helpers even for direct tone conversion, so install `inflect`, `unidecode`, `eng_to_ipa`, `pypinyin`, `jieba`, and `cn2an` as needed by that revision. This worker uses `ToneColorConverter.extract_se` and `.convert` with watermark disabled; it does not need Whisper/VAD, MeloTTS or a voice-service key. The pinned upstream constructor forwards the optional watermark flag to a base constructor that rejects it, so the local adapter initializes the same base model directly and disables the optional watermark model; extraction and conversion methods remain unchanged. It does not install packages or download models automatically.

Place the official V2 converter's `config.json` and `checkpoint.pth` in the private model directory. The [published converter checkpoint](https://huggingface.co/myshell-ai/OpenVoiceV2/blob/f36e7edfe1684461a8343844af60babc2efbb727/converter/checkpoint.pth) has SHA-256 `9652c27e92b6b2a91632590ac9962ef7ae2b712e5c5b7f4c34ec55ee2b37ab9e`. Keep a clean, authorised Ruby reference WAV on this machine and set its path in a private copy of `voice-conversion.config.example.json`. A similarly named public sample can represent a different voice; use the actual intended Ruby reference. References are read locally and never uploaded. Keep references, model files, environment and local configuration out of commits.

Set the optional `voiceConversion` block in gateway configuration: `pythonPath`, `workerPath`, `configPath`, `timeoutSeconds` (1–1800; default 180), and `maxDurationDriftMs` (0–80; default 80). Remove the block if conversion is not installed. All file paths are resolved against the gateway configuration file; paths inside the worker JSON are relative to that JSON. Worker JSON contains `modelDir`, `device` (`auto`, `cuda`, or `cpu`), `maxDurationDriftMs`, and `voices` keyed by allowlisted voice id with `name` and `referencePath`. `auto` uses CUDA if available and otherwise CPU. No GPU is needed on the ASP.NET hosting server.

Check installation without generating media or spending credits:

```powershell
& '<private-venv>/Scripts/python.exe' tools/InterviewGateway/voice_conversion_worker.py --health --config '<private-worker-config.json>'
```

An unavailable check returns `{"ready":false,"voices":[]}`. Worker failures and timeouts expose only generic messages; source paths, references and model details are absent from HTTP responses. Timed-out or disconnected conversion processes are killed, and temporary source/output files are cleaned. RTX 2050 4 GB performance and the voice match must be measured on the installed runtime; readiness is not a quality guarantee.

For the tested Windows CPU setup, `install-local-voice.ps1` downloads pinned public source, checkpoint and 19 locked dependency artifacts into a dedicated local directory, checks their digests, and installs into a separate virtual environment. It requires an existing Windows x64 Python 3.11 with PyTorch and numerical dependencies (the script checks them first); it does not change system packages. Pass the actual authorised reference file, which is read locally. No download request contains that audio:

```powershell
powershell -NoProfile -File tools/InterviewGateway/install-local-voice.ps1 -RuntimeRoot .local/voice-conversion -ReferencePath '<authorised-Ruby.wav>' -Python '<Python311/python.exe>' -Device cpu
```

The installer prints a server-only `voiceConversion` block for the gateway after readiness passes. Merge it into private gateway configuration and restart that gateway. In the local CPU validation, authenticated gateway readiness took 14.5 seconds; converting a 6.270-second public source using the intended local Ruby reference took 17.2 seconds and changed audio duration by 0.612 ms. Keep the server health timeout above this startup cost. These checks establish installation and timing, while the final speaking clip still needs a visual and voice review.

## Fitting a TTS line onto lip-synced speech

`POST /media/fit-voice` accepts multipart `video` (a clip whose own speech drives the lips) and `audio` (the TTS line), and returns `video/mp4`. Speech phrases are detected with `silencedetect` on both; the TTS is trimmed, tempo-adjusted (0.5–2×, pitch kept) and placed on the native phrases, then normalised to −14 LUFS. Video packets are copied and the audio keeps the original sample count, so sound cannot drift from the picture. A clip without speech, or a fit outside the tempo range, is refused (`422 speech_fit_failed`). Pure timing logic lives in `speech-fit.mjs`; run `node --test speech-fit.test.mjs`.

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

A separate limited-user task can restore a missing `/gw` mount on an already enabled Funnel. Set `windows.funnelHostname` to the existing `*.ts.net` hostname in private config, then run:

```powershell
powershell -NoProfile -File tools/InterviewGateway/funnel-windows.ps1 -Register
powershell -NoProfile -File tests/InterviewFlowTests/funnel-guard.ps1
```

`Aris-InterviewFunnelGuard` checks at logon and every minute; it preserves the root mount, respects intentional Funnel shutdown and leaves conflicting `/gw` targets alone. It does not restart Tailscale for TLS failures. The script logs only a route readiness result, with no keys, and unregisters with `-Unregister`.
