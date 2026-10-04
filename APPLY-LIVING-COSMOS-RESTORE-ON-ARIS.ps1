# Run on Aris (Windows). Restores living cosmos: starfield+planets+SVG constellation.
$ErrorActionPreference = "Stop"
$ProjectRoot = "D:\Downloads\ArisThucTap-main\ArisThucTap-main"
$Zip = Join-Path $PSScriptRoot "aris-living-cosmos-restore.zip"
if (-not (Test-Path $Zip)) { throw "Missing $Zip" }
if (-not (Test-Path $ProjectRoot)) { throw "Missing project root $ProjectRoot" }

$targets = @(
  "ArisSkyve\wwwroot\js\aris-constellation.js",
  "ArisSkyve\wwwroot\css\aris-cosmos.css",
  "ArisSkyve\wwwroot\css\aris-cinematic-shell.css"
)
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
foreach ($rel in $targets) {
  $full = Join-Path $ProjectRoot $rel
  if (Test-Path $full) {
    $bak = "$full.living-cosmos-restore-$stamp.bak"
    Copy-Item $full $bak
    Write-Host "Backup: $bak"
  }
}

Expand-Archive -Path $Zip -DestinationPath $ProjectRoot -Force

# If aris-earth.css exists, append Earth stacking rules (idempotent)
$earth = Join-Path $ProjectRoot "ArisSkyve\wwwroot\css\aris-earth.css"
$append = Join-Path $ProjectRoot "ArisSkyve\wwwroot\css\aris-earth.living-cosmos-append.css"
if ((Test-Path $earth) -and (Test-Path $append)) {
  $marker = "LIVING COSMOS RESTORE — keep Earth"
  $cur = Get-Content -Raw -Encoding UTF8 $earth
  if ($cur -notmatch [regex]::Escape($marker)) {
    $extra = Get-Content -Raw -Encoding UTF8 $append
    # Write UTF-8 without BOM
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($earth, ($cur.TrimEnd() + "`r`n`r`n" + $extra), $utf8)
    Write-Host "Appended Earth stacking rules to aris-earth.css"
  } else {
    Write-Host "aris-earth.css already has restore rules"
  }
} else {
  Write-Host "aris-earth.css not present or append snippet missing — cosmos.css already covers body.aris-home-earth-stage"
}

Write-Host "Applied Living Cosmos Restore to $ProjectRoot"
Write-Host "Hard refresh: Ctrl+F5 on Dashboard, Jobs, Profile, Login"
Write-Host "Expect: Jobs = starfield + planets + Sagittarius SVG; Dashboard = Earth + Leo corner; Auth = supernova"
