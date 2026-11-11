import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchWeather, fetchAirQuality, fetchHistoricalAverage, geocodeCity, reverseGeocode } from '../src/lib/openMeteo.js';
import { fetchAlerts } from '../src/lib/alerts.js';
import { fetchObservation } from '../src/lib/observation.js';
import { fetchPollen } from '../src/lib/pollen.js';
import { fetchRadarFrame } from '../src/lib/radar.js';

// The rule: `timeoutMs` bounds a whole call, body included, and `signal`
// aborts it; with neither, a call behaves as it always did, where the timer
// stops at the headers. Each fetcher either rejects or, for the ones that
// answer null on any failure, resolves null.

// Sends headers and the start of a body, then never finishes.
async function stallingServer() {
  const sockets = new Set();
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{"features":');
  });
  server.on('connection', (s) => sockets.add(s));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => {
      for (const s of sockets) s.destroy();
      server.close();
    }
  };
}

let nextLat = 1;
const point = () => ({ latitude: nextLat++ + 0.25, longitude: 2.5, timeZone: 'UTC' });

// Every fetcher, and what it does when its call is cut short.
const CALLS = [
  ['fetchWeather', (o) => fetchWeather(point(), o), 'rejects'],
  ['fetchAirQuality', (o) => fetchAirQuality(point(), o), 'rejects'],
  ['fetchHistoricalAverage', (o) => fetchHistoricalAverage(point(), o), 'rejects'],
  ['geocodeCity', (o) => geocodeCity('Anywhere', o), 'rejects'],
  ['reverseGeocode', (o) => reverseGeocode(5.5, 6.5, { ...o, fallbackBaseUrl: o.baseUrl }), 'null'],
  ['fetchAlerts', (o) => fetchAlerts(point(), o), 'rejects'],
  ['fetchObservation', (o) => fetchObservation(point(), o), 'null'],
  ['fetchPollen', (o) => fetchPollen(point(), o), 'rejects'],
  ['fetchRadarFrame', (o) => fetchRadarFrame(o), 'null']
];

async function settlesAs(promise, outcome, name, withinMs) {
  const t0 = Date.now();
  if (outcome === 'null') assert.equal(await promise, null, name);
  else await assert.rejects(promise, (e) => e.name === 'TimeoutError' || e.name === 'AbortError', name);
  assert.ok(Date.now() - t0 < withinMs, `${name} took ${Date.now() - t0} ms`);
}

test('timeoutMs ends every fetcher whose body stalls after the headers', async () => {
  const srv = await stallingServer();
  try {
    await Promise.all(CALLS.map(([name, call, outcome]) => settlesAs(call({ baseUrl: srv.base, timeoutMs: 300 }), outcome, name, 3000)));
  } finally {
    srv.close();
  }
});

test('a caller signal ends every fetcher whose body stalls', async () => {
  const srv = await stallingServer();
  try {
    const ctrl = new AbortController();
    const pending = CALLS.map(([name, call, outcome]) => settlesAs(call({ baseUrl: srv.base, signal: ctrl.signal }), outcome, name, 3000));
    setTimeout(() => ctrl.abort(), 200);
    await Promise.all(pending);
  } finally {
    srv.close();
  }
});

test('an already aborted signal ends every fetcher at once', async () => {
  const srv = await stallingServer();
  try {
    const signal = AbortSignal.abort();
    await Promise.all(CALLS.map(([name, call, outcome]) => settlesAs(call({ baseUrl: srv.base, signal }), outcome, name, 1000)));
  } finally {
    srv.close();
  }
});

test('timeoutMs aborts the request itself, so its socket is released', async () => {
  let opened = 0;
  let closed = 0;
  const server = http.createServer((req, res) => {
    opened++;
    res.on('close', () => closed++);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{"features":');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await assert.rejects(fetchAlerts(point(), { baseUrl: base, timeoutMs: 200 }));
    await assert.rejects(fetchPollen(point(), { baseUrl: base, timeoutMs: 200 }));
    assert.equal(await fetchRadarFrame({ baseUrl: base, timeoutMs: 200 }), null);
    for (let i = 0; i < 50 && closed < opened; i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(opened, 3);
    assert.equal(closed, 3, 'a timed-out request was left open on the server');
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test('timeoutMs also ends a custom fetch that ignores its signal', async () => {
  const never = () => new Promise(() => {});
  await Promise.all(CALLS.map(([name, call, outcome]) => settlesAs(call({ fetch: never, timeoutMs: 200 }), outcome, name, 2000)));
});

test('timeoutMs also ends a custom fetch whose body ignores its signal', async () => {
  // Headers at once, then a body that never arrives and never aborts.
  const stuckBody = async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) });
  await Promise.all(CALLS.map(([name, call, outcome]) => settlesAs(call({ fetch: stuckBody, timeoutMs: 200 }), outcome, name, 2000)));
});

test('timeoutMs replaces the 10 s header timer instead of adding to it', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // Rejects only when its signal aborts.
  const honest = (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
  let settled = null;
  const p = fetchAlerts(point(), { fetch: honest, timeoutMs: 15000 }).then(
    () => (settled = 'resolved'),
    (e) => (settled = e.name)
  );
  const turns = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  };
  await turns();
  t.mock.timers.tick(10000);
  await turns();
  assert.equal(settled, null, 'the 10 s header timer still fired');
  t.mock.timers.tick(5000);
  await turns();
  assert.equal(settled, 'TimeoutError');
  await p;
});

test('a bad timeoutMs is an error, even from the fetchers that answer null', async () => {
  for (const bad of [0, -1, Infinity, NaN, '500', null]) {
    for (const [name, call] of CALLS) {
      await assert.rejects(Promise.resolve().then(() => call({ fetch: async () => new Response('{}'), timeoutMs: bad })), TypeError, `${name} ${bad}`);
    }
  }
});

test('with no signal or timeoutMs the body read is still unbounded, as in the browser app', async () => {
  // Pinned so the comments saying so stay true. The hook's 12 s race is what
  // unblocks the card in the app.
  const srv = await stallingServer();
  let settled = false;
  const p = fetchAlerts(point(), { baseUrl: srv.base }).then(
    () => (settled = true),
    () => (settled = true)
  );
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(settled, false);
  srv.close();
  await p;
});
