# APK Comparison Script
# Usage: .\compare_apk.ps1 original.apk rebuilt.apk

param(
    [string]$OriginalAPK = "original.apk",
    [string]$RebuiltAPK = "rebuilt.apk"
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "    APK Comparison Tool" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Check if files exist
if (-not (Test-Path $OriginalAPK)) {
    Write-Host "ERROR: Original APK not found: $OriginalAPK" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $RebuiltAPK)) {
    Write-Host "ERROR: Rebuilt APK not found: $RebuiltAPK" -ForegroundColor Red
    exit 1
}

# Create temp directories
$TempDir = "apk_compare_temp"
$OriginalDir = "$TempDir\original"
$RebuiltDir = "$TempDir\rebuilt"

Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $OriginalDir -Force | Out-Null
New-Item -ItemType Directory -Path $RebuiltDir -Force | Out-Null

Write-Host "`n[1] Extracting APKs..." -ForegroundColor Yellow

# Extract APKs
Expand-Archive -Path $OriginalAPK -DestinationPath $OriginalDir -Force
Expand-Archive -Path $RebuiltAPK -DestinationPath $RebuiltDir -Force

Write-Host "[2] Comparing file structure..." -ForegroundColor Yellow

# Get file lists
$OriginalFiles = Get-ChildItem -Path $OriginalDir -Recurse -File | ForEach-Object { $_.FullName.Replace($OriginalDir, "") }
$RebuiltFiles = Get-ChildItem -Path $RebuiltDir -Recurse -File | ForEach-Object { $_.FullName.Replace($RebuiltDir, "") }

# Find missing files
$MissingFiles = $OriginalFiles | Where-Object { $_ -notin $RebuiltFiles }
$ExtraFiles = $RebuiltFiles | Where-Object { $_ -notin $OriginalFiles }

Write-Host "`n=== MISSING FILES IN REBUILT APK ===" -ForegroundColor Red
if ($MissingFiles) {
    $MissingFiles | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
} else {
    Write-Host "  None" -ForegroundColor Green
}

Write-Host "`n=== EXTRA FILES IN REBUILT APK ===" -ForegroundColor Yellow
if ($ExtraFiles) {
    $ExtraFiles | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
} else {
    Write-Host "  None" -ForegroundColor Green
}

Write-Host "`n[3] Comparing file sizes..." -ForegroundColor Yellow

$CommonFiles = $OriginalFiles | Where-Object { $_ -in $RebuiltFiles }
$SizeDifferences = @()

foreach ($file in $CommonFiles) {
    $OrigFile = Get-Item "$OriginalDir$file" -ErrorAction SilentlyContinue
    $RebFile = Get-Item "$RebuiltDir$file" -ErrorAction SilentlyContinue
    
    if ($OrigFile -and $RebFile) {
        $OrigSize = $OrigFile.Length
        $RebSize = $RebFile.Length
        
        if ($OrigSize -ne $RebSize) {
            $SizeDifferences += [PSCustomObject]@{
                File = $file
                OriginalSize = $OrigSize
                RebuiltSize = $RebSize
                Difference = $RebSize - $OrigSize
            }
        }
    }
}

Write-Host "`n=== SIZE DIFFERENCES ===" -ForegroundColor Cyan
if ($SizeDifferences) {
    $SizeDifferences | Format-Table -AutoSize
} else {
    Write-Host "  All files have identical sizes" -ForegroundColor Green
}

Write-Host "`n[4] Checking native libraries..." -ForegroundColor Yellow

$ABIs = @("arm64-v8a", "armeabi-v7a", "x86", "x86_64")
foreach ($abi in $ABIs) {
    $OrigLibs = Get-ChildItem -Path "$OriginalDir\lib\$abi" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
    $RebLibs = Get-ChildItem -Path "$RebuiltDir\lib\$abi" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
    
    if ($OrigLibs) {
        Write-Host "`n  $abi:" -ForegroundColor Cyan
        $MissingLibs = $OrigLibs | Where-Object { $_ -notin $RebLibs }
        if ($MissingLibs) {
            Write-Host "    Missing: $($MissingLibs -join ', ')" -ForegroundColor Red
        } else {
            Write-Host "    All libraries present" -ForegroundColor Green
        }
    }
}

Write-Host "`n[5] Checking critical files..." -ForegroundColor Yellow

$CriticalFiles = @(
    "\AndroidManifest.xml",
    "\resources.arsc",
    "\classes.dex",
    "\assets\bin\Data\unity default resources",
    "\assets\bin\Data\globalgamemanagers",
    "\assets\bin\Data\globalgamemanagers.assets",
    "\assets\bin\Data\level0"
)

Write-Host "`n=== CRITICAL FILES STATUS ===" -ForegroundColor Cyan
foreach ($file in $CriticalFiles) {
    $OrigExists = Test-Path "$OriginalDir$file"
    $RebExists = Test-Path "$RebuiltDir$file"
    
    if ($OrigExists -and $RebExists) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } elseif ($OrigExists -and -not $RebExists) {
        Write-Host "  ✗ $file (MISSING IN REBUILT)" -ForegroundColor Red
    } else {
        Write-Host "  ? $file (not in original)" -ForegroundColor Yellow
    }
}

Write-Host "`n[6] Checking META-INF..." -ForegroundColor Yellow

$OrigMetaInf = Get-ChildItem -Path "$OriginalDir\META-INF" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
$RebMetaInf = Get-ChildItem -Path "$RebuiltDir\META-INF" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name

Write-Host "`n  Original META-INF:" -ForegroundColor Cyan
$OrigMetaInf | ForEach-Object { Write-Host "    $_" }

Write-Host "`n  Rebuilt META-INF:" -ForegroundColor Cyan
$RebMetaInf | ForEach-Object { Write-Host "    $_" }

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "    Comparison Complete" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

Write-Host "`nReport saved to: apk_comparison_report.txt" -ForegroundColor Green

# Save report
$Report = @"
APK Comparison Report
Generated: $(Get-Date)

Original APK: $OriginalAPK
Rebuilt APK: $RebuiltAPK

=== SUMMARY ===
Missing Files: $($MissingFiles.Count)
Extra Files: $($ExtraFiles.Count)
Files with Size Differences: $($SizeDifferences.Count)

=== MISSING FILES ===
$($MissingFiles -join "`n")

=== EXTRA FILES ===
$($ExtraFiles -join "`n")

=== SIZE DIFFERENCES ===
$($SizeDifferences | Format-Table -AutoSize | Out-String)
"@

$Report | Out-File -FilePath "apk_comparison_report.txt" -Encoding UTF8

Write-Host "`nTip: Review apk_comparison_report.txt for detailed analysis" -ForegroundColor Cyan
