// fetch with a real abort-based timeout. Racing a fetch against a timer (see
// useLocationWeather's withTimeout) unblocks the CALLER, but the losing fetch
// keeps running and holds one of the browser's ~6 connections per host. On a
// flaky network each retry round leaks another stalled request; once the pool
// for a host is full of zombies, every new request queues behind them and
// "times out" without ever reaching the wire — the card wedges until the tab
// dies. Aborting on timeout releases the socket so a retry gets a fresh start.
const DEFAULT_TIMEOUT_MS = 10 * 1000; // under the hook's 12s race, so the abort fires first

// `opts` is fetch's init, plus an optional `fetch` to call instead of the
// global one and an optional outer `signal` that aborts it too. The timer
// covers the request until headers arrive, not the body read; `ms` null means
// no timer of its own (a caller's timeoutMs is in charge, see withDeadline).
export async function fetchWithTimeout(url, { fetch: fetchImpl = fetch, signal: outer, ...opts } = {}, ms = DEFAULT_TIMEOUT_MS) {
  if (outer?.aborted) throw outer.reason; // never call out for a call already given up on
  const ctrl = new AbortController();
  const t = ms == null ? null : setTimeout(() => ctrl.abort(), ms);
  // Forwarded for as long as the outer signal lives, so an abort after the
  // headers still reaches the body read. The outer signal is withDeadline's
  // per-call one, never the caller's own.
  if (outer) outer.addEventListener('abort', () => ctrl.abort(outer.reason), { once: true });
  try {
    return await fetchImpl(url, { ...opts, signal: ctrl.signal });
  } finally {
    if (t !== null) clearTimeout(t);
  }
}

// Every fetcher in src/lib that calls out takes the same optional last
// argument, so a server can reuse them:
//   baseUrl    replaces the scheme and host the fetcher calls by default
//   headers    merged over the fetcher's own (NWS asks for a User-Agent)
//   fetch      a fetch-compatible function to call instead of the global fetch
//   cache      a Map-like { get, set } to cache results in (see cacheFor)
//   signal     an AbortSignal that aborts the whole call
//   timeoutMs  a deadline for the whole call, every request and body in it
// With none given, each request has the URL and init the app sent before, and
// the shared caches are read and written with the same keys as before.
//
// A call with baseUrl, headers or fetch never touches the shared caches: it
// uses `cache` if given, else no cache at all. So a stand-in, a stub or a
// different header can't fill what the default path reads, or be answered
// from it. signal and timeoutMs don't change what comes back, so on their own
// they leave a call on the shared caches.

// `baseUrl` without trailing slashes, or the fetcher's default.
export function baseOf(opts, fallback) {
  const b = opts?.baseUrl;
  return typeof b === 'string' ? b.replace(/\/+$/, '') : fallback;
}

// True when the caller's options can change what a fetcher returns.
export function changesResult(opts) {
  return opts?.baseUrl !== undefined || opts?.headers !== undefined || opts?.fetch !== undefined;
}

// A TTL cache over a Map, entries { expires, data }: the shape every in-memory
// cache here already used. get() is undefined on a miss, so a cached null is a
// hit.
export function ttlMap(ttlMs, store = new Map()) {
  return {
    get(key) {
      const e = store.get(key);
      return e && e.expires > Date.now() ? e.data : undefined;
    },
    set(key, data) {
      store.set(key, { expires: Date.now() + ttlMs, data });
      return data;
    }
  };
}

const fetchIds = new WeakMap();
let nextFetchId = 1;
function fetchIdOf(fn) {
  if (!fetchIds.has(fn)) fetchIds.set(fn, nextFetchId++);
  return fetchIds.get(fn);
}

// Where a fetcher keeps results for this call. The default path gets `shared`
// with its keys untouched. Anything else gets the caller's `cache`, with keys
// prefixed by the fetcher's name and every option that can change the answer
// (base, each header by lower-cased name, which fetch function), so one Map
// handed to every fetcher with different options never crosses answers. With
// no `cache`, nothing is kept. The fetch is compared by identity, so a caller
// who builds a new function for every call never gets a hit.
export function cacheFor(opts, { shared, name, base, ttlMs }) {
  const own = opts?.cache;
  if (!own && !changesResult(opts)) return shared;
  if (!own) return { get: () => undefined, set: (_key, data) => data };
  const headers = opts?.headers === undefined ? [] : [...new Headers(opts.headers)];
  const fetchId = opts?.fetch === undefined ? 0 : fetchIdOf(opts.fetch);
  const prefix = `${name}|${JSON.stringify([base, headers, fetchId])}|`;
  const store = ttlMap(ttlMs, own);
  return { get: (key) => store.get(prefix + key), set: (key, data) => store.set(prefix + key, data) };
}

// fetchWithTimeout's init for the caller's options over `ownHeaders`. Adds no
// `headers` field when there are none to send. Caller headers may be anything
// Headers accepts, and replace the fetcher's own by name, whatever the case.
export function initFor(opts, ownHeaders, signal) {
  let headers = null;
  if (opts?.headers !== undefined) {
    headers = new Headers(ownHeaders);
    for (const [k, v] of new Headers(opts.headers)) headers.set(k, v);
  } else if (ownHeaders) {
    headers = ownHeaders;
  }
  return {
    ...(headers ? { headers } : null),
    ...(opts?.fetch ? { fetch: opts.fetch } : null),
    ...(signal ? { signal } : null)
  };
}

// The per-request header timer to use: the fetcher's own, or none when the
// caller set a deadline for the whole call.
export function headerTimeout(opts, ms) {
  return opts?.timeoutMs === undefined ? ms : null;
}

// Throws on a timeoutMs that isn't a positive finite number, or a signal that
// isn't an AbortSignal. Every fetcher calls this before anything else, a cache
// lookup included, so a bad option is an error on a hit too, and the ones that
// answer null on any failure don't turn it into a silent null.
export function checkDeadline(opts) {
  const t = opts?.timeoutMs;
  if (t !== undefined && !(typeof t === 'number' && t > 0 && Number.isFinite(t))) {
    throw new TypeError(`timeoutMs must be a positive number of ms, got ${t}`);
  }
  // null is no signal, as it was before signals were checked.
  const s = opts?.signal;
  if (s != null && !(typeof s.aborted === 'boolean' && typeof s.addEventListener === 'function')) {
    throw new TypeError('signal must be an AbortSignal');
  }
}

// True when the caller's signal has already aborted. Checked before a cache
// lookup, so an aborted call never gets an answer.
export function alreadyAborted(opts) {
  return opts?.signal?.aborted === true;
}

// Run `work(signal)` under the caller's signal and timeoutMs, which bound the
// whole call: every request, and reading every body. With neither it is just
// work(undefined), so the default path is untouched. The race means the call
// settles on abort even if a custom fetch, or a body, ignores the signal.
export async function withDeadline(opts, work) {
  checkDeadline(opts);
  const signal = opts?.signal ?? undefined;
  const timeoutMs = opts?.timeoutMs;
  // Before `work` starts, so an aborted call never calls out.
  if (signal?.aborted) throw signal.reason;
  if (signal === undefined && timeoutMs === undefined) return work(undefined);
  const ctrl = new AbortController();
  const fromCaller = () => ctrl.abort(signal.reason);
  if (signal) {
    if (signal.aborted) fromCaller();
    else signal.addEventListener('abort', fromCaller, { once: true });
  }
  const timer =
    timeoutMs === undefined
      ? null
      : setTimeout(() => ctrl.abort(new DOMException(`timed out after ${timeoutMs} ms`, 'TimeoutError')), timeoutMs);
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(ctrl.signal.reason);
    if (ctrl.signal.aborted) onAbort();
    else ctrl.signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([work(ctrl.signal), aborted]);
  } finally {
    if (timer !== null) clearTimeout(timer);
    signal?.removeEventListener('abort', fromCaller);
    ctrl.signal.removeEventListener('abort', onAbort);
    aborted.catch(() => {});
  }
}
