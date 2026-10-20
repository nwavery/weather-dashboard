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

import { recentDryObservation, OBS_DRY_TRUST_MS } from '../src/lib/observation.js';

test('recentDryObservation: a dry report keeps weight for 4 h, a wet one never does', () => {
  const NOW = Date.parse('2026-10-20T01:46:00Z');
  const at = (minsAgo, dry) => ({ precipCode: dry ? null : 61, dry, observedAt: new Date(NOW - minsAgo * 60000).toISOString() });
  assert.equal(OBS_DRY_TRUST_MS, 240 * 60000);
  assert.equal(recentDryObservation(at(96, true), NOW), true); // tonight: 96 min stale, "Clear"
  assert.equal(recentDryObservation(at(240, true), NOW), true);
  assert.equal(recentDryObservation(at(241, true), NOW), false);
  assert.equal(recentDryObservation(at(30, false), NOW), false); // it was raining: radar rule unchanged
  assert.equal(recentDryObservation(null, NOW), false);
  assert.equal(recentDryObservation({ dry: true }, NOW), false); // no timestamp, no trust
  assert.equal(recentDryObservation(at(-10, true), NOW), false); // future-stamped: ignore
});
