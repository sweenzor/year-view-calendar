/** @vitest-environment node */

import { lookup } from 'node:dns/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateProxyUrl as validateNodeProxyUrl } from './proxy-utils.js';
import { validateProxyUrl as validateWorkerProxyUrl } from './functions/proxy.js';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

const normalizeValidationResult = (result) => ({
  ok: result.ok,
  status: result.status,
  message: result.message,
  url: result.url?.toString(),
});

const createDnsResponse = (answers = []) => {
  return new Response(JSON.stringify({ Answer: answers }), {
    headers: { 'Content-Type': 'application/dns-json' },
  });
};

const createDnsFetch = ({ a = [], aaaa = [] } = {}) => {
  return vi.fn(async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    const queryType = new URL(url).searchParams.get('type');

    if (queryType === 'A') {
      return createDnsResponse(a);
    }

    if (queryType === 'AAAA') {
      return createDnsResponse(aaaa);
    }

    throw new Error(`Unexpected DNS query ${url}`);
  });
};

const validateBothProxyPaths = async (url) => {
  const [nodeResult, workerResult] = await Promise.all([
    validateNodeProxyUrl(url),
    validateWorkerProxyUrl(url),
  ]);

  return {
    node: normalizeValidationResult(nodeResult),
    worker: normalizeValidationResult(workerResult),
  };
};

describe('proxy validation alignment', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects private DNS results in both proxy paths', async () => {
    lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    vi.stubGlobal('fetch', createDnsFetch({
      a: [{ type: 1, data: '127.0.0.1' }],
    }));

    const results = await validateBothProxyPaths('https://calendar.example.com/feed.ics');

    expect(results.node).toEqual(results.worker);
    expect(results.node).toMatchObject({
      ok: false,
      status: 403,
      message: 'Private or local network URLs are not allowed.',
    });
  });

  it('accepts public DNS results in both proxy paths', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    vi.stubGlobal('fetch', createDnsFetch({
      a: [{ type: 1, data: '93.184.216.34' }],
    }));

    const results = await validateBothProxyPaths('https://calendar.example.com/feed.ics');

    expect(results.node).toEqual(results.worker);
    expect(results.node).toMatchObject({
      ok: true,
      url: 'https://calendar.example.com/feed.ics',
    });
  });

  it('rejects URL-only private destinations before DNS in both proxy paths', async () => {
    const fetchMock = vi.fn();
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    vi.stubGlobal('fetch', fetchMock);

    const results = await validateBothProxyPaths('http://localhost/private.ics');

    expect(results.node).toEqual(results.worker);
    expect(results.node).toMatchObject({
      ok: false,
      status: 403,
      message: 'Private or local network URLs are not allowed.',
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets upstream fetches surface DNS failures in both proxy paths', async () => {
    lookup.mockRejectedValue(new Error('DNS unavailable'));
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('DNS unavailable');
    }));

    const results = await validateBothProxyPaths('https://calendar.example.com/feed.ics');

    expect(results.node).toEqual(results.worker);
    expect(results.node).toMatchObject({
      ok: true,
      url: 'https://calendar.example.com/feed.ics',
    });
  });
});
