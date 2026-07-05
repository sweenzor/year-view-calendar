import ICAL from 'ical.js';
import { MILLISECONDS_PER_DAY, calculateInclusiveDaySpan } from './calendar-utils';

const UNTITLED_EVENT = 'Untitled Event';
const MAX_RECURRING_OCCURRENCES = 500;
const MAX_RECURRENCE_ITERATIONS = 10000;

const toLocalDayStart = (date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const buildEventId = (event, index, sourceId, occurrenceId = null) => {
  const uid = event.uid;
  if (uid) {
    return occurrenceId
      ? `${sourceId}:${uid}:${occurrenceId.toString()}`
      : `${sourceId}:${uid}`;
  }

  return occurrenceId
    ? `${sourceId}:event-${index}:${occurrenceId.toString()}`
    : `${sourceId}:event-${index}`;
};

const doesOccurrenceOverlapRange = (startTime, endTime, { rangeStart = null, rangeEnd = null } = {}) => {
  const rawStart = startTime.toJSDate();
  const rawEnd = endTime.toJSDate();

  if (rangeStart && rawEnd <= rangeStart) {
    return false;
  }

  if (rangeEnd && rawStart >= rangeEnd) {
    return false;
  }

  return true;
};

const normalizeCalendarEvent = (
  event,
  index,
  sourceId,
  {
    startTime = event.startDate,
    endTime = event.endDate,
    occurrenceId = null,
  } = {},
) => {

  if (!startTime || !endTime) {
    return null;
  }

  const rawStart = startTime.toJSDate();
  const rawEnd = endTime.toJSDate();
  const durationMs = rawEnd.getTime() - rawStart.getTime();
  const allDay = startTime.isDate;

  const meetsDurationThreshold = allDay
    ? durationMs >= MILLISECONDS_PER_DAY
    : durationMs > MILLISECONDS_PER_DAY;

  if (!meetsDurationThreshold) {
    return null;
  }

  const start = toLocalDayStart(rawStart);
  const inclusiveEnd = new Date(rawEnd.getTime() - (allDay ? MILLISECONDS_PER_DAY : 1));
  const end = toLocalDayStart(inclusiveEnd);

  if (end < start) {
    return null;
  }

  const title = event.summary?.toString().trim() || UNTITLED_EVENT;

  return {
    id: buildEventId(event, index, sourceId, occurrenceId),
    sourceId,
    title,
    start,
    end,
    allDay,
    durationDays: calculateInclusiveDaySpan(start, end),
  };
};

const expandCalendarEvent = (event, index, { sourceId, rangeStart = null, rangeEnd = null } = {}) => {
  if (!event.isRecurring()) {
    if (!doesOccurrenceOverlapRange(event.startDate, event.endDate, { rangeStart, rangeEnd })) {
      return [];
    }

    const normalizedEvent = normalizeCalendarEvent(event, index, sourceId);
    return normalizedEvent ? [normalizedEvent] : [];
  }

  const iterator = event.iterator();
  const expandedEvents = [];
  let matchCount = 0;
  let iterationCount = 0;

  while (matchCount < MAX_RECURRING_OCCURRENCES && iterationCount < MAX_RECURRENCE_ITERATIONS) {
    iterationCount += 1;
    const nextOccurrence = iterator.next();
    if (!nextOccurrence) {
      break;
    }

    const occurrenceDetails = event.getOccurrenceDetails(nextOccurrence);
    if (rangeEnd
      && occurrenceDetails.startDate.toJSDate() >= rangeEnd
      && nextOccurrence.toJSDate() >= rangeEnd) {
      break;
    }

    if (!doesOccurrenceOverlapRange(occurrenceDetails.startDate, occurrenceDetails.endDate, { rangeStart, rangeEnd })) {
      continue;
    }

    matchCount += 1;
    const normalizedEvent = normalizeCalendarEvent(event, index, sourceId, {
      startTime: occurrenceDetails.startDate,
      endTime: occurrenceDetails.endDate,
      occurrenceId: occurrenceDetails.recurrenceId,
    });

    if (normalizedEvent) {
      expandedEvents.push({
        ...normalizedEvent,
        title: occurrenceDetails.item.summary?.toString().trim() || normalizedEvent.title,
      });
    }
  }

  return expandedEvents;
};

const getPrimaryCalendarEvents = (calendarComponent) => {
  const calendarEvents = calendarComponent
    .getAllSubcomponents('vevent')
    .map((component) => new ICAL.Event(component));
  const recurringEventsByUid = new Map(
    calendarEvents
      .filter((event) => event.isRecurring() && !event.isRecurrenceException() && event.uid)
      .map((event) => [event.uid, event]),
  );

  calendarEvents
    .filter((event) => event.isRecurrenceException() && event.uid)
    .forEach((event) => {
      recurringEventsByUid.get(event.uid)?.relateException(event);
    });

  return calendarEvents.filter((event) => !event.isRecurrenceException());
};

export const normalizeCalendarData = (
  icsContent,
  {
    sourceId = 'unknown-source',
    rangeStart = null,
    rangeEnd = null,
  } = {},
) => {
  const trimmedContent = icsContent?.trim();
  if (!trimmedContent) {
    return { events: [], calendarName: null };
  }

  let calendarComponent;
  try {
    calendarComponent = new ICAL.Component(ICAL.parse(trimmedContent));
  } catch {
    throw new Error('Invalid calendar data.');
  }

  const calendarName = calendarComponent.getFirstPropertyValue('x-wr-calname')
    || calendarComponent.getFirstPropertyValue('name')
    || null;

  const events = getPrimaryCalendarEvents(calendarComponent)
    .flatMap((event, index) => expandCalendarEvent(event, index, {
      sourceId,
      rangeStart,
      rangeEnd,
    }))
    .filter(Boolean);

  return { events, calendarName };
};
