// Cloudflare Pages Function – replaces the Express proxy (server.js) for production.
// Uses the same worker-safe URL validation rules as the dev proxy, plus a DNS-over-HTTPS
// lookup so hostnames that resolve to private addresses are rejected before fetch().

import {
  PRIVATE_NETWORK_MESSAGE,
  PROXY_TIMEOUT_MS,
  getIpVersion,
  isPrivateIpAddress,
  validateProxyUrlShape,
} from '../proxy-shared.js';
import {
  PROXY_SECURITY_HEADERS,
  PROXY_USER_AGENT,
  followValidatedRedirects,
  readCalendarFetchResponse,
} from './proxy-core.js';

const DNS_QUERY_BASE_URL = 'https://cloudflare-dns.com/dns-query';
const DNS_QUERY_TIMEOUT_MS = 5_000;
const CROSS_ORIGIN_BROWSER_MESSAGE = 'Cross-origin browser requests are not allowed.';

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

const errorResponse = (status, message) => {
  return new Response(message, { status, headers: { ...PROXY_SECURITY_HEADERS } });
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
    const { response } = await followValidatedRedirects(validation.url.toString(), {
      validateUrl,
      sendRequest: async (url) => {
        const response = await fetch(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
          headers: { 'User-Agent': PROXY_USER_AGENT },
        });

        return {
          status: response.status,
          redirectLocation: response.headers.get('location'),
          response,
        };
      },
    });

    const body = await readCalendarFetchResponse(response);

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        ...PROXY_SECURITY_HEADERS,
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
