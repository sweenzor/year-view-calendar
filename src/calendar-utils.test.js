import { describe, expect, it } from 'vitest';
import { assignEventColors, eventColorKey, normalizeCalendarData } from './calendar-utils';

const wrapCalendar = (eventBlocks) => {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...eventBlocks.flat(),
    'END:VCALENDAR',
  ].join('\r\n');
};

const makeEvent = (lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'];

describe('normalizeCalendarData', () => {
  it('parses a multi-day all-day event using exclusive DTEND', () => {
    const calendar = wrapCalendar([
      makeEvent([
        'UID:vacation-1',
        'SUMMARY:Vacation',
        'DTSTART;VALUE=DATE:20260824',
        'DTEND;VALUE=DATE:20260830',
      ]),
    ]);

    const { events } = normalizeCalendarData(calendar, { sourceId: 'source-a' });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'source-a:vacation-1',
      sourceId: 'source-a',
      title: 'Vacation',
      allDay: true,
      durationDays: 6,
    });
    expect(events[0].start).toEqual(new Date(2026, 7, 24));
    expect(events[0].end).toEqual(new Date(2026, 7, 29));
  });

  it('keeps timed multi-day events that last more than 24 hours', () => {
    const calendar = wrapCalendar([
      makeEvent([
        'UID:timed-1',
        'SUMMARY:Conference',
        'DTSTART:20260610T090000Z',
        'DTEND:20260611T100100Z',
      ]),
    ]);

    const { events } = normalizeCalendarData(calendar, { sourceId: 'source-b' });

    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(false);
    expect(events[0].start).toEqual(new Date(Date.UTC(2026, 5, 10)));
    expect(events[0].end).toEqual(new Date(Date.UTC(2026, 5, 11)));
    expect(events[0].durationDays).toBe(2);
  });

  it('keeps single-day all-day events so callers can opt in to showing them', () => {
    const calendar = wrapCalendar([
      makeEvent([
        'UID:holiday-1',
        'SUMMARY:Labor Day',
        'DTSTART;VALUE=DATE:20260907',
        'DTEND;VALUE=DATE:20260908',
      ]),
    ]);

    const { events } = normalizeCalendarData(calendar, { sourceId: 'source-holiday' });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'source-holiday:holiday-1',
      allDay: true,
      durationDays: 1,
    });
    expect(events[0].start).toEqual(new Date(2026, 8, 7));
    expect(events[0].end).toEqual(new Date(2026, 8, 7));
  });

  it('filters out timed events that do not exceed 24 hours', () => {
    const calendar = wrapCalendar([
      makeEvent([
        'UID:timed-2',
        'SUMMARY:Overnight flight',
        'DTSTART:20260610T120000Z',
        'DTEND:20260611T110000Z',
      ]),
    ]);

    expect(normalizeCalendarData(calendar, { sourceId: 'source-c' }).events).toEqual([]);
  });

  it('expands recurring all-day events inside the requested display range', () => {
    const calendar = wrapCalendar([
      makeEvent([
        'UID:recurring-1',
        'SUMMARY:Quarterly Retreat',
        'DTSTART;VALUE=DATE:20260101',
        'DTEND;VALUE=DATE:20260104',
        'RRULE:FREQ=MONTHLY;COUNT=3',
      ]),
    ]);

    const { events } = normalizeCalendarData(calendar, {
      sourceId: 'source-recurring',
      rangeStart: new Date(2026, 0, 1),
      rangeEnd: new Date(2026, 3, 1),
    });

    expect(events).toHaveLength(3);
    expect(events.map((event) => event.id)).toEqual([
      'source-recurring:recurring-1:2026-01-01',
      'source-recurring:recurring-1:2026-02-01',
      'source-recurring:recurring-1:2026-03-01',
    ]);
    expect(events.map((event) => event.start)).toEqual([
      new Date(2026, 0, 1),
      new Date(2026, 1, 1),
      new Date(2026, 2, 1),
    ]);
  });

  it('applies recurrence overrides when an exception changes an occurrence', () => {
    const calendar = wrapCalendar([
      makeEvent([
        'UID:recurring-2',
        'SUMMARY:Retreat',
        'DTSTART;VALUE=DATE:20260101',
        'DTEND;VALUE=DATE:20260104',
        'RRULE:FREQ=MONTHLY;COUNT=2',
      ]),
      makeEvent([
        'UID:recurring-2',
        'RECURRENCE-ID;VALUE=DATE:20260201',
        'SUMMARY:Moved Retreat',
        'DTSTART;VALUE=DATE:20260205',
        'DTEND;VALUE=DATE:20260208',
      ]),
    ]);

    const { events } = normalizeCalendarData(calendar, {
      sourceId: 'source-exception',
      rangeStart: new Date(2026, 0, 1),
      rangeEnd: new Date(2026, 2, 15),
    });

    expect(events).toHaveLength(2);
    expect(events.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
    }))).toEqual([
      {
        id: 'source-exception:recurring-2:2026-01-01',
        title: 'Retreat',
        start: new Date(2026, 0, 1),
        end: new Date(2026, 0, 3),
      },
      {
        id: 'source-exception:recurring-2:2026-02-01',
        title: 'Moved Retreat',
        start: new Date(2026, 1, 5),
        end: new Date(2026, 1, 7),
      },
    ]);
  });

  it('supports folded lines and parameterized properties', () => {
    const calendar = wrapCalendar([
      makeEvent([
        'UID:folded-1',
        'SUMMARY;LANGUAGE=en:Planning Retreat and ',
        ' Workshop',
        'DTSTART;TZID=UTC:20260301T090000',
        'DTEND;TZID=UTC:20260302T101500',
      ]),
    ]);

    const { events } = normalizeCalendarData(calendar, { sourceId: 'source-d' });

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Planning Retreat and Workshop');
    expect(events[0].start).toEqual(new Date(Date.UTC(2026, 2, 1)));
    expect(events[0].end).toEqual(new Date(Date.UTC(2026, 2, 2)));
  });

  it('falls back to an untitled label when summary is missing', () => {
    const calendar = wrapCalendar([
      makeEvent([
        'UID:no-summary',
        'DTSTART;VALUE=DATE:20260501',
        'DTEND;VALUE=DATE:20260505',
      ]),
    ]);

    const { events } = normalizeCalendarData(calendar, { sourceId: 'source-e' });
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Untitled Event');
  });

  it('returns an empty array for empty input', () => {
    expect(normalizeCalendarData('', { sourceId: 'empty' })).toEqual({ events: [], calendarName: null });
  });

  it('extracts calendar name from X-WR-CALNAME', () => {
    const calendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'X-WR-CALNAME:Work Travel',
      'BEGIN:VEVENT',
      'UID:named-1',
      'SUMMARY:Trip',
      'DTSTART;VALUE=DATE:20260501',
      'DTEND;VALUE=DATE:20260505',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const { calendarName } = normalizeCalendarData(calendar, { sourceId: 'source-f' });
    expect(calendarName).toBe('Work Travel');
  });

  it('returns null calendar name when none is set', () => {
    const calendar = wrapCalendar([
      makeEvent([
        'UID:no-name',
        'SUMMARY:Trip',
        'DTSTART;VALUE=DATE:20260501',
        'DTEND;VALUE=DATE:20260505',
      ]),
    ]);

    const { calendarName } = normalizeCalendarData(calendar, { sourceId: 'source-g' });
    expect(calendarName).toBeNull();
  });

  it('throws for malformed calendar data', () => {
    expect(() => normalizeCalendarData('not ics content', { sourceId: 'bad' })).toThrow('Invalid calendar data.');
  });
});

describe('assignEventColors', () => {
  const makeEvent = (title, startMonth, startDay) => ({
    title,
    start: new Date(2026, startMonth, startDay),
    end: new Date(2026, startMonth, startDay + 3),
  });

  it('assigns a unique background color to each event', () => {
    const events = [
      makeEvent('A', 0, 1),
      makeEvent('B', 0, 5),
      makeEvent('C', 0, 10),
    ];

    const colorMap = assignEventColors(events);
    const colors = events.map((event) => colorMap.get(eventColorKey(event))?.backgroundColor);

    expect(colors.every(Boolean)).toBe(true);
    expect(new Set(colors).size).toBe(3);
  });

  it('returns readable foreground and HSL background values', () => {
    const event = makeEvent('Color test', 0, 1);
    const colorMap = assignEventColors([event]);
    const appearance = colorMap.get(eventColorKey(event));

    expect(appearance.backgroundColor).toMatch(/^hsl\(\d+(\.\d+)?, \d+%, \d+%\)$/);
    expect(['#ffffff', '#0f172a']).toContain(appearance.textColor);
  });

  it('keeps distinct colors for separate events with the same title and start date', () => {
    const events = [
      {
        id: 'source-a:event-1',
        sourceId: 'source-a',
        title: 'Vacation',
        start: new Date(2026, 6, 1),
        end: new Date(2026, 6, 4),
      },
      {
        id: 'source-b:event-1',
        sourceId: 'source-b',
        title: 'Vacation',
        start: new Date(2026, 6, 1),
        end: new Date(2026, 6, 10),
      },
    ];

    const colorMap = assignEventColors(events);

    expect(colorMap.size).toBe(2);
    expect(colorMap.get(eventColorKey(events[0]))?.backgroundColor).not.toBe(
      colorMap.get(eventColorKey(events[1]))?.backgroundColor,
    );
  });
});
