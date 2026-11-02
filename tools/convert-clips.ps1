<#
  Converts raw screen recordings into web-ready clips for the website.

  Usage (from the website folder):
    .\tools\convert-clips.ps1                         # converts everything in _raw-clips
    .\tools\convert-clips.ps1 -Start 1 -Duration 5    # trim: keep 5 s starting at 1 s
    .\tools\convert-clips.ps1 -Source "C:\path\video.mp4" -Name hero

  Output: assets\clips\<name>.mp4  (H.264, 16:10, no audio, 30 fps, fast start)
  Raw file names become clip names, e.g. "01 Design.mp4" -> "01-design.mp4".
#>
param(
  [string]$Source = "_raw-clips",
  [string]$Name,
  [string]$Output = "assets\clips",
  [int]$Width = 1280,
  [int]$Crf = 26,
  [int]$Fps = 30,
  [double]$Start = 0,
  [double]$Duration = 0
)

$ErrorActionPreference = "Stop"

# winget adds ffmpeg to PATH only for new shells; pick it up here too.
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  throw "ffmpeg not found. Install it with: winget install --id Gyan.FFmpeg -e"
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path $Source)) { throw "Input not found: $Source" }
New-Item -ItemType Directory -Force $Output | Out-Null

$files = if ((Get-Item $Source).PSIsContainer) {
  Get-ChildItem $Source -File | Where-Object { $_.Extension -match '^\.(mp4|mov|mkv|webm|avi)$' }
} else {
  @(Get-Item $Source)
}

if (-not $files) { Write-Host "No videos found in $Source"; return }

$height = [int]([math]::Round($Width * 10 / 16 / 2) * 2)
$filter = "crop='min(iw,ih*16/10)':'min(ih,iw*10/16)',scale=${Width}:${height}:flags=lanczos,fps=$Fps"

foreach ($f in $files) {
  $clipName = if ($Name -and $files.Count -eq 1) { $Name } else {
    ($f.BaseName.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
  }
  $dest = Join-Path $Output "$clipName.mp4"

  $ffArgs = @("-y", "-v", "error", "-stats")
  if ($Start -gt 0)    { $ffArgs += @("-ss", "$Start") }
  if ($Duration -gt 0) { $ffArgs += @("-t", "$Duration") }
  $ffArgs += @(
    "-i", $f.FullName,
    "-vf", $filter,
    "-c:v", "libx264", "-preset", "slow", "-crf", "$Crf",
    "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart",
    $dest
  )

  Write-Host "-> $($f.Name)  =>  $dest"
  & ffmpeg @ffArgs
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed on $($f.Name)" }

  $sizeMb = [math]::Round((Get-Item $dest).Length / 1MB, 2)
  Write-Host "   done: $sizeMb MB"
}
