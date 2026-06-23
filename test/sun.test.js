import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunPhase, isSunDown, sunScreenPosition, worldSun, worldDayFraction } from '../src/lib/sun.js';

// Fixed instants keep these deterministic regardless of when the suite runs.
const noonUTC = new Date(Date.UTC(2026, 5, 22, 12, 0, 0));

test('real sun: London is up around mid-day, down at deep night', () => {
  assert.equal(isSunDown(noonUTC, 51.5, -0.12), false);
  assert.equal(sunPhase(noonUTC, 51.5, -0.12), 'day');
  const midnightUTC = new Date(Date.UTC(2026, 5, 22, 0, 0, 0)); // ~01:00 BST
  assert.equal(isSunDown(midnightUTC, 51.5, -0.12), true);
});

test('real sun: missing coords are treated as "sun up" (no crash)', () => {
  assert.equal(isSunDown(noonUTC, undefined, undefined), false);
  assert.equal(sunPhase(noonUTC, undefined, undefined), null);
  assert.equal(sunScreenPosition(noonUTC, undefined, undefined), null);
});

test('sunScreenPosition is null when the sun is below the horizon', () => {
  const midnightUTC = new Date(Date.UTC(2026, 5, 22, 0, 0, 0));
  assert.equal(sunScreenPosition(midnightUTC, 51.5, -0.12), null);
});

test('worldSun: a 24h world is high at local noon, dark at local midnight', () => {
  // Chicago: pick instants that are local noon / local midnight.
  const localNoon = new Date(Date.UTC(2026, 5, 22, 17, 0, 0)); // 12:00 CDT
  const localMidnight = new Date(Date.UTC(2026, 5, 22, 5, 0, 0)); // 00:00 CDT
  const day = worldSun(localNoon, 'America/Chicago', 24);
  const night = worldSun(localMidnight, 'America/Chicago', 24);
  assert.equal(day.phase, 'day');
  assert.equal(day.dark, false);
  assert.ok(day.pos && day.pos.y < 12, 'noon sun rides high'); // small y = near top
  assert.equal(night.phase, 'night');
  assert.equal(night.dark, true);
  assert.equal(night.pos, null);
});

test('worldSun: a 12h world cycles twice as fast (dark + light within one civil day)', () => {
  const tz = 'Europe/Lisbon';
  const states = [];
  for (let h = 0; h < 24; h += 1) {
    states.push(worldSun(new Date(Date.UTC(2026, 5, 22, h, 0, 0)), tz, 12).dark);
  }
  const flips = states.filter((d, i) => i > 0 && d !== states[i - 1]).length;
  assert.ok(flips >= 3, `expected multiple day/night flips in a civil day, got ${flips}`);
});

test('worldSun: invalid timezone falls back instead of throwing', () => {
  const s = worldSun(noonUTC, 'Not/AZone', 24);
  assert.ok(['day', 'night', 'dawn', 'dusk'].includes(s.phase));
});

test('worldDayFraction stays within [0,1)', () => {
  for (const h of [0, 6, 13, 23]) {
    const f = worldDayFraction(new Date(Date.UTC(2026, 5, 22, h, 0, 0)), 'America/Chicago', 26);
    assert.ok(f >= 0 && f < 1, `fraction ${f} out of range`);
  }
});
