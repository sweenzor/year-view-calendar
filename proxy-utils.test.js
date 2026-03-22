/** @vitest-environment node */

import { describe, expect, it } from 'vitest';
import {
  createSafeLookup,
  isBlockedHostname,
  isPrivateIpAddress,
  resolveRedirectUrl,
  validateProxyUrl,
} from './proxy-utils.js';

describe('proxy-utils', () => {
  it('detects blocked hostnames and private IP addresses', () => {
    expect(isBlockedHostname('localhost')).toBe(true);
    expect(isBlockedHostname('localhost.')).toBe(true);
    expect(isBlockedHostname('calendar.internal')).toBe(true);
    expect(isPrivateIpAddress('10.1.2.3')).toBe(true);
    expect(isPrivateIpAddress('192.168.1.4')).toBe(true);
    expect(isPrivateIpAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIpAddress('8.8.8.8')).toBe(false);
  });

  it('rejects unsupported or local URLs before attempting proxy fetches', async () => {
    await expect(validateProxyUrl('ftp://example.com/calendar.ics')).resolves.toMatchObject({
      ok: false,
      status: 400,
    });

    await expect(validateProxyUrl('http://localhost/calendar.ics')).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it('rejects redirects to blocked destinations', async () => {
    await expect(resolveRedirectUrl('https://example.com/calendar.ics', 'http://localhost/private.ics')).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it('resolves safe relative redirects', async () => {
    await expect(resolveRedirectUrl('https://example.com/path/calendar.ics', '../next.ics')).resolves.toMatchObject({
      ok: true,
    });
  });

  it('rejects private DNS results at request time', async () => {
    const safeLookup = createSafeLookup((_hostname, _options, callback) => {
      callback(null, [{ address: '127.0.0.1', family: 4 }]);
    });

    await expect(new Promise((resolve, reject) => {
      safeLookup('example.com', {}, (error, address) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address);
      });
    })).rejects.toThrow('Private or local network URLs are not allowed.');
  });
});
