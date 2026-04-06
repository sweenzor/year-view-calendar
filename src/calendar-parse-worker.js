import { normalizeCalendarData } from './calendar-utils';

self.onmessage = (event) => {
  const {
    content,
    sourceId,
    rangeStartMs = null,
    rangeEndMs = null,
  } = event.data;

  try {
    const { events, calendarName } = normalizeCalendarData(content, {
      sourceId,
      rangeStart: rangeStartMs == null ? null : new Date(rangeStartMs),
      rangeEnd: rangeEndMs == null ? null : new Date(rangeEndMs),
    });
    self.postMessage({ events, calendarName });
  } catch (error) {
    self.postMessage({ error: error.message || 'Failed to parse calendar data.' });
  }
};
