import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// The rules: no fetcher calls out for a call whose signal has already
// aborted, and `signal: null` is no signal at all.
//
// "Every fetcher" is read from the tree, not listed: every function exported
// by a src/lib module that calls fetch is called in each argument shape the
// fetchers use, with the options last. What counts is a call to the caller's
// own `fetch`: it can only be reached through the options, so a shape that
// puts them in the wrong place (and falls back to the global fetch, a
// separate spy here) doesn't count. A fetcher added later is in the loop the
// day it lands. The live-signal run below proves the shapes reach the
// fetchers we know of, so a quiet aborted run means something.

const LIB = new URL('../src/lib/', import.meta.url);
const callsOut = (src) => /\bfetch(WithTimeout|Impl)?\(/.test(src);
const modules = readdirSync(LIB)
  .filter((f) => f.endsWith('.js'))
  .filter((f) => callsOut(readFileSync(new URL(f, LIB), 'utf8')))
  .sort();

// fetchRadar only runs with a page: give it one whose tile image fails at once.
globalThis.document = { createElement: () => ({ getContext: () => null }) };
globalThis.Image = class {
  set src(v) {
    if (v) setTimeout(() => this.onerror?.(), 0);
  }
};

let calls = 0;
const spy = async () => {
  calls++;
  return new Response('{}', { status: 200 });
};
// The global fetch: keeps the network out, and isn't counted.
globalThis.fetch = async () => new Response('{}', { status: 200 });

let lat = 10;
const shapes = (opts) => [
  [{ latitude: (lat += 1.25), longitude: 20.5, timeZone: 'UTC' }, opts],
  ['Testville', opts],
  [(lat += 1.25), 20.5, opts],
  [opts],
  ['https://example.test/', opts]
];

async function exercise(makeOpts) {
  const byName = new Map();
  for (const file of modules) {
    const mod = await import(new URL(file, LIB).href);
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== 'function') continue;
      let n = 0;
      for (const args of shapes(makeOpts())) {
        const before = calls;
        try {
          await Promise.race([Promise.resolve().then(() => fn(...args)), new Promise((r) => setTimeout(r, 300))]);
        } catch {
          /* junk arguments for a non-fetcher: only calling out matters */
        }
        n += calls - before;
      }
      byName.set(`${file}:${name}`, n);
    }
  }
  return byName;
}

const KNOWN = [
  'alerts.js:fetchAlerts',
  'fetchTimeout.js:fetchWithTimeout',
  'observation.js:fetchObservation',
  'openMeteo.js:fetchAirQuality',
  'openMeteo.js:fetchHistoricalAverage',
  'openMeteo.js:fetchWeather',
  'openMeteo.js:geocodeCity',
  'openMeteo.js:reverseGeocode',
  'pollen.js:fetchPollen',
  'radar.js:fetchRadar',
  'radar.js:fetchRadarFrame'
];

test('every fetcher calls out with a live signal, and with signal: null', async () => {
  for (const [label, make] of [
    ['live signal', () => ({ fetch: spy, signal: new AbortController().signal })],
    ['signal: null', () => ({ fetch: spy, signal: null })]
  ]) {
    const byName = await exercise(make);
    for (const k of KNOWN) assert.ok(byName.get(k) > 0, `${k} never called out with a ${label}`);
  }
});

test('no exported function calls out for an already aborted signal', async () => {
  const byName = await exercise(() => ({ fetch: spy, signal: AbortSignal.abort() }));
  const offenders = [...byName].filter(([, n]) => n > 0).map(([k, n]) => `${k} (${n})`);
  assert.deepEqual(offenders, []);
  assert.ok(byName.size >= KNOWN.length, 'the loop found fewer functions than the known fetchers');
});
