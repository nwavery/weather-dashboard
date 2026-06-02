import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pollenHandler } from './pollen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 8080;

const app = express();
app.disable('x-powered-by');

// Health check. Cloud Run's serving layer reserves /healthz, so expose it
// under /api where requests actually reach the container.
app.get('/api/healthz', (_req, res) => res.json({ ok: true }));

// Pollen proxy — the only endpoint that touches the Google API key.
app.get('/api/pollen', pollenHandler);

// Static built front-end.
app.use(express.static(DIST, { index: false, maxAge: '1h' }));

// SPA fallback: anything not matched above returns index.html.
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`weather-dashboard listening on :${PORT}`);
});
