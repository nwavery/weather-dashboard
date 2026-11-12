// Kiosk auto-update: an always-on wall display refreshes its DATA every few
// minutes but never re-loads the app CODE, so deploys don't reach it until
// someone walks over and reloads. In kiosk contexts (see runtime.js) we check
// for a new bundle periodically and reload during the quiet pre-dawn window.
//
// Plain desktop tabs are deliberately left alone: a reload exits fullscreen,
// and the Fullscreen API can't re-enter without a user gesture. The ?view=card
// embed runs it too: it lives in another page's frame, which may never reload
// it, and has no fullscreen to lose.
//
// Guards against a reload loop: reload only between QUIET_START and QUIET_END,
// only when the deployed index.html names a different bundle from the running
// one (and never when the running one can't be found, as under the dev
// server), check at most every checkInterval(), and try each new bundle at
// most once per RETRY_AFTER_MS. That last one is for a reload that doesn't
// take, e.g. the service worker serving its cached shell because the network
// dropped at that moment: without it every check would reload again. The
// attempt is written into the page's own URL (sgReload=<bundle>~<ms>), since a
// frame's storage may be partitioned or blocked, and window.name may be the
// parent's name for the frame.
import { isKioskContext } from './runtime.js';
import { IS_CARD_VIEW } from './view.js';

const CHECK_MS_DEFAULT = 60 * 60 * 1000; // hourly
const QUIET_START = 3; // 3 AM local…
const QUIET_END = 5; // …to 5 AM
const WAS_FULLSCREEN_KEY = 'sgWasFullscreen';
export const RETRY_AFTER_MS = 20 * 60 * 60 * 1000; // once a night
const TRIED_PARAM = 'sgReload';

// Whether to reload now: 'reload' or 'stay'. `tried` is the last attempt as
// { bundle, at }, or null.
export function reloadDecision({ mine, live, hour, tried, nowMs }) {
  if (!mine || !live || live === mine) return 'stay';
  if (hour < QUIET_START || hour >= QUIET_END) return 'stay';
  if (tried && tried.bundle === live && nowMs - tried.at >= 0 && nowMs - tried.at < RETRY_AFTER_MS) return 'stay';
  return 'reload';
}

// The last attempt recorded in `search`, or null.
export function triedFrom(search) {
  try {
    const v = new URLSearchParams(search).get(TRIED_PARAM);
    const m = v && /^(index-[\w-]+\.js)~(\d+)$/.exec(v);
    return m ? { bundle: m[1], at: Number(m[2]) } : null;
  } catch {
    return null;
  }
}

// `href` with the attempt at `bundle` recorded, or with no record (bundle null).
export function withTried(href, bundle, at) {
  const u = new URL(href);
  if (bundle) u.searchParams.set(TRIED_PARAM, `${bundle}~${at}`);
  else u.searchParams.delete(TRIED_PARAM);
  return u.href;
}

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

  if (!isKioskContext() && !IS_CARD_VIEW) return false;

  const mine = currentBundle();
  if (!mine) return false;

  // The reload took: tidy the record out of the address.
  const tried = triedFrom(window.location.search);
  if (tried && tried.bundle === mine) {
    try {
      window.history.replaceState(window.history.state, '', withTried(window.location.href, null));
    } catch {
      /* ignore */
    }
  }

  async function tick() {
    const hour = new Date().getHours();
    if (hour < QUIET_START || hour >= QUIET_END) return;
    try {
      const live = await deployedBundle();
      const nowMs = Date.now();
      if (reloadDecision({ mine, live, hour, tried: triedFrom(window.location.search), nowMs }) !== 'reload') return;
      try {
        if (document.fullscreenElement) sessionStorage.setItem(WAS_FULLSCREEN_KEY, '1');
      } catch {
        /* ignore */
      }
      window.location.replace(withTried(window.location.href, live, nowMs));
    } catch {
      /* transient network failure: try again next tick */
    }
  }

  setInterval(tick, checkInterval());
  return true;
}
