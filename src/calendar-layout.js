import { eventColorKey, getEventAppearance } from './calendar-utils';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const BASE_DAY_HEIGHT_REM = 1.5;
const EVENT_HEIGHT_REM = 1.25;
const STACK_GAP_REM = 0.125;

const createMonthBounds = (year, month) => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return { start, end };
};

const formatRangeLabel = (start, end) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${formatter.format(start)} to ${formatter.format(end)}`;
};

const sortSegments = (left, right) => {
  if (left.colStart !== right.colStart) {
    return left.colStart - right.colStart;
  }

  return (right.colEnd - right.colStart) - (left.colEnd - left.colStart);
};

export const stackSegments = (segments) => {
  const sortedSegments = [...segments].sort(sortSegments);
  const lanes = [];

  const stackedSegments = sortedSegments.map((segment) => {
    let laneIndex = lanes.findIndex((laneEnd) => laneEnd <= segment.colStart);

    if (laneIndex === -1) {
      laneIndex = lanes.length;
      lanes.push(0);
    }

    lanes[laneIndex] = segment.colEnd;
    return {
      ...segment,
      stackIndex: laneIndex,
    };
  });

  return {
    stackedSegments,
    laneCount: lanes.length,
  };
};

const buildMonthSegments = ({ year, month, events, colorMap }) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const totalSlots = daysInMonth + firstDayOfMonth;
  const rowCount = Math.ceil(totalSlots / 7);
  const segmentsByRow = Array.from({ length: rowCount }, () => []);
  const { start: monthStart, end: monthEnd } = createMonthBounds(year, month);

  events.forEach((event, index) => {
    if (event.end < monthStart || event.start > monthEnd) {
      return;
    }

    const displayStart = event.start < monthStart ? monthStart : event.start;
    const displayEnd = event.end > monthEnd ? monthEnd : event.end;
    const appearance = getEventAppearance(event, colorMap);
    let current = new Date(displayStart);

    while (current <= displayEnd) {
      const weekday = current.getDay();
      const daysUntilEndOfWeek = 6 - weekday;
      let segmentEnd = new Date(current);
      segmentEnd.setDate(current.getDate() + daysUntilEndOfWeek);
      if (segmentEnd > displayEnd) {
        segmentEnd = new Date(displayEnd);
      }

      const startDayOfMonth = current.getDate();
      const endDayOfMonth = segmentEnd.getDate();
      const startSlot = firstDayOfMonth + startDayOfMonth - 1;
      const endSlot = firstDayOfMonth + endDayOfMonth - 1;
      const rowIndex = Math.floor(startSlot / 7);

      if (rowIndex < rowCount && segmentsByRow[rowIndex]) {
        segmentsByRow[rowIndex].push({
          id: event.id || `${event.title}-${index}-${startSlot}`,
          title: event.title || 'Untitled Event',
          ariaLabel: `${event.title || 'Untitled Event'}, ${formatRangeLabel(event.start, event.end)}`,
          colStart: (startSlot % 7) + 1,
          colEnd: (endSlot % 7) + 2,
          isContinuation: current.getTime() !== event.start.getTime() || event.start < monthStart,
          isContinuedAfter: segmentEnd.getTime() !== event.end.getTime() || event.end > monthEnd,
          backgroundColor: appearance.backgroundColor,
          textColor: appearance.textColor,
          colorKey: eventColorKey(event),
        });
      }

      current = new Date(segmentEnd);
      current.setDate(current.getDate() + 1);
    }
  });

  return {
    daysInMonth,
    firstDayOfMonth,
    rowCount,
    segmentsByRow,
  };
};

export const getDisplayedMonths = ({ selectedYear, isRollingView, baseDate = new Date() }) => {
  const startMonth = isRollingView ? baseDate.getMonth() : 0;

  return Array.from({ length: 12 }, (_, index) => {
    const monthIndex = startMonth + index;
    const month = monthIndex % 12;
    const year = selectedYear + Math.floor(monthIndex / 12);

    return {
      key: `${year}-${month}`,
      year,
      month,
    };
  });
};

export const buildMonthLayout = ({ year, month, events, colorMap }) => {
  const { daysInMonth, firstDayOfMonth, segmentsByRow } = buildMonthSegments({
    year,
    month,
    events,
    colorMap,
  });

  const rows = segmentsByRow.map((segments, rowIndex) => {
    const { stackedSegments, laneCount } = stackSegments(segments);
    const containerHeightRem = Math.max(
      BASE_DAY_HEIGHT_REM + 0.5,
      BASE_DAY_HEIGHT_REM + (laneCount * (EVENT_HEIGHT_REM + STACK_GAP_REM)) + 0.5,
    );

    const today = new Date();
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    const todayDate = today.getDate();

    const days = Array.from({ length: 7 }, (_, columnIndex) => {
      const dayIndex = (rowIndex * 7) + columnIndex + 1 - firstDayOfMonth;
      const isValid = dayIndex > 0 && dayIndex <= daysInMonth;
      return {
        key: `day-${rowIndex}-${columnIndex + 1}`,
        value: isValid ? dayIndex : '',
        isToday: isValid && isCurrentMonth && dayIndex === todayDate,
      };
    });

    return {
      key: `row-${rowIndex}`,
      days,
      segments: stackedSegments,
      containerHeightRem,
    };
  });

  return {
    key: `${year}-${month}`,
    year,
    month,
    monthName: MONTH_NAMES[month],
    weekdayLabels: WEEKDAY_LABELS,
    rows,
  };
};

export const buildCalendarLayouts = ({ displayedMonths, events, colorMap }) => {
  return displayedMonths.map(({ year, month }) => buildMonthLayout({
    year,
    month,
    events,
    colorMap,
  }));
};
