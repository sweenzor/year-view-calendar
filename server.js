import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = 3001;

// ---------------------------------------------------------------------------
// Security headers — applied to every response
// ---------------------------------------------------------------------------
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
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10;              // max requests per window per IP
const requestLog = new Map();           // IP -> [timestamp, ...]

// Periodically clean up stale entries so the map doesn't grow forever
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

// ---------------------------------------------------------------------------
// URL validation helpers
// ---------------------------------------------------------------------------

/** Only http and https protocols are allowed. */
function hasAllowedProtocol(parsed) {
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/**
 * Returns true if the hostname resolves to a private / loopback / link-local
 * address that should never be reached by an outbound proxy.
 */
function isPrivateHost(hostname) {
  // Normalise: strip IPv6 brackets if present
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  // Loopback
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;

  // IPv4 private ranges
  const ipv4Match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    if (a === 169 && b === 254) return true;             // 169.254.0.0/16 (link-local)
    if (a === 0) return true;                            // 0.0.0.0/8
  }

  // IPv6 loopback / link-local (fe80::)
  if (/^fe80:/i.test(h)) return true;
  // IPv4-mapped IPv6 — e.g. ::ffff:127.0.0.1
  if (/^::ffff:/i.test(h)) {
    const mapped = h.replace(/^::ffff:/i, '');
    return isPrivateHost(mapped);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Proxy endpoint
// ---------------------------------------------------------------------------
app.get('/proxy', async (req, res) => {
  // --- Rate limiting ---
  const clientIp = req.ip || req.socket.remoteAddress;
  if (isRateLimited(clientIp)) {
    console.warn(`Rate limit exceeded for ${clientIp}`);
    return res.status(429).send('Too many requests. Please try again later.');
  }

  // --- URL presence ---
  const { url } = req.query;
  if (!url) {
    console.log('Proxy request missing URL');
    return res.status(400).send('URL is required');
  }

  // --- URL format validation ---
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    console.warn(`Invalid URL rejected: ${url}`);
    return res.status(400).send('Invalid URL format');
  }

  // --- Protocol check ---
  if (!hasAllowedProtocol(parsed)) {
    console.warn(`Blocked disallowed protocol: ${parsed.protocol} (${url})`);
    return res.status(400).send('Only http and https URLs are allowed');
  }

  // --- Private IP / hostname check (SSRF protection) ---
  if (isPrivateHost(parsed.hostname)) {
    console.warn(`Blocked private/reserved address: ${parsed.hostname} (${url})`);
    return res.status(400).send('URLs pointing to private or reserved addresses are not allowed');
  }

  console.log(`Proxying request for: ${url}`);

  try {
    const response = await axios.get(url, {
      responseType: 'text',
      timeout: 10_000, // 10-second timeout
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    console.log('Proxy request successful');
    res.send(response.data);
  } catch (error) {
    // Log full details server-side but return only a generic message to the client
    console.error('Proxy fetch error:', error.message);
    if (error.response) {
      console.error('Upstream response status:', error.response.status);
    }
    res.status(502).send('Failed to fetch the requested URL');
  }
});

app.listen(port, '0.0.0.0', (err) => {
  if (err) {
    console.error('Failed to start server:', err);
  } else {
    console.log(`Proxy server listening on port ${port}`);
  }
});
