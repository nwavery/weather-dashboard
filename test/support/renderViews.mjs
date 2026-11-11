// Server-renders the whole App for a list of URLs, with the clock frozen and
// no network, and prints { [search]: html } as JSON. Run in its own process
// with TZ=UTC: test/defaultView.test.js uses it to compare today's default
// render with the one main produced (test/fixtures/default-view.json).
//
//   TZ=UTC node test/support/renderViews.mjs '?demo=1' ''
//
// An argument `card:<i>:embed` (or `card:<i>:plain`) renders demo card i on
// its own instead of the App, with or without WeatherCard's `embed`, and
// `fic:<name>:embed` does the same for a fictional city.
//
// Only the first render is captured, the way a server render sees it: no
// effects run, so no fetch, no geolocation, no timers. Run with TZ=UTC: the
// demo data and the clock text are in the process's zone.
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXED = Date.parse('2026-11-11T18:30:00Z');
const searches = process.argv.slice(2);

const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [FIXED]));
  }
  static now() {
    return FIXED;
  }
};
// The rain and snow layers scatter their drops with Math.random while
// rendering. A seeded generator, restarted for every URL, makes that
// repeatable; it also means a change to how many draws a render makes shows
// up as a different render, which is what the comparison is for.
let seed = 1;
Math.random = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
globalThis.fetch = async () => {
  throw new Error('no network in a server render');
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
const out = {};
try {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement } = await import('react');
  for (const search of searches) {
    globalThis.window = { location: { search, href: `https://skyglance.test/${search}` } };
    // Just what components read while rendering (FullscreenButton asks
    // whether the page is already fullscreen).
    globalThis.document = { fullscreenElement: null, fullscreenEnabled: false, documentElement: {} };
    // A working, empty storage, as a browser has: Node has none, and a bare
    // `localStorage` there is a ReferenceError, which would make every render
    // a blocked-storage render. RENDER_STORAGE_THROWS=1 instead makes access
    // throw, the way a frame with blocked third-party storage behaves.
    for (const k of ['localStorage', 'sessionStorage']) {
      const m = new Map();
      const store = {
        getItem: (key) => (m.has(key) ? m.get(key) : null),
        setItem: (key, v) => void m.set(key, String(v)),
        removeItem: (key) => void m.delete(key)
      };
      Object.defineProperty(globalThis, k, { value: store, configurable: true, writable: true });
      Object.defineProperty(globalThis.window, k, { value: store, configurable: true, writable: true });
    }
    if (process.env.RENDER_STORAGE_THROWS === '1') {
      const blocked = {
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
        configurable: true
      };
      for (const target of [globalThis, globalThis.window]) {
        Object.defineProperty(target, 'localStorage', blocked);
        Object.defineProperty(target, 'sessionStorage', blocked);
      }
    }
    // Module-level constants (IS_TV, the ?city= pin) read the URL at import,
    // so every URL gets fresh modules.
    server.moduleGraph.invalidateAll();
    seed = 1;
    const card = /^(card|fic):([^:]+):(embed|plain)$/.exec(search);
    if (card) {
      globalThis.window.location.search = card[1] === 'card' ? '?demo=1' : '';
      const { WeatherCard } = await server.ssrLoadModule('/src/components/WeatherCard.jsx');
      const { UnitsProvider } = await server.ssrLoadModule('/src/context/UnitsContext.jsx');
      const { DEMO_LOCATIONS } = await server.ssrLoadModule('/src/lib/demoData.js');
      const { findFictional } = await server.ssrLoadModule('/src/lib/fictionalCities.js');
      const location = card[1] === 'card' ? DEMO_LOCATIONS[Number(card[2])] : { key: 'current', ...findFictional(card[2]) };
      const el = createElement(WeatherCard, { location, now: new Date(), embed: card[3] === 'embed' });
      out[search] = renderToStaticMarkup(createElement(UnitsProvider, null, el));
      continue;
    }
    const { default: App } = await server.ssrLoadModule('/src/App.jsx');
    out[search] = renderToStaticMarkup(createElement(App));
  }
} finally {
  await server.close();
}
process.stdout.write(JSON.stringify(out, null, 1));
