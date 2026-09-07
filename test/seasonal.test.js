import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonalEffect } from '../src/lib/seasonal.js';

// Fixed instants keep these deterministic regardless of when the suite runs.
const MIN = 60e3;
const OKC = { lat: 35.61622, tz: 'America/Chicago' }; // northern hemisphere
const SYD = { lat: -33.87, tz: 'Australia/Sydney' }; // southern hemisphere

const at = (ms, loc, opts = {}) => seasonalEffect(new Date(ms), loc.lat, loc.tz, opts);

// Walk `days` of minutes from `startMs` and group the minutes that returned
// `kind` into contiguous spells.
function spells(startMs, days, loc, kind, opts = {}) {
  const out = [];
  let run = 0;
  for (let m = 0; m < days * 1440; m++) {
    if (at(startMs + m * MIN, loc, opts) === kind) {
      run += 1;
    } else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out;
}

test('autumn leaves gust a few times a day instead of running all season', () => {
  const days = 30;
  const runs = spells(Date.UTC(2026, 8, 10), days, OKC, 'leaves');
  const perDay = runs.length / days;
  const minutes = runs.reduce((a, b) => a + b, 0);

  assert.ok(perDay >= 4 && perDay <= 7, `${perDay.toFixed(2)} gusts/day, expected roughly 5`);
  // One slot is 3 minutes; adjacent slots pair up occasionally, never more.
  assert.ok(Math.max(...runs) <= 6, `longest gust ${Math.max(...runs)} min, expected <= 6`);
  assert.ok(Math.min(...runs) >= 3, `shortest gust ${Math.min(...runs)} min, expected >= 3`);
  // The whole point: leaves are on screen a tiny fraction of the season.
  const duty = minutes / (days * 1440);
  assert.ok(duty < 0.02, `leaves on screen ${(duty * 100).toFixed(2)}% of the month`);
});

test('a gust is stable across reloads and identical for every viewer', () => {
  // Find a minute inside a gust, then re-ask for it repeatedly.
  let gustMs = null;
  for (let m = 0; m < 1440 * 3 && gustMs === null; m++) {
    const ms = Date.UTC(2026, 8, 10) + m * MIN;
    if (at(ms, OKC) === 'leaves') gustMs = ms;
  }
  assert.ok(gustMs !== null, 'no gust found in three days');
  for (let i = 0; i < 5; i++) assert.equal(at(gustMs, OKC), 'leaves');
  // Whole seconds within the same minute agree too — no flicker mid-minute.
  for (const s of [0, 15, 45, 59]) assert.equal(at(gustMs + s * 1000, OKC), 'leaves');
});

test('two cards do not gust in lockstep', () => {
  const start = Date.UTC(2026, 8, 10);
  const other = { lat: 42.36, tz: 'America/New_York' };
  let a = 0;
  let b = 0;
  let both = 0;
  for (let m = 0; m < 30 * 1440; m++) {
    const ms = start + m * MIN;
    const x = at(ms, OKC) === 'leaves';
    const y = at(ms, other) === 'leaves';
    if (x) a++;
    if (y) b++;
    if (x && y) both++;
  }
  assert.ok(a > 0 && b > 0, 'both cards should gust sometimes');
  assert.ok(both < Math.min(a, b) / 4, `${both} simultaneous minutes of ${a}/${b} — too correlated`);
});

test('leaves stay suppressed by precipitation and outside autumn', () => {
  // A whole autumn month with precip on the card: never a leaf.
  assert.equal(spells(Date.UTC(2026, 9, 1), 30, OKC, 'leaves', { hasPrecip: true }).length, 0);
  // Summer and winter months in the north: never a leaf, gust slots or not.
  for (const [y, mo] of [[2026, 6], [2026, 0]]) {
    assert.equal(spells(Date.UTC(y, mo, 1), 28, OKC, 'leaves').length, 0, `month ${mo + 1} produced leaves`);
  }
});

test('autumn is hemisphere-aware', () => {
  // April is autumn in Sydney, spring in Oklahoma.
  assert.ok(spells(Date.UTC(2026, 3, 1), 20, SYD, 'leaves').length > 0, 'Sydney should gust in April');
  assert.equal(spells(Date.UTC(2026, 3, 1), 20, OKC, 'leaves').length, 0, 'Oklahoma should not gust in April');
  // …and October is the reverse.
  assert.ok(spells(Date.UTC(2026, 9, 1), 20, OKC, 'leaves').length > 0, 'Oklahoma should gust in October');
  assert.equal(spells(Date.UTC(2026, 9, 1), 20, SYD, 'leaves').length, 0, 'Sydney should not gust in October');
});

// ── Everything below is unchanged behaviour, pinned so the gust work can't
// quietly alter the holidays or the summer fireflies.
test('summer fireflies still run every night, ungated', () => {
  const nightMs = Date.UTC(2026, 6, 15, 6, 0); // 1 AM CDT
  assert.equal(at(nightMs, OKC, { isDark: true }), 'fireflies');
  assert.equal(at(nightMs, OKC, { isDark: false }), null); // daytime: nothing
  // Every sampled summer night, not a sample of them.
  for (let d = 0; d < 30; d++) {
    assert.equal(at(nightMs + d * 86400e3, OKC, { isDark: true }), 'fireflies', `night ${d}`);
  }
});

test('holidays are unchanged and outrank the season', () => {
  const noon = (y, mo, d) => Date.UTC(y, mo, d, 18); // ~noon CST/CDT
  const night = (y, mo, d) => Date.UTC(y, mo, d, 7); // ~1-2 AM local on that same local date
  assert.equal(at(noon(2026, 1, 14), OKC), 'hearts'); // Feb 14, all day, no dark gate
  assert.equal(at(noon(2026, 11, 25), OKC), 'snowflakes'); // Dec 25
  assert.equal(at(noon(2026, 11, 25), OKC, { hasPrecip: true }), null); // …unless it's snowing
  assert.equal(at(night(2026, 9, 31), OKC, { isDark: true }), 'bats'); // Halloween night
  // Halloween daytime returns null, NOT leaves: the holiday branch short-circuits autumn.
  assert.equal(at(noon(2026, 9, 31), OKC, { isDark: false }), null);
  assert.equal(at(night(2026, 6, 4), OKC, { isDark: true }), 'fireworks'); // Jul 4 in the Americas
  // Outside the Americas Jul 4 is not a holiday, so it falls through to the
  // ordinary summer night rather than setting off fireworks.
  assert.equal(at(night(2026, 6, 4), { lat: 51.5, tz: 'Europe/London' }, { isDark: true }), 'fireflies');
  assert.equal(at(night(2026, 11, 31), OKC, { isDark: true }), 'fireworks'); // New Year's Eve
});

test('a missing or broken location degrades to no effect', () => {
  assert.equal(seasonalEffect(new Date(Date.UTC(2026, 9, 1)), undefined, 'America/Chicago'), null);
  assert.equal(seasonalEffect(new Date(Date.UTC(2026, 9, 1)), NaN, 'America/Chicago'), null);
  assert.equal(seasonalEffect(new Date(Date.UTC(2026, 9, 1)), 35.6, 'Not/AZone'), null);
});
