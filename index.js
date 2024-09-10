#!/usr/bin/env node

const clear = require('console-clear');
const cors = require('cors');
const express = require('express');
const https = require('https');
const axios = require('axios');
const app = express();
const PORT = 3000;
const BASE_URL = 'https://api-web.tomarket.ai/tomarket-game/v1/';
const isDevelopment = process.env.NODE_ENV === 'development';
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Nonaktifkan verifikasi sertifikat SSL
});

app.use(
  cors({
    origin: '*',
    // Membolehkan semua origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    // Metode HTTP yang diperbolehkan
    credentials: true, // Jika kamu ingin mengizinkan kredensial (seperti cookies)
  })
);

// Middleware untuk parsing JSON
app.use(express.json());

// Fungsi untuk meneruskan request ke API Tomarket
async function forwardRequest(req, res) {
  delete req.headers.host;
  delete req.headers.referer;
  delete req.headers.origin;
  const path = req.originalUrl.replace('/api/', ''); // Ambil path setelah /api/
  const url = `${BASE_URL}${path}`;

  // log semua method, headers, query string, serta body (optional)
  console.log(`[${req.method}] ${url}`);
  console.log(`Headers: ${JSON.stringify(req.headers)}`);
  console.log(`Query String: ${req.querystring}`);
  console.log(`Body: ${JSON.stringify(req.body)}`);
  console.log('-------------------------------');

  try {
    // Siapkan options untuk axios
    const options = {
      method: req.method,
      url, // URL yang dikirim ke Axios
      headers: {
        'Content-Type': 'application/json',
        ...req.headers, // Tambahkan header dari request client
      },
      data: req.method !== 'GET' && req.body ? req.body : undefined, // Hanya tambahkan body untuk POST/PUT
      // httpsAgent, // Tambahkan httpsAgent untuk SSL
    };

    // Kirim request ke API Tomarket menggunakan axios
    const response = await axios(options);

    // log response text
    console.log('Response:\n' + JSON.stringify(response.data));
    console.log('-------------------------------');

    // Kirimkan response kembali ke client
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(error);

    // Tangani error ketika forward request
    if (isDevelopment) {
      res.status(500).json({
        error: true,
        status: 999,
        message: error.message,
        data: error.response ? error.response.data : null, // Tambahkan data error jika ada
      });
    } else {
      res.status(500).json({
        error: true,
        status: 999,
        message: 'Failed connecting to Tomarket server',
      });
    }
  }
}

// Tangani semua request yang diawali dengan /api/
app.all('/api/*', forwardRequest);

// Jalankan server
app.listen(PORT, () => {
  clear();
  console.log(`Server is running on http://localhost:${PORT}`);
});
module.exports = app;
