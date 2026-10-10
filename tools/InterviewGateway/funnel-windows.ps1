param([string]$ConfigFile, [switch]$Register, [switch]$Unregister)
$ErrorActionPreference='Stop'
function Repair-InterviewFunnel($Config, [scriptblock]$Run) {
    $hostname=$Config.windows.funnelHostname
    if(-not $hostname -or $hostname -notmatch '^[a-z0-9-]+\.tail[a-z0-9]+\.ts\.net$' -or $Config.prefix -ne '/gw' -or [int]$Config.port -lt 1 -or [int]$Config.port -gt 65535){return 'Skipped: no valid configured gateway mount'}
    if(-not $Run){
        $Run={param([string[]]$Arguments)
            $previous=$ErrorActionPreference;$ErrorActionPreference='Continue'
            try {$output=& 'C:\Program Files\Tailscale\tailscale.exe' @Arguments 2>&1;$code=$LASTEXITCODE}
            finally {$ErrorActionPreference=$previous}
            [pscustomobject]@{Code=$code;Text=($output -join "`n")}
        }
    }
    $probe=& $Run @('serve','status','--json')
    if($probe.Code -ne 0){return 'Unavailable: cannot read Funnel configuration'}
    try {$serve=$probe.Text|ConvertFrom-Json} catch{return 'Unavailable: invalid Funnel configuration'}
    $site=$hostname+':443'
    $allowed=$serve.AllowFunnel.PSObject.Properties[$site]
    $web=$serve.Web.PSObject.Properties[$site]
    # Respect an intentional shutdown and never create a public hostname/Funnel.
    if(-not $allowed -or $allowed.Value -ne $true -or -not $web){return 'Skipped: Funnel is not enabled for the configured hostname'}
    $mount=$web.Value.Handlers.PSObject.Properties['/gw']
    $target='http://127.0.0.1:'+([int]$Config.port)
    if($mount -and $mount.Value.Proxy -eq $target){return 'Ready: gateway mount present'}
    if($mount){return 'Skipped: gateway mount has a different target'}
    $restore=& $Run @('funnel','--bg','--set-path=/gw',$target)
    if($restore.Code -ne 0){return 'Unavailable: gateway mount could not be restored'}
    return 'Restored: /gw gateway mount; root untouched'
}
if($MyInvocation.InvocationName -eq '.'){return}
if(-not $ConfigFile){$ConfigFile=Join-Path $PSScriptRoot 'config.local.json'}
$ConfigFile=(Resolve-Path -LiteralPath $ConfigFile).Path
$taskName='Aris-InterviewFunnelGuard'
if($Unregister){Unregister-ScheduledTask -TaskName $taskName -Confirm:$false;return}
if($Register){
    $user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
    $action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$PSCommandPath+'" -ConfigFile "'+$ConfigFile+'"')
    $triggers=@((New-ScheduledTaskTrigger -AtLogOn -User $user),(New-ScheduledTaskTrigger -Once -At ((Get-Date).AddSeconds(15)) -RepetitionInterval (New-TimeSpan -Minutes 1)))
    $principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
    $settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Seconds 45) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description 'Restores only a missing /gw on an already enabled Funnel; preserves root and intentional shutdown.' -Force | Out-Null
    Start-ScheduledTask -TaskName $taskName
    Write-Output "$taskName registered: limited user, check every minute."
    return
}
$config=Get-Content -LiteralPath $ConfigFile -Raw -Encoding UTF8|ConvertFrom-Json
$result=Repair-InterviewFunnel $config
$logDir=Join-Path ((Resolve-Path (Join-Path $PSScriptRoot '../..')).Path) '.local/interview-gateway-supervisor'
New-Item -ItemType Directory -Path $logDir -Force|Out-Null
$log=Join-Path $logDir 'funnel.log'
if((Test-Path -LiteralPath $log) -and (Get-Item -LiteralPath $log).Length -gt 1MB){Move-Item -LiteralPath $log -Destination ($log+'.1') -Force}
Add-Content -LiteralPath $log -Value ((Get-Date -Format o)+' '+$result) -Encoding UTF8
Write-Output $result
