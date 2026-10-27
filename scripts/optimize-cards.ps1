Add-Type -AssemblyName System.Drawing

$cardsDir = "C:\Users\Madhusanka\.gemini\antigravity\scratch\vacatina\public\cards"
$files = Get-ChildItem "$cardsDir\*.jpg"

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)

foreach ($f in $files) {
    $origBytes = $f.Length
    # Load original image
    $origBmp = [System.Drawing.Bitmap]::FromFile($f.FullName)
    $origW = $origBmp.Width
    $origH = $origBmp.Height
    
    # Calculate target dimensions: max width 1200px
    $targetW = $origW
    $targetH = $origH
    if ($origW -gt 1200) {
        $targetW = 1200
        $targetH = [int](($origH * 1200) / $origW)
    }

    $newBmp = New-Object System.Drawing.Bitmap($targetW, $targetH)
    $g = [System.Drawing.Graphics]::FromImage($newBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $g.DrawImage($origBmp, 0, 0, $targetW, $targetH)
    $g.Dispose()
    $origBmp.Dispose()

    # Save to temp and replace
    $tmpPath = "$($f.FullName).tmp"
    $newBmp.Save($tmpPath, $jpegCodec, $encoderParams)
    $newBmp.Dispose()

    Move-Item -Force $tmpPath $f.FullName
    $newBytes = (Get-Item $f.FullName).Length

    Write-Host "$($f.Name): $origW x $origH ($([math]::Round($origBytes/1024)) KB) -> $targetW x $targetH ($([math]::Round($newBytes/1024)) KB)"
}
