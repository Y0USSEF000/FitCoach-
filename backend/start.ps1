# ─────────────────────────────────────────────────────────────
# YSF Coach — Backend launcher
# Starts the C# API on 0.0.0.0:5000 so your phone can reach it.
# Set your Gemini key once: $env:GEMINI_API_KEY="..." (or it prompts).
# ─────────────────────────────────────────────────────────────

Set-Location $PSScriptRoot

if (-not $env:GEMINI_API_KEY) {
    $key = Read-Host "Enter your GEMINI_API_KEY (or press Enter to skip / use appsettings.json)"
    if ($key) { $env:GEMINI_API_KEY = $key }
}

Write-Host ""
Write-Host "  Starting YSF Coach API on http://0.0.0.0:5000 ..." -ForegroundColor Cyan
Write-Host ""

dotnet run --urls http://0.0.0.0:5000
