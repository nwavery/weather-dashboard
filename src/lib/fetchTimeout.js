// fetch with a real abort-based timeout. Racing a fetch against a timer (see
// useLocationWeather's withTimeout) unblocks the CALLER, but the losing fetch
// keeps running and holds one of the browser's ~6 connections per host. On a
// flaky network each retry round leaks another stalled request; once the pool
// for a host is full of zombies, every new request queues behind them and
// "times out" without ever reaching the wire — the card wedges until the tab
// dies. Aborting on timeout releases the socket so a retry gets a fresh start.
const DEFAULT_TIMEOUT_MS = 10 * 1000; // under the hook's 12s race, so the abort fires first

export async function fetchWithTimeout(url, opts = {}, ms = DEFAULT_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
