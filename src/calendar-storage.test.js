import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearRememberedCalendarUrls,
  loadHiddenEventIds,
  loadInfoBannerDismissed,
  loadRememberedCalendarUrls,
  saveHiddenEventIds,
  saveInfoBannerDismissed,
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
      { url: 'https://example.com/work.ics', name: 'Work', showSingleDayEvents: true },
    ]);
  });

  it('persists single-day toggle for remembered URL sources', () => {
    saveRememberedCalendarUrls([
      {
        id: 'source-1',
        name: 'Work',
        type: 'url',
        url: 'https://example.com/work.ics',
        rememberOnDevice: true,
        showSingleDayEvents: false,
      },
    ]);

    expect(loadRememberedCalendarUrls()).toEqual([
      { url: 'https://example.com/work.ics', name: 'Work', showSingleDayEvents: false },
    ]);
  });

  it('redacts path-derived labels when saving remembered private URL sources', () => {
    const googleSecretUrl = 'https://calendar.google.com/calendar/ical/person%40example.com/private-abc123/basic.ics';
    const privateFeedUrl = 'https://feeds.example.com/calendars/very-secret-token/private.ics?token=abc123';

    saveRememberedCalendarUrls([
      {
        id: 'source-1',
        name: 'calendar.google.com/calendar/ical/person%40example.com/private-abc123/basic.ics',
        type: 'url',
        url: googleSecretUrl,
        rememberOnDevice: true,
      },
      {
        id: 'source-2',
        name: 'feeds.example.com/calendars/very-secret-token/private.ics?token=abc123',
        type: 'url',
        url: privateFeedUrl,
        rememberOnDevice: true,
      },
    ]);

    expect(loadRememberedCalendarUrls()).toEqual([
      { url: googleSecretUrl, name: null, showSingleDayEvents: true },
      { url: privateFeedUrl, name: null, showSingleDayEvents: true },
    ]);
  });

  it('redacts legacy path-derived labels when loading remembered private URL sources', () => {
    const googleSecretUrl = 'https://calendar.google.com/calendar/ical/person%40example.com/private-abc123/basic.ics';

    localStorage.setItem('calendarUrls', JSON.stringify([
      {
        url: googleSecretUrl,
        name: 'calendar.google.com/calendar/ical/person@example.com/private-abc123/basic.ics',
        showSingleDayEvents: false,
      },
    ]));

    expect(loadRememberedCalendarUrls()).toEqual([
      { url: googleSecretUrl, name: null, showSingleDayEvents: false },
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

  it('defaults to showing the info banner', () => {
    expect(loadInfoBannerDismissed()).toBe(false);
  });

  it('persists info banner dismissal', () => {
    saveInfoBannerDismissed();
    expect(loadInfoBannerDismissed()).toBe(true);
  });
});
