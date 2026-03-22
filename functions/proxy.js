// Cloudflare Pages Function – replaces the Express proxy (server.js) for production.
// Uses the same worker-safe URL validation rules as the dev proxy, plus a DNS-over-HTTPS
// lookup so hostnames that resolve to private addresses are rejected before fetch().

import {
  MAX_PROXY_REDIRECTS,
  MAX_PROXY_RESPONSE_BYTES,
  NON_CALENDAR_MESSAGE,
  PRIVATE_NETWORK_MESSAGE,
  PROXY_TIMEOUT_MS,
  getIpVersion,
  isPrivateIpAddress,
  looksLikeCalendarData,
  parseRedirectTarget,
  validateProxyUrlShape,
} from '../proxy-shared.js';

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const DNS_QUERY_BASE_URL = 'https://cloudflare-dns.com/dns-query';
const DNS_QUERY_TIMEOUT_MS = 5_000;
const CROSS_ORIGIN_BROWSER_MESSAGE = 'Cross-origin browser requests are not allowed.';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

// --- Helpers ---

const extractDnsAnswers = (payload) => {
  if (!Array.isArray(payload?.Answer)) {
    return [];
  }

  return payload.Answer
    .filter((answer) => (answer.type === 1 || answer.type === 28) && typeof answer.data === 'string')
    .map((answer) => answer.data);
};

const lookupHostnameAddresses = async (hostname) => {
  const queryTypes = ['A', 'AAAA'];
  const responses = await Promise.all(queryTypes.map(async (queryType) => {
    const dnsUrl = `${DNS_QUERY_BASE_URL}?name=${encodeURIComponent(hostname)}&type=${queryType}`;
    const response = await fetch(dnsUrl, {
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(DNS_QUERY_TIMEOUT_MS),
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return extractDnsAnswers(payload);
  }));

  return [...new Set(responses.flat())];
};

const validateUrl = async (urlString) => {
  const baseValidation = validateProxyUrlShape(urlString);
  if (!baseValidation.ok) {
    return baseValidation;
  }

  if (getIpVersion(baseValidation.normalizedHostname)) {
    return {
      ok: true,
      url: baseValidation.url,
    };
  }

  try {
    const lookupResults = await lookupHostnameAddresses(baseValidation.normalizedHostname);
    if (lookupResults.some((address) => isPrivateIpAddress(address))) {
      return { ok: false, status: 403, message: PRIVATE_NETWORK_MESSAGE };
    }
  } catch {
    // Let the upstream fetch surface DNS failures naturally.
  }

  return {
    ok: true,
    url: baseValidation.url,
  };
};

const resolveRedirectUrl = async (currentUrl, location) => {
  const redirectTarget = parseRedirectTarget(currentUrl, location);
  if (!redirectTarget.ok) {
    return redirectTarget;
  }

  return validateUrl(redirectTarget.url.toString());
};

const validateBrowserRequest = (request, requestUrl) => {
  const origin = request.headers.get('Origin');
  if (origin && origin !== requestUrl.origin) {
    return { ok: false, status: 403, message: CROSS_ORIGIN_BROWSER_MESSAGE };
  }

  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return { ok: false, status: 403, message: CROSS_ORIGIN_BROWSER_MESSAGE };
  }

  return { ok: true };
};

// --- Core fetch ---

const fetchRemoteCalendar = async (initialUrl) => {
  let currentUrl = initialUrl;

  for (let i = 0; i <= MAX_PROXY_REDIRECTS; i++) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YearViewCalendar/1.0)' },
    });

    if (!REDIRECT_STATUS_CODES.has(response.status)) {
      return response;
    }

    if (i === MAX_PROXY_REDIRECTS) {
      break;
    }

    const redirectTarget = response.headers.get('location');
    if (!redirectTarget) {
      const err = new Error('The remote calendar returned a redirect without a location.');
      err.status = 502;
      throw err;
    }

    const validation = await resolveRedirectUrl(currentUrl, redirectTarget);
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
  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let totalBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_PROXY_RESPONSE_BYTES) {
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
  const browserRequestValidation = validateBrowserRequest(context.request, requestUrl);
  if (!browserRequestValidation.ok) {
    return errorResponse(browserRequestValidation.status, browserRequestValidation.message);
  }

  const url = requestUrl.searchParams.get('url');

  if (!url || !url.trim()) {
    return errorResponse(400, 'A calendar URL is required.');
  }

  const validation = await validateUrl(url);
  if (!validation.ok) {
    return errorResponse(validation.status, validation.message);
  }

  try {
    const response = await fetchRemoteCalendar(validation.url.toString());

    if (response.status >= 400) {
      return errorResponse(response.status, `The remote calendar responded with status ${response.status}.`);
    }

    const body = await readResponseWithSizeLimit(response);
    if (!looksLikeCalendarData(body)) {
      return errorResponse(415, NON_CALENDAR_MESSAGE);
    }

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
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
