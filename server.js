import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { MAX_PROXY_RESPONSE_BYTES, PROXY_TIMEOUT_MS, validateProxyUrl } from './proxy-utils.js';

const app = express();
const port = 3001;

app.use(cors());

app.get('/proxy', async (req, res) => {
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
