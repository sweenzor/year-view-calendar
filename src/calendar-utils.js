// --- RFC 5545 Line Unfolding (§3.1) ---
// Long lines are folded with CRLF followed by a single space or tab.
// This step joins continuation lines back together before parsing.
const unfoldLines = (icsContent) => {
  return icsContent.replace(/\r\n[ \t]/g, '')
                   .replace(/\n[ \t]/g, '')
                   .replace(/\r[ \t]/g, '');
};

// --- RFC 5545 Character Unescaping ---
// Unescape \\, \, , \;, and \n/\N in property values.
// For title/summary fields, \n/\N becomes a space (newlines don't make sense in titles).
const unescapeICSValue = (value, useSpaceForNewline = false) => {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) {
      const next = value[i + 1];
      if (next === '\\') { result += '\\'; i++; }
      else if (next === ',') { result += ','; i++; }
      else if (next === ';') { result += ';'; i++; }
      else if (next === 'n' || next === 'N') { result += useSpaceForNewline ? ' ' : '\n'; i++; }
      else { result += value[i]; }
    } else {
      result += value[i];
    }
  }
  return result;
};

// --- ICS Parsing Utility ---
export const parseICS = (icsContent) => {
  const events = [];
  // Unfold continuation lines before splitting
  const unfolded = unfoldLines(icsContent);
  const lines = unfolded.split(/\r\n|\n|\r/);
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
        currentEvent.title = unescapeICSValue(line.substring(8), true);
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
        endDate.setHours(0,0,0,0);

        // ICS DTEND for all-day events is exclusive (Aug 30 = last day Aug 29)
        // Subtract one day so end represents the actual last day of the event
        if (endDate.getTime() > startDate.getTime()) {
            endDate.setDate(endDate.getDate() - 1);
        }

        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive of both start and end

        return { ...e, start: startDate, end: endDate, durationDays };
    })
    .filter(e => e.durationDays > 1);
};

// --- Golden-angle Color Assignment ---
const GOLDEN_ANGLE = 137.508;
export const eventColorKey = (evt) => `${evt.start.getTime()}-${evt.title || ''}`;
export const assignEventColors = (events) => {
  const sorted = [...events].sort((a, b) => a.start - b.start || (a.title || '').localeCompare(b.title || ''));
  const colorMap = new Map();
  sorted.forEach((evt, i) => {
    const hue = (i * GOLDEN_ANGLE) % 360;
    const saturation = 58 + (i % 3) * 8;     // 58%, 66%, 74%
    const lightness = 45 + (i % 4) * 5;      // 45%, 50%, 55%, 60%
    colorMap.set(eventColorKey(evt), `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`);
  });
  return colorMap;
};
