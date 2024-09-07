import clear from 'console-clear';
import cors from 'cors';
import express, { json } from 'express';
import https from 'https';
import fetch from 'node-fetch';
const app = express();
const PORT = 3000;

const BASE_URL = 'https://api-web.tomarket.ai/tomarket-game/v1/';
const isDevelopment = process.env.NODE_ENV === 'development';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Nonaktifkan verifikasi sertifikat SSL
});

app.use(
  cors({
    origin: '*', // Membolehkan semua origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Metode HTTP yang diperbolehkan
    credentials: true, // Jika kamu ingin mengizinkan kredensial (seperti cookies)
  })
);

// Middleware untuk parsing JSON
app.use(json());

// Fungsi untuk meneruskan request ke API Tomarket
async function forwardRequest(req, res) {
  delete req.headers.host;
  delete req.headers.referer;
  delete req.headers.origin;

  const path = req.originalUrl.replace('/api/', ''); // Ambil path setelah /api/
  const url = `${BASE_URL}${path}`;

  try {
    // Siapkan options untuk fetch
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers, // Tambahkan header dari request client
      },
      body:
        req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined,
      agent: httpsAgent, // Penggunaan agent HTTPS agar SSL diaktifkan
    };

    // Kirim request ke API Tomarket
    const response = await fetch(url, options);
    const responseText = await response.text();

    const data = JSON.parse(responseText);

    // Jika respons sukses, kirim kembali ke client
    if (response.ok) {
      res.status(response.status).json(data);
    } else {
      res.status(response.status).json({
        error: true,
        status: response.status,
        message: response.statusText,
        data,
      });
    }
  } catch (error) {
    // Tangani error ketika forward request
    if (isDevelopment) {
      // Tampilkan error lengkap dalam mode development
      res
        .status(500)
        .json({ error: true, status: 401, message: error.message });
    } else {
      // Tampilkan pesan generik jika bukan mode development
      res.status(500).json({
        error: true,
        status: 401,
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