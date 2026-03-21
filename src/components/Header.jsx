import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Repeat, Printer } from 'lucide-react';

const Header = ({ currentYear, setCurrentYear, isRollingView, setIsRollingView, handlePrint }) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100 no-print">
      <div className="mb-4 md:mb-0">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarIcon className="text-blue-600" />
          Yearly Planner
        </h1>
        <p className="text-gray-500 mt-1">Visualizing multi-day events (24h+)</p>
      </div>

      <div className="flex items-center gap-4">

         {/* Print Button */}
         <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
            title="Print Calendar"
         >
            <Printer size={16} />
            Print
         </button>

         {/* View Mode Toggle */}
         <button
           onClick={() => setIsRollingView(!isRollingView)}
           className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none ${isRollingView ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
           title={isRollingView ? "Switch to Calendar Year" : "Switch to Rolling 12 Months"}
         >
           <Repeat size={16} />
           {isRollingView ? "Next 12 Months" : "Calendar Year"}
         </button>

         {/* Year Navigation */}
         <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setCurrentYear(y => y - 1)}
              className="p-2 hover:bg-white rounded-md transition-colors text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              title="Previous Year"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="px-4 font-bold text-lg w-20 text-center">{currentYear}</span>
            <button
              onClick={() => setCurrentYear(y => y + 1)}
              className="p-2 hover:bg-white rounded-md transition-colors text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              title="Next Year"
            >
              <ChevronRight size={20} />
            </button>
         </div>
      </div>
    </div>
  );
};

export default Header;
