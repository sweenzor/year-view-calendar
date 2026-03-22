/** @vitest-environment node */

import { describe, expect, it } from 'vitest';
import { isBlockedHostname, isPrivateIpAddress, validateProxyUrl } from './proxy-utils.js';

describe('proxy-utils', () => {
  it('detects blocked hostnames and private IP addresses', () => {
    expect(isBlockedHostname('localhost')).toBe(true);
    expect(isBlockedHostname('calendar.internal')).toBe(true);
    expect(isPrivateIpAddress('10.1.2.3')).toBe(true);
    expect(isPrivateIpAddress('192.168.1.4')).toBe(true);
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
});
