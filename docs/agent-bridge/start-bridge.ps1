# Start Codex Bridge Daemon in background or current console
param(
    [switch]$Background
)

$BridgeDir = $PSScriptRoot
Set-Location $BridgeDir

if ($Background) {
    Start-Process python -ArgumentList "bridge.py --daemon" -WindowStyle Hidden
    Write-Host "[+] Codex Bridge daemon launched in background." -ForegroundColor Green
} else {
    Write-Host "[*] Starting Codex Bridge daemon in current console (Press Ctrl+C to stop)..." -ForegroundColor Cyan
    python bridge.py --daemon
}
