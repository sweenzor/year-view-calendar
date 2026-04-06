import { createMockEvents } from './calendar-utils';

export const SOURCE_STATUS = {
  READY: 'ready',
  LOADING: 'loading',
  ERROR: 'error',
};

const MOCK_SOURCE = {
  id: 'mock',
  name: 'Example Data',
  type: 'mock',
  status: SOURCE_STATUS.READY,
  error: null,
};

const updateSource = (sources, sourceId, updater) => {
  return sources.map((source) => (
    source.id === sourceId
      ? updater(source)
      : source
  ));
};

const upsertSource = (sources, nextSource) => {
  const nextSources = sources.filter((source) => source.id !== 'mock');
  const existingIndex = nextSources.findIndex((source) => source.id === nextSource.id);

  if (existingIndex === -1) {
    nextSources.push(nextSource);
    return nextSources;
  }

  nextSources[existingIndex] = nextSource;
  return nextSources;
};

export const createSourceId = () => {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const createSourceIdFromUrl = (url) => {
  let hash = 0;
  for (let index = 0; index < url.length; index += 1) {
    hash = ((hash << 5) - hash + url.charCodeAt(index)) | 0;
  }

  return `url-${(hash >>> 0).toString(36)}`;
};

export const createInitialCalendarState = (baseDate = new Date()) => {
  return {
    events: createMockEvents(baseDate.getFullYear()),
    sources: [{ ...MOCK_SOURCE }],
    importFeedback: null,
  };
};

export const applyImportedSource = (state, { source, events }) => {
  const nextSource = {
    ...source,
    status: SOURCE_STATUS.READY,
    error: null,
  };

  return {
    ...state,
    events: [
      ...state.events.filter((event) => event.sourceId !== 'mock' && event.sourceId !== source.id),
      ...events,
    ],
    sources: upsertSource(state.sources, nextSource),
    importFeedback: null,
  };
};

export const setSourceLoading = (state, sourceId) => {
  return {
    ...state,
    sources: updateSource(state.sources, sourceId, (source) => ({
      ...source,
      status: SOURCE_STATUS.LOADING,
      error: null,
    })),
  };
};

export const setSourceError = (state, { sourceId, error }) => {
  return {
    ...state,
    sources: updateSource(state.sources, sourceId, (source) => ({
      ...source,
      status: SOURCE_STATUS.ERROR,
      error,
    })),
  };
};

export const updateSourceEvents = (state, { sourceId, events }) => {
  if (!state.sources.some((source) => source.id === sourceId)) {
    return state;
  }

  const existing = state.events.filter((event) => event.sourceId === sourceId);
  if (existing.length === events.length
    && existing.every((event, i) => event.id === events[i].id)) {
    return state;
  }

  return {
    ...state,
    events: [
      ...state.events.filter((event) => event.sourceId !== sourceId),
      ...events,
    ],
  };
};

export const removeSourceFromState = (state, sourceId) => {
  return {
    ...state,
    events: state.events.filter((event) => event.sourceId !== sourceId),
    sources: state.sources.filter((source) => source.id !== sourceId),
  };
};

export const clearAllSourcesFromState = (state) => {
  return {
    ...state,
    events: [],
    sources: [],
    importFeedback: null,
  };
};

export const calendarSourcesReducer = (state, action) => {
  switch (action.type) {
    case 'APPLY_IMPORTED_SOURCE':
      return applyImportedSource(state, action.payload);
    case 'SET_SOURCE_LOADING':
      return setSourceLoading(state, action.payload.sourceId);
    case 'SET_SOURCE_ERROR':
      return setSourceError(state, action.payload);
    case 'UPDATE_SOURCE_EVENTS':
      return updateSourceEvents(state, action.payload);
    case 'REMOVE_SOURCE':
      return removeSourceFromState(state, action.payload.sourceId);
    case 'CLEAR_ALL':
      return clearAllSourcesFromState(state);
    case 'SET_IMPORT_FEEDBACK':
      return {
        ...state,
        importFeedback: action.payload,
      };
    case 'CLEAR_IMPORT_FEEDBACK':
      return {
        ...state,
        importFeedback: null,
      };
    default:
      return state;
  }
};
