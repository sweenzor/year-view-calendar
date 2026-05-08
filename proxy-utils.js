import { lookup as lookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import {
  INVALID_REDIRECT_MESSAGE,
  MAX_PROXY_REDIRECTS,
  MAX_PROXY_RESPONSE_BYTES,
  PRIVATE_NETWORK_MESSAGE,
  PROXY_TIMEOUT_MS,
  isBlockedHostname,
  isPrivateIpAddress,
  normalizeHostname,
  parseRedirectTarget,
  validateProxyUrlWithDnsLookup,
} from './proxy-shared.js';

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

export {
  INVALID_REDIRECT_MESSAGE,
  MAX_PROXY_REDIRECTS,
  MAX_PROXY_RESPONSE_BYTES,
  PRIVATE_NETWORK_MESSAGE,
  PROXY_TIMEOUT_MS,
  isBlockedHostname,
  isPrivateIpAddress,
};

export const validateProxyUrl = async (urlString) => {
  return validateProxyUrlWithDnsLookup(urlString, (hostname) => {
    return lookup(hostname, { all: true, verbatim: true });
  });
};

export const isRedirectStatus = (status) => {
  return REDIRECT_STATUS_CODES.has(status);
};

export const resolveRedirectUrl = async (currentUrl, location) => {
  const redirectTarget = parseRedirectTarget(currentUrl, location);
  if (!redirectTarget.ok) {
    return redirectTarget;
  }

  return validateProxyUrl(redirectTarget.url.toString());
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
