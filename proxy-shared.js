export const MAX_PROXY_RESPONSE_BYTES = 25 * 1024 * 1024;
export const PROXY_TIMEOUT_MS = 30_000;
export const MAX_PROXY_REDIRECTS = 3;
export const PRIVATE_NETWORK_MESSAGE = 'Private or local network URLs are not allowed.';
export const INVALID_REDIRECT_MESSAGE = 'The remote calendar redirected to an invalid URL.';
export const NON_CALENDAR_MESSAGE = 'The remote resource did not look like calendar data.';

const PRIVATE_HOSTNAME_SUFFIXES = ['.internal', '.local', '.localhost'];
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '::',
  '::1',
  'host.docker.internal',
]);

const IPV4_PRIVATE_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '127.0.0.0', end: '127.255.255.255' },
  { start: '169.254.0.0', end: '169.254.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
];

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export const normalizeHostname = (hostname) => {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
};

export const isIPv4 = (value) => {
  const match = IPV4_RE.exec(value);
  if (!match) {
    return false;
  }

  return match.slice(1).every((octet) => Number(octet) <= 255);
};

export const isIPv6 = (value) => {
  return value.includes(':') && !isIPv4(value);
};

export const getIpVersion = (value) => {
  if (isIPv4(value)) {
    return 4;
  }

  if (isIPv6(value)) {
    return 6;
  }

  return 0;
};

const ipv4ToInteger = (address) => {
  return address.split('.').reduce((value, octet) => ((value << 8) + Number(octet)), 0);
};

export const isPrivateIpAddress = (address) => {
  const normalizedAddress = normalizeHostname(address);
  const ipVersion = getIpVersion(normalizedAddress);

  if (ipVersion === 4) {
    const numericAddress = ipv4ToInteger(normalizedAddress);
    return IPV4_PRIVATE_RANGES.some(({ start, end }) => {
      return numericAddress >= ipv4ToInteger(start) && numericAddress <= ipv4ToInteger(end);
    });
  }

  if (ipVersion === 6) {
    if (normalizedAddress.startsWith('::ffff:')) {
      return isPrivateIpAddress(normalizedAddress.slice('::ffff:'.length));
    }

    return normalizedAddress === '::'
      || normalizedAddress === '::1'
      || normalizedAddress.startsWith('fc')
      || normalizedAddress.startsWith('fd')
      || normalizedAddress.startsWith('fe80:');
  }

  return false;
};

export const isBlockedHostname = (hostname) => {
  const normalized = normalizeHostname(hostname);
  return BLOCKED_HOSTNAMES.has(normalized)
    || PRIVATE_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
};

export const validateProxyUrlShape = (urlString) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return {
      ok: false,
      status: 400,
      message: 'A valid calendar URL is required.',
    };
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return {
      ok: false,
      status: 400,
      message: 'Only http:// and https:// URLs are supported.',
    };
  }

  if (parsedUrl.username || parsedUrl.password) {
    return {
      ok: false,
      status: 400,
      message: 'URLs with embedded credentials are not supported.',
    };
  }

  const normalizedHostname = normalizeHostname(parsedUrl.hostname);

  if (isBlockedHostname(normalizedHostname)) {
    return {
      ok: false,
      status: 403,
      message: PRIVATE_NETWORK_MESSAGE,
    };
  }

  if (getIpVersion(normalizedHostname) && isPrivateIpAddress(normalizedHostname)) {
    return {
      ok: false,
      status: 403,
      message: PRIVATE_NETWORK_MESSAGE,
    };
  }

  return {
    ok: true,
    url: parsedUrl,
    normalizedHostname,
  };
};

export const parseRedirectTarget = (currentUrl, location) => {
  let redirectedUrl;
  try {
    redirectedUrl = new URL(location, currentUrl);
  } catch {
    return {
      ok: false,
      status: 502,
      message: INVALID_REDIRECT_MESSAGE,
    };
  }

  return {
    ok: true,
    url: redirectedUrl,
  };
};

export const looksLikeCalendarData = (text) => {
  if (typeof text !== 'string') {
    return false;
  }

  const sanitized = text.replace(/^\ufeff/, '').trimStart();
  return /BEGIN:VCALENDAR/i.test(sanitized);
};
