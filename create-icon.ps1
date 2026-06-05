Add-Type -AssemblyName System.Drawing

$outPath = Join-Path $PSScriptRoot "build\icon.ico"

$sizes = @(256, 128, 64, 48, 32, 16)
$streams = New-Object System.Collections.ArrayList

foreach ($sz in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 30, 80))
    $g.FillRectangle($bgBrush, 0, 0, $sz, $sz)

    $circleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 30, 100, 200))
    $margin = [int]($sz * 0.08)
    $g.FillEllipse($circleBrush, $margin, $margin, $sz - 2*$margin, $sz - 2*$margin)

    $fontSize = [Math]::Max(8, [int]($sz * 0.52))
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, 0, $sz, $sz)
    $g.DrawString("R", $font, [System.Drawing.Brushes]::White, $rect, $sf)

    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    [void]$streams.Add(@($sz, $ms.ToArray()))
    $ms.Dispose()
    $bmp.Dispose()
}

$out = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($out)

$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$streams.Count)

$headerSize = 6 + 16 * $streams.Count
$offset = $headerSize
foreach ($entry in $streams) {
    $data = $entry[1]
    $offset += $data.Length
}
$offset = $headerSize
foreach ($entry in $streams) {
    $sz = $entry[0]
    $data = $entry[1]
    $w = if ($sz -eq 256) { 0 } else { [byte]$sz }
    $h = if ($sz -eq 256) { 0 } else { [byte]$sz }
    $writer.Write([byte]$w)
    $writer.Write([byte]$h)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$data.Length)
    $writer.Write([uint32]$offset)
    $offset += $data.Length
}
foreach ($entry in $streams) {
    $writer.Write($entry[1])
}
$writer.Flush()
[System.IO.File]::WriteAllBytes($outPath, $out.ToArray())
$out.Dispose()

$size = (Get-Item $outPath).Length
Write-Host "Icon created successfully: $size bytes at $outPath"
