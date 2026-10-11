param([switch]$Inspect, [string]$SettingsPath)
$ErrorActionPreference = 'Stop'
$stageRoot = Split-Path -Parent $PSScriptRoot
$settingsPath = if ($SettingsPath) { $SettingsPath } else { Join-Path $stageRoot '.local\production-settings.json' }
if (-not (Test-Path -LiteralPath $settingsPath)) { throw 'Database settings were not found. The account was not created.' }
$accountSettings = Get-Content -Encoding UTF8 -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$databaseConnection = $accountSettings.ConnectionStrings__DefaultConnection
if (-not $databaseConnection) { $databaseConnection = $accountSettings.'ConnectionStrings:DefaultConnection' }
if (-not $databaseConnection) { $databaseConnection = $accountSettings.ConnectionStrings.DefaultConnection }
if (-not $databaseConnection -and $accountSettings.environmentVariables) { $databaseConnection = $accountSettings.environmentVariables.ConnectionStrings__DefaultConnection }
if (-not $databaseConnection) { throw 'Database connection is missing. The account was not created.' }
$oldConnection = $env:ConnectionStrings__DefaultConnection
try {
    $env:ConnectionStrings__DefaultConnection = $databaseConnection
    $buildRoot = Join-Path $stageRoot '.local\provision-employer-build'
    & dotnet build (Join-Path $stageRoot 'tools\ProvisionEmployer\ProvisionEmployer.csproj') -o $buildRoot --nologo -p:UseAppHost=false -p:NuGetAudit=false -p:WarningLevel=0 -v quiet
    if ($LASTEXITCODE -ne 0) { throw 'Provisioning helper did not build. The account was not changed.' }
    $arguments = @((Join-Path $buildRoot 'ProvisionEmployer.dll'))
    if ($Inspect) { $arguments += '--inspect' }
    & dotnet @arguments
    if ($LASTEXITCODE -ne 0) { throw "Provisioning returned exit code $LASTEXITCODE. Existing accounts were not overwritten." }
} finally {
    $env:ConnectionStrings__DefaultConnection = $oldConnection
}
