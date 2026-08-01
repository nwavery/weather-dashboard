// Offline shell for the always-on display.
//
// The failure this exists to fix: a kiosk that has been running for weeks
// reloads (nightly auto-update, a TV power-cycle, a Wi-Fi hiccup) and the
// network isn't there for those few seconds — so the browser shows its own
// "can't reach this site" page and the wall display is dead until someone
// notices. With a cached shell it renders instead: clock ticking, cards in
// their retrying state, and it fills in the moment the network returns.
//
// Deliberately narrow: ONLY the app shell and third-party static assets are
// cached. Every weather/air/pollen/alert/radar call goes straight to the
// network, so a card can never quietly show yesterday's temperature as if it
// were current — the app's own last-good-value logic already handles a failed
// refresh, and it knows how stale its data is. This worker doesn't.

const VERSION = 'v1';
const SHELL = `sg-shell-${VERSION}`; // our HTML + hashed build assets
const VENDOR = `sg-vendor-${VERSION}`; // fonts & icon CSS from third-party CDNs
const CACHES = new Set([SHELL, VENDOR]);

// Third-party hosts serving static, versioned assets. Everything not listed
// here (and every /api/ path) bypasses the worker entirely.
const VENDOR_HOSTS = new Set([
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'openweathermap.org'
]);

const ASSET_RE = /\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g;
const STATIC_RE = /\.(?:js|css|png|jpe?g|svg|webp|woff2?|ttf|ico|webmanifest)$/;

// Cache the shell from a fresh index.html: store the HTML under a single "/"
// key (matching the server's SPA fallback), add any build assets we don't
// already have, and drop assets from previous deploys so the cache doesn't
// accumulate a bundle per release.
async function cacheShell(cache, res) {
  const html = await res.clone().text();
  await cache.put('/', res.clone());

  const wanted = new Set(html.match(ASSET_RE) || []);
  await Promise.all(
    [...wanted].map(async (path) => {
      if (await cache.match(path)) return;
      await cache.add(path).catch(() => {
        /* a missing asset shouldn't fail the whole install */
      });
    })
  );

  for (const req of await cache.keys()) {
    const { pathname } = new URL(req.url);
    if (pathname.startsWith('/assets/') && !wanted.has(pathname)) await cache.delete(req);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL);
        const res = await fetch('/', { cache: 'reload' });
        if (res.ok) await cacheShell(cache, res);
      } catch {
        /* offline at install time — runtime caching will fill in later */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('sg-') && !CACHES.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// Network-first, falling back to the cached shell. Also refreshes the cache in
// the background so a new deploy is picked up on the next load.
async function shellFirst(event, req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) event.waitUntil(cacheShell(cache, res.clone()).catch(() => {}));
    return res;
  } catch (err) {
    const hit = await cache.match('/');
    if (hit) return hit;
    throw err;
  }
}

// Cache-first. Build assets are content-hashed and third-party CDN URLs are
// versioned, so a hit is always valid; unhashed files (favicon, icons) refresh
// when VERSION is bumped.
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // Opaque (no-cors) responses have status 0 — still worth storing, since
  // that's how the browser requests cross-origin stylesheets and fonts.
  if (res && (res.ok || res.type === 'opaque')) {
    await cache.put(req, res.clone()).catch(() => {
      /* quota — serve it anyway */
    });
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Live data and the health check are never cached.
    if (url.pathname.startsWith('/api/')) return;

    // Navigations are handled first and unconditionally. A refresh — which is
    // how the kiosk picks up a deploy, and the exact moment we're here to
    // survive — carries cache mode 'reload', so it must not fall into the
    // cache-busting bypass below. shellFirst still tries the network first, so
    // a reload with a working connection behaves like a normal one.
    if (req.mode === 'navigate') {
      event.respondWith(shellFirst(event, req));
      return;
    }

    // The nightly deploy check (autoReload.js) fetches "/" with cache:
    // 'no-store' to read the live bundle hash. It must reach the network or
    // the kiosk would compare itself against its own cached HTML and never
    // update.
    //
    // Only 'no-store' — deliberately NOT 'reload'. A refresh propagates cache
    // mode 'reload' to the page's subresources, so bypassing on it would send
    // every build asset to the network during exactly the reload we're trying
    // to survive. Build assets are content-hashed, so answering a hard refresh
    // from cache can't serve stale code: a new deploy has new filenames.
    if (req.cache === 'no-store') return;

    if (url.pathname === '/') {
      event.respondWith(shellFirst(event, req));
      return;
    }
    if (url.pathname === '/sw.js') return; // never let the worker cache itself
    if (url.pathname.startsWith('/assets/') || STATIC_RE.test(url.pathname)) {
      event.respondWith(cacheFirst(req, SHELL));
    }
    return;
  }

  if (VENDOR_HOSTS.has(url.hostname)) event.respondWith(cacheFirst(req, VENDOR));
});
