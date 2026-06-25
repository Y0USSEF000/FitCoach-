# =============================================================
# FitWolf - Expo launcher
#  * Kills any stale Metro (so it always uses port 8081)
#  * Auto-detects your LAN IP and syncs app.json + Metro host
#  * Runs offline so Expo's flaky dependency check can't crash startup
# =============================================================

Set-Location $PSScriptRoot

# 0. Free Metro ports 8081/8082 from any leftover process.
foreach ($port in 8081, 8082) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction Stop; Write-Host ("  Freed port {0} (stopped PID {1})" -f $port, $c.OwningProcess) -ForegroundColor DarkGray } catch {}
    }
}

# 1. Find the active LAN IPv4 (adapter with a default gateway).
$ip = (Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
    Select-Object -First 1 -ExpandProperty IPv4Address).IPAddress

if (-not $ip) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } |
        Select-Object -First 1 -ExpandProperty IPAddress)
}

if (-not $ip) {
    Write-Host "Could not detect your LAN IP. Connect to Wi-Fi and try again." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  Detected LAN IP: $ip" -ForegroundColor Green

# 2. Keep app.json's apiUrl in sync so the app reaches your backend.
$appJsonPath = Join-Path $PSScriptRoot "app.json"
$appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
$desired = "http://${ip}:5000"
if ($appJson.expo.extra.apiUrl -ne $desired) {
    $appJson.expo.extra.apiUrl = $desired
    $appJson | ConvertTo-Json -Depth 30 | Set-Content $appJsonPath -Encoding utf8
    Write-Host "  Updated app.json apiUrl -> $desired" -ForegroundColor Green
}

# 3. Force Metro host + run offline (avoids the 'Body has already been read' crash).
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip
$env:EXPO_OFFLINE = "1"

Write-Host ""
Write-Host "  Starting Expo on exp://${ip}:8081 - scan the QR in Expo Go." -ForegroundColor Cyan
Write-Host ""

npx expo start --lan -c
