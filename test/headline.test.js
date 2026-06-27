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

test('higher-priority flavors outrank the heads-up', () => {
  assert.equal(flavor({ air: { us_aqi: 200 }, minutely: minutely(15) }).label, 'Smoky haze');
  assert.equal(
    flavor({ current: { ...benign, temperature_2m: 100, relative_humidity_2m: 65 }, minutely: minutely(99999) }).label,
    'Scorching'
  );
});
