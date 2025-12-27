import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = 3001;

app.use(cors());

app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    console.log('Proxy request missing URL');
    return res.status(400).send('URL is required');
  }

  console.log(`Proxying request for: ${url}`);

  try {
    const response = await axios.get(url, {
      responseType: 'text',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    console.log('Proxy request successful');
    res.send(response.data);
  } catch (error) {
    console.error('Error fetching URL:', error.message);
    if (error.response) {
        console.error('Response status:', error.response.status);
        res.status(error.response.status).send(error.message);
    } else {
        res.status(500).send('Error fetching URL: ' + error.message);
    }
  }
});

app.listen(port, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
  } else {
    console.log(`Proxy server listening at http://localhost:${port}`);
  }
});
