import { useState, useEffect, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { parseICS, assignEventColors, eventColorKey } from './calendar-utils';
import Header from './components/Header';
import ImportPanel from './components/ImportPanel';
import SourcesList from './components/SourcesList';
import InfoBanner from './components/InfoBanner';
import { X } from 'lucide-react';

// --- Helper: determine text color from HSL background ---
const getTextColorForHSL = (hslString) => {
  const match = hslString.match(/hsl\([\d.]+,\s*([\d.]+)%,\s*([\d.]+)%\)/);
  if (match) {
    const lightness = parseFloat(match[2]);
    return lightness > 55 ? '#1a1a1a' : '#ffffff';
  }
  return '#ffffff';
};

// --- Mock Data Generator ---
const generateMockEvents = (year) => {
  return [
    { id: 'mock-1', sourceId: 'mock', title: "Winter Vacation", start: new Date(year, 0, 5), end: new Date(year, 0, 12) },
    { id: 'mock-2', sourceId: 'mock', title: "Conference in NY", start: new Date(year, 2, 10), end: new Date(year, 2, 14) },
    { id: 'mock-3', sourceId: 'mock', title: "Project Sprint", start: new Date(year, 4, 1), end: new Date(year, 4, 15) },
    { id: 'mock-4', sourceId: 'mock', title: "Summer Roadtrip", start: new Date(year, 6, 20), end: new Date(year, 7, 5) },
    { id: 'mock-5', sourceId: 'mock', title: "Design Workshop", start: new Date(year, 8, 12), end: new Date(year, 8, 14) },
    { id: 'mock-6', sourceId: 'mock', title: "Holiday Break", start: new Date(year, 11, 24), end: new Date(year, 11, 31) },
    // Add intentional overlap for demonstration
    { id: 'mock-7', sourceId: 'mock', title: "Overlap Test A", start: new Date(year, 4, 5), end: new Date(year, 4, 10) },
    { id: 'mock-8', sourceId: 'mock', title: "Overlap Test B", start: new Date(year, 4, 8), end: new Date(year, 4, 12) },
  ];
};

// --- Components ---

const MonthGrid = ({ year, month, events, colorMap }) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const totalSlots = daysInMonth + firstDayOfMonth;
  const rowCount = Math.ceil(totalSlots / 7);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // 1. Slice events into weekly segments
  const weeklySegments = useMemo(() => {
    const segmentsByRow = Array.from({ length: rowCount }, () => []);
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0); // last day of month at midnight

    events.forEach((evt, evtIdx) => {
      if (evt.end < monthStart || evt.start > monthEnd) return;

      const displayStart = evt.start < monthStart ? monthStart : evt.start;
      const displayEnd = evt.end > monthEnd ? monthEnd : evt.end;

      let current = new Date(displayStart);
      while (current <= displayEnd) {
        const weekDay = current.getDay();
        const daysUntilEndOfWeek = 6 - weekDay;
        let segmentEnd = new Date(current);
        segmentEnd.setDate(current.getDate() + daysUntilEndOfWeek);
        if (segmentEnd > displayEnd) segmentEnd = new Date(displayEnd);

        const startDayOfM = current.getDate();
        const endDayOfM = segmentEnd.getDate();
        const startSlot = firstDayOfMonth + startDayOfM - 1;
        const endSlot = firstDayOfMonth + endDayOfM - 1;

        const row = Math.floor(startSlot / 7);
        const colStart = (startSlot % 7) + 1;
        const colEnd = (endSlot % 7) + 2; // exclusive

        const evtTitle = evt.title || 'Untitled';
        const color = colorMap?.get(eventColorKey(evt)) || 'hsl(210, 60%, 50%)';
        const textColor = getTextColorForHSL(color);

        // Rounded corners logic
        let rounded = "rounded-sm";
        const isRealStart = current.getTime() === evt.start.getTime();
        const isRealEnd = segmentEnd.getTime() === evt.end.getTime();
        if (isRealStart && isRealEnd) rounded = "rounded-md";
        else if (isRealStart) rounded = "rounded-l-md";
        else if (isRealEnd) rounded = "rounded-r-md";
        else rounded = "";

        if (row < rowCount && segmentsByRow[row]) {
            segmentsByRow[row].push({
                id: evt.id || `${evtTitle}-${evtIdx}-${startSlot}`, // unique key helper
                title: evtTitle,
                colStart,
                colEnd, // CSS grid end (exclusive)
                color,
                textColor,
                rounded,
                isContinuation: !isRealStart || evt.start < monthStart,
                isContinuedAfter: !isRealEnd || evt.end > monthEnd
            });
        }

        current = new Date(segmentEnd);
        current.setDate(current.getDate() + 1);
        if (current > displayEnd) break;
      }
    });

    return segmentsByRow;
  }, [year, month, events, colorMap, firstDayOfMonth, rowCount]); // colorMap is stable-keyed, changes only when events change

  // 2. Render each week (row) independently
  const renderWeekRows = () => {
    return weeklySegments.map((segments, rowIndex) => {
        // -- Stacking Algorithm --
        segments.sort((a, b) => {
            if (a.colStart !== b.colStart) return a.colStart - b.colStart;
            return (b.colEnd - b.colStart) - (a.colEnd - a.colStart);
        });

        const lanes = [];
        const stackedSegments = segments.map(seg => {
            let laneIndex = -1;
            for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] <= seg.colStart) {
                    laneIndex = i;
                    break;
                }
            }
            if (laneIndex === -1) {
                laneIndex = lanes.length;
                lanes.push(0);
            }
            lanes[laneIndex] = seg.colEnd;
            return { ...seg, stackIndex: laneIndex };
        });

        const itemsInStack = lanes.length;
        const baseHeight = 1.5;
        const eventHeight = 1.25;
        const gap = 0.125;

        const containerHeight = Math.max(baseHeight + 0.5, baseHeight + (itemsInStack * (eventHeight + gap)) + 0.5);

        // Generate Static Grid Cells for Day Numbers to ensure alignment
        const daysInRow = [];
        for (let col = 1; col <= 7; col++) {
            const dayIndex = (rowIndex * 7) + col - firstDayOfMonth;
            const isDay = dayIndex > 0 && dayIndex <= daysInMonth;

            daysInRow.push(
                <div
                    key={`day-${col}`}
                    className="text-center text-xs text-gray-400 z-0"
                    style={{
                        height: `${baseHeight}rem`,
                        lineHeight: `${baseHeight}rem`,
                        gridColumnStart: col,
                        gridRowStart: 1
                    }}
                >
                    {isDay ? dayIndex : ''}
                </div>
            );
        }

        return (
            <div
                key={`row-${rowIndex}`}
                className="relative grid grid-cols-7 gap-x-0 w-full border-b border-gray-50 last:border-b-0 print:border-gray-200"
                style={{ height: `${containerHeight}rem` }}
            >
                {/* Day Numbers Layer (Static Grid Items) */}
                {daysInRow}

                {/* Events Layer (Absolute on top of grid) */}
                {stackedSegments.map((seg, idx) => {
                    const span = seg.colEnd - seg.colStart;
                    const chevronPx = span === 1 ? 4 : 6;
                    const hasLeft = seg.isContinuation;
                    const hasRight = seg.isContinuedAfter;
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
                        key={`${seg.id}-${rowIndex}-${idx}`}
                        className={`absolute flex items-center overflow-hidden shadow-sm text-[9px] leading-tight font-medium hover:z-20 hover:opacity-90 transition-all cursor-pointer ${!hasLeft && !hasRight ? 'rounded-md' : hasLeft && !hasRight ? 'rounded-r-md' : !hasLeft && hasRight ? 'rounded-l-md' : ''} print:shadow-none print:text-black`}
                        style={{
                            top: `${baseHeight + (seg.stackIndex * (eventHeight + gap))}rem`,
                            height: `${eventHeight}rem`,
                            left: `calc(${((seg.colStart - 1) / 7) * 100}% + ${hasLeft ? '0px' : '1px'})`,
                            width: `calc(${((seg.colEnd - seg.colStart) / 7) * 100}% - ${hasLeft && hasRight ? '0px' : hasLeft || hasRight ? '1px' : '2px'})`,
                            zIndex: 10,
                            paddingLeft: hasLeft ? `${chevronPx + 2}px` : '4px',
                            paddingRight: hasRight ? `${chevronPx + 2}px` : '4px',
                            clipPath,
                            backgroundColor: seg.color,
                            color: seg.textColor
                        }}
                        title={seg.title}
                    >
                        <span className="truncate w-full">
                            {seg.title}
                        </span>
                    </div>
                    );
                })}
            </div>
        );
    });
  };

  return (
    <div className="flex flex-col mb-4 break-inside-avoid bg-white rounded-sm print:mb-2">
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-100 print:mb-1 print:pb-0.5 print:border-gray-200">
          <div className="flex items-baseline gap-1">
            <h3 className="font-bold text-gray-800 text-sm print:text-black">{monthNames[month]}</h3>
            <span className="text-xs text-gray-400 print:text-gray-600">{year}</span>
          </div>
      </div>

      {/* Headers */}
      <div className="grid grid-cols-7 gap-0 text-center mb-1">
        {['S','M','T','W','T','F','S'].map((d,i) => (
          <div key={i} className="text-[9px] text-gray-400 font-medium print:text-gray-600">{d}</div>
        ))}
      </div>

      {/* Week Rows */}
      <div className="flex flex-col print-compact-rows">
          {renderWeekRows()}
      </div>
    </div>
  );
};

const App = () => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isRollingView, setIsRollingView] = useState(false);

  // State now holds a single flat list of events, but each event is tagged with a sourceId
  const [events, setEvents] = useState(generateMockEvents(new Date().getFullYear()));
  const [sources, setSources] = useState([{ id: 'mock', name: 'Example Data', type: 'mock' }]);
  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [error, setError] = useState(null);

  const colorMap = useMemo(() => assignEventColors(events), [events]);

  const componentRef = useRef();

  // Auto-dismiss error after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Yearly Planner - ${currentYear}`,
    pageStyle: `
      @page {
        size: portrait;
        margin: 5mm;
      }
    `
  });

  const processICSData = (content, sourceName, sourceType, sourceUrl = null, existingSourceId = null) => {
    try {
      const parsedEvents = parseICS(content);
      const sourceId = existingSourceId || Date.now().toString() + Math.random().toString(36).substring(2, 11);

      // Tag events with source ID
      const taggedEvents = parsedEvents.map(e => ({
        ...e,
        sourceId
      }));

      setEvents(prev => {
        // Remove mock events and any existing events for this source
        const cleanPrev = prev.filter(e => e.sourceId !== 'mock' && e.sourceId !== sourceId);
        return [...cleanPrev, ...taggedEvents];
      });
      setSources(prev => {
        // Remove mock source if present
        const cleanPrev = prev.filter(s => s.id !== 'mock');
        if (existingSourceId) {
          // Update existing source in place
          return cleanPrev.map(s => s.id === sourceId ? { ...s, name: sourceName, type: sourceType, url: sourceUrl } : s);
        }
        return [...cleanPrev, { id: sourceId, name: sourceName, type: sourceType, url: sourceUrl }];
      });
    } catch {
      setError(`Error parsing ${sourceName}.`);
    }
  };

  const handleFiles = (fileList) => {
    Array.from(fileList).forEach(file => {
      if (file.name.endsWith('.ics')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            processICSData(e.target.result, file.name, 'file');
        };
        reader.readAsText(file);
      } else {
          setError(`Skipping ${file.name}: Not an .ics file`);
      }
    });
  };

  const fetchICSFromUrl = async (url) => {
    const proxyUrl = `/proxy?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }
    return response.text();
  };

  const getCalendarName = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + (urlObj.pathname.length > 1 ? urlObj.pathname : '');
    } catch {
      return "Remote Calendar";
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!urlInput) return;

    // Auto-replace webcal:// with https://
    let cleanUrl = urlInput.trim();
    if (cleanUrl.startsWith('webcal://')) {
        cleanUrl = 'https://' + cleanUrl.substring(9);
    }

    setIsLoadingUrl(true);
    try {
        const text = await fetchICSFromUrl(cleanUrl);
        processICSData(text, getCalendarName(cleanUrl), 'url', cleanUrl);
        setUrlInput('');
    } catch (fetchError) {
        console.error("Proxy fetch failed", fetchError);
        // Fallback to direct fetch (may work on intranets without CORS issues)
        try {
            const response = await fetch(cleanUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            const text = await response.text();
            processICSData(text, getCalendarName(cleanUrl), 'url', cleanUrl);
            setUrlInput('');
        } catch {
             const msg = fetchError.message && fetchError.message.includes('Server responded')
                ? `Import failed: ${fetchError.message}`
                : "Could not load URL. Note: Many calendar providers (like Google) block direct browser access via CORS. You may need to download the file manually and drag it in.";
             setError(msg);
        }
    } finally {
        setIsLoadingUrl(false);
    }
  };

  const [reloadingSources, setReloadingSources] = useState(new Set());

  const reloadSource = async (source) => {
    if (!source.url) return;
    setReloadingSources(prev => new Set(prev).add(source.id));
    try {
      const text = await fetchICSFromUrl(source.url);
      processICSData(text, source.name, 'url', source.url, source.id);
    } catch (reloadError) {
      console.error("Reload failed", reloadError);
      setError(`Failed to reload ${source.name}`);
    } finally {
      setReloadingSources(prev => { const next = new Set(prev); next.delete(source.id); return next; });
    }
  };

  const reloadAllSources = async () => {
    const urlSources = sources.filter(s => s.url);
    await Promise.all(urlSources.map(source => reloadSource(source)));
  };

  const removeSource = (sourceId) => {
    setSources(prev => prev.filter(s => s.id !== sourceId));
    setEvents(prev => prev.filter(e => e.sourceId !== sourceId));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 p-4 md:p-8 font-sans print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto print:max-w-none print:mx-0">

        {/* Error Banner */}
        {error && (
          <div className="relative flex items-start gap-2 mb-6 text-sm text-rose-800 bg-rose-50 p-4 rounded-lg border border-rose-200 no-print">
            <p className="pr-6">{error}</p>
            <button
              onClick={() => setError(null)}
              className="absolute top-2 right-2 p-1 hover:bg-rose-100 rounded-full text-rose-400 hover:text-rose-600 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Header */}
        <Header
          currentYear={currentYear}
          setCurrentYear={setCurrentYear}
          isRollingView={isRollingView}
          setIsRollingView={setIsRollingView}
          handlePrint={handlePrint}
        />

        {/* Controls Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 no-print">

            {/* 1. Import Panel */}
            <ImportPanel
              dragActive={dragActive}
              urlInput={urlInput}
              isLoadingUrl={isLoadingUrl}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onFileInput={handleFileInput}
              onUrlChange={e => setUrlInput(e.target.value)}
              onUrlSubmit={handleUrlSubmit}
            />

            {/* 2. Loaded Sources List */}
            <SourcesList
              sources={sources}
              eventCount={events.length}
              reloadingSources={reloadingSources}
              onReloadSource={reloadSource}
              onReloadAll={reloadAllSources}
              onRemoveSource={removeSource}
              onClearAll={() => { setSources([]); setEvents([]); }}
            />
        </div>

        {/* Info Banner */}
        {showInfo && (
          <InfoBanner onDismiss={() => setShowInfo(false)} />
        )}

        {/* Calendar Grid */}
        <div ref={componentRef} className="print-container">
            {/* Print Header - Visible only when printing */}
            <div className="hidden print:flex items-center justify-between mb-4 border-b border-gray-300 pb-2">
                 <h1 className="text-2xl font-bold text-gray-800">
                     Yearly Planner {currentYear}
                 </h1>
                 <span className="text-sm text-gray-500">
                     {isRollingView ? `Rolling View (Starting ${new Date().toLocaleString('default', { month: 'long' })})` : 'Calendar Year'}
                 </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 bg-white p-8 rounded-xl shadow-sm border border-gray-100 items-start print-grid print:p-0 print:gap-4 print:shadow-none print:border-none">
            {Array.from({ length: 12 }).map((_, index) => {
                // Logic to calculate exact Month/Year for this grid cell based on View Mode
                let displayMonth = index;
                let displayYear = currentYear;

                if (isRollingView) {
                    const today = new Date();
                    const startMonth = today.getMonth(); // 0-11
                    const targetMonthIndex = startMonth + index;
                    displayMonth = targetMonthIndex % 12;
                    displayYear = currentYear + Math.floor(targetMonthIndex / 12);
                }

                return (
                <MonthGrid
                    key={`${displayYear}-${displayMonth}`}
                    year={displayYear}
                    month={displayMonth}
                    events={events}
                    colorMap={colorMap}
                />
                );
            })}
            </div>
        </div>

        <div className="mt-12 text-center text-gray-400 text-sm no-print">
          <p>Privacy Note: All processing happens in your browser. Your calendar data is not sent to any server.</p>
        </div>

      </div>
    </div>
  );
};

export default App;
