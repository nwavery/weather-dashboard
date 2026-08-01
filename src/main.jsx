import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { startAutoReload } from './lib/autoReload.js';
import './index.css';

// Ask the browser to treat our site storage as persistent. TV browsers (Fire
// TV Silk especially) evict site data aggressively between launches, which
// wipes saved manual locations and resurrects the IP-located guess. Best
// effort — browsers may ignore it, and the ?city= URL pin remains the
// storage-proof option for kiosks.
try {
  navigator.storage?.persist?.();
} catch {
  /* best effort */
}

// Kiosk-only: pick up new deploys automatically during the pre-dawn quiet
// window (plain tabs are left alone — see autoReload.js for why).
startAutoReload();

// Cache the app shell so a reload without a network (TV power-cycle, Wi-Fi
// hiccup, the nightly auto-update landing a second early) still renders the
// dashboard instead of the browser's error page. Registered after `load` so
// it never competes with the first paint, and only in a real build — a
// service worker in front of the dev server just fights HMR. See public/sw.js
// for what it will and won't cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* unsupported, blocked by policy, or insecure origin — the app is fine without it */
    });
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
