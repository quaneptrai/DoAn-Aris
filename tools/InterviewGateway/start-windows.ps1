param([switch]$Register, [switch]$Unregister, [string]$ConfigFile)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (-not $ConfigFile) { $ConfigFile = Join-Path $PSScriptRoot 'config.local.json' }
$ConfigFile = (Resolve-Path -LiteralPath $ConfigFile).Path
$taskName = 'Aris-InterviewGateway'
$scriptPath = $PSCommandPath
if ($Unregister) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false; return }
if ($Register) {
    $user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $scriptPath + '" -ConfigFile "' + $ConfigFile + '"') -WorkingDirectory $repo
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Starts the interview gateway and local renderer after Windows login; no generation is submitted.' -Force | Out-Null
    Start-ScheduledTask -TaskName $taskName
    Write-Output "$taskName registered and started for $user."
    return
}
$mutex = New-Object Threading.Mutex($false, 'Local\ArisInterviewGatewaySupervisor')
if (-not $mutex.WaitOne(0)) { $mutex.Dispose(); return }
$logDir = Join-Path $repo '.local/interview-gateway-supervisor'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$owned = @{}
function Listening([int]$Port) {
    $client = New-Object Net.Sockets.TcpClient
    try { $result = $client.BeginConnect('127.0.0.1',$Port,$null,$null); if (-not $result.AsyncWaitHandle.WaitOne(1000)) { return $false }; $client.EndConnect($result); return $true } catch { return $false } finally { $client.Dispose() }
}
function Start-Managed([string]$Name,[string]$Exe,[string[]]$Arguments,[string]$Directory,[int]$Port) {
    if (Listening $Port) { return }
    if ($owned.ContainsKey($Name) -and -not $owned[$Name].HasExited) { return }
    foreach ($stream in @('stdout','stderr')) {
        $file = Join-Path $logDir "$Name.$stream.log"
        if ((Test-Path -LiteralPath $file) -and (Get-Item -LiteralPath $file).Length -gt 5MB) { Move-Item -LiteralPath $file -Destination "$file.1" -Force }
    }
    $owned[$Name] = Start-Process -FilePath $Exe -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir "$Name.stdout.log") -RedirectStandardError (Join-Path $logDir "$Name.stderr.log") -PassThru
}
try {
    $node = (Get-Command node -ErrorAction Stop).Source
    while ($true) {
        $config = Get-Content -LiteralPath $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
        # ArisControl.exe ghi cờ này khi chủ dự án tắt F2A: không tự bật lại.
        $videoOff = Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'ArisControl\off\f2a')
        if (-not $videoOff -and $config.windows.videoPython -and $config.windows.videoWorkingDirectory) {
            Start-Managed 'video' $config.windows.videoPython @('-m','uvicorn','src.main:app','--host','127.0.0.1','--port','8000') $config.windows.videoWorkingDirectory 8000
        }
        Start-Managed 'gateway' $node @('"' + (Join-Path $PSScriptRoot 'gateway.mjs') + '"','--config','"' + $ConfigFile + '"') $repo ([int]$config.port)
        Start-Sleep -Seconds 10
    }
} finally {
    foreach ($child in $owned.Values) { if (-not $child.HasExited) { Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue } }
    $mutex.ReleaseMutex(); $mutex.Dispose()
}
