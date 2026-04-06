/** @vitest-environment node */

import { describe, expect, it } from 'vitest';
import {
  followValidatedRedirects,
  readCalendarFetchResponse,
  validateCalendarBody,
} from './proxy-core.js';

describe('proxy-core', () => {
  it('follows redirects through the shared helper', async () => {
    const result = await followValidatedRedirects('https://example.com/start.ics', {
      validateUrl: async (url) => ({ ok: true, url: new URL(url) }),
      sendRequest: async (url) => {
        if (url === 'https://example.com/start.ics') {
          return { status: 302, redirectLocation: '/final.ics' };
        }

        return {
          status: 200,
          response: new Response('BEGIN:VCALENDAR\nEND:VCALENDAR'),
        };
      },
    });

    expect(result.status).toBe(200);
  });

  it('accepts calendar-shaped response bodies', () => {
    expect(validateCalendarBody('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR')).toContain('BEGIN:VCALENDAR');
  });

  it('rejects non-calendar fetch responses', async () => {
    await expect(
      readCalendarFetchResponse(new Response('<html>not a calendar</html>', { status: 200 })),
    ).rejects.toMatchObject({ status: 415 });
  });
});
