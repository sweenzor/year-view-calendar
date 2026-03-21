import { X, Trash2, RefreshCw } from 'lucide-react';

const SourcesList = ({
  sources,
  eventCount,
  reloadingSources,
  onReloadSource,
  onReloadAll,
  onRemoveSource,
  onClearAll,
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
            <span>Loaded Calendars</span>
            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{eventCount} events</span>
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
                     <div className="flex items-center gap-1">
                        {source.url && (
                          <button
                            onClick={() => onReloadSource(source)}
                            disabled={reloadingSources.has(source.id)}
                            className="text-gray-400 hover:text-purple-500 p-1 rounded-md transition-colors disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            title="Reload calendar"
                          >
                            <RefreshCw size={14} className={reloadingSources.has(source.id) ? 'animate-spin' : ''} />
                          </button>
                        )}
                        <button
                          onClick={() => onRemoveSource(source.id)}
                          className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          title="Remove calendar"
                        >
                          <X size={14} />
                        </button>
                     </div>
                </div>
            ))}
        </div>
         {sources.length > 0 && (
            <div className="mt-4 flex gap-2">
              {sources.some(s => s.url) && (
                <button
                    onClick={onReloadAll}
                    disabled={reloadingSources.size > 0}
                    className="flex-1 text-xs text-purple-500 hover:text-purple-700 flex items-center justify-center gap-1 py-2 border border-purple-100 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                    <RefreshCw size={12} className={reloadingSources.size > 0 ? 'animate-spin' : ''} /> Reload All
                </button>
              )}
              <button
                  onClick={onClearAll}
                  className="flex-1 text-xs text-red-500 hover:text-red-700 flex items-center justify-center gap-1 py-2 border border-red-100 rounded-lg hover:bg-red-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                  <Trash2 size={12} /> Clear All
              </button>
            </div>
        )}
    </div>
  );
};

export default SourcesList;
