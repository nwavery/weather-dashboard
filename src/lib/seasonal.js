// Date-aware seasonal & holiday flourishes for real-city cards. Returns a
// WorldEffects kind (or null). Holidays match the location's local calendar
// date; seasons are hemisphere-aware. Lower priority than weather "flavor"
// effects (windy leaves, smoke, dust), which the caller checks first.

import { hashStr, rand01 } from './hash.js';

// Autumn lasts three months, and a flourish that never stops is just wallpaper:
// on an always-on display the same ten leaves looped for the entire season. So
// the leaves arrive as GUSTS — a few minutes at a time, a handful of times a
// day. Deterministic like the worlds' scheduled events: a pure function of
// (card, wall-clock), so every viewer sees the same gust at the same moment and
// a reload never rerolls it.
//
// Measured over 90 days: ~4.9 gusts a day, ~15 minutes of leaves in 24 hours.
// Adjacent slots pair up about 1% of the time, which reads as a longer gust.
const GUST_SLOT_MS = 3 * 60 * 1000;
const GUST_CHANCE = 0.01;

// Seeded per card so two autumn cities don't gust in lockstep.
function leafGust(ms, latitude, timeZone) {
  const seed = hashStr(`${latitude}|${timeZone || ''}`);
  return rand01(seed, Math.floor(ms / GUST_SLOT_MS)) < GUST_CHANCE;
}

// Preview override: ?seasonal=1 forces the seasonal flourish on, so a leaf gust
// can be seen without waiting for its slot (same trick as ?worldevent= and
// ?meteor=). Guarded so the module still works under Node in tests.
function forcedSeasonal() {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('seasonal') === '1';
  } catch {
    return false;
  }
}

export function seasonalEffect(date, latitude, timeZone, { isDark = false, hasPrecip = false } = {}) {
  if (typeof latitude !== 'number' || Number.isNaN(latitude)) return null;
  let mm;
  let dd;
  try {
    const ymd = date.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD in tz
    mm = Number(ymd.slice(5, 7));
    dd = Number(ymd.slice(8, 10));
  } catch {
    return null;
  }
  if (!mm) return null;
  const md = mm * 100 + dd; // e.g. 704 = Jul 4
  const south = latitude < 0;

  // ── Holidays (date-specific) take priority ──
  if (md === 1231 || md === 101) return isDark ? 'fireworks' : null; // New Year's
  if (md === 214) return 'hearts'; // Valentine's Day
  if (md === 704 && /America\//.test(timeZone || '')) return isDark ? 'fireworks' : null; // July 4th (Americas)
  if (md === 1031) return isDark ? 'bats' : null; // Halloween night
  if (md >= 1223 && md <= 1226 && !hasPrecip) return 'snowflakes'; // Christmas

  // ── Seasons (hemisphere-aware), lower priority ──
  const isSummer = south ? mm === 12 || mm <= 2 : mm >= 6 && mm <= 8;
  const isAutumn = south ? mm >= 3 && mm <= 5 : mm >= 9 && mm <= 11;
  if (isSummer && isDark) return 'fireflies'; // warm summer nights
  // Autumn leaves blow through in gusts rather than drifting all season.
  if (isAutumn && !hasPrecip && (forcedSeasonal() || leafGust(date.getTime(), latitude, timeZone))) {
    return 'leaves';
  }

  return null;
}
