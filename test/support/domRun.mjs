// Mounts the whole App in jsdom for one URL, lets its effects run, and prints
// what they did as JSON. Unlike renderViews.mjs (first server render only),
// this runs useEffect: the ?city= pin, rotation, the canvases' frame loops.
//
//   TZ=UTC node test/support/domRun.mjs '?view=card&city=Pandora' [alerts] [tap]
//
// `alerts` is how many NWS alerts the stubbed API returns for a real city.
// `tap` clicks the first alert once the page has settled. `drag-click` drags
// the mouse 50px from the first card's rename button and releases it there,
// then clicks it, the way a tap that wobbled arrives.
// One page per process: several App modules read the URL once at import.
//
// The clock is frozen at 05:00 UTC on 12 Nov 2026, night in the US, so a clear
// real city draws its star canvas. requestAnimationFrame is a queue the
// harness runs a frame at a time: a canvas in a continuous loop asks for one
// new frame per frame, a still one asks for none.
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXED = Date.parse('2026-11-12T05:00:00Z');
const [search = '', alertCount = '0', action = ''] = process.argv.slice(2);

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  url: `https://skyglance.test/${search}`
});
const { window } = dom;

// The browser surface the app touches, made global before React loads.
for (const k of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'Node', 'Event', 'CustomEvent', 'getComputedStyle']) {
  Object.defineProperty(globalThis, k, { value: k === 'window' ? window : window[k], configurable: true, writable: true });
}
let rafQueue = [];
let rafRequests = 0;
window.requestAnimationFrame = globalThis.requestAnimationFrame = (cb) => {
  rafRequests++;
  rafQueue.push(cb);
  return rafQueue.length;
};
window.cancelAnimationFrame = globalThis.cancelAnimationFrame = () => {};
class StubResizeObserver {
  observe() {}
  disconnect() {}
}
window.ResizeObserver = globalThis.ResizeObserver = StubResizeObserver;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
// A 2D context that accepts every call; the frame loops are what's measured.
const ctx = new Proxy(
  {},
  {
    get: (_t, p) =>
      p === 'getImageData'
        ? () => ({ data: new Uint8ClampedArray(36) })
        : p === 'measureText'
          ? () => ({ width: 0 })
          : p === 'createLinearGradient' || p === 'createRadialGradient'
            ? () => ({ addColorStop() {} })
            : () => {},
    set: () => true
  }
);
window.HTMLCanvasElement.prototype.getContext = () => ctx;

const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...a) {
    super(...(a.length ? a : [FIXED]));
  }
  static now() {
    return FIXED;
  }
};
let seed = 7;
Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// A clear, calm night everywhere, and `alertCount` NWS alerts.
function forecast() {
  const hours = Array.from({ length: 48 }, (_, i) => new Date(FIXED + (i - 6) * 3600e3).toISOString().slice(0, 13) + ':00');
  const days = Array.from({ length: 6 }, (_, i) => new Date(FIXED + i * 86400e3).toISOString().slice(0, 10));
  return {
    current: { temperature_2m: 52, relative_humidity_2m: 40, apparent_temperature: 50, weather_code: 0, wind_speed_10m: 4, wind_direction_10m: 180, wind_gusts_10m: 8, uv_index: 0, dew_point_2m: 30, precipitation: 0, cloud_cover: 0 },
    hourly: { time: hours, temperature_2m: hours.map(() => 50), weather_code: hours.map(() => 0), precipitation: hours.map(() => 0), cloud_cover: hours.map(() => 0), precipitation_probability: hours.map(() => 0) },
    minutely_15: { time: [], precipitation: [], weather_code: [] },
    daily: { time: days, temperature_2m_max: days.map(() => 60), temperature_2m_min: days.map(() => 40), temperature_2m_mean: days.map(() => 50), weather_code: days.map(() => 0) }
  };
}
const ALERT_TEXT = [
  ['Flood Warning', 'Flood Warning issued November 11 at 9:41PM CST until November 13 at 6:00AM CST by NWS Norman OK for the North Canadian River near Oklahoma City and the Deep Fork near Arcadia'],
  ['Wind Advisory', 'Wind Advisory issued November 11 at 8:02PM CST until November 12 at 9:00PM CST by NWS Norman OK, south winds 25 to 35 mph with gusts up to 50 mph expected'],
  ['Red Flag Warning', 'Red Flag Warning issued November 11 at 3:00PM CST until November 12 at 8:00PM CST by NWS Norman OK']
];
globalThis.fetch = window.fetch = async (url) => {
  const u = new URL(String(url), 'https://skyglance.test');
  const p = u.pathname;
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
  if (p === '/v1/forecast') return json(forecast());
  if (p === '/v1/air-quality') return json({ current: { us_aqi: 30, pm2_5: 5, ozone: 40 } });
  if (p === '/v1/archive') return json({ daily: { time: ['2020-11-12'], temperature_2m_mean: [48] } });
  if (p === '/v1/search') return json({ results: [{ name: u.searchParams.get('name'), latitude: 30.27, longitude: -97.74, timezone: 'America/Chicago', admin1: 'Texas', country_code: 'US' }] });
  if (p === '/alerts/active') {
    return json({
      features: ALERT_TEXT.slice(0, Number(alertCount)).map(([event, headline], i) => ({
        properties: { id: `a${i}`, event, headline, severity: 'Moderate', onset: new Date(FIXED - 3600e3).toISOString(), ends: new Date(FIXED + 30 * 3600e3).toISOString() }
      }))
    });
  }
  return json({}, 404); // NWS points, radar, pollen, IP lookup: not needed
};

const { createServer } = await import('vite');
const server = await createServer({
  root: ROOT,
  configFile: false,
  logLevel: 'silent',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  esbuild: { jsx: 'automatic' }
});
const settle = async (ms) => {
  const end = RealDate.now() + ms;
  while (RealDate.now() < end) await new Promise((r) => setTimeout(r, 5));
};
let out;
try {
  const { createRoot } = await import('react-dom/client');
  const { createElement } = await import('react');
  const { default: App } = await server.ssrLoadModule('/src/App.jsx');
  const { IS_CARD_VIEW } = await server.ssrLoadModule('/src/lib/view.js');
  if (IS_CARD_VIEW) document.documentElement.classList.add('card-view');
  createRoot(document.getElementById('root')).render(createElement(App));
  await settle(400);
  // Let every canvas draw its first frames, then count what keeps asking.
  let t = 0;
  const frame = () => {
    const q = rafQueue;
    rafQueue = [];
    for (const cb of q) cb((t += 16));
  };
  for (let i = 0; i < 3; i++) frame();
  const before = rafRequests;
  for (let i = 0; i < 10; i++) frame();
  const continuous = rafRequests - before;
  const toggle = () => document.querySelector('.alert-toggle')?.getAttribute('aria-expanded') ?? null;
  const expandedBefore = toggle();
  if (action === 'tap') {
    document.querySelector('.alert-toggle')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle(50);
  }
  let renameOpened = null;
  if (action === 'drag-click') {
    // jsdom has no PointerEvent: a MouseEvent carrying the pointer fields.
    const pointer = (type, y) => {
      const e = new window.MouseEvent(type, { bubbles: true, clientY: y, button: 0 });
      Object.defineProperty(e, 'pointerType', { value: 'mouse' });
      Object.defineProperty(e, 'pointerId', { value: 1 });
      return e;
    };
    const btn = document.querySelector('.edit-location-btn');
    btn.dispatchEvent(pointer('pointerdown', 300));
    window.dispatchEvent(pointer('pointermove', 250));
    window.dispatchEvent(pointer('pointerup', 250));
    btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle(50);
    renameOpened = !!document.querySelector('.location-input');
  }
  const cards = [...document.querySelectorAll('.card')];
  out = {
    expandedBefore,
    expandedAfter: toggle(),
    renameOpened,
    cards: cards.length,
    names: cards.map((c) => c.querySelector('.location-name')?.textContent),
    canvases: document.querySelectorAll('canvas').length,
    rafRequestsOver10Frames: continuous,
    alerts: document.querySelectorAll('.weather-alert').length,
    alertHeadlines: [...document.querySelectorAll('.alert-headline')].map((e) => e.textContent),
    html: document.getElementById('root').innerHTML
  };
} finally {
  await server.close();
}
process.stdout.write(JSON.stringify(out));
process.exit(0);
