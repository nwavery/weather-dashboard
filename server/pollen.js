// Pollen proxy.
//
// This is the whole reason the app has a backend: the Google Pollen API needs a
// secret API key, and we never want that key in the browser or the repo. The
// key is read from POLLEN_API_KEY (injected by Cloud Run from Secret Manager).
//
// Guardrails so a public endpoint can't be used to drain the quota/billing:
//   - origin allowlist (ALLOWED_ORIGINS) — only your site may call it
//   - in-memory cache (pollen is a once-daily forecast) — collapses repeat calls
//   - simple per-IP rate limit

const GOOGLE_POLLEN_URL = 'https://pollen.googleapis.com/v1/forecast:lookup';

const CACHE_TTL_MS = Number(process.env.POLLEN_CACHE_TTL_MS || 6 * 60 * 60 * 1000); // 6h
const RATE_LIMIT = Number(process.env.POLLEN_RATE_LIMIT || 60); // requests...
const RATE_WINDOW_MS = Number(process.env.POLLEN_RATE_WINDOW_MS || 60 * 1000); // ...per window

const cache = new Map(); // "lat,lng" -> { expires, body }
const rate = new Map(); // ip -> { count, resetAt }

function allowedOriginHosts() {
  return new Set(
    (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((o) => hostOf(o) || o)
  );
}

function hostOf(value) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

// If ALLOWED_ORIGINS is unset we run "open" (handy for local dev). Once set
// (in production), a request must carry an Origin or Referer on the allowlist.
function originAllowed(req) {
  const allow = allowedOriginHosts();
  if (allow.size === 0) return true;
  const hosts = [req.headers.origin, req.headers.referer]
    .map((v) => v && hostOf(v))
    .filter(Boolean);
  if (hosts.length === 0) return false;
  return hosts.some((h) => allow.has(h));
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = rate.get(ip);
  if (!entry || now > entry.resetAt) {
    rate.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

const UPI_CATEGORIES = ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high'];
function upiCategory(value) {
  return typeof value === 'number' && UPI_CATEGORIES[value] ? UPI_CATEGORIES[value] : 'n/a';
}

function normalizeType(typeInfo) {
  if (!typeInfo) return null;
  const idx = typeInfo.indexInfo;
  if (idx && typeof idx.value === 'number') {
    return {
      value: idx.value,
      category: idx.category || upiCategory(idx.value),
      inSeason: !!typeInfo.inSeason
    };
  }
  return {
    value: null,
    category: typeInfo.inSeason === false ? 'Out of season' : 'n/a',
    inSeason: !!typeInfo.inSeason
  };
}

function normalize(data) {
  const day = data && Array.isArray(data.dailyInfo) ? data.dailyInfo[0] : null;
  const types = day && Array.isArray(day.pollenTypeInfo) ? day.pollenTypeInfo : [];
  const byCode = {};
  for (const t of types) if (t && t.code) byCode[t.code] = t;
  return {
    tree: normalizeType(byCode.TREE),
    grass: normalizeType(byCode.GRASS),
    weed: normalizeType(byCode.WEED),
    regionCode: data?.regionCode || null
  };
}

export async function pollenHandler(req, res) {
  const apiKey = process.env.POLLEN_API_KEY;
  if (!apiKey) {
    return res
      .status(503)
      .json({ error: 'pollen_not_configured', message: 'Pollen API key is not configured on the server.' });
  }
  if (!originAllowed(req)) {
    return res.status(403).json({ error: 'forbidden_origin' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'invalid_coordinates' });
  }

  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    res.set('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
    res.set('X-Cache', 'HIT');
    return res.json(hit.body);
  }

  const url =
    `${GOOGLE_POLLEN_URL}?key=${encodeURIComponent(apiKey)}` +
    `&location.latitude=${lat}&location.longitude=${lng}&days=1&plantsDescription=false`;

  try {
    const upstream = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!upstream.ok) {
      let detail = `${upstream.status}`;
      try {
        const e = await upstream.json();
        detail = e?.error?.message || detail;
      } catch {
        /* ignore */
      }
      // Map all upstream failures to 502 and never echo the key back.
      return res
        .status(502)
        .json({ error: 'upstream_error', message: String(detail).split(apiKey).join('***') });
    }
    const data = await upstream.json();
    const body = normalize(data);
    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, body });
    res.set('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
    res.set('X-Cache', 'MISS');
    return res.json(body);
  } catch {
    return res.status(502).json({ error: 'upstream_unreachable', message: 'Could not reach the pollen provider.' });
  }
}
