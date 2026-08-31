const express = require('express');
const path = require('path');

const app = express();

const CLIENT_DIST = path.join(__dirname, 'frontend', 'dist');
const INDEX_HTML = path.join(CLIENT_DIST, 'index.html');

const normalizeBasePath = (value) => {
  if (!value || value === '/') return '/';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
};

const BASE_PATH = normalizeBasePath(process.env.VITE_BASE_PATH || process.env.BASE_PATH || '/');
const sendIndex = (req, res) => {
  res.sendFile(INDEX_HTML);
};
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

app.use(express.static(CLIENT_DIST));

if (BASE_PATH !== '/') {
  app.use(BASE_PATH, express.static(CLIENT_DIST));
  app.get(BASE_PATH, sendIndex);
  app.get(new RegExp(`^${escapeRegExp(BASE_PATH)}(?:/.*)?$`), sendIndex);
}

app.get('/', sendIndex);
app.get(/.*/, sendIndex);


if (require.main === module) {
  const PORT = Number(process.env.FRONTEND_PORT || 2848);
  app.listen(PORT, () => {
    console.log(`Frontend server running on port ${PORT}`);
    console.log(`Serving from ${CLIENT_DIST}`);
    console.log(`Base path ${BASE_PATH}`);
  });
}

module.exports = app;
``