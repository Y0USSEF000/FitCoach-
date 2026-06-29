# FitWolf — Mobile App

AI nutrition coach, ported from the Telegram bot to an **Expo React Native** app
with a **C# (ASP.NET Core)** backend.

Multi-language: Arabic · French · German · Spanish · English.

## What it does

- **Onboarding** — language, height, weight, age, gender, activity, goal.
- **Macro targets + BMI** — Mifflin-St Jeor BMR → TDEE → goal-adjusted macros (same formula as the bot).
- **Food photo logging** — snap a meal, Gemini Vision estimates macros, logged against the day.
- **Daily status** — progress bars per macro with "remaining" amounts.
- **Meal program** — Gemini-generated 1-day plan + coach message (offline fallback included).
- **Meals list + undo last meal.**
- **🔔 Notifications** (the new feature):
  - **Time to eat** — daily at each configured meal time.
  - **Time to drink** — repeating every N hours.
  - **Did you eat today?** — daily 20:00 check-in, plus an immediate nudge when you open
    the app and have logged nothing yet.

## Architecture

```
ysf-coach/
├── backend/        C# ASP.NET Core minimal API (all logic + Gemini calls + storage)
│   ├── Program.cs              endpoints
│   ├── Models/Models.cs        User, Meal, DayLog, Targets, NotificationPrefs, DTOs
│   └── Services/
│       ├── NutritionService.cs targets + BMI (ported from calculate_targets/calculate_bmi)
│       ├── GeminiService.cs    text + vision via generativelanguage REST, model fallback
│       └── UserStore.cs        users.json file store (mirrors the bot)
└── mobile/         Expo + expo-router + TypeScript
    ├── app/                    screens (onboarding + tabs: dashboard, meals, program, settings)
    └── src/lib/
        ├── i18n.ts             5-language UI strings
        ├── api.ts              backend client (X-User-Id device key)
        ├── notifications.ts    expo-notifications scheduling
        ├── store.tsx           app state (lang, profile)
        └── ui.tsx / theme.ts   shared components + colors
```

## Quick start (Windows, two PowerShell windows)

**Window 1 — backend:**
```powershell
cd "ysf-coach\backend"
.\start.ps1      # prompts for your Gemini key, then runs on 0.0.0.0:5000
```

**Window 2 — mobile app:**
```powershell
cd "ysf-coach\mobile"
.\start.ps1      # auto-detects your LAN IP, syncs app.json, starts Expo on the LAN
```

`mobile\start.ps1` solves the most common Expo problem (`exp://127.0.0.1`):
it detects your PC's real IP, sets `REACT_NATIVE_PACKAGER_HOSTNAME`, updates
`app.json` → `extra.apiUrl`, and launches with `--lan -c`.

Then open **Expo Go** on a phone (same Wi-Fi) and scan the QR.

> First time only: `cd mobile && npm install`.
> If PowerShell blocks the script: `Set-ExecutionPolicy -Scope Process Bypass` then re-run.

## Manual run (any OS)

```bash
# backend
cd backend && GEMINI_API_KEY=your_key dotnet run --urls http://0.0.0.0:5000
# mobile
cd mobile && npm install && npx expo start --lan
```

- Set `app.json` → `extra.apiUrl` to your PC's LAN IP, e.g. `http://192.168.0.105:5000`.
- **Notifications require a physical device** (Expo Go / a dev build) — they don't fire on simulators.

## Notes

- The Telegram-specific layer (commands, keyboards, polling) is replaced by the mobile UI;
  all the **business logic** (macros, BMI, Gemini prompts, meal/undo, fallbacks) lives in the C# backend.
- The `GEMINI_API_KEY` stays server-side — the app never holds it.
"# FitCoach-" 
