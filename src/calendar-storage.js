const STORAGE_KEY = 'calendarUrls';

export const saveCalendarUrls = (sources) => {
  try {
    const urls = sources
      .filter((s) => s.type === 'url' && s.url)
      .map((s) => s.url);
    if (urls.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

export const loadCalendarUrls = () => {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const clearCalendarUrls = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors when clearing
  }
};
