import { memo, useMemo } from 'react';
import { assignEventColors } from '../calendar-utils';
import { buildCalendarLayouts } from '../calendar-layout';

const MonthGrid = memo(({ monthLayout, hiddenEventIds, onToggleEvent }) => {
  return (
    <div className="flex flex-col mb-4 break-inside-avoid bg-white rounded-sm print:mb-2">
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-100 print:mb-1 print:pb-0.5 print:border-gray-200">
        <div className="flex items-baseline gap-1">
          <h3 className="font-bold text-gray-800 text-sm print:text-black">{monthLayout.monthName}</h3>
          <span className="text-xs text-gray-600 print:text-gray-600">{monthLayout.year}</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0 text-center mb-1">
        {monthLayout.weekdayLabels.map((dayLabel, index) => (
          <div key={`${monthLayout.key}-${dayLabel}-${index}`} className="text-[9px] text-gray-500 font-medium print:text-gray-600">
            {dayLabel}
          </div>
        ))}
      </div>

      <div className="flex flex-col print-compact-rows">
        {monthLayout.rows.map((row) => (
          <div
            key={row.key}
            className="relative grid grid-cols-7 gap-x-0 w-full border-b border-gray-50 last:border-b-0 print:border-gray-200"
            style={{ height: `${row.containerHeightRem}rem` }}
          >
            {row.days.map((day, index) => (
              <div
                key={day.key}
                className="text-center text-xs text-gray-500 z-0 flex items-center justify-center"
                style={{
                  height: '1.5rem',
                  lineHeight: '1.5rem',
                  gridColumnStart: index + 1,
                  gridRowStart: 1,
                }}
              >
                {day.isToday ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border-2 border-blue-500 text-blue-600 font-semibold">
                    {day.value}
                  </span>
                ) : (
                  day.value
                )}
              </div>
            ))}

            {row.segments.map((segment, index) => {
              const span = segment.colEnd - segment.colStart;
              const chevronPx = span === 1 ? 4 : 6;
              const hasLeft = segment.isContinuation;
              const hasRight = segment.isContinuedAfter;
              const isHidden = hiddenEventIds.has(segment.id);
              let clipPath;
              if (hasLeft && hasRight) {
                clipPath = `polygon(${chevronPx}px 0, calc(100% - ${chevronPx}px) 0, 100% 50%, calc(100% - ${chevronPx}px) 100%, ${chevronPx}px 100%, 0 50%)`;
              } else if (hasLeft) {
                clipPath = `polygon(${chevronPx}px 0, 100% 0, 100% 100%, ${chevronPx}px 100%, 0 50%)`;
              } else if (hasRight) {
                clipPath = `polygon(0 0, calc(100% - ${chevronPx}px) 0, 100% 50%, calc(100% - ${chevronPx}px) 100%, 0 100%)`;
              }

              return (
                <div
                  key={`${segment.id}-${row.key}-${index}`}
                  role="note"
                  tabIndex={0}
                  aria-label={segment.ariaLabel}
                  onClick={() => onToggleEvent(segment.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleEvent(segment.id); } }}
                  className={`absolute flex items-center overflow-hidden shadow-sm text-[9px] leading-tight font-medium hover:z-20 transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${!hasLeft && !hasRight ? 'rounded-md' : hasLeft && !hasRight ? 'rounded-r-md' : !hasLeft && hasRight ? 'rounded-l-md' : ''} print:shadow-none print:text-black ${isHidden ? 'opacity-30' : 'hover:opacity-90'}`}
                  style={{
                    top: `${1.5 + (segment.stackIndex * (1.25 + 0.125))}rem`,
                    height: '1.25rem',
                    left: `calc(${((segment.colStart - 1) / 7) * 100}% + ${hasLeft ? '0px' : '1px'})`,
                    width: `calc(${((segment.colEnd - segment.colStart) / 7) * 100}% - ${hasLeft && hasRight ? '0px' : hasLeft || hasRight ? '1px' : '2px'})`,
                    zIndex: 10,
                    paddingLeft: hasLeft ? `${chevronPx + 2}px` : '4px',
                    paddingRight: hasRight ? `${chevronPx + 2}px` : '4px',
                    clipPath,
                    backgroundColor: segment.backgroundColor,
                    color: segment.textColor,
                  }}
                  title={segment.title}
                >
                  <span className="truncate w-full">{segment.title}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

export const CalendarGrid = ({ componentRef, displayedMonths, events, isRollingView, hiddenEventIds, onToggleEvent }) => {
  const colorMap = useMemo(() => assignEventColors(events), [events]);
  const monthLayouts = useMemo(
    () => buildCalendarLayouts({ displayedMonths, events, colorMap }),
    [displayedMonths, events, colorMap],
  );

  const printEvents = useMemo(
    () => hiddenEventIds.size > 0 ? events.filter((e) => !hiddenEventIds.has(e.id)) : events,
    [events, hiddenEventIds],
  );
  const printColorMap = useMemo(() => assignEventColors(printEvents), [printEvents]);
  const printLayouts = useMemo(
    () => hiddenEventIds.size > 0 ? buildCalendarLayouts({ displayedMonths, events: printEvents, colorMap: printColorMap }) : null,
    [displayedMonths, printEvents, printColorMap, hiddenEventIds],
  );

  const rollingLabel = monthLayouts[0] ? `${monthLayouts[0].monthName} ${monthLayouts[0].year}` : '';

  return (
    <div ref={componentRef} className="print-container">
      <div className="hidden print:flex items-center justify-between mb-4 border-b border-gray-300 pb-2">
        <h1 className="text-2xl font-bold text-gray-800">
          Year-view Calendar
        </h1>
        <span className="text-sm text-gray-600">
          {isRollingView ? `Rolling View (Starting ${rollingLabel})` : 'Calendar Year'}
        </span>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 bg-white p-8 rounded-xl shadow-sm border border-gray-100 items-start print-grid print:p-0 print:gap-4 print:shadow-none print:border-none ${printLayouts ? 'screen-only' : ''}`}>
        {monthLayouts.map((monthLayout) => (
          <MonthGrid key={monthLayout.key} monthLayout={monthLayout} hiddenEventIds={hiddenEventIds} onToggleEvent={onToggleEvent} />
        ))}
      </div>

      {printLayouts && (
        <div className="hidden print-only-grid print:p-0 print:gap-4 print:shadow-none print:border-none">
          {printLayouts.map((monthLayout) => (
            <MonthGrid key={`print-${monthLayout.key}`} monthLayout={monthLayout} hiddenEventIds={hiddenEventIds} onToggleEvent={onToggleEvent} />
          ))}
        </div>
      )}
    </div>
  );
};
