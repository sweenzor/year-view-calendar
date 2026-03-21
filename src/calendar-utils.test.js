import { describe, it, expect } from 'vitest';
import { parseICS, assignEventColors, eventColorKey } from './calendar-utils';

// --- Helper to build minimal ICS content ---
const makeICS = (events) => {
  const lines = ['BEGIN:VCALENDAR'];
  for (const evt of events) {
    lines.push('BEGIN:VEVENT');
    if (evt.summary) lines.push(`SUMMARY:${evt.summary}`);
    if (evt.dtstart) lines.push(evt.dtstart);
    if (evt.dtend) lines.push(evt.dtend);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

// ==========================================================
// parseICS
// ==========================================================
describe('parseICS', () => {
  it('parses a basic multi-day all-day event', () => {
    const ics = makeICS([{
      summary: 'Vacation',
      dtstart: 'DTSTART;VALUE=DATE:20260824',
      dtend: 'DTEND;VALUE=DATE:20260830',
    }]);
    const events = parseICS(ics);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Vacation');
    // DTEND is exclusive: Aug 30 means last day is Aug 29
    expect(events[0].start).toEqual(new Date(2026, 7, 24));
    expect(events[0].end).toEqual(new Date(2026, 7, 29));
    expect(events[0].durationDays).toBe(6);
  });

  it('handles DTSTART/DTEND without VALUE=DATE', () => {
    const ics = makeICS([{
      summary: 'Trip',
      dtstart: 'DTSTART:20260301',
      dtend: 'DTEND:20260305',
    }]);
    const events = parseICS(ics);
    expect(events).toHaveLength(1);
    expect(events[0].start).toEqual(new Date(2026, 2, 1));
    expect(events[0].end).toEqual(new Date(2026, 2, 4));
    expect(events[0].durationDays).toBe(4);
  });

  it('handles DTSTART with datetime format (YYYYMMDDTHHMMSS)', () => {
    const ics = makeICS([{
      summary: 'Conference',
      dtstart: 'DTSTART:20260610T090000',
      dtend: 'DTEND:20260614T170000',
    }]);
    const events = parseICS(ics);
    expect(events).toHaveLength(1);
    // Time component is ignored — dates parsed as day only
    expect(events[0].start).toEqual(new Date(2026, 5, 10));
    expect(events[0].end).toEqual(new Date(2026, 5, 13));
  });

  it('filters out short events (1 day or less)', () => {
    const ics = makeICS([
      {
        summary: 'Meeting',
        dtstart: 'DTSTART;VALUE=DATE:20260101',
        dtend: 'DTEND;VALUE=DATE:20260102', // exclusive → 1 day only
      },
      {
        summary: 'Long Trip',
        dtstart: 'DTSTART;VALUE=DATE:20260101',
        dtend: 'DTEND;VALUE=DATE:20260104', // 3 days
      },
    ]);
    const events = parseICS(ics);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Long Trip');
  });

  it('assigns "Untitled Event" when SUMMARY is missing', () => {
    const ics = makeICS([{
      dtstart: 'DTSTART;VALUE=DATE:20260501',
      dtend: 'DTEND;VALUE=DATE:20260505',
    }]);
    const events = parseICS(ics);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Untitled Event');
  });

  it('parses multiple events', () => {
    const ics = makeICS([
      { summary: 'A', dtstart: 'DTSTART;VALUE=DATE:20260101', dtend: 'DTEND;VALUE=DATE:20260105' },
      { summary: 'B', dtstart: 'DTSTART;VALUE=DATE:20260210', dtend: 'DTEND;VALUE=DATE:20260215' },
      { summary: 'C', dtstart: 'DTSTART;VALUE=DATE:20260320', dtend: 'DTEND;VALUE=DATE:20260325' },
    ]);
    const events = parseICS(ics);
    expect(events).toHaveLength(3);
    expect(events.map(e => e.title)).toEqual(['A', 'B', 'C']);
  });

  it('skips events with missing dates', () => {
    const ics = makeICS([
      { summary: 'No End', dtstart: 'DTSTART;VALUE=DATE:20260101' },
      { summary: 'No Start', dtend: 'DTEND;VALUE=DATE:20260105' },
      { summary: 'Valid', dtstart: 'DTSTART;VALUE=DATE:20260101', dtend: 'DTEND;VALUE=DATE:20260105' },
    ]);
    const events = parseICS(ics);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Valid');
  });

  it('handles \\n, \\r\\n, and \\r line endings', () => {
    const unix = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Test\nDTSTART;VALUE=DATE:20260101\nDTEND;VALUE=DATE:20260105\nEND:VEVENT\nEND:VCALENDAR';
    const windows = unix.replace(/\n/g, '\r\n');
    const oldMac = unix.replace(/\n/g, '\r');

    expect(parseICS(unix)).toHaveLength(1);
    expect(parseICS(windows)).toHaveLength(1);
    expect(parseICS(oldMac)).toHaveLength(1);
  });

  it('returns empty array for empty/invalid input', () => {
    expect(parseICS('')).toEqual([]);
    expect(parseICS('not ics content')).toEqual([]);
  });

  // --- RFC 5545 Line Unfolding ---
  it('unfolds folded SUMMARY lines (CRLF + space)', () => {
    // Manually build ICS with folded SUMMARY line
    const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Very Long\r\n  Title Here\r\nDTSTART;VALUE=DATE:20260101\r\nDTEND;VALUE=DATE:20260105\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const events = parseICS(ics);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Very Long Title Here');
  });

  it('unfolds folded DTSTART lines', () => {
    // DTSTART split across two lines
    const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Test\r\nDTSTART;VALUE=DA\r\n TE:20260101\r\nDTEND;VALUE=DATE:20260105\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const events = parseICS(ics);
    expect(events).toHaveLength(1);
    expect(events[0].start).toEqual(new Date(2026, 0, 1));
  });

  // --- RFC 5545 Character Unescaping ---
  it('unescapes commas in SUMMARY', () => {
    const ics = makeICS([{
      summary: 'Hello\\, World',
      dtstart: 'DTSTART;VALUE=DATE:20260101',
      dtend: 'DTEND;VALUE=DATE:20260105',
    }]);
    const events = parseICS(ics);
    expect(events[0].title).toBe('Hello, World');
  });

  it('unescapes semicolons in SUMMARY', () => {
    const ics = makeICS([{
      summary: 'Part A\\; Part B',
      dtstart: 'DTSTART;VALUE=DATE:20260101',
      dtend: 'DTEND;VALUE=DATE:20260105',
    }]);
    const events = parseICS(ics);
    expect(events[0].title).toBe('Part A; Part B');
  });

  it('unescapes backslashes in SUMMARY', () => {
    const ics = makeICS([{
      summary: 'Path\\\\Name',
      dtstart: 'DTSTART;VALUE=DATE:20260101',
      dtend: 'DTEND;VALUE=DATE:20260105',
    }]);
    const events = parseICS(ics);
    expect(events[0].title).toBe('Path\\Name');
  });

  it('unescapes \\n in SUMMARY as space (not newline)', () => {
    const ics = makeICS([{
      summary: 'Line One\\nLine Two',
      dtstart: 'DTSTART;VALUE=DATE:20260101',
      dtend: 'DTEND;VALUE=DATE:20260105',
    }]);
    const events = parseICS(ics);
    expect(events[0].title).toBe('Line One Line Two');
  });
});

// ==========================================================
// assignEventColors / eventColorKey
// ==========================================================
describe('assignEventColors', () => {
  const makeEvent = (title, startMonth, startDay) => ({
    title,
    start: new Date(2026, startMonth, startDay),
    end: new Date(2026, startMonth, startDay + 3),
  });

  it('assigns a unique color to each event', () => {
    const events = [
      makeEvent('A', 0, 1),
      makeEvent('B', 0, 5),
      makeEvent('C', 0, 10),
    ];
    const colorMap = assignEventColors(events);
    const colors = events.map(e => colorMap.get(eventColorKey(e)));
    // All should have values
    expect(colors.every(Boolean)).toBe(true);
    // All should be unique
    expect(new Set(colors).size).toBe(3);
  });

  it('returns HSL color strings', () => {
    const events = [makeEvent('Test', 0, 1)];
    const colorMap = assignEventColors(events);
    const color = colorMap.get(eventColorKey(events[0]));
    expect(color).toMatch(/^hsl\(\d+(\.\d+)?, \d+%, \d+%\)$/);
  });

  it('produces maximally different hues for adjacent events', () => {
    const events = [
      makeEvent('A', 3, 1),
      makeEvent('B', 3, 5),
    ];
    const colorMap = assignEventColors(events);
    const colors = events.map(e => colorMap.get(eventColorKey(e)));
    const hues = colors.map(c => parseFloat(c.match(/hsl\(([^,]+)/)[1]));
    // Golden angle separation ≈ 137.5°
    const diff = Math.abs(hues[1] - hues[0]);
    expect(diff).toBeGreaterThan(100);
    expect(diff).toBeLessThan(180);
  });

  it('is stable across calls with same input', () => {
    const events = [makeEvent('A', 0, 1), makeEvent('B', 1, 1)];
    const map1 = assignEventColors(events);
    const map2 = assignEventColors(events);
    for (const evt of events) {
      expect(map1.get(eventColorKey(evt))).toBe(map2.get(eventColorKey(evt)));
    }
  });

  it('handles empty event list', () => {
    const colorMap = assignEventColors([]);
    expect(colorMap.size).toBe(0);
  });
});

describe('eventColorKey', () => {
  it('produces same key for events with same start and title', () => {
    const a = { start: new Date(2026, 0, 1), title: 'Test' };
    const b = { start: new Date(2026, 0, 1), title: 'Test' };
    expect(eventColorKey(a)).toBe(eventColorKey(b));
  });

  it('produces different keys for different titles', () => {
    const a = { start: new Date(2026, 0, 1), title: 'A' };
    const b = { start: new Date(2026, 0, 1), title: 'B' };
    expect(eventColorKey(a)).not.toBe(eventColorKey(b));
  });

  it('produces different keys for different start dates', () => {
    const a = { start: new Date(2026, 0, 1), title: 'Test' };
    const b = { start: new Date(2026, 0, 2), title: 'Test' };
    expect(eventColorKey(a)).not.toBe(eventColorKey(b));
  });
});
