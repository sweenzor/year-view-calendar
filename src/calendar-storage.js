const STORAGE_KEY = 'calendarUrls';

export const saveRememberedCalendarUrls = (sources) => {
  try {
    const entries = sources
      .filter((source) => source.type === 'url' && source.url && source.rememberOnDevice)
      .map((source) => ({
        url: source.url,
        name: source.name,
        showSingleDayEvents: source.showSingleDayEvents === true,
      }));

    if (entries.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

export const loadRememberedCalendarUrls = () => {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return [];

    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => (typeof entry === 'string' ? { url: entry, name: null } : entry))
      .filter((entry) => typeof entry?.url === 'string' && entry.url.trim());
  } catch {
    return [];
  }
};

export const clearRememberedCalendarUrls = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors when clearing
  }
};

const HIDDEN_EVENTS_KEY = 'hiddenEventIds';

export const saveHiddenEventIds = (hiddenIds) => {
  try {
    if (hiddenIds.size > 0) {
      localStorage.setItem(HIDDEN_EVENTS_KEY, JSON.stringify([...hiddenIds]));
    } else {
      localStorage.removeItem(HIDDEN_EVENTS_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

export const loadHiddenEventIds = () => {
  try {
    const json = localStorage.getItem(HIDDEN_EVENTS_KEY);
    if (!json) return new Set();
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
};
