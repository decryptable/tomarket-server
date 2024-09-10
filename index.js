#!/usr/bin/env node

const clear = require('console-clear');
const cors = require('cors');
const express = require('express');
const https = require('https');
const fs = require('fs');
const forge = require('node-forge');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = 3000;
const BASE_URL = 'https://api-web.tomarket.ai/tomarket-game/v1/';
const isDevelopment = process.env.NODE_ENV === 'development';

const sslDir = path.join(__dirname, 'ssl');
const keyPath = path.join(sslDir, 'private.key');
const certPath = path.join(sslDir, 'certificate.crt');

// Fungsi untuk generate sertifikat self-signed
function generateSelfSignedCertificate() {
  const pki = forge.pki;

  // Generate kunci privat dan sertifikat self-signed
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1); // Berlaku selama 1 tahun

  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'countryName', value: 'US' },
    { shortName: 'ST', value: 'California' },
    { name: 'localityName', value: 'San Francisco' },
    { name: 'organizationName', value: 'My Company' },
    { shortName: 'OU', value: 'Test' },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true,
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true,
    },
    {
      name: 'subjectAltName',
      altNames: [{ type: 2, value: 'localhost' }],
    },
  ]);

  // Sign the certificate using the private key
  cert.sign(keys.privateKey);

  // Convert ke format PEM
  const privateKeyPem = pki.privateKeyToPem(keys.privateKey);
  const certPem = pki.certificateToPem(cert);

  return { privateKeyPem, certPem };
}

// Jika sertifikat tidak ada, generate sertifikat baru
if (!fs.existsSync(sslDir)) {
  fs.mkdirSync(sslDir); // Buat folder ssl jika belum ada
}

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  const { privateKeyPem, certPem } = generateSelfSignedCertificate();

  // Simpan kunci privat dan sertifikat ke file
  fs.writeFileSync(keyPath, privateKeyPem);
  fs.writeFileSync(certPath, certPem);

  console.log('Generated self-signed SSL certificate.');
}

// Baca sertifikat SSL yang dihasilkan atau yang sudah ada
const privateKey = fs.readFileSync(keyPath, 'utf8');
const certificate = fs.readFileSync(certPath, 'utf8');

const credentials = { key: privateKey, cert: certificate };

// Agent HTTPS untuk menangani SSL
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Nonaktifkan verifikasi sertifikat SSL
});

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
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

  console.log(`[${req.method}] ${url}`);
  console.log(`Headers: ${JSON.stringify(req.headers)}`);
  console.log(`Query String: ${req.querystring}`);
  console.log(`Body: ${JSON.stringify(req.body)}`);
  console.log('-------------------------------');

  try {
    const options = {
      method: req.method,
      url,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers,
      },
      data: req.method !== 'GET' && req.body ? req.body : undefined,
      httpsAgent,
    };

    const response = await axios(options);

    console.log('Response:\n' + JSON.stringify(response.data));
    console.log('-------------------------------');

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(error);

    if (isDevelopment) {
      res.status(500).json({
        error: true,
        status: 999,
        message: error.message,
        data: error.response ? error.response.data : null,
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

// Jalankan server HTTPS
https.createServer(credentials, app).listen(PORT, () => {
  clear();
  console.log(`Server is running on https://localhost:${PORT}`);
});

module.exports = app;
