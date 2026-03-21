import { Upload, Link as LinkIcon, Loader } from 'lucide-react';

const ImportPanel = ({
  dragActive,
  urlInput,
  isLoadingUrl,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileInput,
  onUrlChange,
  onUrlSubmit,
}) => {
  return (
    <div
      className={`lg:col-span-2 border-2 border-dashed rounded-xl p-6 flex flex-col justify-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
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
                    onChange={onFileInput}
                />
                <label
                    htmlFor="ics-upload"
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium cursor-pointer transition-colors text-sm w-full md:w-auto text-center focus-within:ring-2 focus-within:ring-blue-500"
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
                <form onSubmit={onUrlSubmit} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="https://example.com/calendar.ics"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        value={urlInput}
                        onChange={onUrlChange}
                    />
                    <button
                        type="submit"
                        disabled={isLoadingUrl}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
  );
};

export default ImportPanel;
