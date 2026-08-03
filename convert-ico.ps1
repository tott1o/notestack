Add-Type -AssemblyName System.Drawing

$inputPng = "C:\Users\akhil\Downloads\notestack\notestacklogo.png"
$outputIcoRoot = "C:\Users\akhil\Downloads\notestack\notestacklogo.ico"
$outputIcoPublic = "C:\Users\akhil\Downloads\notestack\public\notestacklogo.ico"

$bmp = [System.Drawing.Bitmap]::FromFile($inputPng)
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)

$streamRoot = [System.IO.File]::Create($outputIcoRoot)
$icon.Save($streamRoot)
$streamRoot.Close()

$streamPublic = [System.IO.File]::Create($outputIcoPublic)
$icon.Save($streamPublic)
$streamPublic.Close()

$bmp.Dispose()
Write-Host "Native Windows ICO successfully generated via System.Drawing API!"
