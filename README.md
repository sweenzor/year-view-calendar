# Year-view Calendar

**[yearview.life](https://yearview.life/)**

A React-based yearly planner designed to visualize long-term events. This application automatically filters out short meetings and focuses on displaying multi-day events (lasting longer than 24 hours) in a clean, continuous view.

## Features

*   **Long-Term Focus:** Automatically filters out events shorter than 24 hours to de-clutter your year view.
*   **Multi-Source Import:**
    *   **Drag & Drop:** Upload `.ics` calendar files directly.
    *   **URL Import:** Fetch calendars from public URLs (handles `webcal://` and `https://`).
    *   **Reload:** Re-fetch URL-imported calendars individually or all at once.
*   **Flexible Views:**
    *   **Calendar Year:** Standard Jan-Dec view.
    *   **Rolling 12-Months:** View a 12-month window starting from the current month in the selected year.
*   **Privacy-Aware Imports:** File imports stay in your browser. URL imports may transit the local proxy server when direct browser access is blocked. Saved feed URLs are only stored when you explicitly opt in on that device.
*   **Visual Clarity:**
    *   Continuous event bars spanning across days and weeks.
    *   Chevron-shaped bars at week and month boundaries show event continuation.
    *   Smart stacking for overlapping events.
    *   Golden-angle color assignment ensures co-occurring events are visually distinct.
*   **Print Support:** Optimized print layout with 3-column grid and readable black text on event bars.

## Tech Stack

*   **Framework:** [React 19](https://react.dev/) (via [Vite 7](https://vite.dev/))
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **Print:** [react-to-print](https://github.com/MatthewHerb662/react-to-print)
*   **Testing:** [Vitest](https://vitest.dev/)
*   **Date Parsing:** [ical.js](https://github.com/kewisch/ical.js/) with app-side normalization for long-event display

## Getting Started

### Prerequisites

*   Node.js (v18 or higher recommended)
*   npm

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/sweenzor/year-view-calendar.git
    cd year-view-calendar
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser at `http://localhost:5173`.

### Docker

You can also run the app with Docker — no local Node.js installation required.

1.  Start the development environment:
    ```bash
    docker compose up
    ```

2.  Open your browser at `http://localhost:5173`.

Source files are volume-mounted so hot reloading works — edits to files in `src/`, `index.html`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, and `server.js` are reflected immediately without rebuilding.

To rebuild the image after changing dependencies (e.g. `package.json`):
```bash
docker compose up --build
```

### Running Lint

```bash
npm run lint                               # local
docker compose exec app npm run lint       # via Docker Compose
docker exec year-view-calendar-app-1 npm run lint  # via OrbStack running container
```

If you're using OrbStack, the Compose-managed container is typically named `year-view-calendar-app-1`.

### Running Tests

```bash
npm test                               # local
docker compose exec app npm test       # via Docker
docker exec year-view-calendar-app-1 npm test  # via OrbStack running container
```

## Usage

1.  **Import Data:** Drag an `.ics` file (exported from Google Calendar, Apple Calendar, or Outlook) onto the "File Upload" drop zone, or paste a calendar URL. If you want URL-based calendars to survive refresh, check the device-local “Remember this URL” option before importing.
2.  **Navigate:** Use the arrow keys next to the year to switch years.
3.  **Toggle View:** Click "Next 12 Months" to switch between a static year view and a rolling 12-month view anchored to the selected year.
4.  **Manage Sources:** See loaded calendars in the side panel. Reload URL sources, remove individual sources, or clear all data.
5.  **Print:** Use the print button for an optimized 3-column yearly layout.

## License

MIT
