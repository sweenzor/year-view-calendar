# Year-view Calendar

A React-based yearly planner designed to visualize long-term events. This application automatically filters out short meetings and focuses on displaying multi-day events (lasting longer than 24 hours) in a clean, continuous view.

## Features

*   **Long-Term Focus:** Automatically filters out events shorter than 24 hours to de-clutter your year view.
*   **Multi-Source Import:**
    *   **Drag & Drop:** Upload `.ics` calendar files directly.
    *   **URL Import:** Fetch calendars from public URLs (handles `webcal://` and `https://`).
    *   **Reload:** Re-fetch URL-imported calendars individually or all at once.
*   **Flexible Views:**
    *   **Calendar Year:** Standard Jan-Dec view.
    *   **Rolling 12-Months:** View the next 12 months starting from today.
*   **Privacy First:** All data processing happens entirely in your browser. No calendar data is ever sent to a server.
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
*   **Date Parsing:** Custom ICS parser (no heavy external date libraries)

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

### Running Tests

```bash
npx vitest run                    # local
docker compose exec app npx vitest run  # via Docker
```

## Usage

1.  **Import Data:** Drag an `.ics` file (exported from Google Calendar, Apple Calendar, or Outlook) onto the "File Upload" drop zone, or paste a calendar URL.
2.  **Navigate:** Use the arrow keys next to the year to switch years.
3.  **Toggle View:** Click "Next 12 Months" to switch between a static year view and a rolling view.
4.  **Manage Sources:** See loaded calendars in the side panel. Reload URL sources, remove individual sources, or clear all data.
5.  **Print:** Use the print button for an optimized 3-column yearly layout.

## License

MIT
