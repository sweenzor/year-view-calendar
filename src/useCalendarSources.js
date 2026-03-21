import { startTransition, useReducer, useState } from 'react';
import { fetchCalendarTextWithFallback, getCalendarName, isSupportedCalendarUrl, normalizeCalendarUrl, readFileAsText } from './calendar-import';
import { normalizeCalendarData } from './calendar-utils';
import { calendarSourcesReducer, createInitialCalendarState, createSourceId } from './calendar-sources';

const applyImportedContent = (dispatch, content, {
  sourceId,
  sourceName,
  sourceType,
  sourceUrl = null,
}) => {
  const events = normalizeCalendarData(content, { sourceId });
  startTransition(() => {
    dispatch({
      type: 'APPLY_IMPORTED_SOURCE',
      payload: {
        source: {
          id: sourceId,
          name: sourceName,
          type: sourceType,
          url: sourceUrl,
        },
        events,
      },
    });
  });
};

export const useCalendarSources = (baseDate) => {
  const [state, dispatch] = useReducer(calendarSourcesReducer, baseDate, createInitialCalendarState);
  const [isImportingUrl, setIsImportingUrl] = useState(false);

  const setImportFeedback = (feedback) => {
    dispatch({
      type: 'SET_IMPORT_FEEDBACK',
      payload: feedback,
    });
  };

  const clearImportFeedback = () => {
    dispatch({ type: 'CLEAR_IMPORT_FEEDBACK' });
  };

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
        applyImportedContent(dispatch, content, {
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

    setIsImportingUrl(true);
    clearImportFeedback();

    try {
      const content = await fetchCalendarTextWithFallback(normalizedUrl);
      applyImportedContent(dispatch, content, {
        sourceId: createSourceId(),
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
      applyImportedContent(dispatch, content, {
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
