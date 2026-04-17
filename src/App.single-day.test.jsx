import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('react-to-print', () => ({
  useReactToPrint: () => vi.fn(),
}));

vi.mock('./calendar-parse-worker.js?worker', () => ({
  default: class MockParseWorker {
    terminate() {}

    postMessage({ sourceId }) {
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            calendarName: null,
            events: [
              {
                id: `${sourceId}:multi`,
                sourceId,
                title: 'Vacation Week',
                start: new Date(2026, 6, 1),
                end: new Date(2026, 6, 4),
                allDay: true,
                durationDays: 4,
              },
              {
                id: `${sourceId}:single`,
                sourceId,
                title: 'Birthday',
                start: new Date(2026, 6, 10),
                end: new Date(2026, 6, 10),
                allDay: true,
                durationDays: 1,
              },
            ],
          },
        });
      });
    }
  },
}));

class MockFileReader {
  readAsText(file) {
    file.text().then((result) => {
      if (this.onload) {
        this.onload({ target: { result } });
      }
    });
  }
}

const importSampleFile = async (user) => {
  const file = new File(['BEGIN:VCALENDAR\r\nEND:VCALENDAR'], 'sample.ics', { type: 'text/calendar' });
  const input = document.getElementById('ics-upload');
  await user.upload(input, file);
};

describe('Single-day all-day events toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('FileReader', MockFileReader);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows single-day all-day events by default and hides them when the source toggle is off', async () => {
    const user = userEvent.setup();
    render(<App initialDate={new Date('2026-03-21T12:00:00Z')} />);

    await importSampleFile(user);

    await waitFor(() => {
      expect(screen.getAllByLabelText(/Vacation Week/).length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(screen.getAllByLabelText(/Birthday/).length).toBeGreaterThan(0);
    });

    const toggleButton = await screen.findByRole('button', {
      name: /Hide single-day events for sample\.ics/i,
    });
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.queryAllByLabelText(/Birthday/).length).toBe(0);
    });

    const unpressedToggle = screen.getByRole('button', {
      name: /Show single-day events for sample\.ics/i,
    });
    expect(unpressedToggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(unpressedToggle);
    await waitFor(() => {
      expect(screen.getAllByLabelText(/Birthday/).length).toBeGreaterThan(0);
    });
  });

  it('updates the events counter in the source list as the toggle is flipped', async () => {
    const user = userEvent.setup();
    render(<App initialDate={new Date('2026-03-21T12:00:00Z')} />);

    await importSampleFile(user);

    const sourceListHeading = await screen.findByRole('heading', { name: /Loaded Calendars/i });
    const sourceList = sourceListHeading.closest('div');

    await waitFor(() => {
      expect(within(sourceList).getByText(/^2 events$/)).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', {
      name: /Hide single-day events for sample\.ics/i,
    });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(within(sourceList).getByText(/^1 events$/)).toBeInTheDocument();
    });
  });
});
