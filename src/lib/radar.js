// Global "raining now" from live weather radar (RainViewer public API — keyless,
// CORS-enabled). Open-Meteo is a forecast model and misses/mistimes localized
// precip; for US points we trust NWS station observations, but elsewhere there's
// no ground truth. RainViewer's radar mosaic covers most of the populated world,
// so when there's an echo over a card's coordinates we can surface precip the
// model missed. Browser-only — it samples a radar tile pixel via canvas; any
// failure (tainted canvas, no echo, no DOM, network) resolves to null, leaving
// the model/observation untouched. Radar can't reliably tell rain from snow, so
// the caller decides type by temperature; and "no echo" can also mean "no radar
// coverage", so radar only ADDS precip, never suppresses it.

const MAPS_TTL_MS = 4 * 60 * 1000; // the frame list refreshes ~every 10 min
const RADAR_Z = 7; // ~1 km/pixel at 256-px tiles — matches radar's native resolution
const ALPHA_ON = 40; // pixel alpha above this counts as a radar echo
let mapsCache = null;

// Latest radar frame { host, path, time } from the public maps index, cached.
async function latestFrame() {
  if (mapsCache && mapsCache.expires > Date.now()) return mapsCache.data;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', { signal: ctrl.signal });
    const meta = await res.json();
    const past = meta?.radar?.past || [];
    const frame = past[past.length - 1];
    const data = frame && meta.host ? { host: meta.host, path: frame.path, time: frame.time } : null;
    mapsCache = { expires: Date.now() + MAPS_TTL_MS, data };
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Read a 3×3 RGBA neighbourhood around (px,py) of a tile image, or null on any
// failure. A small neighbourhood absorbs sub-pixel rounding at the coordinate.
function sampleTile(url, px, py) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let settled = false;
    const done = (v) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const timer = setTimeout(() => done(null), 8000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const x0 = Math.max(0, Math.min(img.width - 3, px - 1));
        const y0 = Math.max(0, Math.min(img.height - 3, py - 1));
        done(ctx.getImageData(x0, y0, 3, 3).data);
      } catch {
        done(null); // tainted canvas, etc.
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    img.src = url;
  });
}

// Radar echo over a location as { precip, intensity, observedAt }, or null when
// radar is unavailable. precip:false means "no echo here" (which may also be "no
// coverage", so the caller must not treat it as 'dry').
export async function fetchRadar(location) {
  const { latitude, longitude } = location;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (typeof document === 'undefined') return null; // non-browser context
  const frame = await latestFrame();
  if (!frame) return null;

  // Web-Mercator (slippy-map) tile + pixel for the coordinate.
  const lat = Math.max(-85, Math.min(85, latitude));
  const n = 2 ** RADAR_Z;
  const fx = ((longitude + 180) / 360) * n;
  const latR = (lat * Math.PI) / 180;
  const fy = ((1 - Math.asinh(Math.tan(latR)) / Math.PI) / 2) * n;
  const xt = Math.floor(fx);
  const yt = Math.floor(fy);
  const px = Math.floor((fx - xt) * 256);
  const py = Math.floor((fy - yt) * 256);

  const url = `${frame.host}${frame.path}/256/${RADAR_Z}/${xt}/${yt}/4/0_1.png`; // color 4, no-smooth, +snow
  const data = await sampleTile(url, px, py);
  if (!data) return null;

  let filled = 0;
  let maxA = 0;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a > ALPHA_ON) {
      filled++;
      if (a > maxA) maxA = a;
    }
  }
  const observedAt = new Date(frame.time * 1000).toISOString();
  if (filled === 0) return { precip: false, observedAt };
  // Broad, solid echo over the point → moderate; a sliver → light.
  const intensity = filled >= 6 && maxA > 160 ? 'moderate' : 'light';
  return { precip: true, intensity, observedAt };
}

// WMO code for a radar echo, using temperature to tell rain from snow. Capped at
// light/moderate — a single coarse pixel shouldn't claim a violent downpour.
export function radarToCode(radar, tempF) {
  if (!radar?.precip) return null;
  const snow = typeof tempF === 'number' && tempF <= 34;
  if (radar.intensity === 'moderate') return snow ? 73 : 63;
  return snow ? 71 : 61;
}
