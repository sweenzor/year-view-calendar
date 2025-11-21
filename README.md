# Year-view Calendar

A React-based yearly planner designed to visualize long-term events. This application automatically filters out short meetings and focuses on displaying multi-day events (lasting longer than 24 hours) in a clean, continuous view.

## Features

*   **Long-Term Focus:** Automatically filters out events shorter than 24 hours to de-clutter your year view.
*   **Multi-Source Import:**
    *   **Drag & Drop:** upload `.ics` calendar files directly.
    *   **URL Import:** Fetch calendars from public URLs (subject to CORS restrictions).
*   **Flexible Views:**
    *   **Calendar Year:** Standard Jan-Dec view.
    *   **Rolling 12-Months:** View the next 12 months starting from today.
*   **Privacy First:** All data processing happens entirely in your browser. No calendar data is ever sent to a server.
*   **Visual Clarity:**
    *   Continuous event bars spanning across days and weeks.
    *   Smart stacking for overlapping events.
    *   Dismissible information tips.

## Tech Stack

*   **Framework:** [React](https://react.dev/) (via Vite)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **Date Parsing:** Custom ICS parser (no heavy external date libraries).

## Getting Started

### Prerequisites

*   Node.js (v18 or higher recommended)
*   npm

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
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

4.  Open your browser at `http://localhost:5173` (or the port shown in the terminal).

## Usage

1.  **Import Data:** Drag an `.ics` file (exported from Google Calendar, Apple Calendar, or Outlook) onto the "File Upload" drop zone.
2.  **Navigate:** Use the arrow keys next to the year to switch years.
3.  **Toggle View:** Click "Next 12 Months" to switch between a static year view and a rolling view.
4.  **Manage Sources:** See loaded calendars in the side panel. You can remove individual sources or clear all data.

## License

MIT
