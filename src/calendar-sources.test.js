import { describe, expect, it } from 'vitest';
import {
  SOURCE_STATUS,
  applyImportedSource,
  calendarSourcesReducer,
  clearAllSourcesFromState,
  createInitialCalendarState,
  removeSourceFromState,
  setSourceError,
  setSourceLoading,
  toggleSourceSingleDayEvents,
} from './calendar-sources';

describe('calendar source state', () => {
  it('starts with mock data', () => {
    const state = createInitialCalendarState(new Date(2026, 2, 21));

    expect(state.sources).toHaveLength(1);
    expect(state.sources[0].id).toBe('mock');
    expect(state.events.length).toBeGreaterThan(0);
  });

  it('applies a new imported source and removes mock data', () => {
    const initialState = createInitialCalendarState(new Date(2026, 2, 21));
    const events = [{
      id: 'source-1:event-1',
      sourceId: 'source-1',
      title: 'Vacation',
      start: new Date(2026, 6, 1),
      end: new Date(2026, 6, 4),
    }];

    const nextState = applyImportedSource(initialState, {
      source: { id: 'source-1', name: 'Trips', type: 'file' },
      events,
    });

    expect(nextState.sources).toEqual([{
      id: 'source-1',
      name: 'Trips',
      type: 'file',
      showSingleDayEvents: true,
      status: SOURCE_STATUS.READY,
      error: null,
    }]);
    expect(nextState.events).toEqual(events);
  });

  it('preserves a source single-day toggle across reloads', () => {
    const baseState = createInitialCalendarState(new Date(2026, 2, 21));
    const imported = applyImportedSource(baseState, {
      source: { id: 'source-1', name: 'Trips', type: 'file' },
      events: [],
    });

    const toggled = toggleSourceSingleDayEvents(imported, 'source-1');
    expect(toggled.sources[0].showSingleDayEvents).toBe(false);

    const reloaded = applyImportedSource(toggled, {
      source: { id: 'source-1', name: 'Trips', type: 'file' },
      events: [],
    });
    expect(reloaded.sources[0].showSingleDayEvents).toBe(false);
  });

  it('toggles single-day events via the reducer', () => {
    const baseState = createInitialCalendarState(new Date(2026, 2, 21));
    const imported = applyImportedSource(baseState, {
      source: { id: 'source-1', name: 'Trips', type: 'file' },
      events: [],
    });

    const off = calendarSourcesReducer(imported, {
      type: 'TOGGLE_SINGLE_DAY_EVENTS',
      payload: { sourceId: 'source-1' },
    });
    expect(off.sources[0].showSingleDayEvents).toBe(false);

    const on = calendarSourcesReducer(off, {
      type: 'TOGGLE_SINGLE_DAY_EVENTS',
      payload: { sourceId: 'source-1' },
    });
    expect(on.sources[0].showSingleDayEvents).toBe(true);
  });

  it('replaces an existing source on refresh', () => {
    const initialState = {
      events: [{
        id: 'source-1:event-old',
        sourceId: 'source-1',
        title: 'Old title',
        start: new Date(2026, 0, 1),
        end: new Date(2026, 0, 3),
      }],
      sources: [{
        id: 'source-1',
        name: 'Remote Calendar',
        type: 'url',
        url: 'https://example.com/old.ics',
        status: SOURCE_STATUS.ERROR,
        error: 'Failed to reload',
      }],
      importFeedback: { type: 'error', message: 'Old error' },
    };

    const nextState = applyImportedSource(initialState, {
      source: {
        id: 'source-1',
        name: 'Remote Calendar',
        type: 'url',
        url: 'https://example.com/new.ics',
      },
      events: [{
        id: 'source-1:event-new',
        sourceId: 'source-1',
        title: 'New title',
        start: new Date(2026, 1, 1),
        end: new Date(2026, 1, 4),
      }],
    });

    expect(nextState.events).toHaveLength(1);
    expect(nextState.events[0].title).toBe('New title');
    expect(nextState.sources[0]).toMatchObject({
      id: 'source-1',
      status: SOURCE_STATUS.READY,
      error: null,
      url: 'https://example.com/new.ics',
    });
    expect(nextState.importFeedback).toBeNull();
  });

  it('tracks loading and error states for sources', () => {
    const state = {
      events: [],
      sources: [{
        id: 'source-1',
        name: 'Remote',
        type: 'url',
        url: 'https://example.com/calendar.ics',
        status: SOURCE_STATUS.READY,
        error: null,
      }],
      importFeedback: null,
    };

    const loadingState = setSourceLoading(state, 'source-1');
    expect(loadingState.sources[0].status).toBe(SOURCE_STATUS.LOADING);

    const errorState = setSourceError(loadingState, {
      sourceId: 'source-1',
      error: 'Fetch failed',
    });
    expect(errorState.sources[0]).toMatchObject({
      status: SOURCE_STATUS.ERROR,
      error: 'Fetch failed',
    });
  });

  it('removes and clears sources', () => {
    const state = {
      events: [{
        id: 'source-1:event-1',
        sourceId: 'source-1',
        title: 'Trip',
        start: new Date(2026, 0, 1),
        end: new Date(2026, 0, 4),
      }],
      sources: [{
        id: 'source-1',
        name: 'Trips',
        type: 'file',
        status: SOURCE_STATUS.READY,
        error: null,
      }],
      importFeedback: { type: 'error', message: 'Something went wrong' },
    };

    const removedState = removeSourceFromState(state, 'source-1');
    expect(removedState.sources).toEqual([]);
    expect(removedState.events).toEqual([]);

    const clearedState = clearAllSourcesFromState(state);
    expect(clearedState).toEqual({
      events: [],
      sources: [],
      importFeedback: null,
    });
  });
});
