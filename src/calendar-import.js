const PROXY_URL_PREFIX = '/proxy?url=';
const URL_IMPORT_FALLBACK_MESSAGE = 'Could not load URL. Some providers block direct browser access, so you may need to download the file and drag it in.';

const isPolicyError = (message) => {
  return message.includes('not allowed') || message.includes('Only http:// and https:// URLs are supported.');
};

const getResponseMessage = async (response) => {
  const text = (await response.text()).trim();
  return text || `Import failed with status ${response.status}.`;
};

export const normalizeCalendarUrl = (value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.startsWith('webcal://')
    ? `https://${trimmed.slice('webcal://'.length)}`
    : trimmed;
};

export const isSupportedCalendarUrl = (value) => {
  try {
    const parsedUrl = new URL(value);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
};

export const getCalendarName = (url) => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname + (parsedUrl.pathname.length > 1 ? parsedUrl.pathname : '');
  } catch {
    return 'Remote Calendar';
  }
};

export const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result || '');
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsText(file);
  });
};

export const fetchCalendarTextWithFallback = async (url) => {
  try {
    const proxyResponse = await fetch(`${PROXY_URL_PREFIX}${encodeURIComponent(url)}`);
    if (!proxyResponse.ok) {
      throw new Error(await getResponseMessage(proxyResponse));
    }

    return proxyResponse.text();
  } catch (proxyError) {
    try {
      const directResponse = await fetch(url);
      if (!directResponse.ok) {
        throw new Error(`Direct fetch failed with status ${directResponse.status}.`);
      }

      return directResponse.text();
    } catch {
      if (isPolicyError(proxyError.message)) {
        throw proxyError;
      }

      throw new Error(proxyError.message || URL_IMPORT_FALLBACK_MESSAGE);
    }
  }
};
