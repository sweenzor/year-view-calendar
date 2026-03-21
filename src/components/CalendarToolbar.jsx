import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Printer, Repeat } from 'lucide-react';

export const CalendarToolbar = ({
  currentYear,
  isRollingView,
  onPreviousYear,
  onNextYear,
  onToggleView,
  onPrint,
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100 no-print">
      <div className="mb-4 md:mb-0">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarIcon className="text-blue-600" />
          Yearly Planner
        </h1>
        <p className="text-gray-500 mt-1">Visualizing multi-day events lasting longer than 24 hours</p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onPrint}
          aria-label="Print calendar"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <Printer size={16} />
          Print
        </button>

        <button
          type="button"
          onClick={onToggleView}
          aria-pressed={isRollingView}
          aria-label={isRollingView ? 'Switch to calendar year view' : 'Switch to rolling 12 month view'}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isRollingView ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <Repeat size={16} />
          {isRollingView ? 'Next 12 Months' : 'Calendar Year'}
        </button>

        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={onPreviousYear}
            aria-label="Previous year"
            className="p-2 hover:bg-white rounded-md transition-colors text-gray-600"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="px-4 font-bold text-lg w-20 text-center">{currentYear}</span>
          <button
            type="button"
            onClick={onNextYear}
            aria-label="Next year"
            className="p-2 hover:bg-white rounded-md transition-colors text-gray-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
