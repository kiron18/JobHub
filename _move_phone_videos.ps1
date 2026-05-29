param(
    [string]$DestPath = "E:\Phone transfer"
)

$targetFoldersAndNames = @(
    @("DCIM\Camera", "VID_20250703_070513866"),
    @("DCIM\Camera", "VID_20260119_181139502"),
    @("DCIM\Camera", "VID_20250713_180746420"),
    @("DCIM\Camera", "VID_20250618_105428287"),
    @("DCIM\Camera", "VID_20251117_194550320"),
    @("DCIM\Camera", "VID_20251120_144351471"),
    @("Movies\Edits", "VID_20250703_151627_654_bsl"),
    @("DCIM\Camera", "VID_20251221_123716303"),
    @("DCIM\Camera", "VID_20251109_154157698"),
    @("DCIM\Camera", "VID_20251109_160722769"),
    @("DCIM\Camera", "VID_20251120_165304579"),
    @("DCIM\Camera", "VID_20250711_151849459"),
    @("DCIM\Camera", "VID_20250829_110328445"),
    @("DCIM\Camera", "VID_20251124_182806743"),
    @("DCIM\Camera", "VID_20250715_203301724"),
    @("Movies\Recorder0", "Recording_20250807_205539"),
    @("DCIM\Camera", "VID_20251109_154803641"),
    @("DCIM\Camera", "VID_20251208_212222261"),
    @("DCIM\Camera", "VID_20260219_165940913"),
    @("DCIM\Camera", "VID_20251122_182258104"),
    @("DCIM\Camera", "VID_20251126_112041510"),
    @("DCIM\Camera", "VID_20251223_235947317"),
    @("DCIM\Camera", "VID_20251120_145354657"),
    @("DCIM\Camera", "VID_20260306_120103116"),
    @("Pictures", "VID_20250702_143819_620_bsl~2"),
    @("DCIM\Camera", "VID_20251221_123716303_02"),
    @("Movies\Recorder0", "Recording_20250815_225044"),
    @("DCIM\Camera", "VID_20250703_164511265"),
    @("Download", "DJI_20250907190842_0172_D"),
    @("DCIM\Camera", "VID_20260129_143041837"),
    @("DCIM\Camera", "VID_20260314_135734428"),
    @("DCIM\Camera", "VID_20260309_205645326"),
    @("DCIM\Camera", "VID_20260111_060548587"),
    @("DCIM\Camera", "VID_20251124_215515184"),
    @("DCIM\Camera", "VID_20260129_125540662"),
    @("Movies\Recorder0", "Recording_20250808_110444"),
    @("DCIM\Camera", "VID_20250618_122235707"),
    @("Movies\youcut", "YouCut_20250617_075935383"),
    @("DCIM\Camera", "VID_20260122_173845044"),
    @("DCIM\Camera", "VID_20250829_100016371"),
    @("DCIM\Camera", "VID_20251210_133359589"),
    @("Movies\Edits", "VID_20251013_200144_945_bsl"),
    @("DCIM\Camera", "VID_20250715_200133066"),
    @("DCIM\Camera", "VID_20250817_191027719"),
    @("DCIM\Camera", "VID_20251122_213519008"),
    @("DCIM\Camera", "VID_20250817_185143136"),
    @("DCIM\Camera", "VID_20260309_205855207"),
    @("DCIM\Camera", "VID_20250806_155551671"),
    @("DCIM\Camera", "VID_20251221_184822572"),
    @("DCIM\Camera", "VID_20250709_184131011"),
    @("DCIM\DJI Album", "dji_fly_20250907_141822_0_1757218702059_video_low_quality"),
    @("DCIM\Camera", "VID_20250714_173236754"),
    @("DCIM\DJI Album", "dji_fly_20250907_133310_0_1757215990920_video_low_quality"),
    @("Movies\Edits", "VID_20251125_184747_538_bsl"),
    @("DCIM\Camera", "VID_20260115_175425799"),
    @("DCIM\Camera", "VID_20251208_212800705"),
    @("DCIM\DJI Album", "dji_fly_20250817_144145_0_1755405705688_video_low_quality"),
    @("DCIM\Camera", "VID_20260127_173403698"),
    @("DCIM\Camera", "VID_20251206_222111195"),
    @("DCIM\Camera", "VID_20250726_143226339"),
    @("Download", "Jake Workout Video (w) VO"),
    @("Movies\Edits", "VID_20251212_154014_604_bsl"),
    @("DCIM\Camera", "VID_20260129_173618397"),
    @("DCIM\Camera", "VID_20250829_112414434"),
    @("DCIM\Camera", "VID_20251109_154011578"),
    @("DCIM\Camera", "VID_20260115_175758254"),
    @("DCIM\Camera", "VID_20260119_182540911"),
    @("DCIM\Camera", "VID_20260111_061318208"),
    @("DCIM\Camera", "VID_20250926_061805627"),
    @("DCIM\OpenCamera", "VID_20250617_175020"),
    @("Movies\Recorder0", "Recording_20250521_183001"),
    @("Movies\Recorder0", "Recording_20250629_160717"),
    @("DCIM\Camera", "VID_20251223_235520087"),
    @("DCIM\Camera", "VID_20260316_131053489"),
    @("Movies\Edits", "VID_20250625_142343_393_bsl"),
    @("DCIM\Camera", "VID_20260119_182120276"),
    @("Movies\LinkedIn", "20260401_222416"),
    @("DCIM\Camera", "VID_20251109_151301412"),
    @("DCIM\Camera", "VID_20251109_151401228"),
    @("DCIM\Camera", "VID_20250803_090309108"),
    @("DCIM\Camera", "VID_20260124_133947075"),
    @("DCIM\Camera", "VID_20250707_122904143"),
    @("DCIM\Camera", "VID_20250628_161133052"),
    @("DCIM\DJI Album", "dji_fly_20250822_154746_0_1755841666491_video_low_quality"),
    @("DCIM\Camera", "VID_20260309_205506424"),
    @("DCIM\Camera", "VID_20250904_162848959"),
    @("DCIM\Camera", "VID_20260124_141610791"),
    @("DCIM\Camera", "VID_20260124_143433720"),
    @("DCIM\Camera", "VID_20250618_110205359"),
    @("DCIM\Camera", "VID_20251122_213937933"),
    @("DCIM\Camera", "VID_20250704_165330158"),
    @("DCIM\Camera", "VID_20250722_210043637"),
    @("DCIM\Camera", "VID_20250713_180135091"),
    @("DCIM\Camera", "VID_20251208_221918386"),
    @("DCIM\Camera", "VID_20250829_130059475"),
    @("DCIM\DJI Album", "dji_fly_20250828_152227_0_1756358547309_video_low_quality"),
    @("DCIM\Camera", "VID_20251208_213213723"),
    @("DCIM\Camera", "VID_20251221_183722889"),
    @("DCIM\Camera", "VID_20260111_005418695"),
    @("DCIM\Camera", "3 things")
)

$targetLookup = @{}
foreach ($entry in $targetFoldersAndNames) {
    $key = $entry[0] + "\" + $entry[1]
    $targetLookup[$key] = $true
}

$shell = New-Object -ComObject Shell.Application
$destFolderObj = $shell.NameSpace($DestPath)

$myComputer = $shell.NameSpace(17)
$phone = $myComputer.Items() | Where-Object { $_.Name -eq "moto g54 5G" }
if ($phone -eq $null) { Write-Error "Phone not found - is it connected?"; exit 1 }
$phoneFolder = $shell.NameSpace($phone.Path)
$internal = $phoneFolder.Items() | Where-Object { $_.Name -eq "Internal shared storage" }
$intFolder = $internal.GetFolder

$copied = 0
$skipped = 0
$failed = 0
$deleted = 0
$totalTargets = $targetFoldersAndNames.Count

function Wait-ForFile($destPath, $fileName, $timeoutSecs) {
    $timeout = [DateTime]::Now.AddSeconds($timeoutSecs)
    # Try with the exact filename first, then just the name (no extension)
    while ([DateTime]::Now -lt $timeout) {
        if (Test-Path (Join-Path $destPath $fileName)) { return $true }
        Start-Sleep -Milliseconds 1000
    }
    return $false
}

function Find-AndProcessItem($folder, [string]$currentPath) {
    $items = $folder.Items()
    if ($items -eq $null) { return }

    for ($i = 0; $i -lt $items.Count; $i++) {
        $item = $items.Item($i)
        if ($item -eq $null) { continue }

        $name = $item.Name
        $fullPath = if ($currentPath) { "$currentPath\$name" } else { $name }
        $isFolder = $item.IsFolder

        if ($isFolder) {
            $prefix = $fullPath + "\"
            $hasMatch = $false
            foreach ($key in $targetLookup.Keys) {
                if ($key.StartsWith($prefix)) { $hasMatch = $true; break }
            }
            if ($hasMatch) {
                try {
                    $subFolder = $item.GetFolder
                    if ($subFolder -ne $null) { Find-AndProcessItem $subFolder $fullPath }
                } catch {}
            }
        } elseif ($targetLookup.ContainsKey($fullPath)) {
            Write-Output "  [$($copied+$skipped+$failed+1)/$totalTargets] Found: $fullPath"

            # Get real filename with extension
            $realName = ""
            try { $realName = [string]($item.ExtendedProperty("System.FileName")) } catch {}
            if (-not $realName) { $realName = $name }

            $destFile = Join-Path $DestPath $realName
            if (Test-Path $destFile) {
                Write-Output "    Already at destination, deleting from phone..."
                $script:skipped++
            } else {
                Write-Output "    Copying (~$([math]::Round((try{[long]($item.ExtendedProperty('System.Size'))}catch{0})/1MB,1)) MB)..."
                try {
                    $destFolderObj.CopyHere($item, 0x14)
                    $copiedOk = Wait-ForFile $DestPath $realName 180
                    if ($copiedOk) {
                        Write-Output "    Copied OK."
                        $script:copied++
                    } else {
                        Write-Output "    TIMEOUT - file may not have copied."
                        $script:failed++
                    }
                } catch {
                    Write-Output "    Error: $_"
                    $script:failed++
                }
            }

            # Delete from phone regardless (already exists or copied OK)
            if ((Test-Path $destFile)) {
                try {
                    $item.InvokeVerb("delete")
                    Write-Output "    Deleted from phone."
                    $script:deleted++
                } catch {
                    Write-Output "    Could not delete: $_"
                }
            }
        }
    }
}

Write-Output "=== Moving top 100 largest videos from phone to E:\Phone transfer ==="
Write-Output "Scanning phone folders..."
Write-Output ""

Find-AndProcessItem $intFolder ""

Write-Output ""
Write-Output "=== Transfer complete ==="
Write-Output "  Total targeted: $totalTargets"
Write-Output "  Copied to PC:   $copied"
Write-Output "  Already existed: $skipped"
Write-Output "  Failed/Timeout: $failed"
Write-Output "  Deleted from phone: $deleted"
Write-Output ""
if ($failed -gt 0) { Write-Output "WARNING: $failed files may not have transferred. Check E:\Phone transfer and phone." }
