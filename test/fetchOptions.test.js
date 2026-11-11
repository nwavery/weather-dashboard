import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchWeather, fetchAirQuality, fetchHistoricalAverage, geocodeCity, reverseGeocode } from '../src/lib/openMeteo.js';
import { fetchAlerts } from '../src/lib/alerts.js';
import { fetchObservation } from '../src/lib/observation.js';
import { fetchPollen } from '../src/lib/pollen.js';
import { fetchRadarFrame } from '../src/lib/radar.js';
import { formatDateYYYYMMDD } from '../src/lib/format.js';

// Every fetcher takes { baseUrl, headers, fetch } so a server can reuse it.
// These run each one against a local stand-in for its API and check that the
// base, the headers and the fetcher all reach the wire, and that with no
// options each request is exactly the one the app sent before.

const UA = 'avery-home-test/1 (ops@example.test)';
const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

// A stand-in that answers every API above and records what it was asked.
async function standIn({ reverseFails = false, pollenStatus = 200 } = {}) {
  const seen = [];
  const today = formatDateYYYYMMDD(new Date(), 'UTC');
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url, headers: req.headers });
    const path = req.url.split('?')[0];
    if (path === '/v1/forecast') return json(res, 200, { current: {}, daily: {}, hourly: {} });
    if (path === '/v1/air-quality') return json(res, 200, { current: { us_aqi: 12 } });
    if (path === '/v1/archive') {
      return json(res, 200, { daily: { time: [`2020${today.slice(4)}`, `2021${today.slice(4)}`], temperature_2m_mean: [50, 60] } });
    }
    if (path === '/v1/search') return json(res, 200, { results: [{ name: 'Testville', latitude: 1, longitude: 2, timezone: 'UTC' }] });
    if (path === '/v1/reverse') {
      return reverseFails ? json(res, 500, {}) : json(res, 200, { results: [{ name: 'Revtown', timezone: 'UTC' }] });
    }
    if (path === '/data/reverse-geocode-client') return json(res, 200, { city: 'Fallbackton', timezone: { ianaTimeZone: 'UTC' } });
    if (path === '/alerts/active') return json(res, 200, { features: [] });
    if (path.startsWith('/points/')) {
      return json(res, 200, { properties: { observationStations: 'https://api.weather.gov/gridpoints/OUN/1,2/stations' } });
    }
    if (path === '/gridpoints/OUN/1,2/stations') {
      return json(res, 200, { features: [{ properties: { stationIdentifier: 'KTST', name: 'Test Station' } }] });
    }
    if (path === '/stations/KTST/observations/latest') {
      return json(res, 200, { properties: { timestamp: new Date().toISOString(), presentWeather: [], textDescription: 'Light Rain' } });
    }
    if (path === '/api/pollen') {
      return pollenStatus === 200 ? json(res, 200, { tree: null, grass: null, weed: null }) : json(res, pollenStatus, { error: 'not_configured' });
    }
    if (path === '/public/weather-maps.json') {
      return json(res, 200, { host: 'https://tiles.test', radar: { past: [{ path: '/old', time: 1 }, { path: '/new', time: 2 }] } });
    }
    json(res, 404, {});
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, seen, close: () => server.close() };
}

// Each test uses its own coordinates, because every fetcher caches per point.
let nextLat = 10;
const freshPoint = () => ({ latitude: nextLat++ + 0.5, longitude: -97.25, timeZone: 'UTC' });

test('Open-Meteo fetchers call the given base and send the given headers', async () => {
  const s = await standIn();
  const opts = { baseUrl: s.base, headers: { 'User-Agent': UA } };
  try {
    const loc = freshPoint();
    assert.deepEqual(await fetchWeather(loc, opts), { current: {}, daily: {}, hourly: {} });
    assert.deepEqual(await fetchAirQuality(loc, opts), { us_aqi: 12 });
    assert.deepEqual(await fetchHistoricalAverage(loc, opts), { baseline: 55, years: 2 });
    assert.equal((await geocodeCity('Testville', opts)).name, 'Testville');
    assert.equal((await reverseGeocode(1, 2, opts)).name, 'Revtown');
    assert.deepEqual(
      s.seen.map((r) => r.url.split('?')[0]),
      ['/v1/forecast', '/v1/air-quality', '/v1/archive', '/v1/search', '/v1/reverse']
    );
    assert.ok(s.seen[0].url.includes(`latitude=${loc.latitude}&longitude=${loc.longitude}`));
    for (const r of s.seen) assert.equal(r.headers['user-agent'], UA, r.url);
  } finally {
    s.close();
  }
});

test('reverseGeocode sends its fallback to fallbackBaseUrl, with the same headers', async () => {
  const primary = await standIn({ reverseFails: true });
  const fallback = await standIn();
  try {
    const opts = { baseUrl: primary.base, fallbackBaseUrl: fallback.base, headers: { 'User-Agent': UA } };
    assert.equal((await reverseGeocode(3, 4, opts)).name, 'Fallbackton');
    assert.deepEqual(primary.seen.map((r) => r.url.split('?')[0]), ['/v1/reverse']);
    assert.deepEqual(fallback.seen.map((r) => r.url.split('?')[0]), ['/data/reverse-geocode-client']);
    assert.equal(fallback.seen[0].headers['user-agent'], UA);
  } finally {
    primary.close();
    fallback.close();
  }
});

test('NWS fetchers keep their Accept header and add the caller’s User-Agent', async () => {
  const s = await standIn();
  const opts = { baseUrl: s.base, headers: { 'User-Agent': UA } };
  try {
    assert.deepEqual(await fetchAlerts(freshPoint(), opts), []);
    const obs = await fetchObservation(freshPoint(), opts);
    assert.equal(obs.precipCode, 61);
    assert.equal(obs.station, 'Test Station');
    // The stations link NWS returns is absolute; it is followed through the base.
    assert.deepEqual(
      s.seen.map((r) => r.url.split('?')[0].replace(/\/points\/.*/, '/points/…')),
      ['/alerts/active', '/points/…', '/gridpoints/OUN/1,2/stations', '/stations/KTST/observations/latest']
    );
    for (const r of s.seen) {
      assert.equal(r.headers['user-agent'], UA, r.url);
      assert.equal(r.headers.accept, 'application/geo+json', r.url);
    }
  } finally {
    s.close();
  }
});

test('a caller’s header of the same name replaces the fetcher’s own', async () => {
  const s = await standIn();
  try {
    await fetchAlerts(freshPoint(), { baseUrl: s.base, headers: { Accept: 'application/ld+json' } });
    assert.equal(s.seen[0].headers.accept, 'application/ld+json');
  } finally {
    s.close();
  }
});

test('pollen takes an absolute base, and keeps its error codes', async () => {
  const ok = await standIn();
  const down = await standIn({ pollenStatus: 503 });
  try {
    const loc = { latitude: 35.5, longitude: -97.5 };
    assert.deepEqual(await fetchPollen(loc, { baseUrl: ok.base, headers: { Referer: 'https://skyglance.web.app/' } }), {
      tree: null,
      grass: null,
      weed: null
    });
    assert.equal(ok.seen[0].url, '/api/pollen?lat=35.5&lng=-97.5');
    assert.equal(ok.seen[0].headers.referer, 'https://skyglance.web.app/');
    await assert.rejects(fetchPollen(loc, { baseUrl: down.base }), (err) => err.message === 'not_configured' && err.status === 503);
  } finally {
    ok.close();
    down.close();
  }
});

test('pollen takes a fetcher instead, which sees the relative path', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ tree: { value: 2 } }), { status: 200 });
  };
  assert.deepEqual(await fetchPollen({ latitude: 1, longitude: 2 }, { fetch: fetcher }), { tree: { value: 2 } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/pollen?lat=1&lng=2');
  assert.ok(calls[0].init.signal instanceof AbortSignal, 'the timeout still applies');
  assert.equal('fetch' in calls[0].init, false, 'the fetcher is not passed on as an init field');
});

test('every fetcher takes a fetcher, not only pollen', async () => {
  const urls = [];
  const fetcher = async (url) => {
    urls.push(url);
    return new Response('{}', { status: 500 });
  };
  const loc = freshPoint();
  await assert.rejects(fetchWeather(loc, { fetch: fetcher }));
  await assert.rejects(fetchAirQuality(loc, { fetch: fetcher }));
  await assert.rejects(fetchHistoricalAverage(loc, { fetch: fetcher }));
  await assert.rejects(geocodeCity('x', { fetch: fetcher }));
  assert.equal(await reverseGeocode(5, 6, { fetch: fetcher }), null);
  await assert.rejects(fetchAlerts(loc, { fetch: fetcher }));
  assert.equal(await fetchObservation(loc, { fetch: fetcher }), null);
  assert.equal(await fetchRadarFrame({ fetch: fetcher, baseUrl: 'https://radar.fetcher.test' }), null);
  assert.equal(urls.length, 9);
});

test('radar frame comes from the given base', async () => {
  const s = await standIn();
  try {
    const frame = await fetchRadarFrame({ baseUrl: s.base, headers: { 'User-Agent': UA } });
    assert.deepEqual(frame, { host: 'https://tiles.test', path: '/new', time: 2 });
    assert.equal(s.seen[0].url, '/public/weather-maps.json');
    assert.equal(s.seen[0].headers['user-agent'], UA);
  } finally {
    s.close();
  }
});

test('a trailing slash on the base does not double the path separator', async () => {
  const s = await standIn();
  try {
    await fetchAlerts(freshPoint(), { baseUrl: `${s.base}//` });
    await fetchPollen({ latitude: 1, longitude: 2 }, { baseUrl: `${s.base}/` });
    assert.deepEqual(s.seen.map((r) => r.url.split('?')[0]), ['/alerts/active', '/api/pollen']);
  } finally {
    s.close();
  }
});

test('caches are per base: a second base is asked, not answered from the first', async () => {
  const a = await standIn();
  const b = await standIn();
  try {
    const loc = freshPoint();
    for (const s of [a, b]) {
      await fetchAlerts(loc, { baseUrl: s.base });
      await fetchAirQuality(loc, { baseUrl: s.base });
      await fetchHistoricalAverage(loc, { baseUrl: s.base });
      await fetchObservation(loc, { baseUrl: s.base });
      await fetchRadarFrame({ baseUrl: s.base });
    }
    const paths = (s) => s.seen.map((r) => r.url.split('?')[0].replace(/\/points\/.*/, '/points/…'));
    const expected = [
      '/alerts/active',
      '/v1/air-quality',
      '/v1/archive',
      '/points/…',
      '/gridpoints/OUN/1,2/stations',
      '/stations/KTST/observations/latest',
      '/public/weather-maps.json'
    ];
    assert.deepEqual(paths(a), expected);
    assert.deepEqual(paths(b), expected);
    // And within one base the cache still holds.
    const before = a.seen.length;
    await fetchAlerts(loc, { baseUrl: a.base });
    await fetchObservation(loc, { baseUrl: a.base });
    await fetchRadarFrame({ baseUrl: a.base });
    assert.equal(a.seen.length, before);
  } finally {
    a.close();
    b.close();
  }
});

// ── With no options, nothing changed ────────────────────────────────────────

test('with no options every request is the one the app sent before', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    throw new Error('offline');
  });
  const loc = { latitude: 61.25, longitude: -149.75, timeZone: 'America/Anchorage' };
  await assert.rejects(fetchWeather(loc));
  await assert.rejects(fetchAirQuality(loc));
  await assert.rejects(fetchHistoricalAverage(loc));
  await assert.rejects(geocodeCity('Anchorage'));
  assert.equal(await reverseGeocode(61.25, -149.75), null);
  await assert.rejects(fetchAlerts(loc));
  assert.equal(await fetchObservation(loc), null);
  await assert.rejects(fetchPollen(loc));
  assert.equal(await fetchRadarFrame(), null);

  const tz = 'America%2FAnchorage';
  const expected = [
    [
      'https://api.open-meteo.com/v1/forecast?latitude=61.25&longitude=-149.75' +
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,dew_point_2m,precipitation,cloud_cover' +
        '&hourly=temperature_2m,weather_code,precipitation,cloud_cover,precipitation_probability' +
        '&minutely_15=precipitation,weather_code&forecast_minutely_15=16' +
        '&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,weather_code' +
        `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${tz}&forecast_days=6`,
      null
    ],
    [`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=61.25&longitude=-149.75&current=us_aqi,pm2_5,ozone&timezone=${tz}`, null],
    [/^https:\/\/archive-api\.open-meteo\.com\/v1\/archive\?latitude=61\.25&longitude=-149\.75&daily=temperature_2m_mean&temperature_unit=fahrenheit&timezone=America%2FAnchorage&start_date=\d{4}-\d\d-\d\d&end_date=\d{4}-\d\d-\d\d$/, null],
    ['https://geocoding-api.open-meteo.com/v1/search?name=Anchorage&count=1&language=en&format=json', null],
    ['https://geocoding-api.open-meteo.com/v1/reverse?latitude=61.25&longitude=-149.75&count=1&language=en&format=json', null],
    ['https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=61.25&longitude=-149.75&localityLanguage=en', null],
    ['https://api.weather.gov/alerts/active?point=61.2500,-149.7500', { Accept: 'application/geo+json' }],
    ['https://api.weather.gov/points/61.2500,-149.7500', { Accept: 'application/geo+json' }],
    ['/api/pollen?lat=61.25&lng=-149.75', null],
    ['https://api.rainviewer.com/public/weather-maps.json', null]
  ];
  assert.equal(calls.length, expected.length);
  calls.forEach(({ url, init }, i) => {
    const [want, headers] = expected[i];
    if (want instanceof RegExp) assert.match(url, want);
    else assert.equal(url, want);
    // The init is the timeout's signal, plus NWS's Accept, and nothing else.
    assert.deepEqual(Object.keys(init).sort(), headers ? ['headers', 'signal'] : ['signal'], url);
    assert.ok(init.signal instanceof AbortSignal, url);
    if (headers) assert.deepEqual(init.headers, headers, url);
  });
});
