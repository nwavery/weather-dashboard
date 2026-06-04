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

// Content-hashed build assets (dist/assets/*) are immutable — cache hard.
app.use(
  '/assets',
  express.static(path.join(DIST, 'assets'), { index: false, immutable: true, maxAge: '1y' })
);

// Other static files (favicon, etc.) — modest cache.
app.use(express.static(DIST, { index: false, maxAge: '1h' }));

// SPA fallback. index.html must always revalidate so a new deploy is picked up
// on the next normal reload (no hard-refresh needed); the hashed assets it
// references are immutable, so this stays cheap.
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'), {
    cacheControl: false,
    headers: { 'Cache-Control': 'no-cache' }
  });
});

app.listen(PORT, () => {
  console.log(`weather-dashboard listening on :${PORT}`);
});
