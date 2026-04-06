import express from 'express';
import axios from 'axios';
import { MAX_PROXY_RESPONSE_BYTES } from './proxy-shared.js';
import {
  createSafeLookup,
  PROXY_TIMEOUT_MS,
  validateProxyUrl,
} from './proxy-utils.js';
import {
  PROXY_SECURITY_HEADERS,
  PROXY_USER_AGENT,
  followValidatedRedirects,
  validateCalendarBody,
} from './functions/proxy-core.js';

const app = express();
const port = 3001;

// Security headers
app.use((_req, res, next) => {
  Object.entries(PROXY_SECURITY_HEADERS).forEach(([header, value]) => {
    res.setHeader(header, value);
  });
  next();
});

// In-memory rate limiter — no external dependencies to keep the server lightweight.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateCounts = new Map();

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateCounts) {
    if (now >= record.resetTime) {
      rateCounts.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);
cleanupInterval.unref();

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateCounts.get(ip);

  if (!record || now >= record.resetTime) {
    rateCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  record.count += 1;
  return record.count > RATE_LIMIT_MAX;
}

const safeLookup = createSafeLookup();

app.get('/proxy', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress;
  if (isRateLimited(clientIp)) {
    return res.status(429).send('Too many requests. Please try again later.');
  }

  const { url } = req.query;
  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).send('A calendar URL is required.');
  }

  const validation = await validateProxyUrl(url);
  if (!validation.ok) {
    return res.status(validation.status).send(validation.message);
  }

  try {
    const { response } = await followValidatedRedirects(validation.url.toString(), {
      validateUrl: validateProxyUrl,
      sendRequest: async (url) => {
        const response = await axios.get(url, {
          responseType: 'text',
          timeout: PROXY_TIMEOUT_MS,
          maxContentLength: MAX_PROXY_RESPONSE_BYTES,
          maxBodyLength: MAX_PROXY_RESPONSE_BYTES,
          maxRedirects: 0,
          validateStatus: () => true,
          lookup: safeLookup,
          headers: {
            'User-Agent': PROXY_USER_AGENT,
          },
        });

        return {
          status: response.status,
          redirectLocation: response.headers.location,
          response,
        };
      },
    });

    res.type('text/calendar').send(validateCalendarBody(response.data));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).send(error.message);
    }

    if (error.response) {
      return res.status(error.response.status).send(`The remote calendar responded with status ${error.response.status}.`);
    }

    if (error.code === 'ECONNABORTED') {
      return res.status(504).send('The remote calendar took too long to respond.');
    }

    if (error.message?.toLowerCase().includes('maxcontentlength')) {
      return res.status(413).send('The remote calendar is too large to import.');
    }

    return res.status(502).send('The remote calendar could not be fetched.');
  }
});

app.listen(port, '0.0.0.0', (err) => {
  if (err) {
    console.error('Failed to start server:', err);
  } else {
    console.log(`Proxy server listening on port ${port}`);
  }
});
