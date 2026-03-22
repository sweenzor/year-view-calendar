import { normalizeCalendarData } from './calendar-utils';

self.onmessage = (event) => {
  const { content, sourceId } = event.data;
  try {
    const { events, calendarName } = normalizeCalendarData(content, { sourceId });
    self.postMessage({ events, calendarName });
  } catch (error) {
    self.postMessage({ error: error.message || 'Failed to parse calendar data.' });
  }
};
