// A TTL cache that survives a reload.
//
// Most of our caches are in-memory Maps, which is right for data that goes
// stale in minutes. But two of them hold values that are stable for a day or
// more — the 10-year historical average for today's date, and which NWS
// station is nearest a point — and both are expensive: the archive query scans
// a decade of daily means, and the station lookup is two chained API calls.
//
// An in-memory cache loses those on every reload, and the kiosk reloads itself
// nightly (autoReload.js), so an always-on display was re-running both every
// morning. Mirroring them into localStorage means a cold start reuses whatever
// is still inside its TTL.
//
// Falls back to plain in-memory behaviour whenever storage is unavailable
// (Safari private mode, quota exhausted, a browser that evicts site data) —
// the cache still works, it just doesn't outlive the page.

function defaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null; // access itself can throw when cookies/storage are blocked
  }
}

export function persistentCache(namespace, { ttlMs, maxEntries = 12, storage = defaultStorage() } = {}) {
  const mem = new Map();
  let loaded = false;

  function prune(now) {
    for (const [key, entry] of mem) {
      if (entry.expires <= now) mem.delete(key);
    }
    // Bound the footprint: a long-running display shouldn't accumulate an
    // entry for every location it has ever shown. Oldest expiry goes first.
    if (mem.size > maxEntries) {
      const order = [...mem.entries()].sort((a, b) => a[1].expires - b[1].expires);
      for (const [key] of order.slice(0, mem.size - maxEntries)) mem.delete(key);
    }
  }

  // Seed from storage on first use rather than at import time, so a module
  // that's never called costs nothing.
  function load() {
    if (loaded) return;
    loaded = true;
    if (!storage) return;
    try {
      const raw = storage.getItem(namespace);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      for (const [key, entry] of Object.entries(parsed)) {
        if (entry && typeof entry.expires === 'number' && 'data' in entry) mem.set(key, entry);
      }
      prune(Date.now());
    } catch {
      /* corrupt or unreadable — start empty */
    }
  }

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(namespace, JSON.stringify(Object.fromEntries(mem)));
    } catch {
      /* quota or private mode — the in-memory cache still works */
    }
  }

  return {
    // The cached value, or null when missing or expired.
    get(key) {
      load();
      const entry = mem.get(key);
      if (!entry) return null;
      if (entry.expires <= Date.now()) {
        mem.delete(key);
        return null;
      }
      return entry.data;
    },

    set(key, data) {
      load();
      const now = Date.now();
      mem.set(key, { expires: now + ttlMs, data });
      prune(now);
      persist();
      return data;
    }
  };
}
