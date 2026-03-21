import { normalizeCalendarData } from './calendar-utils';

self.onmessage = (event) => {
  const { content, sourceId } = event.data;
  try {
    const events = normalizeCalendarData(content, { sourceId });
    // Dates aren't structured-cloneable as-is in the event objects,
    // so serialize them for transfer back to the main thread.
    const serialized = events.map((e) => ({
      ...e,
      start: e.start.getTime(),
      end: e.end.getTime(),
    }));
    self.postMessage({ events: serialized });
  } catch (error) {
    self.postMessage({ error: error.message || 'Failed to parse calendar data.' });
  }
};
