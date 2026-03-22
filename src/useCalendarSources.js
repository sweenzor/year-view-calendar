import { startTransition, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { fetchCalendarTextWithFallback, getCalendarName, isSupportedCalendarUrl, normalizeCalendarUrl, readFileAsText } from './calendar-import';
import { calendarSourcesReducer, createInitialCalendarState, createSourceId, createSourceIdFromUrl } from './calendar-sources';
import { clearCalendarUrls, loadCalendarUrls, saveCalendarUrls } from './calendar-storage';
import ParseWorker from './calendar-parse-worker.js?worker';

const parseInWorker = (content, sourceId) => {
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
    worker.postMessage({ content, sourceId });
  });
};

const applyImportedContent = async (dispatch, content, {
  sourceId,
  sourceName,
  sourceType,
  sourceUrl = null,
}) => {
  const { events, calendarName } = await parseInWorker(content, sourceId);
  startTransition(() => {
    dispatch({
      type: 'APPLY_IMPORTED_SOURCE',
      payload: {
        source: {
          id: sourceId,
          name: calendarName || sourceName,
          type: sourceType,
          url: sourceUrl,
        },
        events,
      },
    });
  });
};

const createInitialState = (baseDate) => {
  const savedEntries = loadCalendarUrls();
  if (savedEntries.length > 0) {
    const sources = savedEntries.map((entry) => ({
      id: createSourceIdFromUrl(entry.url),
      name: entry.name || getCalendarName(entry.url),
      type: 'url',
      url: entry.url,
      status: 'loading',
      error: null,
    }));
    return { events: [], sources, importFeedback: null };
  }
  return createInitialCalendarState(baseDate);
};

export const useCalendarSources = (baseDate) => {
  const [state, dispatch] = useReducer(calendarSourcesReducer, baseDate, createInitialState);
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const hasLoadedUrlsRef = useRef(false);

  const setImportFeedback = (feedback) => {
    dispatch({
      type: 'SET_IMPORT_FEEDBACK',
      payload: feedback,
    });
  };

  const clearImportFeedback = useCallback(() => {
    dispatch({ type: 'CLEAR_IMPORT_FEEDBACK' });
  }, []);

  useEffect(() => {
    if (state.importFeedback) {
      const timer = setTimeout(clearImportFeedback, 8000);
      return () => clearTimeout(timer);
    }
  }, [state.importFeedback, clearImportFeedback]);

  // Save URL list whenever sources change
  useEffect(() => {
    if (hasLoadedUrlsRef.current) {
      saveCalendarUrls(state.sources);
    }
  }, [state.sources]);

  // Fetch saved URL sources on mount (sources already in state with loading status)
  useEffect(() => {
    hasLoadedUrlsRef.current = true;
    let stale = false;

    const urlSources = state.sources.filter((s) => s.type === 'url' && s.status === 'loading');
    for (const source of urlSources) {
      fetchCalendarTextWithFallback(source.url)
        .then((content) => {
          if (stale) return;
          return applyImportedContent(dispatch, content, {
            sourceId: source.id,
            sourceName: source.name,
            sourceType: 'url',
            sourceUrl: source.url,
          });
        })
        .catch((error) => {
          if (stale) return;
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
      hasLoadedUrlsRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      try {
        const content = await readFileAsText(file);
        await applyImportedContent(dispatch, content, {
          sourceId: createSourceId(),
          sourceName: file.name,
          sourceType: 'file',
        });
      } catch (error) {
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

  const importUrl = async (urlValue) => {
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

    try {
      const content = await fetchCalendarTextWithFallback(normalizedUrl);
      await applyImportedContent(dispatch, content, {
        sourceId: createSourceIdFromUrl(normalizedUrl),
        sourceName: getCalendarName(normalizedUrl),
        sourceType: 'url',
        sourceUrl: normalizedUrl,
      });
      return true;
    } catch (error) {
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
      await applyImportedContent(dispatch, content, {
        sourceId: source.id,
        sourceName: source.name,
        sourceType: 'url',
        sourceUrl: source.url,
      });
    } catch (error) {
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
    dispatch({
      type: 'REMOVE_SOURCE',
      payload: { sourceId },
    });
  };

  const clearAllSources = () => {
    clearCalendarUrls();
    dispatch({ type: 'CLEAR_ALL' });
  };

  return {
    events: state.events,
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
  };
};
