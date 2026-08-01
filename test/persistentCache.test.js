import test from 'node:test';
import assert from 'node:assert/strict';
import { persistentCache } from '../src/lib/persistentCache.js';

// A stand-in for localStorage. `failOn` lets a test make one operation throw,
// the way a real browser does at quota or in private mode.
function fakeStorage(initial = {}, failOn = null) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem(k) {
      if (failOn === 'get') throw new Error('blocked');
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      if (failOn === 'set') throw new Error('quota');
      map.set(k, v);
    }
  };
}

test('round-trips a value through storage', () => {
  const storage = fakeStorage();
  const a = persistentCache('ns', { ttlMs: 60_000, storage });
  a.set('k', { baseline: 82, years: 10 });

  // A fresh cache over the same storage is what a page reload looks like.
  const b = persistentCache('ns', { ttlMs: 60_000, storage });
  assert.deepEqual(b.get('k'), { baseline: 82, years: 10 });
});

test('set returns the value it stored', () => {
  const cache = persistentCache('ns', { ttlMs: 60_000, storage: fakeStorage() });
  assert.deepEqual(cache.set('k', { a: 1 }), { a: 1 });
});

test('a miss and an expired entry both read as null', () => {
  const storage = fakeStorage();
  const cache = persistentCache('ns', { ttlMs: -1, storage }); // already expired on write
  assert.equal(cache.get('never-set'), null);
  cache.set('k', 'v');
  assert.equal(cache.get('k'), null);
});

test('expired entries do not survive a reload', () => {
  const storage = fakeStorage({
    ns: JSON.stringify({ stale: { expires: Date.now() - 1000, data: 'old' } })
  });
  const cache = persistentCache('ns', { ttlMs: 60_000, storage });
  assert.equal(cache.get('stale'), null);
});

test('a cached null-ish payload is still a hit', () => {
  // How observation.js negative-caches "no NWS station here" — the wrapper must
  // come back truthy so non-US points don't re-query on every refresh.
  const storage = fakeStorage();
  persistentCache('ns', { ttlMs: 60_000, storage }).set('point', { station: null });

  const reloaded = persistentCache('ns', { ttlMs: 60_000, storage });
  const hit = reloaded.get('point');
  assert.ok(hit, 'expected a hit');
  assert.equal(hit.station, null);
});

test('evicts the soonest-to-expire entry past maxEntries', () => {
  const storage = fakeStorage();
  const cache = persistentCache('ns', { ttlMs: 60_000, maxEntries: 2, storage });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  assert.equal(cache.get('a'), null, 'oldest should have been dropped');
  assert.equal(cache.get('c'), 3);
  assert.equal(Object.keys(JSON.parse(storage.map.get('ns'))).length, 2);
});

test('corrupt stored JSON starts empty instead of throwing', () => {
  const cache = persistentCache('ns', { ttlMs: 60_000, storage: fakeStorage({ ns: 'not json{' }) });
  assert.equal(cache.get('k'), null);
  assert.equal(cache.set('k', 'v'), 'v');
});

test('works with no storage at all', () => {
  const cache = persistentCache('ns', { ttlMs: 60_000, storage: null });
  cache.set('k', 'v');
  assert.equal(cache.get('k'), 'v', 'should still cache in memory');
});

test('a throwing storage degrades to in-memory', () => {
  for (const failOn of ['get', 'set']) {
    const cache = persistentCache('ns', { ttlMs: 60_000, storage: fakeStorage({}, failOn) });
    cache.set('k', 'v');
    assert.equal(cache.get('k'), 'v', `should survive storage.${failOn} throwing`);
  }
});
