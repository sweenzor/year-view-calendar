import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCalendarUrls, loadCalendarUrls, saveCalendarUrls } from './calendar-storage';

describe('calendar-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('saves and loads URL sources with names', () => {
    const sources = [
      { id: 'src-1', name: 'Work', type: 'url', url: 'https://example.com/work.ics', status: 'ready', error: null },
      { id: 'src-2', name: 'Personal', type: 'url', url: 'https://example.com/personal.ics', status: 'ready', error: null },
    ];

    saveCalendarUrls(sources);
    expect(loadCalendarUrls()).toEqual([
      { url: 'https://example.com/work.ics', name: 'Work' },
      { url: 'https://example.com/personal.ics', name: 'Personal' },
    ]);
  });

  it('preserves source order', () => {
    const sources = [
      { id: 'src-3', name: 'C', type: 'url', url: 'https://c.com/cal.ics', status: 'ready', error: null },
      { id: 'src-1', name: 'A', type: 'url', url: 'https://a.com/cal.ics', status: 'ready', error: null },
      { id: 'src-2', name: 'B', type: 'url', url: 'https://b.com/cal.ics', status: 'ready', error: null },
    ];

    saveCalendarUrls(sources);
    const loaded = loadCalendarUrls();
    expect(loaded.map((e) => e.name)).toEqual(['C', 'A', 'B']);
  });

  it('ignores non-URL sources', () => {
    const sources = [
      { id: 'mock', name: 'Example Data', type: 'mock', status: 'ready', error: null },
      { id: 'src-1', name: 'Trips', type: 'file', url: null, status: 'ready', error: null },
      { id: 'src-2', name: 'Work', type: 'url', url: 'https://example.com/work.ics', status: 'ready', error: null },
    ];

    saveCalendarUrls(sources);
    expect(loadCalendarUrls()).toEqual([{ url: 'https://example.com/work.ics', name: 'Work' }]);
  });

  it('handles legacy string format', () => {
    localStorage.setItem('calendarUrls', JSON.stringify(['https://example.com/old.ics']));
    expect(loadCalendarUrls()).toEqual([{ url: 'https://example.com/old.ics', name: null }]);
  });

  it('removes storage when no URL sources remain', () => {
    saveCalendarUrls([
      { id: 'src-1', name: 'Work', type: 'url', url: 'https://example.com/work.ics', status: 'ready', error: null },
    ]);
    expect(loadCalendarUrls()).toHaveLength(1);

    saveCalendarUrls([
      { id: 'src-1', name: 'Trips', type: 'file', url: null, status: 'ready', error: null },
    ]);
    expect(loadCalendarUrls()).toEqual([]);
  });

  it('returns empty array when nothing is stored', () => {
    expect(loadCalendarUrls()).toEqual([]);
  });

  it('returns empty array for corrupt JSON', () => {
    localStorage.setItem('calendarUrls', 'not valid json');
    expect(loadCalendarUrls()).toEqual([]);
  });

  it('clears stored URLs', () => {
    saveCalendarUrls([
      { id: 'src-1', name: 'Work', type: 'url', url: 'https://example.com/work.ics', status: 'ready', error: null },
    ]);
    clearCalendarUrls();
    expect(loadCalendarUrls()).toEqual([]);
  });
});
