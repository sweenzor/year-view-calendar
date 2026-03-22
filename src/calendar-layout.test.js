import { describe, expect, it } from 'vitest';
import { buildMonthLayout, getDisplayedMonths } from './calendar-layout';
import { eventColorKey } from './calendar-utils';

const createColorMap = (events) => {
  return new Map(events.map((event) => [eventColorKey(event), {
    backgroundColor: '#123456',
    textColor: '#ffffff',
  }]));
};

describe('getDisplayedMonths', () => {
  it('anchors rolling view to the current month in the selected year', () => {
    const months = getDisplayedMonths({
      selectedYear: 2025,
      isRollingView: true,
      baseDate: new Date(2026, 2, 21),
    });

    expect(months[0]).toEqual({ key: '2025-2', year: 2025, month: 2 });
    expect(months[11]).toEqual({ key: '2026-1', year: 2026, month: 1 });
  });

  it('uses a standard January through December range in calendar year mode', () => {
    const months = getDisplayedMonths({
      selectedYear: 2027,
      isRollingView: false,
      baseDate: new Date(2026, 2, 21),
    });

    expect(months[0]).toEqual({ key: '2027-0', year: 2027, month: 0 });
    expect(months[11]).toEqual({ key: '2027-11', year: 2027, month: 11 });
  });
});

describe('buildMonthLayout', () => {
  it('marks event continuation across week boundaries', () => {
    const events = [{
      id: 'event-1',
      sourceId: 'source',
      title: 'Long trip',
      start: new Date(2026, 1, 6),
      end: new Date(2026, 1, 10),
    }];

    const layout = buildMonthLayout({
      year: 2026,
      month: 1,
      events,
      colorMap: createColorMap(events),
    });

    expect(layout.rows[0].segments[0]).toMatchObject({
      id: 'event-1',
      isContinuation: false,
      isContinuedAfter: true,
    });
    expect(layout.rows[1].segments[0]).toMatchObject({
      id: 'event-1',
      isContinuation: true,
      isContinuedAfter: false,
    });
  });

  it('stacks overlapping events into separate lanes', () => {
    const events = [
      {
        id: 'event-1',
        sourceId: 'source',
        title: 'Overlap A',
        start: new Date(2026, 4, 5),
        end: new Date(2026, 4, 10),
      },
      {
        id: 'event-2',
        sourceId: 'source',
        title: 'Overlap B',
        start: new Date(2026, 4, 8),
        end: new Date(2026, 4, 12),
      },
    ];

    const layout = buildMonthLayout({
      year: 2026,
      month: 4,
      events,
      colorMap: createColorMap(events),
    });

    const overlappingRow = layout.rows.find((row) => row.segments.length === 2);
    expect(overlappingRow.segments.map((segment) => segment.stackIndex).sort()).toEqual([0, 1]);
  });
});
