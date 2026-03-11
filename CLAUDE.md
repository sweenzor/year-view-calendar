# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Year-view Calendar is a React SPA for visualizing long-term (24h+) events in a continuous year view. It imports .ics calendar files (via drag-and-drop or URL) and displays multi-day events across a 12-month grid. All calendar processing happens client-side (privacy-first); a small Express proxy server handles CORS for remote URL imports.

## Commands

```bash
npm run dev       # Start Vite dev server (port 5173) + Express proxy (port 3001)
npm run build     # Production build to dist/
npm run lint      # ESLint (flat config, ESLint 9+)
npm run preview   # Serve production build locally
```

Docker alternative: `docker-compose up` exposes the same ports.

When running via Docker, use `docker-compose exec app <command>` to run commands:
```bash
docker-compose exec app npm run lint
docker-compose exec app npx vitest run
```

## Tech Stack

- **React 19** with Vite 7 (JSX, no TypeScript)
- **Tailwind CSS 3** for styling
- **Express 5** proxy server for CORS (server.js, port 3001)
- **lucide-react** for icons, **react-to-print** for print support
- **Vitest** for testing (no vitest dev dependency — runs via npx)
- ESLint 9 flat config with react-hooks and react-refresh plugins

## Architecture

`src/App.jsx` (~650 lines) contains all UI and state. Pure utility functions are in `src/calendar-utils.js`:

- **ICS Parser** (`parseICS` in `calendar-utils.js`): Extracts VEVENT blocks, parses DTSTART/DTEND (handles both `VALUE=DATE` and datetime formats), converts exclusive DTEND to inclusive last-day, filters events shorter than 24 hours. Does not handle RRULE, timezones, or descriptions.
- **Color Assignment** (`assignEventColors` in `calendar-utils.js`): Golden-angle (137.5°) hue spacing with varied saturation/lightness. Events sorted by start date so co-occurring events get maximally different colors. Uses stable string keys (start timestamp + title) for color map lookups.
- **Event Stacking Algorithm** (inside `MonthGrid` in `App.jsx`): Slices events into weekly segments, sorts by column/width, assigns each to a lane (vertical stack position) to handle overlapping events, then positions absolutely over the CSS Grid.
- **Chevron Rendering**: Events spanning week/month boundaries render with clip-path chevron shapes indicating continuation. Uses `isContinuation` and `isContinuedAfter` flags, with cross-month boundary detection.
- **Two View Modes**: Calendar Year (Jan–Dec) and Rolling 12-Month (current month + next 11).
- **Source Management**: Events are tagged with `sourceId` so individual calendar sources can be removed or reloaded independently. URL sources store their URL for re-fetching.
- **Proxy Server** (`server.js`): Stateless Express endpoint `GET /proxy?url=<encoded_url>` that fetches remote .ics content via axios. Vite proxies `/proxy` to localhost:3001 in dev.

### Data Flow

1. File drop/URL submit → `parseICS()` extracts events → `processICSData()` tags with sourceId → state update
2. `assignEventColors()` computes color map from sorted events → passed to `MonthGrid`
3. `MonthGrid` receives events + colorMap → weekly segmentation → stacking algorithm → CSS Grid render with chevron clip-paths
4. Mock events auto-removed when real calendar data is loaded

## Key Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | UI, state, MonthGrid, event stacking, source management |
| `src/calendar-utils.js` | Pure functions: ICS parsing, color assignment |
| `src/calendar-utils.test.js` | Vitest test suite (17 tests) |
| `src/index.css` | Tailwind directives + print styles (3-col layout, scaled sizing) |
| `server.js` | Express CORS proxy for remote calendar URLs |
| `vite.config.js` | Vite config with /proxy → localhost:3001 mapping |

## Testing

```bash
docker-compose exec app npx vitest run                          # run all tests
docker-compose exec app npx vitest run src/calendar-utils.test.js  # run specific file
```

Tests cover: ICS parsing (exclusive DTEND, datetime formats, filtering, line endings), color assignment (uniqueness, golden-angle spacing, stability), and color key generation.

## Notes

- No TypeScript — plain JSX with React 19
- Event colors use inline HSL `backgroundColor` styles (not Tailwind color classes)
- Print view: CSS in `src/index.css` scales root to 62.5%, forces 3-col grid, event text forced to black
- `src/App.css` is legacy/unused
- Firebase config files exist (`.firebaserc`, `firebase.json`) but deployment is not actively configured
