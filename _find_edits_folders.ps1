$shell = New-Object -ComObject Shell.Application
$myComputer = $shell.NameSpace(17)
$phone = $myComputer.Items() | Where-Object { $_.Name -eq "moto g54 5G" }
$phoneFolder = $shell.NameSpace($phone.Path)
$internal = $phoneFolder.Items() | Where-Object { $_.Name -eq "Internal shared storage" }
$intFolder = $internal.GetFolder

$rootItems = $intFolder.Items()
$keywords = @("edit","meta","render","export","project","capcut","youcut","video","final","output")

Write-Output "=== Looking for edit/render-related folders ==="
Write-Output ""

for ($i = 0; $i -lt $rootItems.Count; $i++) {
    $item = $rootItems.Item($i)
    $name = $item.Name
    foreach ($kw in $keywords) {
        if ($name.ToLower().Contains($kw)) {
            Write-Output "Root: $name"
            break
        }
    }
}

Write-Output "`n=== DCIM subfolders ==="
$dcim = $rootItems | Where-Object { $_.Name -eq "DCIM" }
$dcimFolder = $dcim.GetFolder
$dcimItems = $dcimFolder.Items()
for ($i = 0; $i -lt $dcimItems.Count; $i++) {
    Write-Output "  $($dcimItems.Item($i).Name)"
}

Write-Output "`n=== Movies subfolders ==="
$movies = $rootItems | Where-Object { $_.Name -eq "Movies" }
$moviesFolder = $movies.GetFolder
$moviesItems = $moviesFolder.Items()
for ($i = 0; $i -lt $moviesItems.Count; $i++) {
    $sub = $moviesItems.Item($i)
    Write-Output "  $($sub.Name)"
}

# Now scan each edit-related folder for video files
Write-Output "`n=== Scanning edit-related folders for video content ==="
$foldersToScan = @()

# Movies\Edits
$edits = $moviesItems | Where-Object { $_.Name -eq "Edits" }
if ($edits) { $foldersToScan += ,@("Movies\Edits", $edits.GetFolder) }

# Pictures edit folder
$picsFolder = ($rootItems | Where-Object { $_.Name -eq "Pictures" }).GetFolder
$picsItems = $picsFolder.Items()
for ($i = 0; $i -lt $picsItems.Count; $i++) {
    $item = $picsItems.Item($i)
    $found = $false
    foreach ($kw in $keywords) {
        if ($item.Name.ToLower().Contains($kw)) { $found = $true; break }
    }
    if ($found -and $item.IsFolder) {
        $foldersToScan += ,@("Pictures\$($item.Name)", $item.GetFolder)
    }
}

# Scan DCIM folders for edits
for ($i = 0; $i -lt $dcimItems.Count; $i++) {
    $item = $dcimItems.Item($i)
    $found = $false
    foreach ($kw in $keywords) {
        if ($item.Name.ToLower().Contains($kw)) { $found = $true; break }
    }
    if ($found -and $item.IsFolder) {
        $foldersToScan += ,@("DCIM\$($item.Name)", $item.GetFolder)
    }
}

foreach ($scan in $foldersToScan) {
    $folderName = $scan[0]
    $folder = $scan[1]
    $items = $folder.Items()
    $videoCount = 0
    $totalSize = 0
    $largest = @()
    for ($i = 0; $i -lt $items.Count; $i++) {
        $sub = $items.Item($i)
        if (-not $sub.IsFolder) {
            $ext = ""
            try { $ext = [string]($sub.ExtendedProperty("System.ItemType")) } catch {}
            if ($ext -in @(".mp4",".avi",".mkv",".mov",".m4v",".3gp")) {
                $videoCount++
                $sz = 0
                try { $sz = [long]($sub.ExtendedProperty("System.Size")) } catch {}
                $totalSize += $sz
                if ($largest.Count -lt 5) {
                    $largest += ,@($sub.Name, $sz)
                }
            }
        }
    }
    Write-Output "`n--- $folderName ---"
    Write-Output "  Videos: $videoCount | Total: $([math]::Round($totalSize/1GB,2)) GB"
    foreach ($l in $largest) {
        Write-Output "  - $($l[0]) ($([math]::Round($l[1]/1MB,1)) MB)"
    }
}
