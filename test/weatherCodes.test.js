import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveWeatherCode, isPrecipCode } from '../src/data/weatherCodes.js';

test('isPrecipCode flags liquid-precip / thunder codes only', () => {
  assert.equal(isPrecipCode(61), true); // rain
  assert.equal(isPrecipCode(95), true); // thunder
  assert.equal(isPrecipCode(3), false); // overcast
  assert.equal(isPrecipCode(71), false); // snow is not in the phantom set
});

test('phantom precip: a rain/thunder code at 0 mm falls back to cloud cover', () => {
  assert.equal(effectiveWeatherCode({ weather_code: 95, precipitation: 0, cloud_cover: 10 }), 0); // clear
  assert.equal(effectiveWeatherCode({ weather_code: 61, precipitation: 0, cloud_cover: 40 }), 1); // mainly clear
  assert.equal(effectiveWeatherCode({ weather_code: 63, precipitation: 0, cloud_cover: 60 }), 2); // partly cloudy
  assert.equal(effectiveWeatherCode({ weather_code: 82, precipitation: 0, cloud_cover: 95 }), 3); // overcast
});

test('real precipitation passes through untouched', () => {
  assert.equal(effectiveWeatherCode({ weather_code: 61, precipitation: 2, cloud_cover: 90 }), 61);
  assert.equal(effectiveWeatherCode({ weather_code: 95, precipitation: 8, cloud_cover: 90 }), 95);
});

test('snow at 0 mm is legitimate, not phantom', () => {
  assert.equal(effectiveWeatherCode({ weather_code: 71, precipitation: 0, cloud_cover: 90 }), 71);
});

test('a fresh observation with precip overrides a dry model', () => {
  const obs = { precipCode: 61, dry: false };
  assert.equal(effectiveWeatherCode({ weather_code: 3, precipitation: 0, cloud_cover: 100 }, obs), 61);
});

test('a dry observation suppresses model precip to its cloud cover', () => {
  const obs = { precipCode: null, dry: true };
  // model insists on violent showers; station says dry -> overcast from cloud cover
  assert.equal(effectiveWeatherCode({ weather_code: 82, precipitation: 15, cloud_cover: 95 }, obs), 3);
});

test('a dry observation leaves a non-precip model code alone', () => {
  const obs = { precipCode: null, dry: true };
  assert.equal(effectiveWeatherCode({ weather_code: 2, precipitation: 0, cloud_cover: 60 }, obs), 2);
});

test('missing data degrades gracefully', () => {
  assert.equal(effectiveWeatherCode(undefined), undefined);
  assert.equal(effectiveWeatherCode({ weather_code: 0 }), 0);
  // precip code with no precip field (e.g. fictional) is left as-is
  assert.equal(effectiveWeatherCode({ weather_code: 61 }), 61);
});
