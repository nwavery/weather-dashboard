import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headlineFlavor } from '../src/lib/headline.js';

const TZ = 'America/Chicago';
const base = () => new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
const naive = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
// 15-min series with precip (code + mm) only at slot `onsetMin` (multiple of 15).
function minutely(onsetMin, code = 61, mm = 2) {
  const b = base();
  const time = [];
  const precipitation = [];
  const weather_code = [];
  for (let m = 0; m <= 180; m += 15) {
    time.push(naive(new Date(b.getTime() + m * 60000)));
    const hit = m === onsetMin;
    precipitation.push(hit ? mm : 0);
    weather_code.push(hit ? code : 1);
  }
  return { time, precipitation, weather_code };
}
const benign = {
  weather_code: 1,
  precipitation: 0,
  wind_speed_10m: 5,
  wind_gusts_10m: 9,
  relative_humidity_2m: 55,
  apparent_temperature: 70,
  temperature_2m: 70,
  dew_point_2m: 48
};
const flavor = (opts) =>
  headlineFlavor({ current: { ...benign }, air: { us_aqi: 25 }, hourly: {}, timeZone: TZ, effCode: 1, ...opts });
const label = (mn, code, mm) => flavor({ minutely: minutely(mn, code, mm) })?.label;

test('incoming-precip wording escalates by lead time', () => {
  assert.equal(label(15), 'Rain imminent'); // <30 min
  assert.equal(label(60), 'Rain incoming'); // ~1 h
  assert.equal(label(120), 'Rain approaching'); // ~2 h
  assert.equal(label(165), 'Rain on the way'); // ~3 h
});

test('the kind drives the noun', () => {
  assert.equal(label(15, 71, 1), 'Snow imminent');
  assert.equal(label(120, 95, 8), 'Storm approaching');
});

test('phantom thunderstorm (code 95 at 0 mm) does not raise a storm', () => {
  const f = flavor({ minutely: minutely(60, 95, 0) });
  assert.notEqual(f?.label, 'Storm incoming');
  assert.equal(f?.label, 'Quite dry'); // falls through to the comfort word
});

test('no upcoming precip falls through to the comfort word', () => {
  assert.equal(flavor({ minutely: minutely(99999) })?.label, 'Quite dry');
});

test('not flagged when it is already precipitating (effCode is a precip code)', () => {
  const f = flavor({ minutely: minutely(15), effCode: 61 });
  assert.notEqual(f?.label, 'Rain imminent');
});

// ── Trace precip needs the odds behind it ─────────────────────────────────
// Whole-hour series spanning the look-ahead, each hour at `pct` % chance.
function hourly(pct) {
  const h0 = base();
  h0.setMinutes(0, 0, 0);
  const time = [];
  const precipitation_probability = [];
  for (let k = -1; k <= 5; k++) {
    time.push(naive(new Date(h0.getTime() + k * 3600000)));
    precipitation_probability.push(pct);
  }
  return { time, precipitation_probability };
}
const labelWith = (mn, code, mm, pct) => flavor({ minutely: minutely(mn, code, mm), hourly: hourly(pct) })?.label;

test('a trace of drizzle at negligible odds is not "Rain imminent" (Oct 3, Rohan)', () => {
  // The real case: one 15-min slot of 0.1 mm WMO 51 drizzle, 2% hourly chance.
  assert.equal(labelWith(15, 51, 0.1, 2), 'Quite dry'); // falls through to the comfort word
});

test('a trace still counts when the odds back it up', () => {
  assert.equal(labelWith(15, 61, 0.1, 60), 'Rain imminent');
  assert.equal(labelWith(15, 61, 0.1, 30), 'Rain imminent'); // the floor itself counts
  assert.equal(labelWith(15, 61, 0.1, 29), 'Quite dry'); // just under it does not
});

test('a real amount still fires at low odds (the downpour exception survives)', () => {
  assert.equal(labelWith(15, 61, 0.6, 5), 'Rain imminent');
  assert.equal(labelWith(120, 95, 8, 5), 'Storm approaching');
});

test('snow is trusted by its code, odds or not', () => {
  assert.equal(labelWith(15, 71, 0, 5), 'Snow imminent');
});

test('a trace thunderstorm at low odds is not a storm warning', () => {
  assert.equal(labelWith(15, 95, 0.2, 10), 'Quite dry');
});

test('unknown odds keep the heads-up rather than hide it', () => {
  assert.equal(label(15, 51, 0.1), 'Rain imminent'); // no hourly series at all
  const h = hourly(2);
  h.precipitation_probability = h.precipitation_probability.map(() => null);
  assert.equal(flavor({ minutely: minutely(15, 51, 0.1), hourly: h })?.label, 'Rain imminent');
});

test('a slot takes the odds of the hour that contains it, not the hour before', () => {
  // Open-Meteo labels intervals by their END: the 15-min slot "hh+1:15" covers
  // hh+1:00-hh+1:15, which belongs to the hourly entry "hh+2:00", not "hh+1:00".
  // (Odds stay under 70% so the separate probability-only fallback can't fire.)
  const h0 = base();
  h0.setMinutes(0, 0, 0);
  const at = (min) => naive(new Date(h0.getTime() + min * 60000));
  const slot = at(75); // hh+1:15 — never on the hour, 15-75 min from now
  const series = (govPct, prevPct) => {
    const minutelyS = { time: [], precipitation: [], weather_code: [] };
    for (let k = 0; k <= 16; k++) {
      const t = at(k * 15);
      minutelyS.time.push(t);
      minutelyS.precipitation.push(t === slot ? 0.1 : 0);
      minutelyS.weather_code.push(t === slot ? 61 : 1);
    }
    const hourlyS = { time: [], precipitation_probability: [] };
    for (let k = -1; k <= 5; k++) {
      const t = at(k * 60);
      hourlyS.time.push(t);
      hourlyS.precipitation_probability.push(t === at(120) ? govPct : t === at(60) ? prevPct : 0);
    }
    return { minutely: minutelyS, hourly: hourlyS };
  };
  assert.equal(flavor(series(2, 60))?.label, 'Quite dry'); // its own hour says 2%
  assert.match(flavor(series(60, 2))?.label, /^Rain (imminent|incoming)$/); // its own hour says 60%
});

test('higher-priority flavors outrank the heads-up', () => {
  assert.equal(flavor({ air: { us_aqi: 200 }, minutely: minutely(15) }).label, 'Smoky haze');
  assert.equal(
    flavor({ current: { ...benign, temperature_2m: 100, relative_humidity_2m: 65 }, minutely: minutely(99999) }).label,
    'Scorching'
  );
});
