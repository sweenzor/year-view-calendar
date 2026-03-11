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

When running via Docker, use `docker-compose exec app <command>` to run commands (e.g. `docker-compose exec app npm run lint`).

## Tech Stack

- **React 19** with Vite 7 (JSX, no TypeScript)
- **Tailwind CSS 3** for styling
- **Express 5** proxy server for CORS (server.js, port 3001)
- **lucide-react** for icons, **react-to-print** for print support
- ESLint 9 flat config with react-hooks and react-refresh plugins

## Architecture

The app is a monolithic single-file component (`src/App.jsx`, ~660 lines) containing all UI and logic:

- **ICS Parser** (`parseICS`): Custom parser that extracts VEVENT blocks, parses DTSTART/DTEND, filters events shorter than 24 hours, and calculates `durationDays`. Does not handle RRULE, timezones, or descriptions.
- **Event Stacking Algorithm** (inside `MonthGrid`): Slices events into weekly segments, sorts by column/width, assigns each to a lane (vertical stack position) to handle overlapping events, then positions absolutely over the CSS Grid.
- **Two View Modes**: Calendar Year (Jan–Dec) and Rolling 12-Month (current month + next 11).
- **Source Management**: Events are tagged with `sourceId` so individual calendar sources can be removed independently.
- **Proxy Server** (`server.js`): Stateless Express endpoint `GET /proxy?url=<encoded_url>` that fetches remote .ics content via axios. Vite proxies `/proxy` to localhost:3001 in dev.

### Data Flow

1. File drop/URL submit → `parseICS()` extracts events → `processICSData()` tags with sourceId → state update
2. `MonthGrid` receives events → weekly segmentation → stacking algorithm → CSS Grid render
3. Mock events auto-removed when real calendar data is loaded

## Key Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Entire app: UI, state, ICS parsing, MonthGrid, event stacking |
| `src/index.css` | Tailwind directives + print styles (3-col layout, scaled sizing) |
| `server.js` | Express CORS proxy for remote calendar URLs |
| `vite.config.js` | Vite config with /proxy → localhost:3001 mapping |

## Notes

- No test suite exists
- No TypeScript — plain JSX with React 19
- Print CSS in `src/index.css` scales root to 62.5% and forces 3-column grid
- `src/App.css` is legacy/unused
- Firebase config files exist (`.firebaserc`, `firebase.json`) but deployment is not actively configured
