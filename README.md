# Doppelganger

**Become the One Who Wins.**

A habit tracker built around one idea: every day you either feed yourself or feed your shadow. Complete your daily habits and your avatar grows stronger. Skip them and your Doppelganger (the version of you that never changes) absorbs the points you left on the table.

Pure HTML/CSS/JS. No accounts, no server, no build step. All data lives in your browser's localStorage.

## Running it

Serve the folder with any static server (e.g. `python -m http.server`) and open it. Netlify deploys the repo root on every push to `main`.

## How it works

- **9 daily habits** worth 5–15 points each (95 max per day).
- **Days end at 4:00 AM.** Once a day is over, every point you didn't earn goes to your Shadow, and you lose those missed points × your tier multiplier (Bronze ×0, Silver ×0.5, Gold ×1, Platinum ×2, Diamond ×3, Goggins ×4).
- **Every day counts.** From the first day you log anything, each day after it is scored whether or not you open the app. Missing 10 days costs you 10 days.
- **Perfect days** (all 9 habits) give a +5 bonus.
- **Screen time penalty:** −10 for you and +10 for your Shadow per hour over the limit, logged per day.
- **Past-day editing:** use the arrows (or ← / → keys) on the Habits page. Your totals are recalculated from that day forward.

## Code

| File | Role |
|---|---|
| `js/engine.js` | Habits, tiers, dates and scoring. No DOM. Scores are replayed from the day log rather than stored, so they can't drift. |
| `js/charts.js` | Dependency-free SVG charts with hover tooltips. |
| `js/app.js` | UI, rendering and localStorage. |
| `css/styles.css` | Styles. |
| `tests/engine.test.js` | `node --test tests/` |

Data from the old v1 format is migrated automatically on first load. The original is kept under the `doppelganger_data_v1_backup` localStorage key.
