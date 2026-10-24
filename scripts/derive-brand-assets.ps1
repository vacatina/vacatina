# ============================================================================
# Vacatina — Web-optimized brand derivatives from Official Logo Pack v2
#
# FULL LOGOS: lossless crop of the transparent canvas ONLY. Pixels belonging to
#   the artwork are copied 1:1 (no resample, no recolor, tagline retained).
#   A small transparent safety margin is kept; the brand clear-space rule
#   (width of lowercase "n") is enforced in layout CSS around the <img>.
# MARK / ICONS: proportional resize of the official standalone mark
#   (Vacatina_Mark_SpaceCadet.png) for favicon / Apple touch / PWA icons.
# SHARE CARD: 1200x630 composed from the official primary full logo only.
# ============================================================================
param([string]$Root = (Split-Path -Parent $PSScriptRoot))
Add-Type -AssemblyName System.Drawing

$brand = Join-Path $Root 'public\brand'
$web = Join-Path $brand 'web'
New-Item -ItemType Directory -Force -Path $web | Out-Null

function Get-AlphaBBox([System.Drawing.Bitmap]$bmp) {
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($data.Stride * $bmp.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)
  $minX = $bmp.Width; $minY = $bmp.Height; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    $row = $y * $data.Stride
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      if ($bytes[$row + $x * 4 + 3] -gt 0) {
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  return @{ X = $minX; Y = $minY; W = ($maxX - $minX + 1); H = ($maxY - $minY + 1); Bytes = $bytes; Stride = $data.Stride }
}

$pad = 8
$report = @()
foreach ($name in 'Vacatina_Logo_Primary_FullColor', 'Vacatina_Logo_Reverse_SpaceCadet', 'Vacatina_Logo_OneColor_SpaceCadet') {
  $src = [System.Drawing.Bitmap]::FromFile((Join-Path $brand "full-logo\$name.png"))
  $bb = Get-AlphaBBox $src
  $out = New-Object System.Drawing.Bitmap ($bb.W + 2 * $pad), ($bb.H + 2 * $pad), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  # 1:1 pixel copy (no interpolation): LockBits row copy
  $srcRect = New-Object System.Drawing.Rectangle $bb.X, $bb.Y, $bb.W, $bb.H
  $sd = $src.LockBits($srcRect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $dstRect = New-Object System.Drawing.Rectangle $pad, $pad, $bb.W, $bb.H
  $dd = $out.LockBits($dstRect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $rowBuf = New-Object byte[] ($bb.W * 4)
  for ($y = 0; $y -lt $bb.H; $y++) {
    [System.Runtime.InteropServices.Marshal]::Copy([IntPtr]($sd.Scan0.ToInt64() + $y * $sd.Stride), $rowBuf, 0, $rowBuf.Length)
    [System.Runtime.InteropServices.Marshal]::Copy($rowBuf, 0, [IntPtr]($dd.Scan0.ToInt64() + $y * $dd.Stride), $rowBuf.Length)
  }
  $src.UnlockBits($sd); $out.UnlockBits($dd)
  $outPath = Join-Path $web "$name.web.png"
  $out.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $report += "$name.web.png  canvas=$($out.Width)x$($out.Height)  artwork=$($bb.W)x$($bb.H) (source bbox x=$($bb.X) y=$($bb.Y) of $($src.Width)x$($src.Height))"
  $out.Dispose(); $src.Dispose()
}

function Save-Resized([string]$srcPath, [int]$size, [string]$outPath) {
  $src = [System.Drawing.Bitmap]::FromFile($srcPath)
  $dst = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.DrawImage($src, 0, 0, $size, $size)
  $g.Dispose(); $dst.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png); $dst.Dispose(); $src.Dispose()
}

$markSrc = Join-Path $brand 'marks\Vacatina_Mark_SpaceCadet.png'
$icons = Join-Path $Root 'public\icons'
New-Item -ItemType Directory -Force -Path $icons | Out-Null
foreach ($s in 16, 32, 48, 180, 192, 512) {
  $fn = if ($s -eq 180) { 'apple-touch-icon.png' } else { "icon-$s.png" }
  Save-Resized $markSrc $s (Join-Path $icons $fn)
  $report += "icons/$fn  ${s}x${s} (official Space Cadet mark, proportional)"
}
Save-Resized $markSrc 144 (Join-Path $web 'Vacatina_Mark_SpaceCadet.web.png')
$report += "web/Vacatina_Mark_SpaceCadet.web.png 144x144 (header mark @ up to 4x density)"

# Maskable PWA icon: official mark centred inside the 80% safe zone on white
$mask = New-Object System.Drawing.Bitmap 512, 512
$g = [System.Drawing.Graphics]::FromImage($mask)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$m = [System.Drawing.Bitmap]::FromFile($markSrc)
$g.DrawImage($m, 76, 76, 360, 360)
$g.Dispose(); $m.Dispose()
$mask.Save((Join-Path $icons 'icon-maskable-512.png'), [System.Drawing.Imaging.ImageFormat]::Png); $mask.Dispose()
$report += "icons/icon-maskable-512.png 512x512 (mark inside maskable safe zone)"

# 1200x630 social share card: white field, official primary full logo (proportional), no generated text
$share = New-Object System.Drawing.Bitmap 1200, 630
$g = [System.Drawing.Graphics]::FromImage($share)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$logo = [System.Drawing.Bitmap]::FromFile((Join-Path $web 'Vacatina_Logo_Primary_FullColor.web.png'))
$w = 820; $h = [int]([double]$logo.Height * $w / $logo.Width)
$g.DrawImage($logo, [int]((1200 - $w) / 2), [int]((630 - $h) / 2) - 10, $w, $h)
$navy = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(27, 20, 100))
$g.FillRectangle($navy, 0, 606, 1200, 24)
$g.Dispose(); $logo.Dispose()
$share.Save((Join-Path $Root 'public\og\vacatina-share-1200x630.png'), [System.Drawing.Imaging.ImageFormat]::Png) 2>$null
if (-not $?) {
  New-Item -ItemType Directory -Force -Path (Join-Path $Root 'public\og') | Out-Null
  $share.Save((Join-Path $Root 'public\og\vacatina-share-1200x630.png'), [System.Drawing.Imaging.ImageFormat]::Png)
}
$share.Dispose()
$report += "og/vacatina-share-1200x630.png 1200x630 (official primary full logo on white + Space Cadet base rule)"

$report | Set-Content (Join-Path $web 'DERIVATIVES.txt')
$report
