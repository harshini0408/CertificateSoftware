const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');

const app = express();

const CLIENT_DIST = path.join(__dirname, 'frontend', 'dist');
const INDEX_HTML = path.join(CLIENT_DIST, 'index.html');

const BASE_PATH = (process.env.VITE_BASE_PATH || process.env.BASE_PATH || '/CreditPoints').replace(/\/+$/, '') || '/';
const BACKEND_ORIGIN = (
  process.env.BACKEND_ORIGIN ||
  process.env.VITE_DEV_BACKEND_ORIGIN ||
  'http://127.0.0.1:2849'
).replace(/\/+$/, '');

const backendPrefixes = [
  '/admin',
  '/affairs',
  '/api',
  '/auth',
  '/certificate-config',
  '/clubs',
  '/coordinator',
  '/dept',
  '/guest',
  '/health',
  '/hod',
  '/image-templates',
  '/principal',
  '/role-presets',
  '/static',
  '/storage',
  '/student',
  '/students',
  '/templates',
  '/tutor',
  '/verify',
];

const shouldProxy = (url) => backendPrefixes.some((prefix) => (
  url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`)
));

const stripBasePath = (url) => {
  if (BASE_PATH === '/') return url;
  if (url === BASE_PATH) return '/';
  if (url.startsWith(`${BASE_PATH}/`)) return url.slice(BASE_PATH.length) || '/';
  return url;
};

const requestPath = (req) => stripBasePath(req.path);
const requestUrl = (req) => stripBasePath(req.originalUrl);
const isBackendRequest = (req) => shouldProxy(requestPath(req));

const proxyToBackend = (req, res) => {
  const target = new URL(requestUrl(req), BACKEND_ORIGIN);
  const client = target.protocol === 'https:' ? https : http;
  const headers = {
    ...req.headers,
    host: target.host,
  };

  const proxyReq = client.request(
    target,
    {
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (error) => {
    console.error(`Backend proxy error for ${req.method} ${req.originalUrl}:`, error.message);
    if (!res.headersSent) {
      res.status(502).json({ detail: 'Backend unavailable' });
    } else {
      res.end();
    }
  });

  req.pipe(proxyReq);
};

app.use((req, res, next) => {
  if (isBackendRequest(req)) {
    proxyToBackend(req, res);
    return;
  }
  next();
});

app.use(BASE_PATH === '/' ? '/' : BASE_PATH, express.static(CLIENT_DIST));
app.get(/.*/, (req, res) => res.sendFile(INDEX_HTML));
if (require.main === module) {
  const PORT = Number(process.env.FRONTEND_PORT || 2848);
  app.listen(PORT, () => {
    console.log(`Frontend server running on port ${PORT}`);
    console.log(`Serving from ${CLIENT_DIST}`);
    console.log(`Base path ${BASE_PATH}`);
  });
}

module.exports = app;
