// Kiosk auto-update: an always-on wall display refreshes its DATA every 10
// minutes but never re-loads the app CODE, so deploys don't reach it until
// someone walks over and reloads. In kiosk contexts (see runtime.js) we check
// for a new bundle periodically and reload during the quiet pre-dawn window.
//
// Plain desktop tabs are deliberately left alone: a reload exits fullscreen,
// and the Fullscreen API can't re-enter without a user gesture.
import { isKioskContext } from './runtime.js';

const CHECK_MS_DEFAULT = 60 * 60 * 1000; // hourly
const QUIET_START = 3; // 3 AM local…
const QUIET_END = 5; // …to 5 AM
const WAS_FULLSCREEN_KEY = 'sgWasFullscreen';

function currentBundle() {
  const s = [...document.querySelectorAll('script[src]')].find((el) => /index-[\w-]+\.js/.test(el.src));
  return s ? s.src.match(/index-[\w-]+\.js/)[0] : null;
}

async function deployedBundle() {
  const res = await fetch('/', { cache: 'no-store' });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/index-[\w-]+\.js/);
  return m ? m[0] : null;
}

function checkInterval() {
  try {
    const v = parseInt(new URLSearchParams(window.location.search).get('reloadCheckMs'), 10);
    if (Number.isFinite(v) && v >= 1000) return v;
  } catch {
    /* ignore */
  }
  return CHECK_MS_DEFAULT;
}

export function startAutoReload() {
  // After an auto-reload, try to restore page fullscreen. Strict browsers
  // reject this without a user gesture (harmless); kiosk/TV shells either
  // allow it or were never page-fullscreen to begin with.
  try {
    if (sessionStorage.getItem(WAS_FULLSCREEN_KEY)) {
      sessionStorage.removeItem(WAS_FULLSCREEN_KEY);
      const el = document.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
    }
  } catch {
    /* ignore */
  }

  if (!isKioskContext()) return false;

  const mine = currentBundle();
  if (!mine) return false;

  async function tick() {
    const hour = new Date().getHours();
    if (hour < QUIET_START || hour >= QUIET_END) return;
    try {
      const live = await deployedBundle();
      if (live && live !== mine) {
        try {
          if (document.fullscreenElement) sessionStorage.setItem(WAS_FULLSCREEN_KEY, '1');
        } catch {
          /* ignore */
        }
        window.location.reload();
      }
    } catch {
      /* transient network failure — try again next tick */
    }
  }

  setInterval(tick, checkInterval());
  return true;
}
