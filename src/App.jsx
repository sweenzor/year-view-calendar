import { Info, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { getDisplayedMonths, getDisplayedRange } from './calendar-layout';
import {
  loadHiddenEventIds,
  loadInfoBannerDismissed,
  saveHiddenEventIds,
  saveInfoBannerDismissed,
} from './calendar-storage';
import { CalendarGrid } from './components/CalendarGrid';
import { CalendarToolbar } from './components/CalendarToolbar';
import { ImportPanel } from './components/ImportPanel';
import { SourceList } from './components/SourceList';
import { useCalendarSources } from './useCalendarSources';

const App = ({ initialDate = new Date() }) => {
  const [baseDate] = useState(() => new Date(initialDate));
  const [currentYear, setCurrentYear] = useState(baseDate.getFullYear());
  const [isRollingView, setIsRollingView] = useState(false);
  const [showInfo, setShowInfo] = useState(() => !loadInfoBannerDismissed());
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
  const handleDismissInfo = useCallback(() => {
    saveInfoBannerDismissed();
    setShowInfo(false);
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

        {showInfo && (
          <div className="relative mb-6 rounded-lg border border-gray-200 bg-white p-4 pr-12 shadow-sm no-print">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Info size={18} />
              </div>
              <div className="max-w-5xl space-y-1.5 text-sm leading-6 text-gray-700">
                <p>
                  File imports stay in your browser. Calendar links are requested through a proxy first; if that fails,
                  your browser tries the link directly.
                </p>
                <p>URLs are remembered only when you opt in on this device.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismissInfo}
              aria-label="Dismiss information banner"
              className="absolute right-3 top-3 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={16} />
            </button>
          </div>
        )}

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
      </div>
    </div>
  );
};

export default App;
