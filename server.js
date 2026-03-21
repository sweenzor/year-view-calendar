import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { MAX_PROXY_RESPONSE_BYTES, PROXY_TIMEOUT_MS, validateProxyUrl } from './proxy-utils.js';

const app = express();
const port = 3001;

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use(cors());

// ---------------------------------------------------------------------------
// Simple in-memory sliding-window rate limiter (no dependencies)
// Allows RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS per IP.
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const requestLog = new Map();

setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [ip, timestamps] of requestLog) {
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) {
      requestLog.delete(ip);
    } else {
      requestLog.set(ip, filtered);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

function isRateLimited(ip) {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (requestLog.get(ip) || []).filter((t) => t > cutoff);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

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
    const response = await axios.get(validation.url.toString(), {
      responseType: 'text',
      timeout: PROXY_TIMEOUT_MS,
      maxContentLength: MAX_PROXY_RESPONSE_BYTES,
      maxBodyLength: MAX_PROXY_RESPONSE_BYTES,
      maxRedirects: 3,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; YearViewCalendar/1.0)',
      },
    });

    res.type('text/calendar').send(response.data);
  } catch (error) {
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
