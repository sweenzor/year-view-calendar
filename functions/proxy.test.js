/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from './proxy.js';

const createContext = (requestUrl, headers = {}) => {
  return {
    request: new Request(requestUrl, { headers }),
  };
};

const createDnsResponse = (answers = []) => {
  return new Response(JSON.stringify({ Answer: answers }), {
    headers: { 'Content-Type': 'application/dns-json' },
  });
};

describe('Cloudflare Pages proxy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects cross-origin browser requests before fetching anything', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await onRequestGet(createContext(
      'https://yearview.life/proxy?url=https://example.com/calendar.ics',
      {
        Origin: 'https://evil.example',
        'Sec-Fetch-Site': 'cross-site',
      },
    ));

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe('Cross-origin browser requests are not allowed.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects hostnames that resolve to private addresses', async () => {
    const fetchMock = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('type=A')) {
        return createDnsResponse([{ type: 1, data: '127.0.0.1' }]);
      }

      if (url.includes('type=AAAA')) {
        return createDnsResponse();
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await onRequestGet(createContext(
      'https://yearview.life/proxy?url=https://calendar.example.com/feed.ics',
      { Origin: 'https://yearview.life' },
    ));

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe('Private or local network URLs are not allowed.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns calendar data for same-origin requests without wildcard CORS', async () => {
    const fetchMock = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.startsWith('https://cloudflare-dns.com/dns-query')) {
        return createDnsResponse();
      }

      if (url === 'https://example.com/calendar.ics') {
        return new Response('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR');
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await onRequestGet(createContext(
      'https://yearview.life/proxy?url=https://example.com/calendar.ics',
      {
        Origin: 'https://yearview.life',
        'Sec-Fetch-Site': 'same-origin',
      },
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    await expect(response.text()).resolves.toContain('BEGIN:VCALENDAR');
  });

  it('rejects non-calendar responses from the upstream server', async () => {
    const fetchMock = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.startsWith('https://cloudflare-dns.com/dns-query')) {
        return createDnsResponse();
      }

      if (url === 'https://example.com/not-a-calendar.txt') {
        return new Response('<html>not a calendar</html>');
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await onRequestGet(createContext(
      'https://yearview.life/proxy?url=https://example.com/not-a-calendar.txt',
      { Origin: 'https://yearview.life' },
    ));

    expect(response.status).toBe(415);
    await expect(response.text()).resolves.toBe('The remote resource did not look like calendar data.');
  });
});
