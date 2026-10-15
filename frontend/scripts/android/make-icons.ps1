# Makes the Audito app's launcher icons and splash screen from the Audito logo.
#
# The logo is scaled with its aspect ratio kept (never stretched) and centred on
# white. Use a square logo of 1024 px or larger (public/logo.png is 1024x1024).
#
# Writes:
#   mipmap-*/ic_launcher*.png       launcher icons (legacy, round, adaptive foreground)
#   drawable-*dpi/splash_icon.png   Android 12+ splash icon (288dp, inside the 192dp circle)
#   drawable*/splash.png            splash image for Android 11 and older
#
# Usage (Windows PowerShell, from frontend/):
#   powershell -ExecutionPolicy Bypass -File scripts/android/make-icons.ps1 [-Source public/logo.png]

param([string]$Source = "public/logo.png")

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$frontend = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$res = Join-Path $frontend "android\app\src\main\res"
if (-not (Test-Path $res)) { throw "android/ is missing. Run: npx cap add android" }
$logo = [System.Drawing.Image]::FromFile((Resolve-Path (Join-Path $frontend $Source)))
$white = [System.Drawing.Color]::White

# Draws the logo centred in a width x height canvas, its longer side `fraction` of the shorter canvas side.
function New-Canvas([int]$width, [int]$height, [double]$fraction, [bool]$transparent, [bool]$round) {
  $bitmap = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  if (-not $transparent) {
    $brush = New-Object System.Drawing.SolidBrush $white
    if ($round) { $g.FillEllipse($brush, 0, 0, $width - 1, $height - 1) } else { $g.FillRectangle($brush, 0, 0, $width, $height) }
    $brush.Dispose()
  }
  $box = [Math]::Min($width, $height) * $fraction
  $scale = [Math]::Min($box / $logo.Width, $box / $logo.Height)
  $w = $logo.Width * $scale; $h = $logo.Height * $scale
  $g.DrawImage($logo, [float](($width - $w) / 2), [float](($height - $h) / 2), [float]$w, [float]$h)
  $g.Dispose()
  return $bitmap
}

function Save-Png($bitmap, [string]$path) {
  New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

$densities = [ordered]@{ "mdpi" = 1.0; "hdpi" = 1.5; "xhdpi" = 2.0; "xxhdpi" = 3.0; "xxxhdpi" = 4.0 }
foreach ($density in $densities.Keys) {
  $f = $densities[$density]
  $mipmap = Join-Path $res "mipmap-$density"
  $launcher = [int](48 * $f); $foreground = [int](108 * $f); $splashIcon = [int](288 * $f)
  Save-Png (New-Canvas $launcher $launcher 0.78 $false $false) (Join-Path $mipmap "ic_launcher.png")
  Save-Png (New-Canvas $launcher $launcher 0.68 $false $true) (Join-Path $mipmap "ic_launcher_round.png")
  # Adaptive icon foreground: the logo stays inside the 66dp safe zone of the 108dp layer.
  Save-Png (New-Canvas $foreground $foreground 0.58 $true $false) (Join-Path $mipmap "ic_launcher_foreground.png")
  # Android 12+ splash icon: 288dp canvas, logo within the central 192dp circle.
  Save-Png (New-Canvas $splashIcon $splashIcon 0.6 $true $false) (Join-Path $res "drawable-$density\splash_icon.png")
}

# Splash images for Android 11 and older: white with the logo centred.
Get-ChildItem $res -Directory -Filter "drawable*" | ForEach-Object {
  $splash = Join-Path $_.FullName "splash.png"
  if (Test-Path $splash) {
    $existing = [System.Drawing.Image]::FromFile($splash); $w = $existing.Width; $h = $existing.Height; $existing.Dispose()
    Save-Png (New-Canvas $w $h 0.32 $false $false) $splash
  }
}

$logo.Dispose()
Write-Output "Icons and splash images written to $res"
