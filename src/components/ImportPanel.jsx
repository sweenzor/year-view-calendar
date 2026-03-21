import { Loader, Link as LinkIcon, Upload } from 'lucide-react';
import { useState } from 'react';

export const ImportPanel = ({
  onImportFiles,
  onImportUrl,
  onClearFeedback,
  importFeedback,
  isImportingUrl,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    }
    if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      onImportFiles(event.dataTransfer.files);
    }
  };

  const handleFileInput = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      onImportFiles(event.target.files);
    }
  };

  const handleUrlSubmit = async (event) => {
    event.preventDefault();
    const succeeded = await onImportUrl(urlInput);
    if (succeeded) {
      setUrlInput('');
    }
  };

  return (
    <div
      className={`lg:col-span-2 border-2 border-dashed rounded-xl p-6 flex flex-col justify-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {importFeedback && (
        <div
          role={importFeedback.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${importFeedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}
        >
          {importFeedback.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="flex-1 w-full flex flex-col items-center md:items-start">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Upload size={20} />
            </div>
            <h3 className="font-bold text-gray-800">File Upload</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4 text-center md:text-left">
            Drag &amp; drop `.ics` files here
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
            onClick={onClearFeedback}
          >
            Choose Files
          </label>
        </div>

        <div className="hidden md:block w-px h-24 bg-gray-200" />

        <div className="flex-1 w-full">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <LinkIcon size={20} />
            </div>
            <h3 className="font-bold text-gray-800">Import from URL</h3>
          </div>
          <form onSubmit={handleUrlSubmit} className="flex gap-2">
            <label htmlFor="calendar-url" className="sr-only">Calendar URL</label>
            <input
              id="calendar-url"
              type="url"
              placeholder="https://example.com/calendar.ics"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={urlInput}
              onChange={(event) => {
                if (importFeedback) {
                  onClearFeedback();
                }
                setUrlInput(event.target.value);
              }}
            />
            <button
              type="submit"
              disabled={isImportingUrl}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center"
            >
              {isImportingUrl ? <Loader size={16} className="animate-spin" /> : 'Add'}
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            URL imports try the proxy first. If the browser can reach the feed directly, it will fall back to a direct request.
          </p>
        </div>
      </div>
    </div>
  );
};
