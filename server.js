const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const VIEWS_DIR = path.join(__dirname, 'views');
const ALLOW_DB_VIEWER = process.env.ALLOW_DB_VIEWER === 'true';

const VIEW_ROUTES = {
  landing: 'landing.html',
  dashboard: 'dashboard.html',
  home: 'home.html',
  journal: 'journal.html',
  message: 'message.html'
};

// Serve static assets from /public first (styles, scripts, assets)
app.use('/public', express.static(PUBLIC_DIR));
app.use(express.static(PUBLIC_DIR));

// Hide database viewer unless explicitly enabled for local development.
app.use((req, res, next) => {
  if (!ALLOW_DB_VIEWER && (req.path === '/db' || req.path === '/db.html')) {
    return res.status(404).send('Not found');
  }

  return next();
});

// Then serve view files (html) from /views
app.use(express.static(VIEWS_DIR));

function sendView(res, fileName) {
  return res.sendFile(path.join(VIEWS_DIR, fileName));
}

// Root route -> landing.html
app.get('/', (req, res) => {
  return sendView(res, VIEW_ROUTES.landing);
});

Object.entries(VIEW_ROUTES).forEach(([route, fileName]) => {
  if (route === 'landing') {
    return;
  }

  app.get(`/${route}`, (req, res) => {
    return sendView(res, fileName);
  });

  app.get(`/${fileName}`, (req, res) => {
    return sendView(res, fileName);
  });
});

app.get('/db', (req, res) => {
  if (!ALLOW_DB_VIEWER) {
    return res.status(404).send('Not found');
  }

  return sendView(res, 'db.html');
});

app.get('/db.html', (req, res) => {
  if (!ALLOW_DB_VIEWER) {
    return res.status(404).send('Not found');
  }

  return sendView(res, 'db.html');
});

// Fallback for unknown routes: try to serve a view file if it exists
app.get('/:page', (req, res, next) => {
  const pageName = req.params.page;

  if (!ALLOW_DB_VIEWER && (pageName === 'db' || pageName === 'db.html')) {
    return res.status(404).send('Not found');
  }

  const htmlCandidate = path.join(VIEWS_DIR, `${pageName}.html`);
  const rawCandidate = path.join(VIEWS_DIR, pageName);

  if (fs.existsSync(htmlCandidate)) {
    return res.sendFile(htmlCandidate);
  }

  if (fs.existsSync(rawCandidate)) {
    return res.sendFile(rawCandidate);
  }

  return next();
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`MoodBloom server running on http://localhost:${PORT}`);
});
