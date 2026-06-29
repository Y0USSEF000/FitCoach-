# 🐺 FitWolf — Progress & Next Steps

_Last updated: 2026-06-29_

## The project
FitWolf — mobile nutrition app. **Frontend:** React Native + Expo (`/mobile`). **Backend:** C# ASP.NET (.NET 8) (`/backend`). Features: wolf mascot, email 6-digit code login, AI food-photo calorie analysis (Gemini), food search, meal programs, notification reminders. **Goal:** publish on Play Store.

## Key facts
- **Expo account:** `y0ussef000` · **project:** `fitwolf-coach` (id `d683db05-c540-443c-8183-f0e62759d223`)
- **GitHub:** `https://github.com/Y0USSEF000/FitCoach-` (branch `main`)
- **Backend (local):** `http://192.168.0.100:5000` · Windows Firewall port 5000 open
- **Secrets** live in `backend/appsettings.json` — git-ignored, never committed. On the cloud they come from **env vars** instead.
- **Chosen cloud host:** Render (free tier, Docker, auto-HTTPS)

## ✅ Done
1. Freed disk (npm cache → 6.5 GB).
2. EAS cloud builds set up (Android-only).
3. Fixed 3 build failures: stale `android/` folder, poisoned lockfile, lockfile requirement.
4. APK built, installed, ran on phone (got past Play Protect).
5. Diagnosed "Could not reach the server": phone browser reaches backend, but **release APK blocks plain http**. Fixed via `expo-build-properties` + `usesCleartextTraffic` in `app.json`.
6. **Fixed the rebuild itself:** `expo-build-properties` was declared but never `npm install`ed — installed it; `expo config` now resolves with cleartext enabled. Build re-running.

## ⏳ In progress
- **EAS rebuild** of the APK with the cleartext fix. After it lands: install new APK → email login works on home Wi-Fi (PC + backend running).

## 🔜 Next: deploy backend to Render (so the app works for anyone, anywhere)
1. Push backend to GitHub (`main`).
2. On Render: **New → Blueprint**, connect the `FitCoach-` repo, point at `backend/render.yaml`.
3. In the Render dashboard, set the `sync:false` secrets: `GEMINI_API_KEY`, `Smtp__Host` (`smtp-relay.brevo.com`), `Smtp__User`, `Smtp__Pass`, `Smtp__From`. (Values are in `backend/appsettings.json`.)
4. Deploy → get the public URL, e.g. `https://fitwolf-backend.onrender.com`.
5. In `mobile/app.json` change `extra.apiUrl` to that **https** URL → rebuild APK once more.

### ⚠️ Known limitation (address before real launch)
The backend uses **SQLite** (`fitwolf.db`) on local disk. Render's **free tier has no persistent disk and spins down after ~15 min idle** → the DB resets on every restart, so **user accounts are lost**. Fine for testing. For real launch, either: add a Render paid plan + persistent disk (keep SQLite, simplest), or migrate to Postgres.

## After that
- Play Store submission (production build = `eas build -p android --profile production` → app-bundle).

## Commands
```powershell
# Rebuild the app (mobile)
cd "C:\Users\dahiy\claude code home\ysf-coach\mobile"
$env:EAS_NO_VCS=1; $env:EAS_SKIP_AUTO_FINGERPRINT=1; $env:EAS_BUILD_SKIP_LOCKFILE_CHECK=1
eas build -p android --profile preview
```
