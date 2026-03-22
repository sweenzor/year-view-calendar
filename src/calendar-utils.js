import ICAL from 'ical.js';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const UNTITLED_EVENT = 'Untitled Event';
const GOLDEN_ANGLE = 137.508;
const DEFAULT_EVENT_APPEARANCE = {
  backgroundColor: 'hsl(210, 60%, 50%)',
  textColor: '#ffffff',
};

const toLocalDayStart = (date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const calculateInclusiveDaySpan = (start, end) => {
  const diff = end.getTime() - start.getTime();
  return Math.floor(diff / MILLISECONDS_PER_DAY) + 1;
};

const buildEventId = (component, index, sourceId) => {
  const uid = component.getFirstPropertyValue('uid');
  const recurrenceId = component.getFirstPropertyValue('recurrence-id');
  if (uid) {
    return recurrenceId
      ? `${sourceId}:${uid}:${recurrenceId.toString()}`
      : `${sourceId}:${uid}`;
  }

  return `${sourceId}:event-${index}`;
};

const normalizeCalendarEvent = (component, index, sourceId) => {
  const event = new ICAL.Event(component);
  const startTime = event.startDate;
  const endTime = event.endDate;

  if (!startTime || !endTime) {
    return null;
  }

  const rawStart = startTime.toJSDate();
  const rawEnd = endTime.toJSDate();
  const durationMs = rawEnd.getTime() - rawStart.getTime();

  if (!(durationMs > MILLISECONDS_PER_DAY)) {
    return null;
  }

  const allDay = startTime.isDate;
  const start = toLocalDayStart(rawStart);
  const inclusiveEnd = new Date(rawEnd.getTime() - (allDay ? MILLISECONDS_PER_DAY : 1));
  const end = toLocalDayStart(inclusiveEnd);

  if (end < start) {
    return null;
  }

  const title = component.getFirstPropertyValue('summary')?.toString().trim() || UNTITLED_EVENT;

  return {
    id: buildEventId(component, index, sourceId),
    sourceId,
    title,
    start,
    end,
    allDay,
    durationDays: calculateInclusiveDaySpan(start, end),
  };
};

const srgbToLinear = (channel) => {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const hslToRgb = (hue, saturation, lightness) => {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs((2 * l) - 1)) * s;
  const hueSegment = hue / 60;
  const x = chroma * (1 - Math.abs((hueSegment % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSegment >= 0 && hueSegment < 1) {
    red = chroma;
    green = x;
  } else if (hueSegment < 2) {
    red = x;
    green = chroma;
  } else if (hueSegment < 3) {
    green = chroma;
    blue = x;
  } else if (hueSegment < 4) {
    green = x;
    blue = chroma;
  } else if (hueSegment < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = l - (chroma / 2);

  return [red, green, blue].map((value) => Math.round((value + match) * 255));
};

const getReadableTextColor = (hue, saturation, lightness) => {
  const [red, green, blue] = hslToRgb(hue, saturation, lightness);
  const luminance = (
    (0.2126 * srgbToLinear(red))
    + (0.7152 * srgbToLinear(green))
    + (0.0722 * srgbToLinear(blue))
  );

  return luminance > 0.36 ? '#0f172a' : '#ffffff';
};

const createMockEvent = ({ id, title, start, end }) => ({
  id,
  sourceId: 'mock',
  title,
  start,
  end,
  allDay: true,
  durationDays: calculateInclusiveDaySpan(start, end),
});

export const eventColorKey = (event) => `${event.start.getTime()}-${event.title || ''}`;

export const normalizeCalendarData = (icsContent, { sourceId = 'unknown-source' } = {}) => {
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

  const events = calendarComponent
    .getAllSubcomponents('vevent')
    .map((component, index) => normalizeCalendarEvent(component, index, sourceId))
    .filter(Boolean);

  return { events, calendarName };
};

export const assignEventColors = (events) => {
  const sortedEvents = [...events].sort(
    (left, right) => left.start - right.start || (left.title || '').localeCompare(right.title || ''),
  );

  const colorMap = new Map();
  sortedEvents.forEach((event, index) => {
    const hue = (index * GOLDEN_ANGLE) % 360;
    const saturation = 58 + ((index % 3) * 8);
    const lightness = 45 + ((index % 4) * 5);
    colorMap.set(eventColorKey(event), {
      backgroundColor: `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`,
      textColor: getReadableTextColor(hue, saturation, lightness),
    });
  });

  return colorMap;
};

export const getEventAppearance = (event, colorMap) => {
  return colorMap?.get(eventColorKey(event)) || DEFAULT_EVENT_APPEARANCE;
};

export const createMockEvents = (year) => {
  return [
    createMockEvent({
      id: 'mock-1',
      title: 'Winter Vacation',
      start: new Date(year, 0, 5),
      end: new Date(year, 0, 12),
    }),
    createMockEvent({
      id: 'mock-2',
      title: 'Conference in NY',
      start: new Date(year, 2, 10),
      end: new Date(year, 2, 14),
    }),
    createMockEvent({
      id: 'mock-3',
      title: 'Project Sprint',
      start: new Date(year, 4, 1),
      end: new Date(year, 4, 15),
    }),
    createMockEvent({
      id: 'mock-4',
      title: 'Summer Roadtrip',
      start: new Date(year, 6, 20),
      end: new Date(year, 7, 5),
    }),
    createMockEvent({
      id: 'mock-5',
      title: 'Design Workshop',
      start: new Date(year, 8, 12),
      end: new Date(year, 8, 14),
    }),
    createMockEvent({
      id: 'mock-6',
      title: 'Holiday Break',
      start: new Date(year, 11, 24),
      end: new Date(year, 11, 31),
    }),
    createMockEvent({
      id: 'mock-7',
      title: 'Overlap Test A',
      start: new Date(year, 4, 5),
      end: new Date(year, 4, 10),
    }),
    createMockEvent({
      id: 'mock-8',
      title: 'Overlap Test B',
      start: new Date(year, 4, 8),
      end: new Date(year, 4, 12),
    }),
  ];
};
