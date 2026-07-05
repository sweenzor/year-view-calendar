# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Year-view Calendar is a React SPA for visualizing long-running and all-day events in a continuous year view. It imports `.ics` calendar files (via drag-and-drop or URL), normalizes them into inclusive day-bound event records, and renders the selected sources across a 12-month grid. Timed events must last longer than 24 hours; all-day events are kept even when they last one day, and single-day all-day visibility is controlled per source. File imports stay client-side; URL imports may transit the Express proxy when direct browser access is blocked. Remembered URL imports store the full feed URL, including any embedded secret token, in the browser only when the user explicitly opts in on that device.

## Commands

```bash
npm run dev       # Start Vite dev server (port 5173) + Express proxy (port 3001)
npm run build     # Production build to dist/
npm run lint      # ESLint (flat config, ESLint 9+)
npm test          # Vitest suite
npm run preview   # Serve production build locally
```

Docker alternative: `docker compose up` exposes the same ports.

When running via Docker, use `docker compose exec app <command>` to run commands:
```bash
docker compose exec app npm run lint
docker compose exec app npm test
```

## Tech Stack

- **React 19** with Vite 7 (JSX, no TypeScript)
- **Tailwind CSS 3** for styling
- **Express 5** proxy server for CORS (server.js, port 3001)
- **lucide-react** for icons, **react-to-print** for print support
- **Vitest** + **Testing Library** for unit and UI tests
- ESLint 9 flat config with react-hooks and react-refresh plugins

## Architecture

The app is split into small feature modules instead of a single monolith:

- **App shell** (`src/App.jsx`): owns only view-mode/year state, print wiring, info banner visibility, and composition of the major panels.
- **Calendar parsing** (`src/calendar-parse.js`): uses `ical.js` to normalize VEVENTs into `{ id, title, start, end, durationDays, allDay, sourceId }`, keeps all-day events of one day or longer, and filters timed events unless they exceed 24 hours. Imported only by the parse worker (`src/calendar-parse-worker.js`) so `ical.js` stays out of the main bundle.
- **Event appearance** (`src/calendar-utils.js`): pure helpers with no `ical.js` dependency — golden-angle color assignment, readable text colors, and mock events. Main-thread modules must import from here, never from `calendar-parse.js`.
- **Import helpers** (`src/calendar-import.js`): normalizes `webcal://` URLs, reads uploaded files, and performs proxy-first URL fetches with direct-fetch fallback.
- **Source state** (`src/useCalendarSources.js`, `src/calendar-sources.js`): owns import/reload/remove/clear flows plus per-source loading, error, and single-day all-day visibility state. URL sources can be persisted only when `rememberOnDevice` is explicitly enabled; remembered entries also persist the per-source single-day toggle.
- **Calendar layout math** (`src/calendar-layout.js`): computes rolling/calendar-year month ranges, slices multi-day events into row segments, and stacks overlaps into lanes before rendering.
- **Presentational components** (`src/components/`): toolbar, import panel, source list, and calendar grid.
- **Proxy server** (`server.js`, `proxy-utils.js`): validates remote URLs, blocks local/private targets, and fetches approved feeds with timeout and size limits.

### Data Flow

1. File drop or URL submit → `useCalendarSources()` reads/fetches text → `normalizeCalendarData()` returns normalized long-running and all-day events
2. Source reducer merges events by `sourceId`, removes mock data on first real import, and tracks per-source status/error/toggle state
3. `useCalendarSources()` filters single-day all-day events out only for sources whose `showSingleDayEvents` toggle is off
4. `getDisplayedMonths()` chooses the 12 visible months, then `buildCalendarLayouts()` prepares pre-segmented rows for each month
5. `CalendarGrid` renders the prepared layout with chevrons, stacking, print support, and keyboard-focusable event bars

## Key Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Top-level app composition and print wiring |
| `src/useCalendarSources.js` | Import/reload/remove/clear hook |
| `src/calendar-parse.js` | ICS normalization (worker-only, owns the `ical.js` dependency) |
| `src/calendar-utils.js` | Event color assignment and mock events (main-thread safe) |
| `src/calendar-layout.js` | Rolling-range and month layout helpers |
| `src/index.css` | Tailwind directives + print styles (3-col layout, scaled sizing) |
| `server.js` / `proxy-utils.js` | Hardened Express proxy for remote calendar URLs |
| `vite.config.js` | Vite config with /proxy → localhost:3001 mapping |

## Testing

```bash
docker compose exec app npm test                               # run all tests
docker compose exec app npm test -- src/calendar-utils.test.js # run a specific file
```

Tests cover: parser normalization, rolling-range/layout helpers, source-state transitions, remembered URL storage, proxy guard helpers, and App-level import/accessibility behavior including per-source single-day all-day toggles.

## Notes

- No TypeScript — plain JSX with React 19
- Event colors use inline `backgroundColor`/`color` styles from computed appearance objects
- Print view: CSS in `src/index.css` scales root to 62.5%, forces 3-col grid, event text forced to black
- Local workspace config such as `.idx/` should remain untracked
