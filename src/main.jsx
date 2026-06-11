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

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
