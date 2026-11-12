import { test } from 'node:test';
import assert from 'node:assert/strict';

// The two caches that outlive a reload live in localStorage, so their keys
// are a stored format: change one and every kiosk refetches, or worse reads
// an entry meant for something else. These keys are written out literally as
// main (e16b5e7) builds them, not derived from the code under test.

// A storage the persistent caches pick up at import, so it has to exist first.
const store = new Map();
const storage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v))
};
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
const { fetchObservation } = await import('../src/lib/observation.js');
const { fetchHistoricalAverage } = await import('../src/lib/openMeteo.js');
const { formatDateYYYYMMDD } = await import('../src/lib/format.js');

const LOC = { latitude: 47.6062, longitude: -122.3321, timeZone: 'America/Los_Angeles' };
const today = () => formatDateYYYYMMDD(new Date(), LOC.timeZone);
const STATION_KEY = '47.606,-122.332'; // `${lat.toFixed(3)},${lon.toFixed(3)}`
const HIST_KEY = () => `47.6062,-122.3321:America/Los_Angeles:${today()}`; // `${lat},${lon}:${tz}:${day}`

test('entries written by main are read back without a fetch', async (t) => {
  const later = Date.now() + 3600e3;
  store.set('sg:station', JSON.stringify({ [STATION_KEY]: { expires: later, data: { station: { id: 'KSEA', name: 'Seeded' } } } }));
  store.set('sg:hist', JSON.stringify({ [HIST_KEY()]: { expires: later, data: { baseline: 51.5, years: 10 } } }));
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ properties: { timestamp: new Date().toISOString(), textDescription: 'Clear' } }));
  });
  assert.deepEqual(await fetchHistoricalAverage(LOC), { baseline: 51.5, years: 10 });
  const obs = await fetchObservation(LOC);
  assert.equal(obs.station, 'Seeded');
  // No /points lookup: the station came from the seeded entry.
  assert.deepEqual(calls, ['https://api.weather.gov/stations/KSEA/observations/latest']);
});

test('the default path writes keys in main\'s format', async (t) => {
  store.clear();
  const loc = { latitude: 30.25, longitude: -97.75, timeZone: 'America/Chicago' };
  const day = formatDateYYYYMMDD(new Date(), loc.timeZone);
  t.mock.method(globalThis, 'fetch', async (url) => {
    const p = new URL(url).pathname;
    const body = p.startsWith('/points')
      ? { properties: { observationStations: 'https://api.weather.gov/x/stations' } }
      : p.endsWith('/stations')
        ? { features: [{ properties: { stationIdentifier: 'KAUS', name: 'Austin' } }] }
        : p.includes('archive')
          ? { daily: { time: [`2020${day.slice(4)}`], temperature_2m_mean: [70] } }
          : { properties: { timestamp: new Date().toISOString() } };
    return new Response(JSON.stringify(body));
  });
  await fetchObservation(loc);
  await fetchHistoricalAverage(loc);
  // The cache's in-memory side still holds the first test's entries, so check
  // the new key is there and every key has main's shape.
  const stationKeys = Object.keys(JSON.parse(store.get('sg:station')));
  const histKeys = Object.keys(JSON.parse(store.get('sg:hist')));
  assert.ok(stationKeys.includes('30.250,-97.750'), stationKeys.join(' '));
  assert.ok(histKeys.includes(`30.25,-97.75:America/Chicago:${day}`), histKeys.join(' '));
  for (const k of stationKeys) assert.match(k, /^-?\d+\.\d{3},-?\d+\.\d{3}$/);
  for (const k of histKeys) assert.match(k, /^-?[\d.]+,-?[\d.]+:[A-Za-z_/]+:\d{4}-\d\d-\d\d$/);
});

test('a call with options never touches localStorage', async () => {
  store.clear();
  const fetch = async () => new Response(JSON.stringify({ properties: { observationStations: 'https://api.weather.gov/x/stations' } }));
  await fetchObservation({ latitude: 10.5, longitude: 20.5 }, { fetch });
  await fetchObservation({ latitude: 10.5, longitude: 20.5 }, { fetch, cache: new Map() });
  await fetchHistoricalAverage({ latitude: 10.5, longitude: 20.5, timeZone: 'UTC' }, { fetch }).catch(() => {});
  assert.equal(store.size, 0);
});
