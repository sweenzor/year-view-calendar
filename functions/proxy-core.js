import {
  INVALID_REDIRECT_MESSAGE,
  MAX_PROXY_REDIRECTS,
  MAX_PROXY_RESPONSE_BYTES,
  NON_CALENDAR_MESSAGE,
  looksLikeCalendarData,
  parseRedirectTarget,
} from '../proxy-shared.js';

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const MISSING_REDIRECT_LOCATION_MESSAGE = 'The remote calendar returned a redirect without a location.';
const TOO_MANY_REDIRECTS_MESSAGE = 'The remote calendar redirected too many times.';

export const PROXY_USER_AGENT = 'Mozilla/5.0 (compatible; YearViewCalendar/1.0)';

export const PROXY_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export const createProxyError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const followValidatedRedirects = async (initialUrl, { sendRequest, validateUrl }) => {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_PROXY_REDIRECTS; redirectCount += 1) {
    const result = await sendRequest(currentUrl);

    if (!REDIRECT_STATUS_CODES.has(result.status)) {
      return result;
    }

    if (redirectCount === MAX_PROXY_REDIRECTS) {
      break;
    }

    if (!result.redirectLocation) {
      throw createProxyError(502, MISSING_REDIRECT_LOCATION_MESSAGE);
    }

    const redirectTarget = parseRedirectTarget(currentUrl, result.redirectLocation);
    if (!redirectTarget.ok) {
      throw createProxyError(redirectTarget.status, redirectTarget.message || INVALID_REDIRECT_MESSAGE);
    }

    const validation = await validateUrl(redirectTarget.url.toString());
    if (!validation.ok) {
      throw createProxyError(validation.status, validation.message);
    }

    currentUrl = validation.url.toString();
  }

  throw createProxyError(502, TOO_MANY_REDIRECTS_MESSAGE);
};

export const validateCalendarBody = (body) => {
  if (!looksLikeCalendarData(body)) {
    throw createProxyError(415, NON_CALENDAR_MESSAGE);
  }

  return body;
};

export const readResponseWithSizeLimit = async (response) => {
  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let totalBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_PROXY_RESPONSE_BYTES) {
      reader.cancel();
      throw createProxyError(413, 'The remote calendar is too large to import.');
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join('');
};

export const readCalendarFetchResponse = async (response) => {
  if (response.status >= 400) {
    throw createProxyError(response.status, `The remote calendar responded with status ${response.status}.`);
  }

  const body = await readResponseWithSizeLimit(response);
  return validateCalendarBody(body);
};
