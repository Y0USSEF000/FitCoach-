# ============================================================
#  YSF Coach — One-Click Launcher
#  Run this script every time to start the app
# ============================================================

$root   = "c:\Users\dahiy\claude code home\ysf-coach"
$back   = "$root\backend"
$mobile = "$root\mobile"

Write-Host ""
Write-Host "  ██╗   ██╗███████╗███████╗" -ForegroundColor Magenta
Write-Host "  ╚██╗ ██╔╝██╔════╝██╔════╝" -ForegroundColor Magenta
Write-Host "   ╚████╔╝ ███████╗█████╗  " -ForegroundColor Magenta
Write-Host "    ╚██╔╝  ╚════██║██╔══╝  " -ForegroundColor Magenta
Write-Host "     ██║   ███████║██║     " -ForegroundColor Magenta
Write-Host "     ╚═╝   ╚══════╝╚═╝     " -ForegroundColor Magenta
Write-Host "     YSF Coach Launcher" -ForegroundColor Cyan
Write-Host ""

# ── 1. Get current WiFi IP ───────────────────────────────────
$IP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.*" -and
    $_.IPAddress -notlike "172.*"
} | Select-Object -First 1).IPAddress

if (-not $IP) {
    Write-Host "  [ERROR] No WiFi connection found. Connect to WiFi first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "  ✓ Your IP address: $IP" -ForegroundColor Green

# ── 2. Kill old processes ────────────────────────────────────
Write-Host "  → Stopping old processes..." -ForegroundColor Yellow
Stop-Process -Name "node"         -Force -ErrorAction SilentlyContinue
Stop-Process -Name "YsfCoach.Api" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# ── 3. Update app.json with current IP ──────────────────────
$appJsonPath = "$mobile\app.json"
$json = Get-Content $appJsonPath -Raw | ConvertFrom-Json
$json.expo.extra.apiUrl = "http://${IP}:5000"
$json | ConvertTo-Json -Depth 20 | Set-Content $appJsonPath -Encoding UTF8
Write-Host "  ✓ API URL set to: http://${IP}:5000" -ForegroundColor Green

# ── 4. Start backend ─────────────────────────────────────────
Write-Host "  → Starting backend API..." -ForegroundColor Cyan
$backendProc = Start-Process powershell -ArgumentList `
    "-WindowStyle", "Minimized", `
    "-Command", "cd '$back'; dotnet run --urls 'http://0.0.0.0:5000'" `
    -PassThru
Start-Sleep -Seconds 12

# ── 5. Verify backend ────────────────────────────────────────
try {
    $r = Invoke-WebRequest -Uri "http://localhost:5000/" -UseBasicParsing -TimeoutSec 5
    Write-Host "  ✓ Backend running: $($r.Content)" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Backend not responding yet — it may still be starting" -ForegroundColor Yellow
}

# ── 6. Start Expo ─────────────────────────────────────────────
Write-Host ""
Write-Host "  → Starting Expo..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║   Open Expo Go on your phone and     ║" -ForegroundColor White
Write-Host "  ║   SCAN THE QR CODE that appears      ║" -ForegroundColor White
Write-Host "  ║   below (not a saved one!)           ║" -ForegroundColor Yellow
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

Set-Location $mobile
npx expo start --lan --port 8082 --clear
