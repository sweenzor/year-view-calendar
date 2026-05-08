const PROXY_URL_PREFIX = '/proxy?url=';
const URL_IMPORT_FALLBACK_MESSAGE = 'Could not load URL. Some providers block direct browser access, so you may need to download the file and drag it in.';
export const DEFAULT_REMOTE_CALENDAR_NAME = 'Remote Calendar';

const decodeSafely = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

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

export const getCalendarName = () => {
  return DEFAULT_REMOTE_CALENDAR_NAME;
};

export const isPathBasedCalendarName = (url, name) => {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    if (!path || path === '/') {
      return false;
    }

    const decodedPath = decodeSafely(path);
    const pathWithoutLeadingSlash = path.replace(/^\/+/, '');
    const decodedPathWithoutLeadingSlash = decodedPath.replace(/^\/+/, '');
    // Older imports used URL paths as labels, so match encoded and decoded variants.
    const candidates = new Set([
      parsedUrl.href,
      `${parsedUrl.origin}${path}`,
      `${parsedUrl.origin}${path}${parsedUrl.search}`,
      `${parsedUrl.hostname}${path}`,
      `${parsedUrl.hostname}${path}${parsedUrl.search}`,
      `${parsedUrl.hostname}${decodedPath}`,
      `${parsedUrl.hostname}${decodedPath}${parsedUrl.search}`,
      path,
      decodedPath,
      pathWithoutLeadingSlash,
      decodedPathWithoutLeadingSlash,
    ]);

    const segments = pathWithoutLeadingSlash.split('/').filter(Boolean);
    const decodedSegments = decodedPathWithoutLeadingSlash.split('/').filter(Boolean);
    if (segments.length > 0) {
      candidates.add(segments[segments.length - 1]);
    }
    if (decodedSegments.length > 0) {
      candidates.add(decodedSegments[decodedSegments.length - 1]);
    }

    return candidates.has(trimmedName);
  } catch {
    return false;
  }
};

export const getSafeCalendarName = (url, name) => {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName || trimmedName === DEFAULT_REMOTE_CALENDAR_NAME) {
    return null;
  }

  return isPathBasedCalendarName(url, trimmedName) ? null : trimmedName;
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
