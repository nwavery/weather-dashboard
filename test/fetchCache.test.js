import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAirQuality, fetchHistoricalAverage } from '../src/lib/openMeteo.js';
import { fetchAlerts } from '../src/lib/alerts.js';
import { fetchObservation } from '../src/lib/observation.js';
import { fetchRadarFrame } from '../src/lib/radar.js';
import { formatDateYYYYMMDD } from '../src/lib/format.js';

// The rule: a result fetched with a caller's baseUrl, headers or fetch is never
// served to a call with different options, and the default path's caches are
// neither filled nor read by such a call. A caller who wants caching passes
// its own `cache`.

// A fake API that answers every endpoint, stamping each answer with `tag` so a
// test can tell which call's result came back.
function api(tag, log = []) {
  return async (url, init) => {
    log.push({ url: String(url), init });
    const p = new URL(url).pathname;
    const today = formatDateYYYYMMDD(new Date(), 'UTC');
    const body = p.startsWith('/alerts')
      ? { features: [{ properties: { id: tag, event: `${tag} Warning`, ends: null } }] }
      : p.includes('air-quality')
        ? { current: { us_aqi: tag } }
        : p.includes('archive')
          ? { daily: { time: [`2020${today.slice(4)}`], temperature_2m_mean: [tag.length] } }
          : p.includes('weather-maps')
            ? { host: `https://${tag}.test`, radar: { past: [{ path: `/${tag}`, time: 1 }] } }
            : p.startsWith('/points')
              ? { properties: { observationStations: 'https://api.weather.gov/x/stations' } }
              : p.endsWith('/stations')
                ? { features: [{ properties: { stationIdentifier: `K${tag}`, name: tag } }] }
                : { properties: { timestamp: new Date().toISOString(), textDescription: 'Rain' } };
    return new Response(JSON.stringify(body), { status: 200 });
  };
}

// What each fetcher's answer says about which call produced it.
const FETCHERS = {
  alerts: { call: (loc, o) => fetchAlerts(loc, o), tagOf: (r) => r[0]?.id },
  air: { call: (loc, o) => fetchAirQuality(loc, o), tagOf: (r) => r.us_aqi },
  hist: { call: (loc, o) => fetchHistoricalAverage(loc, o), tagOf: (r) => r.baseline },
  obs: { call: (loc, o) => fetchObservation(loc, o), tagOf: (r) => r?.station },
  radar: { call: (_loc, o) => fetchRadarFrame(o), tagOf: (r) => r?.path?.slice(1) }
};
const histTag = (tag) => tag.length; // the archive answer carries the tag's length

let nextLat = 20;
const point = () => ({ latitude: nextLat++ + 0.123, longitude: -100.456, timeZone: 'UTC' });
const expectTag = (name, tag) => (name === 'hist' ? histTag(tag) : tag);

// The radar frame has one shared slot for the whole process, and a test can't
// empty it. So after the first radar case fills it with a real answer, later
// cases can only check the default path is not given the stub's.
let radarSlotFilled = false;
for (const [name, f] of Object.entries(FETCHERS)) {
  for (const [label, opts] of [
    ['a stub fetch', (fetch) => ({ fetch })],
    ['caller headers', (fetch) => ({ headers: { 'User-Agent': 'probe' }, fetch })],
    ['a caller base', (fetch) => ({ baseUrl: 'https://proxy.test', fetch })]
  ]) {
    test(`${name}: ${label} does not fill the default cache`, async (t) => {
      const loc = point();
      await f.call(loc, opts(api('stub')));
      // A distinct tag per case keeps the radar slot honest between cases.
      const realTag = `real${nextLat}`;
      const real = t.mock.method(globalThis, 'fetch', api(realTag));
      const got = await f.call(loc);
      assert.notEqual(f.tagOf(got), expectTag(name, 'stub'));
      if (name === 'radar' && radarSlotFilled) return;
      if (name === 'radar') radarSlotFilled = true;
      assert.ok(real.mock.callCount() > 0, 'the default path did not fetch');
      assert.equal(f.tagOf(got), expectTag(name, realTag));
    });

    test(`${name}: ${label} is not answered from the default cache`, async (t) => {
      const loc = point();
      const realTag = `def${nextLat}`;
      t.mock.method(globalThis, 'fetch', api(realTag));
      await f.call(loc);
      const log = [];
      const got = await f.call(loc, opts(api('mine', log)));
      assert.ok(log.length > 0, 'the caller fetch was not called');
      assert.equal(f.tagOf(got), expectTag(name, 'mine'));
    });
  }
}

test('without a cache of its own, a call with options caches nothing', async () => {
  for (const [name, f] of Object.entries(FETCHERS)) {
    const loc = point();
    const log = [];
    const fetch = api('x', log);
    await f.call(loc, { fetch });
    const n = log.length;
    await f.call(loc, { fetch });
    assert.equal(log.length, 2 * n, `${name} answered a repeat from somewhere`);
  }
});

test('with a cache of its own, a repeat with the same options is a hit', async () => {
  for (const [name, f] of Object.entries(FETCHERS)) {
    const loc = point();
    const log = [];
    const cache = new Map();
    const opts = { fetch: api('x', log), headers: { 'User-Agent': 'a' }, cache };
    await f.call(loc, opts);
    const n = log.length;
    await f.call(loc, { ...opts });
    // Header names are case-insensitive, so this is the same request.
    await f.call(loc, { ...opts, headers: { 'user-agent': 'a' } });
    assert.equal(log.length, n, `${name} refetched`);
  }
});

// One fetch function whose every answer is new, so a cache hit and a refetch
// can be told apart without changing the fetch.
function counting() {
  let n = 0;
  const log = [];
  return { log, fetch: (url, init) => api(`n${++n}`, log)(url, init) };
}

test('changing only one header misses the caller cache', async () => {
  for (const [name, f] of Object.entries(FETCHERS)) {
    const loc = point();
    const cache = new Map();
    const { fetch, log } = counting();
    await f.call(loc, { fetch, cache, headers: { 'User-Agent': 'a', 'X-Trace': '1' } });
    const n = log.length;
    await f.call(loc, { fetch, cache, headers: { 'User-Agent': 'b', 'X-Trace': '1' } });
    assert.ok(log.length > n, `${name}: a changed value was answered from the cache`);
    const m = log.length;
    await f.call(loc, { fetch, cache, headers: { 'User-Agent': 'a' } });
    assert.ok(log.length > m, `${name}: a dropped header was answered from the cache`);
  }
});

test('changing only the fetch, or only the base, misses the caller cache', async () => {
  for (const [name, f] of Object.entries(FETCHERS)) {
    const loc = point();
    const cache = new Map();
    const one = counting();
    await f.call(loc, { fetch: one.fetch, cache });
    const two = counting();
    await f.call(loc, { fetch: two.fetch, cache });
    assert.ok(two.log.length > 0, `${name}: another fetch was answered from the cache`);
    const n = one.log.length;
    await f.call(loc, { fetch: one.fetch, cache, baseUrl: 'https://other.test' });
    assert.ok(one.log.length > n, `${name}: another base was answered from the cache`);
  }
});

test('one Map handed to every fetcher keeps their answers apart', async () => {
  // Alerts and the station lookup share a base (api.weather.gov) and the same
  // key text, `${lat.toFixed(3)},${lon.toFixed(3)}`. Only the fetcher's name
  // keeps an alerts list from being read back as a station.
  const loc = { latitude: 40.123, longitude: -100.456, timeZone: 'UTC' };
  const cache = new Map();
  const opts = { fetch: api('m'), cache };
  assert.equal((await fetchAlerts(loc, opts))[0].id, 'm');
  assert.equal((await fetchObservation(loc, opts))?.station, 'm');
  assert.equal((await fetchAlerts(loc, opts))[0].id, 'm');
  assert.equal((await fetchAirQuality(loc, opts)).us_aqi, 'm');
});

test('signal and timeoutMs on their own stay on the shared cache', async (t) => {
  const loc = point();
  const real = t.mock.method(globalThis, 'fetch', api('shared'));
  await fetchAlerts(loc);
  assert.equal(real.mock.callCount(), 1);
  const got = await fetchAlerts(loc, { timeoutMs: 5000, signal: new AbortController().signal });
  assert.equal(real.mock.callCount(), 1);
  assert.equal(got[0].id, 'shared');
});
