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
// RainViewer colour scheme 2, "Universal Blue". Pinned because the strong-echo
// test below decodes its exact colours. (Requests for scheme 4 were found to be
// served as Universal Blue anyway, Oct 2026.)
const COLOR_SCHEME = 2;
let mapsCache = null;

// Universal Blue colours for 40 dBZ and up, rain and snow ramps, from
// RainViewer's published table (rainviewer.com/files/rainviewer_api_colors_table.csv).
// None of them appears anywhere below 40 dBZ, and all are fully opaque. Alpha
// alone can't measure this: it saturates at 255 from 15 dBZ. A colour not in
// this set never counts as strong, so a palette change fails toward "dry".
export const STRONG_DBZ = 40;
const STRONG_COLORS = new Set([
  0x0000ff, 0x0002ff, 0x0006ff, 0x0009ff, 0x000cff, 0x000fff, 0x0012ff, 0x0015ff, 0x0018ff, 0x001bff,
  0x001fff, 0x0022ff, 0x0025ff, 0x0028ff, 0x002bff, 0x002fff, 0x0032ff, 0x0035ff, 0x0038ff, 0x003bff,
  0x003fff, 0x00ff00, 0x0242ff, 0x0645ff, 0x0948ff, 0x0c4bff, 0x0f4fff, 0x1252ff, 0x1555ff, 0x1858ff,
  0x1b5bff, 0x1f5fff, 0x2262ff, 0x2565ff, 0x2868ff, 0x2b6bff, 0x2f6fff, 0x5d0000, 0x760000, 0x8f0000,
  0xa80000, 0xc10000, 0xcd0d00, 0xd91b00, 0xe62800, 0xf23600, 0xff4400, 0xff4eff, 0xff58ff, 0xff62ff,
  0xff6cff, 0xff77ff, 0xff8100, 0xff81ff, 0xff8b00, 0xff8bff, 0xff9500, 0xff95ff, 0xff9f00, 0xff9fff,
  0xffaa00, 0xffaaff, 0xffffff
]);

// Summarise a 3×3 RGBA patch as { precip, intensity, strong } (pure; testable).
export function summarizeEcho(data) {
  let filled = 0;
  let maxA = 0;
  let strong = false;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const a = data[i + 3];
    if (a > ALPHA_ON) {
      filled++;
      if (a > maxA) maxA = a;
    }
    if (a === 255 && STRONG_COLORS.has((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])) strong = true;
  }
  if (filled === 0) return { precip: false, strong: false };
  // Broad, solid echo over the point → moderate; a sliver → light.
  const intensity = filled >= 6 && maxA > 160 ? 'moderate' : 'light';
  return { precip: true, intensity, strong };
}

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
  // Clamp to valid tile indices so the antimeridian (lon ±180 → fx === n) and the
  // poles don't ask for an out-of-range tile that 404s.
  const xt = Math.min(Math.max(Math.floor(fx), 0), n - 1);
  const yt = Math.min(Math.max(Math.floor(fy), 0), n - 1);
  const px = Math.floor((fx - xt) * 256);
  const py = Math.floor((fy - yt) * 256);

  const url = `${frame.host}${frame.path}/256/${RADAR_Z}/${xt}/${yt}/${COLOR_SCHEME}/0_1.png`; // no-smooth, +snow
  const data = await sampleTile(url, px, py);
  if (!data) return null;
  return { ...summarizeEcho(data), observedAt: new Date(frame.time * 1000).toISOString() };
}

// WMO code for a radar echo, using temperature to tell rain from snow. Capped at
// light/moderate — a single coarse pixel shouldn't claim a violent downpour.
//
// `recentDry`: the station's last report, though too old for the full override,
// said dry within the last few hours. Then only a strong echo (40+ dBZ) may add
// rain. Backtested on 45 days of Oklahoma City stations and archived radar
// (Sep-Oct 2026): a weaker echo after a dry report was dry 90-92% of the time,
// and only around 40 dBZ did rain become likely. That rule cut false "rain"
// calls in this situation from 92% wrong to 94% right.
export function radarToCode(radar, tempF, { recentDry = false } = {}) {
  if (!radar?.precip) return null;
  if (recentDry && !radar.strong) return null;
  const snow = typeof tempF === 'number' && tempF <= 34;
  if (radar.intensity === 'moderate') return snow ? 73 : 63;
  return snow ? 71 : 61;
}
