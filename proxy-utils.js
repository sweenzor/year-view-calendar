import { lookup } from 'node:dns/promises';
import net from 'node:net';

export const MAX_PROXY_RESPONSE_BYTES = 25 * 1024 * 1024;
export const PROXY_TIMEOUT_MS = 120000;

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

const ipv4ToInteger = (address) => {
  return address.split('.').reduce((value, octet) => ((value << 8) + Number(octet)), 0);
};

export const isPrivateIpAddress = (address) => {
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) {
    const numericAddress = ipv4ToInteger(address);
    return IPV4_PRIVATE_RANGES.some(({ start, end }) => {
      return numericAddress >= ipv4ToInteger(start) && numericAddress <= ipv4ToInteger(end);
    });
  }

  if (ipVersion === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80:');
  }

  return false;
};

export const isBlockedHostname = (hostname) => {
  const normalized = hostname.toLowerCase();
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

  if (isBlockedHostname(parsedUrl.hostname)) {
    return {
      ok: false,
      status: 403,
      message: 'Private or local network URLs are not allowed.',
    };
  }

  if (net.isIP(parsedUrl.hostname) && isPrivateIpAddress(parsedUrl.hostname)) {
    return {
      ok: false,
      status: 403,
      message: 'Private or local network URLs are not allowed.',
    };
  }

  try {
    const lookupResults = await lookup(parsedUrl.hostname, { all: true, verbatim: true });
    if (lookupResults.some((result) => isPrivateIpAddress(result.address))) {
      return {
        ok: false,
        status: 403,
        message: 'Private or local network URLs are not allowed.',
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
