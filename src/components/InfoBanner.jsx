import { Info, X } from 'lucide-react';

const InfoBanner = ({ onDismiss }) => {
  return (
    <div className="relative flex items-start gap-2 mb-6 text-sm text-blue-800 bg-blue-50 p-4 rounded-lg border border-blue-100 no-print">
      <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
      <p className="pr-6">
        This view automatically filters out short meetings. Only events lasting <strong>longer than 24 hours</strong> are displayed.
        Events appear as solid blocks labeled with their title, spanning across days.
      </p>
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 p-1 hover:bg-blue-100 rounded-full text-blue-400 hover:text-blue-600 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
        title="Dismiss"
      >
          <X size={14} />
      </button>
    </div>
  );
};

export default InfoBanner;
