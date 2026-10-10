param([int]$Port = 5027, [switch]$Gateway, [string]$AppDll, [string]$LogName = 'interview-test', [string]$GatewayUrl = 'http://127.0.0.1:5310/gw')
# -Gateway: Aris reaches the fake providers only through tools/InterviewGateway (port 5310, see gateway-e2e.json),
# the way production does, and has no FFmpeg of its own.
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (-not $AppDll) { $AppDll = Join-Path $projectRoot 'ArisSkyve/bin/InterviewPort/net10.0/ArisSkyve.dll' }
$contentPath = Join-Path $projectRoot 'ArisSkyve'
$ffmpegPath = Join-Path $projectRoot '.local/interview-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:E2E__UseInMemoryDatabase = 'true'
$env:E2E__SeedInterviewAccounts = 'true'
$arguments = @('"' + $appDll + '"', '--urls', "http://localhost:$Port", '--contentRoot', '"' + $contentPath + '"', '--Logging:EventLog:LogLevel:Default', 'None', '--GoogleDrive:Enabled', 'false')
if ($Gateway) {
    $gw = $GatewayUrl; $key = 'gateway-e2e-key-0123456789abcdef'
    $arguments += @('--InterviewEngine:Llm:BaseUrl', "$gw/llm", '--InterviewEngine:Llm:ApiKey', $key, '--InterviewEngine:Video:BaseUrl', "$gw/video", '--InterviewEngine:Video:ApiKey', $key, '--InterviewEngine:Tts:BaseUrl', "$gw/tts", '--InterviewEngine:Tts:ApiKey', $key, '--InterviewEngine:Tts:Model', 'test-tts', '--InterviewEngine:Stt:BaseUrl', "$gw/stt", '--InterviewEngine:Stt:ApiKey', $key, '--InterviewEngine:Stt:Model', 'test-stt', '--InterviewEngine:Media:BaseUrl', "$gw/media", '--InterviewEngine:Media:ApiKey', $key, '--InterviewEngine:FfmpegPath', 'ffmpeg-not-installed', '--InterviewEngine:Video:BillingIdentityRequired', 'true')
} else {
    $arguments += @('--InterviewEngine:Llm:BaseUrl', 'http://127.0.0.1:5301/v1', '--InterviewEngine:Llm:ApiKey', 'llm-test', '--InterviewEngine:Video:BaseUrl', 'http://127.0.0.1:5302/v1', '--InterviewEngine:Video:ApiKey', 'video-test', '--InterviewEngine:Tts:BaseUrl', 'http://127.0.0.1:5303', '--InterviewEngine:Tts:Model', 'test-tts', '--InterviewEngine:Stt:BaseUrl', 'http://127.0.0.1:5303', '--InterviewEngine:Stt:Model', 'test-stt', '--InterviewEngine:FfmpegPath', '"' + $ffmpegPath + '"')
}
$testProcess = Start-Process -FilePath 'dotnet' -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot ".local/$LogName.stdout.log") -RedirectStandardError (Join-Path $projectRoot ".local/$LogName.stderr.log") -PassThru
Write-Output "Interview test server PID $($testProcess.Id), port $Port, ephemeral database and fake providers$(if ($Gateway) { ' behind the gateway' })."
