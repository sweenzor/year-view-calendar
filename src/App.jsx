import React, { useState, useMemo } from 'react';
import { Upload, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Info, Link as LinkIcon, Trash2, Loader, Repeat } from 'lucide-react';

// --- ICS Parsing Utility ---
const parseICS = (icsContent) => {
  const events = [];
  const lines = icsContent.split(/\r\n|\n|\r/);
  let currentEvent = null;

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    // Simple parsing for YYYYMMDD or YYYYMMDDTHHMMSS
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(year, month, day);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent) {
        // Ensure title exists to prevent render errors
        if (!currentEvent.title) currentEvent.title = "Untitled Event";
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8);
      } else if (line.startsWith('DTSTART;VALUE=DATE:')) {
        currentEvent.start = parseDate(line.substring(19));
      } else if (line.startsWith('DTSTART:')) {
        currentEvent.start = parseDate(line.substring(8));
      } else if (line.startsWith('DTEND;VALUE=DATE:')) {
        currentEvent.end = parseDate(line.substring(17));
      } else if (line.startsWith('DTEND:')) {
        currentEvent.end = parseDate(line.substring(6));
      }
    }
  }

  return events
    .filter(e => e.start && e.end)
    .map(e => {
        const startDate = new Date(e.start);
        startDate.setHours(0,0,0,0);
        const endDate = new Date(e.end);
        
        if (endDate.getTime() === startDate.getTime()) {
             endDate.setDate(endDate.getDate() + 1);
        } else if (endDate.getHours() === 0 && endDate.getMinutes() === 0 && endDate.getSeconds() === 0) {
            if (endDate.getTime() > startDate.getTime()) { 
                // midnight end check
            }
        }

        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return { ...e, start: startDate, end: endDate, durationDays };
    })
    .filter(e => e.durationDays > 1); 
};

// --- Mock Data Generator ---
const generateMockEvents = (year) => {
  return [
    { id: 'mock-1', sourceId: 'mock', title: "Winter Vacation", start: new Date(year, 0, 5), end: new Date(year, 0, 12), color: "bg-blue-500" },
    { id: 'mock-2', sourceId: 'mock', title: "Conference in NY", start: new Date(year, 2, 10), end: new Date(year, 2, 14), color: "bg-purple-500" },
    { id: 'mock-3', sourceId: 'mock', title: "Project Sprint", start: new Date(year, 4, 1), end: new Date(year, 4, 15), color: "bg-green-500" },
    { id: 'mock-4', sourceId: 'mock', title: "Summer Roadtrip", start: new Date(year, 6, 20), end: new Date(year, 7, 5), color: "bg-orange-500" },
    { id: 'mock-5', sourceId: 'mock', title: "Design Workshop", start: new Date(year, 8, 12), end: new Date(year, 8, 14), color: "bg-indigo-500" },
    { id: 'mock-6', sourceId: 'mock', title: "Holiday Break", start: new Date(year, 11, 24), end: new Date(year, 11, 31), color: "bg-red-500" },
    // Add intentional overlap for demonstration
    { id: 'mock-7', sourceId: 'mock', title: "Overlap Test A", start: new Date(year, 4, 5), end: new Date(year, 4, 10), color: "bg-rose-500" },
    { id: 'mock-8', sourceId: 'mock', title: "Overlap Test B", start: new Date(year, 4, 8), end: new Date(year, 4, 12), color: "bg-yellow-500" },
  ];
};

// --- Components ---

const MonthGrid = ({ year, month, events }) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); 
  const totalSlots = daysInMonth + firstDayOfMonth;
  const rowCount = Math.ceil(totalSlots / 7);
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // 1. Slice events into weekly segments
  const weeklySegments = useMemo(() => {
    const segmentsByRow = Array.from({ length: rowCount }, () => []);
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

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

        // Color logic
        const evtTitle = evt.title || 'Untitled';
        const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500"];
        const color = evt.color || colors[(evtTitle.length + evtIdx) % colors.length];

        // Rounded corners logic
        let rounded = "rounded-sm";
        const isRealStart = current.getTime() === evt.start.getTime();
        const isRealEnd = segmentEnd.getTime() >= evt.end.getTime() - 86400000;
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
                rounded,
                isContinuation: !isRealStart
            });
        }

        current = new Date(segmentEnd);
        current.setDate(current.getDate() + 1);
        if (current > displayEnd) break;
      }
    });

    return segmentsByRow;
  }, [year, month, events, firstDayOfMonth, rowCount]);

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
                className="relative grid grid-cols-7 gap-x-0 w-full border-b border-gray-50 last:border-b-0"
                style={{ height: `${containerHeight}rem` }}
            >
                {/* Day Numbers Layer (Static Grid Items) */}
                {daysInRow}

                {/* Events Layer (Absolute on top of grid) */}
                {stackedSegments.map((seg, idx) => (
                    <div
                        key={`${seg.id}-${rowIndex}-${idx}`}
                        className={`absolute flex items-center px-1 overflow-hidden shadow-sm text-[9px] leading-tight font-medium text-white hover:z-20 hover:opacity-90 transition-all cursor-pointer ${seg.color} ${seg.rounded}`}
                        style={{
                            top: `${baseHeight + (seg.stackIndex * (eventHeight + gap))}rem`,
                            height: `${eventHeight}rem`,
                            gridColumnStart: seg.colStart,
                            gridColumnEnd: seg.colEnd,
                            left: '1px',
                            right: '1px',
                            zIndex: 10
                        }}
                        title={seg.title}
                    >
                        <span className="truncate w-full">
                            {seg.isContinuation ? '» ' : ''}{seg.title}
                        </span>
                    </div>
                ))}
            </div>
        );
    });
  };

  return (
    <div className="flex flex-col mb-4 break-inside-avoid bg-white rounded-sm">
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-100">
          <div className="flex items-baseline gap-1">
            <h3 className="font-bold text-gray-800 text-sm">{monthNames[month]}</h3>
            <span className="text-xs text-gray-400">{year}</span>
          </div>
      </div>
      
      {/* Headers */}
      <div className="grid grid-cols-7 gap-0 text-center mb-1">
        {['S','M','T','W','T','F','S'].map((d,i) => (
          <div key={i} className="text-[9px] text-gray-400 font-medium">{d}</div>
        ))}
      </div>
      
      {/* Week Rows */}
      <div className="flex flex-col">
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

  const processICSData = (content, sourceName, sourceType) => {
    try {
      const parsedEvents = parseICS(content);
      const sourceId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      // Tag events with source ID
      const taggedEvents = parsedEvents.map(e => ({
        ...e,
        sourceId
      }));

      setEvents(prev => {
        // Remove mock events if present
        const cleanPrev = prev.filter(e => e.sourceId !== 'mock');
        return [...cleanPrev, ...taggedEvents];
      });
      setSources(prev => {
        // Remove mock source if present
        const cleanPrev = prev.filter(s => s.id !== 'mock');
        return [...cleanPrev, { id: sourceId, name: sourceName, type: sourceType }];
      });
    } catch (err) {
      alert(`Error parsing ${sourceName}.`);
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
          alert(`Skipping ${file.name}: Not an .ics file`);
      }
    });
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!urlInput) return;
    
    setIsLoadingUrl(true);
    try {
        const response = await fetch(urlInput);
        if (!response.ok) throw new Error('Network response was not ok');
        const text = await response.text();
        
        let name = "Remote Calendar";
        try {
            const urlObj = new URL(urlInput);
            name = urlObj.hostname + (urlObj.pathname.length > 1 ? urlObj.pathname : '');
        } catch(e) {}

        processICSData(text, name, 'url');
        setUrlInput('');
    } catch (error) {
        alert("Could not load URL. \n\nNote: Many calendar providers (like Google) block direct browser access via CORS. You may need to download the file manually and drag it in.");
    } finally {
        setIsLoadingUrl(false);
    }
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
    <div className="min-h-screen bg-gray-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="mb-4 md:mb-0">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <CalendarIcon className="text-blue-600" />
              Yearly Planner
            </h1>
            <p className="text-gray-500 mt-1">Visualizing multi-day events (24h+)</p>
          </div>

          <div className="flex items-center gap-4">
            
             {/* View Mode Toggle */}
             <button
               onClick={() => setIsRollingView(!isRollingView)}
               className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isRollingView ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
               title={isRollingView ? "Switch to Calendar Year" : "Switch to Rolling 12 Months"}
             >
               <Repeat size={16} />
               {isRollingView ? "Next 12 Months" : "Calendar Year"}
             </button>

             {/* Year Navigation */}
             <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button 
                  onClick={() => setCurrentYear(y => y - 1)}
                  className="p-2 hover:bg-white rounded-md transition-colors text-gray-600"
                  title="Previous Year"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="px-4 font-bold text-lg w-20 text-center">{currentYear}</span>
                <button 
                  onClick={() => setCurrentYear(y => y + 1)}
                  className="p-2 hover:bg-white rounded-md transition-colors text-gray-600"
                  title="Next Year"
                >
                  <ChevronRight size={20} />
                </button>
             </div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            
            {/* 1. Import Panel */}
            <div 
              className={`lg:col-span-2 border-2 border-dashed rounded-xl p-6 flex flex-col justify-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
                <div className="flex flex-col md:flex-row gap-6 items-center">
                    {/* File Upload */}
                    <div className="flex-1 w-full flex flex-col items-center md:items-start">
                         <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Upload size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800">File Upload</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4 text-center md:text-left">
                            Drag & drop .ics files here
                        </p>
                        <input 
                            type="file" 
                            id="ics-upload" 
                            accept=".ics" 
                            multiple
                            className="hidden" 
                            onChange={handleFileInput}
                        />
                        <label 
                            htmlFor="ics-upload"
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium cursor-pointer transition-colors text-sm w-full md:w-auto text-center"
                        >
                            Choose Files
                        </label>
                    </div>

                    <div className="hidden md:block w-px h-24 bg-gray-200"></div>

                    {/* URL Upload */}
                    <div className="flex-1 w-full">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                <LinkIcon size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800">Import from URL</h3>
                        </div>
                        <form onSubmit={handleUrlSubmit} className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="https://example.com/calendar.ics" 
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                value={urlInput}
                                onChange={e => setUrlInput(e.target.value)}
                            />
                            <button 
                                type="submit" 
                                disabled={isLoadingUrl}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center"
                            >
                                {isLoadingUrl ? <Loader size={16} className="animate-spin" /> : 'Add'}
                            </button>
                        </form>
                        <p className="text-xs text-gray-400 mt-2">
                            Note: Some providers (like Google) may block direct URL access due to CORS.
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. Loaded Sources List */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
                    <span>Loaded Calendars</span>
                    <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{events.length} events</span>
                </h3>
                
                <div className="flex-1 overflow-y-auto max-h-48 space-y-2 pr-1 custom-scrollbar">
                    {sources.length === 0 && (
                        <p className="text-sm text-gray-400 italic text-center py-4">No calendars loaded</p>
                    )}
                    {sources.map(source => (
                        <div key={source.id} className="flex items-center justify-between group bg-gray-50 hover:bg-gray-100 p-2 rounded-lg transition-colors">
                             <div className="flex items-center gap-2 overflow-hidden">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${source.type === 'mock' ? 'bg-blue-400' : source.type === 'url' ? 'bg-purple-400' : 'bg-green-400'}`}></div>
                                <span className="text-sm text-gray-700 truncate" title={source.name}>{source.name}</span>
                             </div>
                             <button 
                                onClick={() => removeSource(source.id)}
                                className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                             >
                                <X size={14} />
                             </button>
                        </div>
                    ))}
                </div>
                 {sources.length > 0 && (
                    <button 
                        onClick={() => { setSources([]); setEvents([]); }}
                        className="mt-4 text-xs text-red-500 hover:text-red-700 flex items-center justify-center gap-1 w-full py-2 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={12} /> Clear All
                    </button>
                )}
            </div>
        </div>

        {/* Legend */}
        <div className="flex items-start gap-2 mb-6 text-sm text-gray-600 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
          <p>
            This view automatically filters out short meetings. Only events lasting <strong>longer than 24 hours</strong> are displayed. 
            Events appear as solid blocks labeled with their title, spanning across days.
          </p>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 bg-white p-8 rounded-xl shadow-sm border border-gray-100 items-start">
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
              />
            );
          })}
        </div>
        
        <div className="mt-12 text-center text-gray-400 text-sm">
          <p>Privacy Note: All processing happens in your browser. Your calendar data is not sent to any server.</p>
        </div>

      </div>
    </div>
  );
};

export default App;