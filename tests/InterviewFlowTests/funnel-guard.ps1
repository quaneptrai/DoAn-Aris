$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../../tools/InterviewGateway/funnel-windows.ps1')
$script:checks=0
function Check($name,$value){if(-not $value){throw $name};$script:checks++;Write-Output "PASS $name"}
$config=[pscustomobject]@{port=8780;prefix='/gw';windows=[pscustomobject]@{funnelHostname='fixture.tailabc.ts.net'}}
$script:calls=[Collections.Generic.List[object]]::new()
$script:serve=@{AllowFunnel=@{'fixture.tailabc.ts.net:443'=$true};Web=@{'fixture.tailabc.ts.net:443'=@{Handlers=@{'/'=@{Proxy='http://127.0.0.1:20128'}}}}}
$run={param([string[]]$Arguments)
    $script:calls.Add($Arguments)
    [pscustomobject]@{Code=0;Text=($script:serve|ConvertTo-Json -Depth 10)}
}
$result=Repair-InterviewFunnel $config $run
Check 'missing gateway mount is restored with only /gw command' ($result.StartsWith('Restored') -and ($script:calls[1] -join ' ') -eq 'funnel --bg --set-path=/gw http://127.0.0.1:8780')
Check 'original root target is preserved' ($script:serve.Web['fixture.tailabc.ts.net:443'].Handlers['/'].Proxy -eq 'http://127.0.0.1:20128')
$script:serve.Web['fixture.tailabc.ts.net:443'].Handlers['/gw']=@{Proxy='http://127.0.0.1:8780'};$script:calls.Clear()
$result=Repair-InterviewFunnel $config $run
Check 'correct configuration performs no mutation' ($result.StartsWith('Ready') -and $script:calls.Count -eq 1)
$script:serve.AllowFunnel['fixture.tailabc.ts.net:443']=$false;$script:calls.Clear()
$result=Repair-InterviewFunnel $config $run
Check 'intentional Funnel shutdown is respected' ($result.StartsWith('Skipped') -and $script:calls.Count -eq 1)
$script:serve.AllowFunnel['fixture.tailabc.ts.net:443']=$true;$script:serve.Web['fixture.tailabc.ts.net:443'].Handlers['/gw'].Proxy='http://127.0.0.1:9999';$script:calls.Clear()
$result=Repair-InterviewFunnel $config $run
Check 'a conflicting mount is not overwritten' ($result.StartsWith('Skipped') -and $script:calls.Count -eq 1)
Write-Output "FUNNEL GUARD PASSED ($script:checks)"
