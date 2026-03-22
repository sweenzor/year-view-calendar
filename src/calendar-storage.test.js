import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCalendarUrls, loadCalendarUrls, saveCalendarUrls } from './calendar-storage';

describe('calendar-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('saves and loads URL sources', () => {
    const sources = [
      { id: 'src-1', name: 'Work', type: 'url', url: 'https://example.com/work.ics', status: 'ready', error: null },
      { id: 'src-2', name: 'Personal', type: 'url', url: 'https://example.com/personal.ics', status: 'ready', error: null },
    ];

    saveCalendarUrls(sources);
    expect(loadCalendarUrls()).toEqual([
      'https://example.com/work.ics',
      'https://example.com/personal.ics',
    ]);
  });

  it('ignores non-URL sources', () => {
    const sources = [
      { id: 'mock', name: 'Example Data', type: 'mock', status: 'ready', error: null },
      { id: 'src-1', name: 'Trips', type: 'file', url: null, status: 'ready', error: null },
      { id: 'src-2', name: 'Work', type: 'url', url: 'https://example.com/work.ics', status: 'ready', error: null },
    ];

    saveCalendarUrls(sources);
    expect(loadCalendarUrls()).toEqual(['https://example.com/work.ics']);
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
