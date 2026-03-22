import { normalizeCalendarData } from './calendar-utils';

self.onmessage = (event) => {
  const { content, sourceId } = event.data;
  try {
    const events = normalizeCalendarData(content, { sourceId });
    self.postMessage({ events });
  } catch (error) {
    self.postMessage({ error: error.message || 'Failed to parse calendar data.' });
  }
};
