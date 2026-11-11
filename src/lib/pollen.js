// Pollen comes from our own backend (/api/pollen), which holds the Google key.
// The browser never sees the key. Returns { tree, grass, weed, regionCode },
// each pollen type being { value, category, inSeason } or null.
//
// The default URL is relative, which only works in a page served by our own
// server. Anywhere else pass `baseUrl` (e.g. https://skyglance.web.app, whose
// proxy then wants an allowlisted Origin or Referer in `headers`), or a
// `fetch` that answers /api/pollen itself.
import { fetchWithTimeout, baseOf, initFor } from './fetchTimeout.js';

export async function fetchPollen(location, opts) {
  const res = await fetchWithTimeout(
    `${baseOf(opts, '')}/api/pollen?lat=${location.latitude}&lng=${location.longitude}`,
    initFor(opts)
  );
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) code = body.error;
    } catch {
      /* ignore */
    }
    const err = new Error(code);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
