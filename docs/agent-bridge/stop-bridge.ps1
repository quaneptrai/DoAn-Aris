# Stop Codex Bridge Daemon safely via stop.signal
$BridgeDir = $PSScriptRoot
Set-Location $BridgeDir

python bridge.py --stop
Write-Host "[+] Stop signal sent to Codex Bridge. Daemon will terminate cleanly." -ForegroundColor Yellow
