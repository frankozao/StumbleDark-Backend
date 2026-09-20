# AndroidManifest Checker
param(
    [string]$APK = "app.apk"
)

Write-Host "Checking AndroidManifest.xml..." -ForegroundColor Cyan

# Decode manifest
$Output = "decoded_manifest.xml"
aapt dump xmltree $APK AndroidManifest.xml > $Output

Write-Host "`nManifest decoded to: $Output" -ForegroundColor Green
Write-Host "`nChecking for common issues..." -ForegroundColor Yellow

# Check for required elements
$Content = Get-Content $Output -Raw

$Checks = @{
    "application" = $Content -match "application"
    "activity" = $Content -match "activity"
    "uses-permission" = $Content -match "uses-permission"
    "package" = $Content -match "package="
}

foreach ($check in $Checks.GetEnumerator()) {
    if ($check.Value) {
        Write-Host "  ✓ $($check.Key) found" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $($check.Key) NOT FOUND!" -ForegroundColor Red
    }
}

Write-Host "`nFull manifest saved to: $Output" -ForegroundColor Cyan
