$exePath = "C:\Users\akhil\Downloads\notestack\dist_app\NoteStack-win32-x64\NoteStack.exe"
$desktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'NoteStack.lnk')
$startMenuPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Programs'), 'NoteStack.lnk')

$WScriptShell = New-Object -ComObject WScript.Shell

# Desktop Shortcut
$shortcut = $WScriptShell.CreateShortcut($desktopPath)
$shortcut.TargetPath = $exePath
$shortcut.WorkingDirectory = "C:\Users\akhil\Downloads\notestack\dist_app\NoteStack-win32-x64"
$shortcut.Description = "NoteStack - College Academic Note & Reference Manager"
$shortcut.Save()

# Start Menu Shortcut
$shortcut2 = $WScriptShell.CreateShortcut($startMenuPath)
$shortcut2.TargetPath = $exePath
$shortcut2.WorkingDirectory = "C:\Users\akhil\Downloads\notestack\dist_app\NoteStack-win32-x64"
$shortcut2.Description = "NoteStack - College Academic Note & Reference Manager"
$shortcut2.Save()

Write-Host "Successfully created NoteStack shortcut on Desktop and Windows Start Menu!"
