import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveConditionCode, historicalText, sunCountdown, liveAlerts } from '../src/lib/conditions.js';
import { daylightInfo } from '../src/lib/sunTimes.js';

// A fixed clock a month before the real one, so a rule that read Date.now()
// instead of nowMs would see every observation here as weeks stale.
const NOW = Date.parse('2026-10-20T01:46:00Z');
const MIN = 60000;
const obsAt = (minsAgo, precipCode = null) => ({
  precipCode,
  dry: precipCode == null,
  observedAt: new Date(NOW - minsAgo * MIN).toISOString()
});
const model = (weather_code, precipitation = 0, cloud_cover = 50, temperature_2m = 60) => ({
  weather_code,
  precipitation,
  cloud_cover,
  temperature_2m
});
const WEAK = { precip: true, intensity: 'light', strong: false };
const STRONG = { precip: true, intensity: 'moderate', strong: true };
const NO_ECHO = { precip: false, strong: false };
const code = (current, observation = null, radar = null, nowMs = NOW) =>
  effectiveConditionCode({ current, observation, radar, nowMs });

// ── Effective condition: a fresh station report is ground truth ─────────────

test('a fresh station report adds the precip the model missed', () => {
  assert.equal(code(model(3), obsAt(10, 63)), 63);
  // …and replaces precip the model already had, even a storm.
  assert.equal(code(model(95, 2.5), obsAt(10, 63)), 63);
});

test('a fresh dry station report drops model precip to its cloud cover', () => {
  assert.equal(code(model(63, 1.2, 90), obsAt(10)), 3); // overcast
  assert.equal(code(model(63, 1.2, 10), obsAt(10)), 0); // clear
  // A non-precip model code is left alone.
  assert.equal(code(model(2, 0, 10), obsAt(10)), 2);
});

test('radar is not consulted while a station report is fresh, even a strong echo', () => {
  assert.equal(code(model(1, 0, 30), obsAt(10), STRONG), 1);
  assert.equal(code(model(1, 0, 30), obsAt(90), STRONG), 1);
  // A fresh wet report keeps its own code over radar's.
  assert.equal(code(model(1), obsAt(10, 51), STRONG), 51);
});

test('the station override lasts exactly 90 minutes, both ways', () => {
  // Dry report over model rain: suppressed at 90 min, not one ms later.
  assert.equal(code(model(63, 1.2, 90), obsAt(90)), 3);
  assert.equal(code(model(63, 1.2, 90), obsAt(90 + 1 / MIN)), 63);
  // Wet report over a dry model: added at 90 min, not one ms later.
  assert.equal(code(model(2), obsAt(90, 61)), 61);
  assert.equal(code(model(2), obsAt(90 + 1 / MIN, 61)), 2);
});

test('a stale wet report adds nothing and does not block radar', () => {
  assert.equal(code(model(2), obsAt(120, 63)), 2);
  assert.equal(code(model(2), obsAt(120, 63), WEAK), 61);
});

test('a report with no timestamp is ignored entirely', () => {
  assert.equal(code(model(2), { precipCode: 63, dry: false }), 2);
  assert.equal(code(model(2), { precipCode: null, dry: true }, WEAK), 61); // no dry trust either
});

test('a future-stamped report still counts as fresh (behaviour kept as found)', () => {
  // freshObservation only bounds age from above. recentDryObservation rejects
  // a future stamp, so the two disagree; recorded here, not changed.
  assert.equal(code(model(2), obsAt(-10, 63)), 63);
});

// ── Effective condition: the model, then radar ───────────────────────────────

test('model precip over 0 mm is phantom and drops to cloud cover', () => {
  assert.equal(code(model(95, 0, 10)), 0);
  assert.equal(code(model(61, 0, 60)), 2);
  // No precipitation field at all is not a 0 mm reading.
  assert.equal(code({ weather_code: 61, cloud_cover: 60, temperature_2m: 60 }), 61);
});

test('radar adds rain or snow by temperature when nothing shows precip', () => {
  assert.equal(code(model(2), null, WEAK), 61);
  assert.equal(code(model(2), null, STRONG), 63);
  assert.equal(code(model(2, 0, 50, 35), null, WEAK), 61);
  assert.equal(code(model(2, 0, 50, 34), null, WEAK), 71);
  // A phantom storm is dropped first, then radar may add real rain.
  assert.equal(code(model(95, 0, 10), null, WEAK), 61);
});

test('radar never removes precip and never replaces a liquid precip code', () => {
  assert.equal(code(model(63, 1.2), null, NO_ECHO), 63);
  assert.equal(code(model(63, 1.2), null, null), 63);
  assert.equal(code(model(65, 8), null, STRONG), 65); // heavy rain stays heavy
  assert.equal(code(model(51, 0.1), null, STRONG), 51); // drizzle stays drizzle
  assert.equal(code(model(2), null, NO_ECHO), 2);
});

test('radar can replace a model snow code, because snow is not a liquid precip code', () => {
  // Behaviour kept as found: snow is outside isPrecipCode, so the radar branch
  // runs and picks rain or snow by temperature alone.
  assert.equal(code(model(73, 0, 90, 36), null, WEAK), 61);
  assert.equal(code(model(73, 0, 90, 30), null, WEAK), 71);
});

test('no model code means no radar either', () => {
  assert.equal(code({ temperature_2m: 60 }, null, STRONG), undefined);
  assert.equal(code(null, obsAt(10, 63), STRONG), undefined);
  assert.equal(code(undefined), undefined);
});

// ── Effective condition: a dry report keeps weight for 4 hours ──────────────

test('a stale dry report within 4 h outranks a weak echo, not a strong one', () => {
  assert.equal(code(model(2), obsAt(96), WEAK), 2); // the Oct 19 incident
  assert.equal(code(model(2), obsAt(240), WEAK), 2);
  assert.equal(code(model(2), obsAt(241), WEAK), 61);
  assert.equal(code(model(2), obsAt(96), STRONG), 63);
});

test('a stale dry report does not suppress model rain', () => {
  // The 4 h window only gates radar; dropping model rain needs a fresh report.
  assert.equal(code(model(63, 1.2, 90), obsAt(96)), 63);
});

test('as the clock moves past one report, the rules hand over at 90 min and 4 h', () => {
  const report = obsAt(0);
  for (let m = 0; m <= 300; m++) {
    const at = NOW + m * MIN;
    const weak = code(model(2), report, WEAK, at);
    const strong = code(model(2), report, STRONG, at);
    assert.equal(weak, m <= 240 ? 2 : 61, `weak echo, report ${m} min old`);
    assert.equal(strong, m <= 90 ? 2 : 63, `strong echo, report ${m} min old`);
  }
});

test('the clock is required', () => {
  assert.throws(() => effectiveConditionCode({ current: model(2) }), TypeError);
  assert.throws(() => effectiveConditionCode({ current: model(2), nowMs: new Date(NOW) }), TypeError);
  assert.throws(() => effectiveConditionCode({ current: model(2), nowMs: NaN }), TypeError);
});

// ── Historical comparison ───────────────────────────────────────────────────

const wx = (daily) => ({ daily });
const hist = (baseline, years = 10) => ({ baseline, years });

test('historical: today is the daily mean, the midpoint only when the mean is missing', () => {
  const d = { temperature_2m_mean: [60], temperature_2m_max: [80], temperature_2m_min: [50] };
  assert.equal(historicalText(wx(d), hist(60), 'imperial'), 'vs 10y avg: ↔ right on average');
  // Midpoint 65 when the mean is NaN or absent.
  const nan = { ...d, temperature_2m_mean: [NaN] };
  assert.equal(historicalText(wx(nan), hist(60), 'imperial'), 'vs 10y avg: ↑ 5° warmer');
  const absent = { temperature_2m_max: [80], temperature_2m_min: [50] };
  assert.equal(historicalText(wx(absent), hist(60), 'imperial'), 'vs 10y avg: ↑ 5° warmer');
});

test('historical: nothing to compare gives a placeholder', () => {
  assert.equal(historicalText(null, hist(60), 'imperial'), 'vs. Historical: --');
  assert.equal(historicalText({}, hist(60), 'imperial'), 'vs. Historical: --');
  const noTemps = { temperature_2m_max: [null], temperature_2m_min: [50] };
  assert.equal(historicalText(wx(noTemps), hist(60), 'imperial'), 'vs. Historical: --');
});

test('historical: no baseline yet shows today’s average in the reading’s unit', () => {
  const d = { temperature_2m_mean: [60.4], temperature_2m_max: [70], temperature_2m_min: [50] };
  assert.equal(historicalText(wx(d), null, 'imperial'), 'Today avg: 60°F');
  assert.equal(historicalText(wx(d), null, 'metric'), 'Today avg: 16°C');
});

test('historical: warmer and cooler, with the number of years actually averaged', () => {
  const at = (mean) => wx({ temperature_2m_mean: [mean], temperature_2m_max: [0], temperature_2m_min: [0] });
  assert.equal(historicalText(at(65), hist(60), 'imperial'), 'vs 10y avg: ↑ 5° warmer');
  assert.equal(historicalText(at(55), hist(60, 9), 'imperial'), 'vs 9y avg: ↓ 5° cooler');
});

test('historical: the gap is converted to °C before rounding', () => {
  const at = (mean) => wx({ temperature_2m_mean: [mean], temperature_2m_max: [0], temperature_2m_min: [0] });
  assert.equal(historicalText(at(69), hist(60), 'metric'), 'vs 10y avg: ↑ 5° warmer');
  assert.equal(historicalText(at(51), hist(60), 'metric'), 'vs 10y avg: ↓ 5° cooler');
  // 0.8 °F is a degree in °F and nothing in °C.
  assert.equal(historicalText(at(60.8), hist(60), 'imperial'), 'vs 10y avg: ↑ 1° warmer');
  assert.equal(historicalText(at(60.8), hist(60), 'metric'), 'vs 10y avg: ↔ right on average');
  assert.equal(historicalText(at(59.2), hist(60), 'imperial'), 'vs 10y avg: ↓ 1° cooler');
});

test('historical: a half-degree gap rounds toward warmer (behaviour kept as found)', () => {
  // Math.round sends +0.5 to 1 and -0.5 to -0, so the same size of gap reads
  // "1° warmer" one way and "right on average" the other.
  const at = (mean) => wx({ temperature_2m_mean: [mean], temperature_2m_max: [0], temperature_2m_min: [0] });
  assert.equal(historicalText(at(60.5), hist(60), 'imperial'), 'vs 10y avg: ↑ 1° warmer');
  assert.equal(historicalText(at(59.5), hist(60), 'imperial'), 'vs 10y avg: ↔ right on average');
});

// ── Sun countdown ───────────────────────────────────────────────────────────

const T = Date.parse('2026-06-15T12:00:00Z');
const day = (sunriseMin, sunsetMin, nextMin, deltaSec = 30) => ({
  sunrise: sunriseMin == null ? null : new Date(T + sunriseMin * MIN),
  sunset: sunsetMin == null ? null : new Date(T + sunsetMin * MIN),
  nextSunrise: nextMin == null ? null : new Date(T + nextMin * MIN),
  polar: null,
  deltaSec
});

test('sun: counts to sunrise, then sunset, then tomorrow’s sunrise', () => {
  assert.equal(sunCountdown(day(192, 900, 1632), T).until, 'sunrise in 3h 12m');
  assert.equal(sunCountdown(day(-300, 45, 1000), T).until, 'sunset in 45m');
  assert.equal(sunCountdown(day(-900, -60, 600), T).until, 'sunrise in 10h 0m');
});

test('sun: at the sunrise instant it has moved on to sunset', () => {
  assert.equal(sunCountdown(day(0, 600, 1500), T).until, 'sunset in 10h 0m');
  assert.equal(sunCountdown(day(-300, 0, 600), T).until, 'sunrise in 10h 0m');
});

test('sun: durations round to the minute', () => {
  const at = (ms) => sunCountdown(day(ms / MIN, 900, 1600), T).until;
  assert.equal(at(29 * 1000), 'sunrise in 0m');
  assert.equal(at(30 * 1000), 'sunrise in 1m');
  assert.equal(at(59.5 * MIN), 'sunrise in 1h 0m');
  assert.equal(at(61 * MIN), 'sunrise in 1h 1m');
});

test('sun: missing times fall through to the next one there is', () => {
  assert.equal(sunCountdown(day(null, 120, 900), T).until, 'sunset in 2h 0m');
  assert.equal(sunCountdown(day(-900, -60, null), T).until, null);
  assert.equal(sunCountdown(day(-900, -60, null), T).daylightDelta, '+30 sec vs yesterday');
});

test('sun: polar days and nights, and no sun at all, show neither line', () => {
  for (const polar of ['day', 'night']) {
    assert.deepEqual(sunCountdown({ ...day(60, 600, 1500), polar }, T), { until: null, daylightDelta: null });
  }
  assert.deepEqual(sunCountdown(null, T), { until: null, daylightDelta: null });
});

test('sun: daylight change to the second, with a real minus sign', () => {
  const delta = (s) => sunCountdown(day(60, 600, 1500, s), T).daylightDelta;
  assert.equal(delta(107), '+1 min 47 sec vs yesterday');
  assert.equal(delta(-12), '−12 sec vs yesterday');
  assert.equal(delta(-60), '−1 min 0 sec vs yesterday');
  assert.equal(delta(59), '+59 sec vs yesterday');
  assert.equal(delta(0), '0 sec vs yesterday');
  assert.equal(delta(null), null);
});

test('sun: the fall-back evening counts to Monday’s sunrise, not 0m (Nov 1 2026)', () => {
  // Built the instant the local day turned, viewed at 6:27:37 PM CST.
  const sun = daylightInfo(new Date('2026-11-01T05:00:05Z'), 35.61622, -97.69454, 'America/Chicago');
  const { until } = sunCountdown(sun, Date.parse('2026-11-02T00:27:37Z'));
  assert.match(until, /^sunrise in 12h 2\dm$/);
});

test('sun: the clock is required', () => {
  assert.throws(() => sunCountdown(day(60, 600, 1500)), TypeError);
});

// ── Live alerts ─────────────────────────────────────────────────────────────

test('alerts: drops an alert the instant it ends, keeps one with no end', () => {
  const iso = (ms) => new Date(ms).toISOString();
  const alerts = [
    { id: 'open', ends: null },
    { id: 'later', ends: iso(NOW + 1) },
    { id: 'now', ends: iso(NOW) },
    { id: 'past', ends: iso(NOW - MIN) },
    { id: 'garbled', ends: 'not a date' },
    { id: 'blank', ends: '' }
  ];
  const before = structuredClone(alerts);
  assert.deepEqual(liveAlerts(alerts, NOW).map((a) => a.id), ['open', 'later', 'blank']);
  assert.deepEqual(alerts, before); // the input is not touched
  // One tick later "later" has ended too.
  assert.deepEqual(liveAlerts(alerts, NOW + 1).map((a) => a.id), ['open', 'blank']);
});

test('alerts: no list is an empty list, and the clock is required', () => {
  assert.deepEqual(liveAlerts(null, NOW), []);
  assert.deepEqual(liveAlerts(undefined, NOW), []);
  assert.throws(() => liveAlerts([]), TypeError);
});
