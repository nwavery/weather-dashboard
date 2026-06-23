import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radarToCode } from '../src/lib/radar.js';

test('radarToCode maps echo + temperature to rain/snow at light/moderate', () => {
  assert.equal(radarToCode({ precip: true, intensity: 'light' }, 55), 61); // light rain
  assert.equal(radarToCode({ precip: true, intensity: 'moderate' }, 55), 63); // moderate rain
  assert.equal(radarToCode({ precip: true, intensity: 'light' }, 30), 71); // light snow (cold)
  assert.equal(radarToCode({ precip: true, intensity: 'moderate' }, 28), 73); // moderate snow
});

test('radarToCode returns null when there is no echo', () => {
  assert.equal(radarToCode({ precip: false }, 55), null);
  assert.equal(radarToCode(null, 55), null);
  assert.equal(radarToCode(undefined, 55), null);
});

test('radarToCode treats unknown temperature as rain (not snow)', () => {
  assert.equal(radarToCode({ precip: true, intensity: 'light' }, undefined), 61);
});
