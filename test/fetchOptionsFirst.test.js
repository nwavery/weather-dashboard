import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAirQuality, fetchHistoricalAverage, geocodeCity, reverseGeocode, fetchWeather } from '../src/lib/openMeteo.js';
import { fetchAlerts } from '../src/lib/alerts.js';
import { fetchObservation } from '../src/lib/observation.js';
import { fetchPollen } from '../src/lib/pollen.js';
import { fetchRadarFrame } from '../src/lib/radar.js';
import { formatDateYYYYMMDD } from '../src/lib/format.js';

// The rule: a fetcher checks its options before anything else, a cache lookup
// included. A bad timeoutMs or signal is a TypeError and an aborted signal
// gets no answer, whether or not the answer is already cached.

const api = async (url) => {
  const p = new URL(url).pathname;
  const today = formatDateYYYYMMDD(new Date(), 'UTC');
  const body = p.startsWith('/alerts')
    ? { features: [{ properties: { id: 'a', event: 'Test Warning', ends: null } }] }
    : p.includes('air-quality')
      ? { current: { us_aqi: 1 } }
      : p.includes('archive')
        ? { daily: { time: [`2020${today.slice(4)}`], temperature_2m_mean: [50] } }
        : p.includes('weather-maps')
          ? { host: 'https://t.test', radar: { past: [{ path: '/p', time: 1 }] } }
          : p.startsWith('/points')
            ? { properties: { observationStations: 'https://api.weather.gov/x/stations' } }
            : p.endsWith('/stations')
              ? { features: [{ properties: { stationIdentifier: 'KOPT', name: 'Opt' } }] }
              : { properties: { timestamp: new Date().toISOString(), textDescription: 'Rain' } };
  return new Response(JSON.stringify(body));
};

let nextLat = 50;
const point = () => ({ latitude: nextLat++ + 0.5, longitude: 8.5, timeZone: 'UTC' });

// The cached fetchers, and what an aborted call answers: a rejection, or null
// for the ones that answer null on any failure.
const CACHED = [
  ['fetchAlerts', (loc, o) => fetchAlerts(loc, o), 'rejects'],
  ['fetchAirQuality', (loc, o) => fetchAirQuality(loc, o), 'rejects'],
  ['fetchHistoricalAverage', (loc, o) => fetchHistoricalAverage(loc, o), 'rejects'],
  ['fetchObservation', (loc, o) => fetchObservation(loc, o), 'null'],
  ['fetchRadarFrame', (_loc, o) => fetchRadarFrame(o), 'null']
];
const BAD = [
  ['timeoutMs 0', { timeoutMs: 0 }],
  ['timeoutMs NaN', { timeoutMs: NaN }],
  ['signal not an AbortSignal', { signal: { aborted: false } }]
];

async function abortedAnswer(promise, outcome, name) {
  if (outcome === 'null') assert.equal(await promise, null, name);
  else await assert.rejects(promise, (e) => e.name === 'AbortError', name);
}

test('on a shared-cache hit, bad options still throw and an aborted signal still wins', async (t) => {
  const real = t.mock.method(globalThis, 'fetch', api);
  for (const [name, call, outcome] of CACHED) {
    const loc = point();
    assert.notEqual(await call(loc), null, `${name} did not warm`);
    const n = real.mock.callCount();
    assert.notEqual(await call(loc), null);
    assert.equal(real.mock.callCount(), n, `${name} is not cached, so this proves nothing`);
    for (const [label, o] of BAD) await assert.rejects(Promise.resolve().then(() => call(loc, o)), TypeError, `${name} ${label}`);
    await abortedAnswer(call(loc, { signal: AbortSignal.abort() }), outcome, name);
    await abortedAnswer(call(loc, { timeoutMs: 5000, signal: AbortSignal.abort() }), outcome, name);
    assert.equal(real.mock.callCount(), n, `${name} fetched for a call it should have refused`);
  }
});

test('on a caller-cache hit, bad options still throw and an aborted signal still wins', async () => {
  for (const [name, call, outcome] of CACHED) {
    const loc = point();
    const cache = new Map();
    let fetches = 0;
    const fetch = (url) => (fetches++, api(url));
    await call(loc, { fetch, cache });
    const n = fetches;
    await call(loc, { fetch, cache });
    assert.equal(fetches, n, `${name} is not cached, so this proves nothing`);
    for (const [label, o] of BAD) {
      await assert.rejects(Promise.resolve().then(() => call(loc, { fetch, cache, ...o })), TypeError, `${name} ${label}`);
    }
    await abortedAnswer(call(loc, { fetch, cache, signal: AbortSignal.abort() }), outcome, name);
  }
});

test('the uncached fetchers check their options before calling out too', async () => {
  let fetches = 0;
  const fetch = (url) => (fetches++, api(url));
  const UNCACHED = [
    ['fetchWeather', (o) => fetchWeather(point(), o)],
    ['geocodeCity', (o) => geocodeCity('x', o)],
    ['reverseGeocode', (o) => reverseGeocode(1, 2, o)],
    ['fetchPollen', (o) => fetchPollen(point(), o)]
  ];
  for (const [name, call] of UNCACHED) {
    for (const [label, o] of BAD) {
      await assert.rejects(Promise.resolve().then(() => call({ fetch, ...o })), TypeError, `${name} ${label}`);
    }
  }
  // geocodeCity answers null for a blank name without calling out; a bad
  // option is still an error there.
  await assert.rejects(geocodeCity('  ', { timeoutMs: -1 }), TypeError);
  assert.equal(fetches, 0);
});
