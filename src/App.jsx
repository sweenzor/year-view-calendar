import { Info, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { getDisplayedMonths, getDisplayedRange } from './calendar-layout';
import { loadHiddenEventIds, saveHiddenEventIds } from './calendar-storage';
import { CalendarGrid } from './components/CalendarGrid';
import { CalendarToolbar } from './components/CalendarToolbar';
import { ImportPanel } from './components/ImportPanel';
import { SourceList } from './components/SourceList';
import { useCalendarSources } from './useCalendarSources';

const App = ({ initialDate = new Date() }) => {
  const [baseDate] = useState(() => new Date(initialDate));
  const [currentYear, setCurrentYear] = useState(baseDate.getFullYear());
  const [isRollingView, setIsRollingView] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [hiddenEventIds, setHiddenEventIds] = useState(() => loadHiddenEventIds());
  const [todayHidden, setTodayHidden] = useState(false);
  const displayedMonths = useMemo(() => getDisplayedMonths({
    selectedYear: currentYear,
    isRollingView,
    baseDate,
  }), [baseDate, currentYear, isRollingView]);
  const displayedRange = useMemo(
    () => getDisplayedRange(displayedMonths),
    [displayedMonths],
  );
  const {
    events,
    sources,
    importFeedback,
    isImportingUrl,
    importFiles,
    importUrl,
    reloadSource,
    reloadAllSources,
    removeSource,
    clearAllSources,
    clearImportFeedback,
    toggleSingleDayEvents,
  } = useCalendarSources({ baseDate, displayedRange });

  useEffect(() => {
    saveHiddenEventIds(hiddenEventIds);
  }, [hiddenEventIds]);

  const componentRef = useRef(null);
  const handleToggleEvent = useCallback((eventId) => {
    setHiddenEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);
  const handleToggleToday = useCallback(() => {
    setTodayHidden((prev) => !prev);
  }, []);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Year-view Calendar ${currentYear}`,
    pageStyle: `
      @page {
        size: portrait;
        margin: 5mm;
      }
    `,
  });

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 p-4 md:p-8 font-sans print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto print:max-w-none print:mx-0">
        <CalendarToolbar
          currentYear={currentYear}
          isRollingView={isRollingView}
          onPreviousYear={() => setCurrentYear((year) => year - 1)}
          onNextYear={() => setCurrentYear((year) => year + 1)}
          onToggleView={() => setIsRollingView((value) => !value)}
          onPrint={handlePrint}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 no-print items-start">
          <ImportPanel
            onImportFiles={importFiles}
            onImportUrl={importUrl}
            onClearFeedback={clearImportFeedback}
            importFeedback={importFeedback}
            isImportingUrl={isImportingUrl}
          />

          <SourceList
            sources={sources}
            eventsCount={events.length}
            onReloadSource={reloadSource}
            onReloadAllSources={reloadAllSources}
            onRemoveSource={removeSource}
            onClearAllSources={clearAllSources}
            onToggleSingleDayEvents={toggleSingleDayEvents}
          />
        </div>

        {showInfo && (
          <div className="relative flex items-start gap-3 mb-6 text-sm text-gray-700 bg-blue-50 p-4 pr-10 rounded-lg border border-blue-100 no-print">
            <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="font-semibold text-gray-800">About this app</p>
              <ul className="list-disc pl-5 space-y-1 marker:text-blue-400">
                <li>
                  Shows all-day events by default. Multi-day events span their full range; single-day all-day events appear too.
                  <ul className="list-[circle] pl-5 mt-1 space-y-1 marker:text-blue-300">
                    <li>Use the calendar icon next to a source to hide its single-day all-day events.</li>
                  </ul>
                </li>
                <li>
                  Imports:
                  <ul className="list-[circle] pl-5 mt-1 space-y-1 marker:text-blue-300">
                    <li>File imports stay in your browser.</li>
                    <li>URL imports try the configured proxy first, then fall back to a direct browser request.</li>
                  </ul>
                </li>
                <li>Remembered URLs are stored only if you explicitly opt in on this device.</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              aria-label="Dismiss information banner"
              className="absolute top-2 right-2 p-1 hover:bg-blue-100 rounded-full text-gray-500 hover:text-blue-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <CalendarGrid
          componentRef={componentRef}
          displayedMonths={displayedMonths}
          events={events}
          isRollingView={isRollingView}
          hiddenEventIds={hiddenEventIds}
          onToggleEvent={handleToggleEvent}
          todayHidden={todayHidden}
          onToggleToday={handleToggleToday}
        />

        <footer className="mt-12 text-center text-gray-400 text-sm no-print">
          <p>
            <a
              href="https://github.com/sweenzor/year-view-calendar"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600 transition-colors"
            >
              Code on GitHub
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default App;
