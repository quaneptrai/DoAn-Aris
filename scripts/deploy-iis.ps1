<#
.SYNOPSIS
Deploy ArisSkyve to the IIS host (site62246 / thuctap.runasp.net) with Web Deploy.

.DESCRIPTION
1. Publishes a committed revision (default HEAD) from a temporary git worktree, so uncommitted
   work in the main working tree (e.g. another agent's half-finished change) is never shipped.
2. Writes production settings from a git-ignored JSON file (default .local/production-settings.json,
   flat "Section__Key": "value" pairs) into web.config as ASP.NET Core environment variables.
   Secrets never enter git; the generated web.config is deleted locally after the deploy.
3. Backs up the live site to .local/deploy-backups/ (unless -SkipBackup), for rollback with:
     msdeploy -verb:sync -source:package=<backup.zip> -dest:contentPath=site62246,computerName=...,...
4. Syncs with AppOffline + DoNotDeleteRule and skips App_Data, so user uploads, private CV originals
   and data-protection keys that exist only on the server are never deleted.
5. Checks /health/live and /health/ready on the live site.

Web Deploy credentials come from the Visual Studio publish profile saved on this machine
(.pubxml.user, DPAPI-encrypted for the current Windows user); nothing is printed.
Database migrations are NOT applied here: check `dotnet ef migrations list` first and apply pending
ones deliberately (they must be backward compatible with the running version).

.EXAMPLE
pwsh scripts/deploy-iis.ps1 -WhatIf        # publish + dry-run sync, no server changes
pwsh scripts/deploy-iis.ps1                # back up, deploy HEAD, verify
#>
param(
    [string]$Commit = 'HEAD',
    [string]$SettingsFile,
    [switch]$SkipBackup,
    [switch]$WhatIf
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
# Web Deploy supports getCredentials=<target>, but its command-line password
# option is visible to same-user process inspection tools. Keep the decrypted
# publish-profile password in memory only long enough to create a session-only
# Credential Manager entry, then invoke msdeploy with the opaque target name.
if (-not ('ArisWebDeployCredentialStore' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

public static class ArisWebDeployCredentialStore
{
    private const uint CRED_TYPE_GENERIC = 1;
    private const uint CRED_PERSIST_SESSION = 1;
    private const int ERROR_NOT_FOUND = 1168;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL
    {
        public uint Flags;
        public uint Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    [DllImport("Advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredWrite(ref CREDENTIAL credential, uint flags);

    [DllImport("Advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredDelete(string target, uint type, uint flags);

    public static void WriteSessionCredential(string target, string userName, string password)
    {
        var bytes = System.Text.Encoding.Unicode.GetBytes(password);
        var blob = Marshal.AllocCoTaskMem(bytes.Length);
        try
        {
            Marshal.Copy(bytes, 0, blob, bytes.Length);
            var credential = new CREDENTIAL
            {
                Type = CRED_TYPE_GENERIC,
                TargetName = target,
                CredentialBlobSize = (uint)bytes.Length,
                CredentialBlob = blob,
                Persist = CRED_PERSIST_SESSION,
                UserName = userName
            };
            if (!CredWrite(ref credential, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        finally
        {
            Array.Clear(bytes, 0, bytes.Length);
            Marshal.FreeCoTaskMem(blob);
        }
    }

    public static void DeleteSessionCredential(string target)
    {
        if (!CredDelete(target, CRED_TYPE_GENERIC, 0) && Marshal.GetLastWin32Error() != ERROR_NOT_FOUND)
            throw new Win32Exception(Marshal.GetLastWin32Error());
    }
}
'@
}
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $SettingsFile) { $SettingsFile = Join-Path $repo '.local\production-settings.json' }
if (-not (Test-Path $SettingsFile)) { throw "Settings file not found: $SettingsFile" }
$msdeploy = 'C:\Program Files\IIS\Microsoft Web Deploy V3\msdeploy.exe'
if (-not (Test-Path $msdeploy)) { throw 'Web Deploy V3 (msdeploy.exe) is not installed.' }

# --- credentials from the newest saved Web Deploy profile ---------------------------------------
$profiles = Join-Path $repo 'ArisSkyve\Properties\PublishProfiles'
$userFile = Get-ChildItem "$profiles\site62246-WebDeploy*.pubxml.user" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $userFile) { throw 'No saved Web Deploy profile (.pubxml.user) found; publish once from Visual Studio.' }
[xml]$userXml = Get-Content $userFile.FullName
[xml]$pubXml = Get-Content (Join-Path $profiles ($userFile.Name -replace '\.user$', ''))
function Get-ProfileValue([xml]$xml, [string]$name) { ($xml.Project.PropertyGroup | Where-Object { $_.$name }).$name }
$passwordBytes = [Security.Cryptography.ProtectedData]::Unprotect(
    [Convert]::FromBase64String((Get-ProfileValue $userXml 'EncryptedPassword')), $null, 'CurrentUser')
$password = [Text.Encoding]::Unicode.GetString($passwordBytes)
$site = Get-ProfileValue $pubXml 'DeployIisAppPath'
$service = Get-ProfileValue $pubXml 'MSDeployServiceURL'
$siteUrl = (Get-ProfileValue $pubXml 'SiteUrlToLaunchAfterPublish') -replace '^http://', 'https://'
$credentialTarget = "ArisSkyve-WebDeploy-$([Guid]::NewGuid().ToString('N'))"
try {
    [ArisWebDeployCredentialStore]::WriteSessionCredential($credentialTarget, (Get-ProfileValue $pubXml 'UserName'), $password)
}
finally {
    [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
    # A .NET string cannot be cleared reliably, but no child process receives
    # it and the decoded byte buffer has been cleared.
    $password = $null
}
$remote = "contentPath='$site',computerName='https://$service`:8172/msdeploy.axd?site=$site',authType='Basic',getCredentials='$credentialTarget'"
function Invoke-MsDeploy([string[]]$arguments) {
    $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { & $msdeploy @arguments 2>&1 | Select-Object -Last 3 }
    finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { throw "msdeploy failed with exit code $LASTEXITCODE" }
}
# Native tools (git, dotnet) print progress on stderr; Windows PowerShell 5.1 would turn that into
# terminating errors under 'Stop'. Run them with 'Continue' and judge success by the exit code.
function Invoke-Native([string]$label, [scriptblock]$command) {
    $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { & $command 2>&1 | Out-Null } finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { throw "$label failed with exit code $LASTEXITCODE" }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$work = Join-Path $env:TEMP "aris-deploy-$stamp"
$tree = Join-Path $work 'src'
$out = Join-Path $work 'publish'
try {
    # --- publish the committed revision from a clean worktree ----------------------------------
    $rev = (git -C $repo rev-parse --short $Commit).Trim()
    Invoke-Native 'git worktree add' { git -C $repo worktree add --detach $tree $Commit }
    Write-Host "Publishing $rev ..."
    Invoke-Native 'dotnet publish' { dotnet publish (Join-Path $tree 'ArisSkyve\ArisSkyve.csproj') -c Release -o $out -p:UseAppHost=false -nologo -v quiet }
    if (Test-Path (Join-Path $out 'App_Data')) { Remove-Item (Join-Path $out 'App_Data') -Recurse -Force }

    # --- production settings -> web.config environment variables ------------------------------
    $settings = Get-Content $SettingsFile -Raw | ConvertFrom-Json
    $webConfig = Join-Path $out 'web.config'
    [xml]$config = Get-Content $webConfig
    $core = $config.SelectSingleNode('//aspNetCore')
    if (-not $core) { throw 'aspNetCore element not found in the published web.config.' }
    $core.SelectNodes('environmentVariables') | ForEach-Object { [void]$core.RemoveChild($_) }
    $variables = $config.CreateElement('environmentVariables')
    $names = @()
    foreach ($property in $settings.PSObject.Properties) {
        if ($property.Name.StartsWith('_') -or [string]::IsNullOrEmpty([string]$property.Value)) { continue }
        $variable = $config.CreateElement('environmentVariable')
        $variable.SetAttribute('name', $property.Name)
        $variable.SetAttribute('value', [string]$property.Value)
        [void]$variables.AppendChild($variable)
        $names += $property.Name
    }
    [void]$core.AppendChild($variables)
    $config.Save($webConfig)
    Write-Host "web.config settings: $($names -join ', ')"
    if (-not ($names -contains 'ConnectionStrings__DefaultConnection')) { throw 'ConnectionStrings__DefaultConnection is required.' }

    # --- back up, deploy, verify ---------------------------------------------------------------
    if (-not $SkipBackup -and -not $WhatIf) {
        $backupDir = Join-Path $repo '.local\deploy-backups'
        New-Item -ItemType Directory -Force $backupDir | Out-Null
        Write-Host 'Backing up the live site ...'
        Invoke-MsDeploy @('-verb:sync', "-source:$remote", "-dest:package='$(Join-Path $backupDir "live-$stamp.zip")'", '-retryAttempts:2')
    }
    Write-Host ($(if ($WhatIf) { 'Dry run (no server changes) ...' } else { 'Deploying ...' }))
    $sync = @('-verb:sync', "-source:contentPath='$out'", "-dest:$remote", '-enableRule:AppOffline', '-enableRule:DoNotDeleteRule',
              '-skip:objectName=dirPath,absolutePath=\\App_Data$', '-useChecksum', '-retryAttempts:3')
    if ($WhatIf) { $sync += '-whatif' }
    Invoke-MsDeploy $sync
    if (-not $WhatIf) {
        foreach ($path in '/health/live', '/health/ready') {
            $ok = $false
            for ($i = 0; $i -lt 12 -and -not $ok; $i++) {
                try { $ok = (Invoke-WebRequest "$siteUrl$($path.TrimStart('/'))" -UseBasicParsing -TimeoutSec 60).StatusCode -eq 200 } catch { Start-Sleep 5 }
            }
            Write-Host "$siteUrl$($path.TrimStart('/')) -> $(if ($ok) { 'OK' } else { 'FAILED' })"
            if (-not $ok) { throw "Health check failed: $path (roll back with the backup package if needed)." }
        }
    }
}
finally {
    # The published web.config contains secrets: never leave it on disk.
    if (Test-Path $out) { Remove-Item -LiteralPath "\\?\$out" -Recurse -Force -ErrorAction SilentlyContinue }
    $ErrorActionPreference = 'Continue'
    git -C $repo worktree remove --force $tree 2>&1 | Out-Null
    if (Test-Path $work) { Remove-Item -LiteralPath "\\?\$work" -Recurse -Force -ErrorAction SilentlyContinue }
    git -C $repo worktree prune 2>&1 | Out-Null
    if ($credentialTarget) {
        try { [ArisWebDeployCredentialStore]::DeleteSessionCredential($credentialTarget) }
        catch { Write-Warning 'Could not remove the temporary Web Deploy credential from this Windows session.' }
    }
}
