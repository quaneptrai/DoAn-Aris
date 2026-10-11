param(
    [Parameter(Mandatory=$true)][string]$RuntimeRoot,
    [Parameter(Mandatory=$true)][string]$ReferencePath,
    [string]$Python = 'python',
    [ValidateSet('cpu','cuda','auto')][string]$Device = 'cpu'
)
$ErrorActionPreference = 'Stop'
$setupRoot = [IO.Path]::GetFullPath($RuntimeRoot)
$voiceReference = (Resolve-Path -LiteralPath $ReferencePath).Path
$helpers = Join-Path $PSScriptRoot 'runtime-setup'
if ($setupRoot -eq [IO.Path]::GetPathRoot($setupRoot)) { throw 'Choose a dedicated runtime directory.' }
$checkPython = @'
import sys,torch,numpy,scipy,sklearn,joblib,cffi,requests,packaging,lazy_loader,jieba
if sys.version_info[:2] != (3,11):raise SystemExit('This dependency lock requires Python 3.11 on Windows x64.')
print('Existing PyTorch:',torch.__version__)
'@
& $Python -c $checkPython
if ($LASTEXITCODE -ne 0) { throw 'Use an existing Python 3.11 environment with PyTorch and the numerical dependencies.' }
New-Item -ItemType Directory -Force -Path $setupRoot | Out-Null
& node (Join-Path $helpers 'download-openvoice.mjs') --root $setupRoot
if ($LASTEXITCODE -ne 0) { throw 'Pinned source or model download failed.' }
& node (Join-Path $helpers 'download-dependencies.mjs') --root $setupRoot
if ($LASTEXITCODE -ne 0) { throw 'Dependency download failed.' }
$extractSource = @'
import sys,zipfile
from pathlib import Path,PurePosixPath
root=Path(sys.argv[1]).resolve()
target=root/'OpenVoice'
with zipfile.ZipFile(root/'downloads/openvoice-source.zip') as archive:
 for entry in archive.infolist():
  parts=PurePosixPath(entry.filename).parts
  if not parts or parts[0]!='OpenVoice-74a1d147b17a8c3092dd5430504bd83ef6c7eb23':raise ValueError('Wrong source revision')
  output=target.joinpath(*parts[1:])
  if not output.resolve().is_relative_to(target.resolve()):raise ValueError('Archive path escape')
  if entry.is_dir():output.mkdir(parents=True,exist_ok=True)
  else:
   output.parent.mkdir(parents=True,exist_ok=True)
   output.write_bytes(archive.read(entry))
'@
& $Python -c $extractSource $setupRoot
if ($LASTEXITCODE -ne 0) { throw 'Source extraction failed.' }
& $Python -m venv --system-site-packages (Join-Path $setupRoot 'venv')
if ($LASTEXITCODE -ne 0) { throw 'Virtual environment creation failed.' }
$runtimePython = Join-Path $setupRoot 'venv/Scripts/python.exe'
$wheelFolder = Join-Path $setupRoot 'wheels'
& $runtimePython -m pip install --no-index --no-cache-dir --find-links $wheelFolder wheel==0.48.0
if ($LASTEXITCODE -ne 0) { throw 'Build dependency install failed.' }
& $runtimePython -m pip install --no-index --no-cache-dir --no-build-isolation --find-links $wheelFolder librosa==0.11.0 soundfile==0.13.1 inflect==7.5.0 Unidecode==1.4.0 eng_to_ipa==0.0.2 pypinyin==0.55.0 cn2an==0.5.24
if ($LASTEXITCODE -ne 0) { throw 'Runtime dependency install failed.' }
# The upstream full requirements include unused TTS/ASR/UI packages and obsolete
# numerical pins. Only its tone-conversion API is installed into this local venv.
& $runtimePython -m pip install --no-index --no-cache-dir --no-deps --no-build-isolation (Join-Path $setupRoot 'OpenVoice')
if ($LASTEXITCODE -ne 0) { throw 'Tone-conversion source install failed.' }
$workerConfig = Join-Path $setupRoot 'voice-conversion.local.json'
$config = @{ modelDir = (Join-Path $setupRoot 'models/converter'); device = $Device; maxDurationDriftMs = 80; voices = @{ ruby_wav_clean = @{ name = 'Ruby'; referencePath = $voiceReference } } }
$config | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $workerConfig -Encoding UTF8
$workerPath = Join-Path $PSScriptRoot 'voice_conversion_worker.py'
$readyJson = & $runtimePython $workerPath --health --config $workerConfig
if ($LASTEXITCODE -ne 0) { throw 'Worker readiness failed.' }
$ready = $readyJson | ConvertFrom-Json
if (-not $ready.ready) { throw 'The configured local voice is not ready.' }
Write-Output 'Local voice is ready. Merge this server-only section into gateway config:'
@{ voiceConversion = @{ pythonPath = $runtimePython; workerPath = $workerPath; configPath = $workerConfig; timeoutSeconds = 180; maxDurationDriftMs = 80 } } | ConvertTo-Json -Depth 4
# The reference file is read locally by the worker; no setup request contains audio.
