import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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
            events: [{
              id: `${sourceId}:event-1`,
              sourceId,
              title: 'Imported Vacation',
              start: new Date('2026-07-01T00:00:00Z'),
              end: new Date('2026-07-04T00:00:00Z'),
              allDay: true,
              durationDays: 4,
            }],
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

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('FileReader', MockFileReader);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('imports an .ics file and replaces the initial mock source', async () => {
    const user = userEvent.setup();
    render(<App initialDate={new Date('2026-03-21T12:00:00Z')} />);

    const file = new File([
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:file-1',
        'SUMMARY:Imported Vacation',
        'DTSTART;VALUE=DATE:20260701',
        'DTEND;VALUE=DATE:20260705',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    ], 'travel.ics', { type: 'text/calendar' });

    const input = document.getElementById('ics-upload');
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.queryByText('Example Data')).not.toBeInTheDocument();
    });
  });

  it('shows rolling months from the current month and exposes accessible controls', async () => {
    const user = userEvent.setup();
    render(<App initialDate={new Date('2026-03-21T12:00:00Z')} />);

    expect(screen.getAllByRole('button', { name: 'Previous year' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Next year' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dismiss information banner' })[0]).toBeInTheDocument();
    expect(screen.getByLabelText('Calendar URL')).toHaveAttribute('type', 'url');

    await user.click(screen.getAllByRole('button', { name: 'Previous year' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Switch to rolling 12 month view' })[0]);

    const monthHeadings = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
      .filter((text) => MONTH_NAMES.includes(text));
    expect(monthHeadings[0]).toBe('March');
    expect(monthHeadings[11]).toBe('February');
  });

  it('renders inline URL import errors instead of using alert()', async () => {
    const user = userEvent.setup();
    globalThis.fetch
      .mockRejectedValueOnce(new Error('Proxy unavailable'))
      .mockRejectedValueOnce(new Error('Browser blocked'));

    render(<App initialDate={new Date('2026-03-21T12:00:00Z')} />);

    const urlInput = screen.getByLabelText('Calendar URL');
    await user.type(urlInput, 'https://example.com/calendar.ics');
    await user.click(urlInput.form.querySelector('button[type="submit"]'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Proxy unavailable');
    });
  });

  it('persists URL imports only when remember-on-device is enabled', async () => {
    const user = userEvent.setup();
    globalThis.fetch.mockResolvedValue({
      ok: true,
      text: async () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
    });

    render(<App initialDate={new Date('2026-03-21T12:00:00Z')} />);

    const urlInput = screen.getByLabelText('Calendar URL');
    await user.type(urlInput, 'https://example.com/private.ics');
    await user.click(screen.getAllByLabelText('Remember this URL on this device')[0]);
    await user.click(urlInput.form.querySelector('button[type="submit"]'));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('calendarUrls'))).toEqual([
        { url: 'https://example.com/private.ics', name: 'example.com/private.ics', showSingleDayEvents: false },
      ]);
    });
  });
});
