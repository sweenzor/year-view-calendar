import { lookup as lookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

export const MAX_PROXY_RESPONSE_BYTES = 25 * 1024 * 1024;
export const PROXY_TIMEOUT_MS = 120000;
export const MAX_PROXY_REDIRECTS = 3;
export const PRIVATE_NETWORK_MESSAGE = 'Private or local network URLs are not allowed.';
export const INVALID_REDIRECT_MESSAGE = 'The remote calendar redirected to an invalid URL.';

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

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

const normalizeHostname = (hostname) => {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
};

const ipv4ToInteger = (address) => {
  return address.split('.').reduce((value, octet) => ((value << 8) + Number(octet)), 0);
};

export const isPrivateIpAddress = (address) => {
  const normalizedAddress = normalizeHostname(address);
  const ipVersion = net.isIP(normalizedAddress);
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

export const validateProxyUrl = async (urlString) => {
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

  if (net.isIP(normalizedHostname) && isPrivateIpAddress(normalizedHostname)) {
    return {
      ok: false,
      status: 403,
      message: PRIVATE_NETWORK_MESSAGE,
    };
  }

  try {
    const lookupResults = await lookup(normalizedHostname, { all: true, verbatim: true });
    if (lookupResults.some((result) => isPrivateIpAddress(result.address))) {
      return {
        ok: false,
        status: 403,
        message: PRIVATE_NETWORK_MESSAGE,
      };
    }
  } catch {
    // Let the upstream fetch surface DNS failures naturally.
  }

  return {
    ok: true,
    url: parsedUrl,
  };
};

export const isRedirectStatus = (status) => {
  return REDIRECT_STATUS_CODES.has(status);
};

export const resolveRedirectUrl = async (currentUrl, location) => {
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

  return validateProxyUrl(redirectedUrl.toString());
};

export const createSafeLookup = (lookupFn = lookupAddress) => {
  return (hostname, _options, callback) => {
    const normalizedHostname = normalizeHostname(hostname);
    if (isBlockedHostname(normalizedHostname)) {
      const error = new Error(PRIVATE_NETWORK_MESSAGE);
      error.status = 403;
      callback(error);
      return;
    }

    lookupFn(normalizedHostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) {
        callback(error);
        return;
      }

      if (!Array.isArray(addresses) || addresses.length === 0) {
        callback(new Error('DNS lookup returned no results.'));
        return;
      }

      if (addresses.some((result) => isPrivateIpAddress(result.address))) {
        const privateAddressError = new Error(PRIVATE_NETWORK_MESSAGE);
        privateAddressError.status = 403;
        callback(privateAddressError);
        return;
      }

      callback(null, addresses[0].address, addresses[0].family);
    });
  };
};
