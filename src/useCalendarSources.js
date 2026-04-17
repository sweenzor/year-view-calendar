import { startTransition, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { fetchCalendarTextWithFallback, getCalendarName, isSupportedCalendarUrl, normalizeCalendarUrl, readFileAsText } from './calendar-import';
import {
  calendarSourcesReducer,
  createInitialCalendarState,
  createSourceId,
  createSourceIdFromUrl,
} from './calendar-sources';
import {
  clearRememberedCalendarUrls,
  loadRememberedCalendarUrls,
  saveRememberedCalendarUrls,
} from './calendar-storage';
import ParseWorker from './calendar-parse-worker.js?worker';

const parseInWorker = (content, {
  sourceId,
  rangeStartMs = null,
  rangeEndMs = null,
}) => {
  return new Promise((resolve, reject) => {
    const worker = new ParseWorker();
    worker.onmessage = (event) => {
      worker.terminate();
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve({ events: event.data.events, calendarName: event.data.calendarName });
      }
    };
    worker.onerror = (error) => {
      worker.terminate();
      reject(new Error(error.message || 'Calendar parsing failed.'));
    };
    worker.postMessage({
      content,
      sourceId,
      rangeStartMs,
      rangeEndMs,
    });
  });
};

const rangesMatch = (left, right) => {
  return left.rangeStartMs === right.rangeStartMs
    && left.rangeEndMs === right.rangeEndMs;
};

const applyImportedContent = async (dispatch, parseSourceContent, content, {
  sourceId,
  sourceName,
  sourceType,
  sourceUrl = null,
  rememberOnDevice = false,
}) => {
  const { events, calendarName } = await parseSourceContent(content, sourceId);
  startTransition(() => {
    dispatch({
      type: 'APPLY_IMPORTED_SOURCE',
      payload: {
        source: {
          id: sourceId,
          name: calendarName || sourceName,
          type: sourceType,
          url: sourceUrl,
          rememberOnDevice,
        },
        events,
      },
    });
  });
};

const createInitialState = (baseDate) => {
  const rememberedEntries = loadRememberedCalendarUrls();
  if (rememberedEntries.length === 0) {
    return createInitialCalendarState(baseDate);
  }

  return {
    events: [],
    sources: rememberedEntries.map((entry) => ({
      id: createSourceIdFromUrl(entry.url),
      name: entry.name || getCalendarName(entry.url),
      type: 'url',
      url: entry.url,
      status: 'loading',
      error: null,
      rememberOnDevice: true,
      showSingleDayEvents: entry.showSingleDayEvents === true,
    })),
    importFeedback: null,
  };
};

export const useCalendarSources = ({ baseDate, displayedRange }) => {
  const [state, dispatch] = useReducer(calendarSourcesReducer, baseDate, createInitialState);
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const hasLoadedRememberedSourcesRef = useRef(false);
  const sourceContentsRef = useRef(new Map());
  const rangeStartMs = displayedRange?.start?.getTime() ?? null;
  const rangeEndMs = displayedRange?.end?.getTime() ?? null;
  const initialRememberedSourcesRef = useRef(state.sources);
  const latestRangeRef = useRef({ rangeStartMs, rangeEndMs });
  if (!rangesMatch(latestRangeRef.current, { rangeStartMs, rangeEndMs })) {
    latestRangeRef.current = { rangeStartMs, rangeEndMs };
  }
  const setImportFeedback = (feedback) => {
    dispatch({
      type: 'SET_IMPORT_FEEDBACK',
      payload: feedback,
    });
  };

  const parseSourceContent = useCallback(async (content, sourceId) => {
    const maxRetries = 3;
    let requestedRange = { ...latestRangeRef.current };

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const parsed = await parseInWorker(content, {
        sourceId,
        ...requestedRange,
      });
      const currentRange = latestRangeRef.current;
      if (rangesMatch(requestedRange, currentRange) || attempt === maxRetries) {
        return parsed;
      }

      requestedRange = { ...currentRange };
    }
  }, []);

  const clearImportFeedback = useCallback(() => {
    dispatch({ type: 'CLEAR_IMPORT_FEEDBACK' });
  }, []);

  useEffect(() => {
    if (state.importFeedback) {
      const timer = setTimeout(clearImportFeedback, 8000);
      return () => clearTimeout(timer);
    }
  }, [state.importFeedback, clearImportFeedback]);

  useEffect(() => {
    if (hasLoadedRememberedSourcesRef.current) {
      saveRememberedCalendarUrls(state.sources);
    }
  }, [state.sources]);

  useEffect(() => {
    let stale = false;
    const syncLoadedSources = async () => {
      const entries = Array.from(sourceContentsRef.current.entries());
      await Promise.all(entries.map(async ([sourceId, content]) => {
        if (!content) {
          return;
        }

        try {
          const { events } = await parseSourceContent(content, sourceId);
          if (stale) {
            return;
          }

          startTransition(() => {
            dispatch({
              type: 'UPDATE_SOURCE_EVENTS',
              payload: { sourceId, events },
            });
          });
        } catch {
          if (stale) {
            return;
          }
        }
      }));
    };

    syncLoadedSources();

    return () => {
      stale = true;
    };
  }, [
    parseSourceContent,
    rangeStartMs,
    rangeEndMs,
  ]);

  useEffect(() => {
    hasLoadedRememberedSourcesRef.current = true;
    let stale = false;

    const rememberedSources = initialRememberedSourcesRef.current.filter(
      (source) => source.type === 'url' && source.status === 'loading',
    );
    for (const source of rememberedSources) {
      fetchCalendarTextWithFallback(source.url)
        .then((content) => {
          if (stale) return;

          sourceContentsRef.current.set(source.id, content);
          return applyImportedContent(dispatch, parseSourceContent, content, {
            sourceId: source.id,
            sourceName: source.name,
            sourceType: 'url',
            sourceUrl: source.url,
            rememberOnDevice: true,
          });
        })
        .catch((error) => {
          if (stale) return;

          sourceContentsRef.current.delete(source.id);
          dispatch({
            type: 'SET_SOURCE_ERROR',
            payload: {
              sourceId: source.id,
              error: error.message || `Failed to load ${source.name}.`,
            },
          });
        });
    }

    return () => {
      stale = true;
      hasLoadedRememberedSourcesRef.current = false;
    };
  }, [parseSourceContent]);

  const importFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) {
      return;
    }

    const feedbackMessages = [];

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.ics')) {
        feedbackMessages.push(`Skipped ${file.name}: not an .ics file.`);
        continue;
      }

      const sourceId = createSourceId();
      try {
        const content = await readFileAsText(file);
        sourceContentsRef.current.set(sourceId, content);
        await applyImportedContent(dispatch, parseSourceContent, content, {
          sourceId,
          sourceName: file.name,
          sourceType: 'file',
        });
      } catch (error) {
        sourceContentsRef.current.delete(sourceId);
        feedbackMessages.push(`Could not import ${file.name}: ${error.message}`);
      }
    }

    if (feedbackMessages.length > 0) {
      setImportFeedback({
        type: 'error',
        message: feedbackMessages.join(' '),
      });
      return;
    }

    clearImportFeedback();
  };

  const importUrl = async (urlValue, { rememberOnDevice = false } = {}) => {
    const normalizedUrl = normalizeCalendarUrl(urlValue);

    if (!normalizedUrl || !isSupportedCalendarUrl(normalizedUrl)) {
      setImportFeedback({
        type: 'error',
        message: 'Enter a valid http:// or https:// calendar URL.',
      });
      return false;
    }

    if (state.sources.some((s) => s.url === normalizedUrl)) {
      setImportFeedback({
        type: 'error',
        message: 'This calendar URL is already loaded.',
      });
      return false;
    }

    setIsImportingUrl(true);
    clearImportFeedback();

    const sourceId = rememberOnDevice ? createSourceIdFromUrl(normalizedUrl) : createSourceId();
    try {
      const content = await fetchCalendarTextWithFallback(normalizedUrl);
      sourceContentsRef.current.set(sourceId, content);
      await applyImportedContent(dispatch, parseSourceContent, content, {
        sourceId,
        sourceName: getCalendarName(normalizedUrl),
        sourceType: 'url',
        sourceUrl: normalizedUrl,
        rememberOnDevice,
      });
      return true;
    } catch (error) {
      sourceContentsRef.current.delete(sourceId);
      setImportFeedback({
        type: 'error',
        message: error.message || 'Could not import that calendar URL.',
      });
      return false;
    } finally {
      setIsImportingUrl(false);
    }
  };

  const reloadSource = async (source) => {
    if (!source.url) {
      return;
    }

    dispatch({
      type: 'SET_SOURCE_LOADING',
      payload: { sourceId: source.id },
    });

    try {
      const content = await fetchCalendarTextWithFallback(source.url);
      sourceContentsRef.current.set(source.id, content);
      await applyImportedContent(dispatch, parseSourceContent, content, {
        sourceId: source.id,
        sourceName: source.name,
        sourceType: 'url',
        sourceUrl: source.url,
        rememberOnDevice: source.rememberOnDevice === true,
      });
    } catch (error) {
      sourceContentsRef.current.delete(source.id);
      dispatch({
        type: 'SET_SOURCE_ERROR',
        payload: {
          sourceId: source.id,
          error: error.message || `Failed to reload ${source.name}.`,
        },
      });
    }
  };

  const reloadAllSources = async () => {
    const urlSources = state.sources.filter((source) => source.url);
    await Promise.all(urlSources.map((source) => reloadSource(source)));
  };

  const removeSource = (sourceId) => {
    sourceContentsRef.current.delete(sourceId);
    dispatch({
      type: 'REMOVE_SOURCE',
      payload: { sourceId },
    });
  };

  const clearAllSources = () => {
    sourceContentsRef.current.clear();
    clearRememberedCalendarUrls();
    dispatch({ type: 'CLEAR_ALL' });
  };

  const toggleSingleDayEvents = useCallback((sourceId) => {
    dispatch({
      type: 'TOGGLE_SINGLE_DAY_EVENTS',
      payload: { sourceId },
    });
  }, []);

  const singleDayAllowedSourceIds = useMemo(() => {
    const allowed = new Set();
    state.sources.forEach((source) => {
      if (source.showSingleDayEvents) {
        allowed.add(source.id);
      }
    });
    return allowed;
  }, [state.sources]);

  const visibleEvents = useMemo(() => {
    return state.events.filter((event) => {
      if (!event.allDay || (event.durationDays ?? 0) > 1) {
        return true;
      }
      return singleDayAllowedSourceIds.has(event.sourceId);
    });
  }, [state.events, singleDayAllowedSourceIds]);

  return {
    events: visibleEvents,
    sources: state.sources,
    importFeedback: state.importFeedback,
    isImportingUrl,
    importFiles,
    importUrl,
    reloadSource,
    reloadAllSources,
    removeSource,
    clearAllSources,
    clearImportFeedback,
    toggleSingleDayEvents,
  };
};
