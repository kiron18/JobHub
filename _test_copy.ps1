$shell = New-Object -ComObject Shell.Application
$dest = "E:\Phone transfer"
$destObj = $shell.NameSpace($dest)

$myComputer = $shell.NameSpace(17)
$phone = $myComputer.Items() | Where-Object { $_.Name -eq "moto g54 5G" }
$phoneFolder = $shell.NameSpace($phone.Path)
$internal = $phoneFolder.Items() | Where-Object { $_.Name -eq "Internal shared storage" }
$intFolder = $internal.GetFolder

# Navigate to DCIM\Camera
$rootItems = $intFolder.Items()
$dcim = $rootItems | Where-Object { $_.Name -eq "DCIM" }
$dcimFolder = $dcim.GetFolder
$camera = $dcimFolder.Items() | Where-Object { $_.Name -eq "Camera" }
$camFolder = $camera.GetFolder

# Find a video file in Camera
$camItems = $camFolder.Items()
$foundVideo = $null
for ($i = 0; $i -lt $camItems.Count; $i++) {
    $item = $camItems.Item($i)
    $kind = ""
    try { $kind = [string]($item.ExtendedProperty("System.ItemType")) } catch {}
    if ($kind -eq ".mp4") { $foundVideo = $item; break }
}

if ($foundVideo) {
    $name = $foundVideo.Name
    $realName = ""
    try { $realName = [string]($foundVideo.ExtendedProperty("System.FileName")) } catch {}
    if (-not $realName) { $realName = $name }
    Write-Output "Testing copy of: $name"
    Write-Output "Real filename: $realName"
    Write-Output "Dest path: $dest\$realName"
    Write-Output "Already exists: $(Test-Path "$dest\$realName")"

    Write-Output "`nInitiating CopyHere..."
    $destObj.CopyHere($foundVideo, 0x14)
    Write-Output "CopyHere returned."

    Write-Output "Waiting up to 30s for file..."
    $timeout = [DateTime]::Now.AddSeconds(30)
    while ([DateTime]::Now -lt $timeout) {
        if (Test-Path "$dest\$realName") {
            Write-Output "FOUND at destination!"
            break
        }
        # Check if it appeared with just the name (no ext)
        if (Test-Path "$dest\$name") {
            Write-Output "FOUND at destination (without extension)!"
            break
        }
        Start-Sleep 1
    }
    if (-not (Test-Path "$dest\$realName") -and -not (Test-Path "$dest\$name")) {
        Write-Output "File not found after 30s. Checking directory contents..."
        Get-ChildItem $dest | Select-Object Name, Length | Sort-Object LastWriteTime -Descending | Select-Object -First 10
    }
} else {
    Write-Output "No .mp4 found in Camera folder!"
}
