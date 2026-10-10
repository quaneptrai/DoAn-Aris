param([string]$AppDll, [string[]]$Suites = @('flow-e2e.mjs','credit-e2e.mjs','stop-e2e.mjs','browser-e2e.cjs','quota-e2e.mjs'))
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (-not $AppDll) { $AppDll = Join-Path $repo '.local/gateway-continuation-build/ArisSkyve.dll' }
if (-not (Test-Path -LiteralPath $AppDll)) { throw 'Build Aris first.' }
# Fake providers on 5301-5303 must already be running; this runner owns a fresh test gateway.
if (Get-NetTCPConnection -State Listen -LocalPort 5311 -ErrorAction SilentlyContinue) { throw '5311 is occupied.' }
$config = Get-Content (Join-Path $PSScriptRoot 'gateway-e2e.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$runDir = Join-Path $repo ('.local/gateway-e2e-run-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $runDir | Out-Null
$config.port = 5311
if ($Suites.Count -eq 1 -and $Suites[0] -in @('admin-e2e.mjs','admin-browser.cjs')) { $config.budget.unlimitedAccounts = @() }
$config | Add-Member -NotePropertyName adminKey -NotePropertyValue "gateway-admin-e2e-key-0123456789abcdef" -Force
$config.dataDir = Join-Path $runDir 'data'
$config.ffmpegPath = Join-Path $repo '.local/interview-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
$configFile = Join-Path $runDir 'config.json'
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configFile -Encoding UTF8
$gatewayPath = Join-Path $repo 'tools/InterviewGateway/gateway.mjs'
$gatewayProcess = Start-Process node -ArgumentList @('"' + $gatewayPath + '"','--config','"' + $configFile + '"') -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runDir 'gateway.stdout.log') -RedirectStandardError (Join-Path $runDir 'gateway.stderr.log') -PassThru
Push-Location $repo
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try { $health = Invoke-RestMethod 'http://127.0.0.1:5311/gw/health' -Headers @{Authorization='Bearer gateway-e2e-key-0123456789abcdef'} -TimeoutSec 3; $ready = $health.services.llm -and $health.services.video -and $health.services.tts -and $health.services.ffmpeg } catch {}
        if ($ready) { break }; Start-Sleep -Milliseconds 200
    }
    if (-not $ready) { throw 'Fake services or isolated gateway are not ready.' }
    foreach ($suite in $Suites) {
        $listener = Get-NetTCPConnection -State Listen -LocalPort 5030 -ErrorAction SilentlyContinue
        if ($listener) { throw '5030 is occupied; do not stop an unidentified process.' }
        $log = 'gateway-' + [IO.Path]::GetFileNameWithoutExtension($suite)
        $launch = & (Join-Path $PSScriptRoot 'start-test-server.ps1') -Port 5030 -Gateway -AdminFixtures:($suite -in @('admin-e2e.mjs','admin-browser.cjs','employer-upgrade-e2e.mjs')) -AppDll $AppDll -LogName $log -GatewayUrl http://127.0.0.1:5311/gw
        $launch | Write-Output
        $testPid = [int]([regex]::Match(($launch -join ' '),'PID (\d+)').Groups[1].Value)
        if (-not $testPid) { throw 'No test server PID returned.' }
        try {
            $ready = $false
            for ($attempt = 0; $attempt -lt 40; $attempt++) {
                try { $ready = (Invoke-WebRequest 'http://localhost:5030/health/live' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch {}
                if ($ready) { break }
                Start-Sleep -Milliseconds 500
            }
            if (-not $ready) { throw 'Test server did not become ready.' }
            & node (Join-Path $PSScriptRoot $suite) 'http://localhost:5030'
            if ($LASTEXITCODE -ne 0) { throw "$suite failed ($LASTEXITCODE). See .local/$log.*.log" }
        } finally {
            $process = Get-CimInstance Win32_Process -Filter "ProcessId=$testPid"
            if ($process -and $process.Name -eq 'dotnet.exe' -and $process.CommandLine.Contains($AppDll)) { Stop-Process -Id $testPid -Force; Wait-Process -Id $testPid -ErrorAction SilentlyContinue }
            for ($wait = 0; $wait -lt 50; $wait++) {
                if (-not (Get-NetTCPConnection -State Listen -LocalPort 5030 -ErrorAction SilentlyContinue)) { break }
                Start-Sleep -Milliseconds 100
            }
        }
    }
} finally {
    Pop-Location
    $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($gatewayProcess.Id)"
    if ($current -and $current.Name -eq 'node.exe' -and $current.CommandLine.Contains($configFile)) { Stop-Process -Id $gatewayProcess.Id -Force; Wait-Process -Id $gatewayProcess.Id -ErrorAction SilentlyContinue }
}
