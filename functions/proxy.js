// Cloudflare Pages Function – replaces the Express proxy (server.js) for production.
// Mirrors the validation and fetch logic from proxy-utils.js without Node-specific APIs.
// Rate limiting is omitted (Workers isolates are ephemeral); use Cloudflare dashboard rules instead.

const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;

const PRIVATE_NETWORK_MESSAGE = 'Private or local network URLs are not allowed.';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '::',
  '::1',
  'host.docker.internal',
]);

const PRIVATE_HOSTNAME_SUFFIXES = ['.internal', '.local', '.localhost'];

const IPV4_PRIVATE_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '127.0.0.0', end: '127.255.255.255' },
  { start: '169.254.0.0', end: '169.254.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
];

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Access-Control-Allow-Origin': '*',
};

// --- Helpers ---

const normalizeHostname = (hostname) => {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
};

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const isIPv4 = (str) => {
  const m = IPV4_RE.exec(str);
  if (!m) return false;
  return m.slice(1).every((o) => Number(o) <= 255);
};

const isIPv6 = (str) => {
  return str.includes(':') && !IPV4_RE.test(str);
};

const ipv4ToInteger = (address) => {
  return address.split('.').reduce((v, o) => ((v << 8) + Number(o)), 0);
};

const isPrivateIpAddress = (address) => {
  const normalized = normalizeHostname(address);

  if (isIPv4(normalized)) {
    const num = ipv4ToInteger(normalized);
    return IPV4_PRIVATE_RANGES.some(({ start, end }) => {
      return num >= ipv4ToInteger(start) && num <= ipv4ToInteger(end);
    });
  }

  if (isIPv6(normalized)) {
    if (normalized.startsWith('::ffff:')) {
      return isPrivateIpAddress(normalized.slice('::ffff:'.length));
    }
    return normalized === '::'
      || normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80:');
  }

  return false;
};

const isBlockedHostname = (hostname) => {
  const normalized = normalizeHostname(hostname);
  return BLOCKED_HOSTNAMES.has(normalized)
    || PRIVATE_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
};

const validateUrl = (urlString) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return { ok: false, status: 400, message: 'A valid calendar URL is required.' };
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { ok: false, status: 400, message: 'Only http:// and https:// URLs are supported.' };
  }

  if (parsedUrl.username || parsedUrl.password) {
    return { ok: false, status: 400, message: 'URLs with embedded credentials are not supported.' };
  }

  const normalized = normalizeHostname(parsedUrl.hostname);

  if (isBlockedHostname(normalized)) {
    return { ok: false, status: 403, message: PRIVATE_NETWORK_MESSAGE };
  }

  if ((isIPv4(normalized) || isIPv6(normalized)) && isPrivateIpAddress(normalized)) {
    return { ok: false, status: 403, message: PRIVATE_NETWORK_MESSAGE };
  }

  return { ok: true, url: parsedUrl };
};

const resolveRedirectUrl = (currentUrl, location) => {
  let redirectedUrl;
  try {
    redirectedUrl = new URL(location, currentUrl);
  } catch {
    return { ok: false, status: 502, message: 'The remote calendar redirected to an invalid URL.' };
  }
  return validateUrl(redirectedUrl.toString());
};

// --- Core fetch ---

const fetchRemoteCalendar = async (initialUrl) => {
  let currentUrl = initialUrl;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YearViewCalendar/1.0)' },
    });

    if (!REDIRECT_STATUS_CODES.has(response.status)) {
      return response;
    }

    if (i === MAX_REDIRECTS) {
      break;
    }

    const redirectTarget = response.headers.get('location');
    if (!redirectTarget) {
      const err = new Error('The remote calendar returned a redirect without a location.');
      err.status = 502;
      throw err;
    }

    const validation = resolveRedirectUrl(currentUrl, redirectTarget);
    if (!validation.ok) {
      const err = new Error(validation.message);
      err.status = validation.status;
      throw err;
    }

    currentUrl = validation.url.toString();
  }

  const err = new Error('The remote calendar redirected too many times.');
  err.status = 502;
  throw err;
};

const readResponseWithSizeLimit = async (response) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let totalBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      reader.cancel();
      const err = new Error('The remote calendar is too large to import.');
      err.status = 413;
      throw err;
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join('');
};

const errorResponse = (status, message) => {
  return new Response(message, { status, headers: { ...SECURITY_HEADERS } });
};

// --- Handler ---

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const url = requestUrl.searchParams.get('url');

  if (!url || !url.trim()) {
    return errorResponse(400, 'A calendar URL is required.');
  }

  const validation = validateUrl(url);
  if (!validation.ok) {
    return errorResponse(validation.status, validation.message);
  }

  try {
    const response = await fetchRemoteCalendar(validation.url.toString());

    if (response.status >= 400) {
      return errorResponse(response.status, `The remote calendar responded with status ${response.status}.`);
    }

    const body = await readResponseWithSizeLimit(response);

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar',
        ...SECURITY_HEADERS,
      },
    });
  } catch (error) {
    if (error.status) {
      return errorResponse(error.status, error.message);
    }

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return errorResponse(504, 'The remote calendar took too long to respond.');
    }

    return errorResponse(502, 'The remote calendar could not be fetched.');
  }
}
