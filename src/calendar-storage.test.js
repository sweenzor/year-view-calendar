import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearRememberedCalendarUrls,
  loadHiddenEventIds,
  loadRememberedCalendarUrls,
  saveHiddenEventIds,
  saveRememberedCalendarUrls,
} from './calendar-storage';

describe('calendar-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('saves and loads only remembered URL sources', () => {
    saveRememberedCalendarUrls([
      { id: 'source-1', name: 'Work', type: 'url', url: 'https://example.com/work.ics', rememberOnDevice: true },
      { id: 'source-2', name: 'Trips', type: 'url', url: 'https://example.com/trips.ics', rememberOnDevice: false },
      { id: 'source-3', name: 'File Upload', type: 'file', url: null, rememberOnDevice: true },
    ]);

    expect(loadRememberedCalendarUrls()).toEqual([
      { url: 'https://example.com/work.ics', name: 'Work' },
    ]);
  });

  it('supports the legacy string-array format', () => {
    localStorage.setItem('calendarUrls', JSON.stringify(['https://example.com/old.ics']));
    expect(loadRememberedCalendarUrls()).toEqual([
      { url: 'https://example.com/old.ics', name: null },
    ]);
  });

  it('clears remembered URLs', () => {
    saveRememberedCalendarUrls([
      { id: 'source-1', name: 'Work', type: 'url', url: 'https://example.com/work.ics', rememberOnDevice: true },
    ]);

    clearRememberedCalendarUrls();
    expect(loadRememberedCalendarUrls()).toEqual([]);
  });

  it('saves and loads hidden event IDs', () => {
    const ids = new Set(['event-1', 'event-2']);
    saveHiddenEventIds(ids);
    expect(loadHiddenEventIds()).toEqual(ids);
  });

  it('returns empty set when no hidden events stored', () => {
    expect(loadHiddenEventIds()).toEqual(new Set());
  });

  it('clears hidden events when set is empty', () => {
    saveHiddenEventIds(new Set(['event-1']));
    saveHiddenEventIds(new Set());
    expect(loadHiddenEventIds()).toEqual(new Set());
  });
});
