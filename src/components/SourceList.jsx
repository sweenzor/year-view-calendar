import { FileText, Link, RefreshCw, Trash2, X } from 'lucide-react';
import { SOURCE_STATUS } from '../calendar-sources';

const SourceIcon = ({ type }) => {
  if (type === 'url') return <Link size={14} className="shrink-0 text-purple-500" />;
  if (type === 'file') return <FileText size={14} className="shrink-0 text-green-600" />;
  return <FileText size={14} className="shrink-0 text-blue-400" />;
};

export const SourceList = ({
  sources,
  eventsCount,
  onReloadSource,
  onReloadAllSources,
  onRemoveSource,
  onClearAllSources,
}) => {
  const hasUrlSources = sources.some((source) => source.url);
  const hasLoadingSources = sources.some((source) => source.status === SOURCE_STATUS.LOADING);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
      <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
        <span>Loaded Calendars</span>
        <span className="text-xs font-normal text-gray-600 bg-gray-100 px-2 py-1 rounded-full">{eventsCount} events</span>
      </h3>

      <div className="flex-1 overflow-y-auto max-h-56 space-y-2 pr-1 custom-scrollbar">
        {sources.length === 0 && (
          <p className="text-sm text-gray-500 italic text-center py-4">No calendars loaded</p>
        )}

        {sources.map((source) => (
          <div key={source.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <SourceIcon type={source.type} />
                <span className="text-sm text-gray-800 truncate" title={source.name}>{source.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {source.url && (
                  <button
                    type="button"
                    onClick={() => onReloadSource(source)}
                    disabled={source.status === SOURCE_STATUS.LOADING}
                    aria-label={`Reload ${source.name}`}
                    className="text-gray-500 hover:text-purple-600 p-1 rounded-md transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={source.status === SOURCE_STATUS.LOADING ? 'animate-spin' : ''} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveSource(source.id)}
                  aria-label={`Remove ${source.name}`}
                  className="text-gray-500 hover:text-red-500 p-1 rounded-md transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {source.error && (
              <p className="mt-2 text-xs text-red-600" role="status" aria-live="polite">
                {source.error}
              </p>
            )}
          </div>
        ))}
      </div>

      {sources.length > 0 && (
        <div className="mt-4 flex gap-2">
          {hasUrlSources && (
            <button
              type="button"
              onClick={onReloadAllSources}
              disabled={hasLoadingSources}
              className="flex-1 text-xs text-purple-600 hover:text-purple-700 flex items-center justify-center gap-1 py-2 border border-purple-100 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={hasLoadingSources ? 'animate-spin' : ''} />
              Reload All
            </button>
          )}
          <button
            type="button"
            onClick={onClearAllSources}
            className="flex-1 text-xs text-red-600 hover:text-red-700 flex items-center justify-center gap-1 py-2 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 size={12} />
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};
