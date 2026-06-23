import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshObservation } from '../src/lib/observation.js';

const iso = (minsAgo) => new Date(Date.now() - minsAgo * 60000).toISOString();

test('freshObservation returns a recent observation', () => {
  const obs = { precipCode: 61, dry: false, observedAt: iso(10) };
  assert.equal(freshObservation(obs), obs);
});

test('freshObservation drops a stale observation (>90 min)', () => {
  assert.equal(freshObservation({ precipCode: 61, dry: false, observedAt: iso(120) }), null);
});

test('freshObservation handles null / missing timestamp', () => {
  assert.equal(freshObservation(null), null);
  assert.equal(freshObservation({ precipCode: 61, dry: false }), null);
});

test('freshObservation keeps a fresh "dry" reading (so it can suppress model precip)', () => {
  const dry = { precipCode: null, dry: true, observedAt: iso(5) };
  assert.equal(freshObservation(dry), dry);
});
