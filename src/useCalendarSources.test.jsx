import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSourceIdFromUrl } from './calendar-sources';
import { useCalendarSources } from './useCalendarSources';

const TEST_URL = 'https://example.com/remembered.ics';

const {
  fetchCalendarTextWithFallbackMock,
  workerJobs,
} = vi.hoisted(() => ({
  fetchCalendarTextWithFallbackMock: vi.fn(),
  workerJobs: [],
}));

vi.mock('./calendar-import', async () => {
  const actual = await vi.importActual('./calendar-import');
  return {
    ...actual,
    fetchCalendarTextWithFallback: fetchCalendarTextWithFallbackMock,
  };
});

vi.mock('./calendar-parse-worker.js?worker', () => ({
  default: class MockParseWorker {
    terminate() {}

    postMessage(payload) {
      workerJobs.push({ payload, worker: this });
    }
  },
}));

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const createDisplayedRange = (year) => ({
  start: new Date(year, 0, 1),
  end: new Date(year + 1, 0, 1),
});

const completeWorkerJob = (job) => {
  act(() => {
    job.worker.onmessage?.({
      data: {
        calendarName: null,
        events: [{
          id: `${job.payload.sourceId}:${job.payload.rangeStartMs}`,
          sourceId: job.payload.sourceId,
          title: `Range ${job.payload.rangeStartMs}`,
          start: new Date(job.payload.rangeStartMs),
          end: new Date(job.payload.rangeStartMs + (2 * 24 * 60 * 60 * 1000)),
          allDay: true,
          durationDays: 3,
        }],
      },
    });
  });
};

const HookHarness = ({ displayedRange }) => {
  const { events } = useCalendarSources({
    baseDate: new Date('2026-03-21T12:00:00Z'),
    displayedRange,
  });

  return (
    <output data-testid="event-ids">
      {events.map((event) => event.id).join(',')}
    </output>
  );
};

describe('useCalendarSources', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    fetchCalendarTextWithFallbackMock.mockReset();
    workerJobs.length = 0;
  });

  it('reparses remembered sources against the latest range when the view changes mid-load', async () => {
    localStorage.setItem('calendarUrls', JSON.stringify([
      { url: TEST_URL, name: 'Remembered feed' },
    ]));

    const sourceId = createSourceIdFromUrl(TEST_URL);
    const initialRange = createDisplayedRange(2026);
    const nextRange = createDisplayedRange(2027);
    const pendingFetch = createDeferred();
    fetchCalendarTextWithFallbackMock.mockReturnValueOnce(pendingFetch.promise);

    const { rerender } = render(<HookHarness displayedRange={initialRange} />);

    await waitFor(() => {
      expect(fetchCalendarTextWithFallbackMock).toHaveBeenCalledWith(TEST_URL);
    });

    act(() => {
      pendingFetch.resolve('BEGIN:VCALENDAR\r\nEND:VCALENDAR');
    });

    await waitFor(() => {
      expect(workerJobs).toHaveLength(1);
    });
    expect(workerJobs[0].payload).toMatchObject({
      sourceId,
      rangeStartMs: initialRange.start.getTime(),
      rangeEndMs: initialRange.end.getTime(),
    });

    rerender(<HookHarness displayedRange={nextRange} />);

    completeWorkerJob(workerJobs[0]);

    await waitFor(() => {
      expect(workerJobs).toHaveLength(2);
    });
    expect(workerJobs[1].payload).toMatchObject({
      sourceId,
      rangeStartMs: nextRange.start.getTime(),
      rangeEndMs: nextRange.end.getTime(),
    });

    completeWorkerJob(workerJobs[1]);

    await waitFor(() => {
      expect(screen.getByTestId('event-ids')).toHaveTextContent(
        `${sourceId}:${nextRange.start.getTime()}`,
      );
    });
  });
});
