import { test } from 'node:test';
import assert from 'node:assert/strict';

// The rule: `timeoutMs` and `signal` bound the whole of fetchRadar, the tile
// image included, like every other fetcher. With neither, the tile keeps its
// own 8 s. fetchRadar needs a page, so these stand in a document and an Image
// whose load the test controls.

const images = [];
globalThis.Image = class {
  constructor() {
    images.push(this);
    this.width = 256;
    this.height = 256;
  }
  set src(v) {
    this._src = v;
    if (v && this.loadAfterMs != null) setTimeout(() => this.onload?.(), this.loadAfterMs);
  }
  get src() {
    return this._src;
  }
};
// An opaque 40 dBZ pixel everywhere, so a loaded tile reads as a strong echo.
const patch = Uint8ClampedArray.from(Array(9).fill([0xff, 0xaa, 0x00, 255]).flat());
globalThis.document = {
  createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: patch }) }) })
};
const { fetchRadar } = await import('../src/lib/radar.js');

const frameFetch = async () =>
  new Response(JSON.stringify({ host: 'https://tiles.test', radar: { past: [{ path: '/p', time: 1700000000 }] } }));
const loc = { latitude: 30.25, longitude: -97.75 };
let nextImageLoad = null; // ms after src is set, or null for never
const realPush = images.push.bind(images);
images.push = (img) => {
  img.loadAfterMs = nextImageLoad;
  return realPush(img);
};

test('timeoutMs ends a tile that never loads, and stops the load', async () => {
  nextImageLoad = null;
  const t0 = Date.now();
  assert.equal(await fetchRadar(loc, { fetch: frameFetch, timeoutMs: 200 }), null);
  assert.ok(Date.now() - t0 < 1000, `took ${Date.now() - t0} ms`);
  assert.equal(images.at(-1).src, '', 'the image load was left running');
});

test('a caller signal ends a tile that never loads', async () => {
  nextImageLoad = null;
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 100);
  const t0 = Date.now();
  assert.equal(await fetchRadar(loc, { fetch: frameFetch, signal: ctrl.signal }), null);
  assert.ok(Date.now() - t0 < 1000, `took ${Date.now() - t0} ms`);
  assert.equal(images.at(-1).src, '');
});

test('an already aborted signal never starts a tile', async () => {
  const before = images.length;
  assert.equal(await fetchRadar(loc, { fetch: frameFetch, signal: AbortSignal.abort() }), null);
  assert.equal(images.length, before);
});

test('a tile that loads in time still gives its reading', async () => {
  nextImageLoad = 30;
  const r = await fetchRadar(loc, { fetch: frameFetch, timeoutMs: 2000, signal: new AbortController().signal });
  assert.deepEqual(r, { precip: true, intensity: 'moderate', strong: true, observedAt: new Date(1700000000 * 1000).toISOString() });
});

test('timeoutMs longer than 8 s replaces the tile\'s own 8 s', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  nextImageLoad = null;
  let settled = false;
  const p = fetchRadar(loc, { fetch: frameFetch, timeoutMs: 15000 }).then((v) => ((settled = true), v));
  const turns = async () => {
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  };
  await turns();
  t.mock.timers.tick(8000);
  await turns();
  assert.equal(settled, false, 'the tile\'s own 8 s still fired');
  t.mock.timers.tick(7000);
  await turns();
  assert.equal(settled, true);
  assert.equal(await p, null);
});

test('with no options the tile keeps its own 8 s', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', frameFetch);
  nextImageLoad = null;
  let settled = false;
  const p = fetchRadar(loc).then((v) => ((settled = true), v));
  const turns = async () => {
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  };
  await turns();
  t.mock.timers.tick(7999);
  await turns();
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  await turns();
  assert.equal(settled, true);
  assert.equal(await p, null);
});

test('a bad timeoutMs or signal is a TypeError from fetchRadar', async () => {
  await assert.rejects(fetchRadar(loc, { fetch: frameFetch, timeoutMs: 0 }), TypeError);
  await assert.rejects(fetchRadar(loc, { fetch: frameFetch, signal: 'nope' }), TypeError);
});
