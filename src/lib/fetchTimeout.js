// fetch with a real abort-based timeout. Racing a fetch against a timer (see
// useLocationWeather's withTimeout) unblocks the CALLER, but the losing fetch
// keeps running and holds one of the browser's ~6 connections per host. On a
// flaky network each retry round leaks another stalled request; once the pool
// for a host is full of zombies, every new request queues behind them and
// "times out" without ever reaching the wire — the card wedges until the tab
// dies. Aborting on timeout releases the socket so a retry gets a fresh start.
const DEFAULT_TIMEOUT_MS = 10 * 1000; // under the hook's 12s race, so the abort fires first

// `opts` is fetch's init, plus an optional `fetch` to call instead of the
// global one. The timer covers the request until headers arrive, not the
// body read.
export async function fetchWithTimeout(url, { fetch: fetchImpl = fetch, ...opts } = {}, ms = DEFAULT_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetchImpl(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Every fetcher in src/lib that calls out takes the same optional last
// argument, so a server can reuse them:
//   baseUrl  replaces the scheme and host the fetcher calls by default
//   headers  merged over the fetcher's own (NWS asks for a User-Agent)
//   fetch    a fetch-compatible function to call instead of the global fetch
// With none given, each request has the URL and init the app sent before.
// Each fetcher's caches are keyed by baseUrl too, so a stand-in base never
// answers for the real one.

// `baseUrl` without trailing slashes, or the fetcher's default.
export function baseOf(opts, fallback) {
  const b = opts?.baseUrl;
  return typeof b === 'string' ? b.replace(/\/+$/, '') : fallback;
}

// Cache key for `key` under the caller's base: unchanged for the default, so
// entries already in localStorage stay valid.
export function cacheKeyFor(base, fallback, key) {
  return base === fallback ? key : `${base}|${key}`;
}

// fetchWithTimeout's init for the caller's options over `ownHeaders`. Adds no
// `headers` field when there are none to send.
export function initFor(opts, ownHeaders) {
  const headers = ownHeaders || opts?.headers ? { ...ownHeaders, ...opts?.headers } : null;
  return { ...(headers ? { headers } : null), ...(opts?.fetch ? { fetch: opts.fetch } : null) };
}
