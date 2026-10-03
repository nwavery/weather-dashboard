import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planetPosition,
  sunPosition,
  moonPosition,
  angularSeparation,
  stepToward,
  parallaxAltitude,
  skyBodies
} from '../src/lib/planets.js';

// The ground truth here is real, published sky events — oppositions, greatest
// elongations, a great conjunction, eclipses. A transcription slip in any
// orbital element would move these by days or degrees, not minutes.
const H = 3600e3;
const DAY = 86400e3;
const at = (iso) => new Date(iso);
const sep = (a, b) => angularSeparation(a.ra, a.dec, b.ra, b.dec);
const elongation = (id, ms) => sep(planetPosition(id, new Date(ms)), sunPosition(new Date(ms)));

// Signed distance (degrees, -180..180) of a planet from exact opposition.
function fromOpposition(id, ms) {
  const d = planetPosition(id, new Date(ms)).lon - sunPosition(new Date(ms)).lon - 180;
  return ((d % 360) + 540) % 360 - 180;
}

function oppositionInstant(id, guessIso) {
  const g = Date.parse(guessIso);
  for (let t = g - 15 * DAY; t < g + 15 * DAY; t += 6 * H) {
    const a = fromOpposition(id, t);
    const b = fromOpposition(id, t + 6 * H);
    if (Math.sign(a) !== Math.sign(b) && Math.abs(a - b) < 90) {
      let lo = t;
      let hi = t + 6 * H;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(fromOpposition(id, mid)) === Math.sign(fromOpposition(id, lo))) lo = mid;
        else hi = mid;
      }
      return lo;
    }
  }
  return null;
}

test('oppositions land on their published dates', () => {
  for (const [id, date] of [
    ['mars', '2025-01-16'],
    ['jupiter', '2024-12-07'],
    ['saturn', '2025-09-21']
  ]) {
    const t = oppositionInstant(id, `${date}T12:00:00Z`);
    assert.ok(t !== null, `no ${id} opposition found near ${date}`);
    assert.equal(new Date(t).toISOString().slice(0, 10), date, `${id} opposition`);
  }
});

test('greatest elongations of Venus and Mercury match the almanac', () => {
  for (const [id, date, published] of [
    ['venus', '2025-01-10', 47.2],
    ['venus', '2025-06-01', 45.9],
    ['mercury', '2025-03-08', 18.2],
    ['mercury', '2025-04-21', 27.4]
  ]) {
    const centre = Date.parse(`${date}T12:00:00Z`);
    let best = -1;
    let bestT = 0;
    for (let t = centre - 12 * DAY; t <= centre + 12 * DAY; t += 2 * H) {
      const e = elongation(id, t);
      if (e > best) [best, bestT] = [e, t];
    }
    assert.ok(Math.abs(best - published) <= 0.2, `${id} ${date}: ${best.toFixed(2)}° vs ${published}°`);
    assert.ok(Math.abs(bestT - centre) <= 1.5 * DAY, `${id} peaked ${new Date(bestT).toISOString()}, expected ${date}`);
  }
});

test('the 2020 great conjunction: Jupiter and Saturn a tenth of a degree apart', () => {
  let min = Infinity;
  let minT = 0;
  for (let t = Date.parse('2020-12-10T00:00:00Z'); t <= Date.parse('2020-12-31T00:00:00Z'); t += 2 * H) {
    const d = sep(planetPosition('jupiter', new Date(t)), planetPosition('saturn', new Date(t)));
    if (d < min) [min, minT] = [d, t];
  }
  assert.ok(min < 0.2, `closest approach ${min.toFixed(3)}°, published 0.10°`);
  assert.ok(Math.abs(minT - Date.parse('2020-12-21T18:00:00Z')) <= DAY, `closest at ${new Date(minT).toISOString()}`);
  // …and a month earlier they were clearly two separate lights.
  assert.ok(sep(planetPosition('jupiter', at('2020-11-21T18:00:00Z')), planetPosition('saturn', at('2020-11-21T18:00:00Z'))) > 1.5);
});

test('the Moon lines up with the Sun at eclipses and sits 90° away at first quarter', () => {
  const sunMoon = (iso) => sep(moonPosition(at(iso)), sunPosition(at(iso)));
  assert.ok(sunMoon('2024-04-08T18:17:00Z') < 0.8, 'total solar eclipse, Apr 8 2024'); // published ~0.33° geocentric
  assert.ok(sunMoon('2025-03-14T06:59:00Z') > 179, 'total lunar eclipse, Mar 14 2025'); // published ~179.7°
  assert.ok(Math.abs(sunMoon('2025-03-06T16:32:00Z') - 90) < 2, 'first quarter, Mar 6 2025');
});

test('phase follows the elongation: full at a lunar eclipse, new at a solar one', () => {
  assert.ok(skyBodies(at('2025-03-14T06:59:00Z')).moon.illum > 0.99);
  assert.ok(skyBodies(at('2024-04-08T18:17:00Z')).moon.illum < 0.01);
  assert.ok(Math.abs(skyBodies(at('2025-03-06T16:32:00Z')).moon.illum - 0.5) < 0.04);
});

test('magnitudes are in the right order and range', () => {
  // At their 2024-25 oppositions / elongations (published: -2.8, -1.4, +0.6, -4.4).
  const jupiter = planetPosition('jupiter', at('2024-12-07T20:00:00Z')).mag;
  const mars = planetPosition('mars', at('2025-01-16T03:00:00Z')).mag;
  const saturn = planetPosition('saturn', at('2025-09-21T06:00:00Z')).mag;
  const venus = planetPosition('venus', at('2025-01-10T04:00:00Z')).mag;
  assert.ok(Math.abs(jupiter + 2.8) < 0.15, `Jupiter ${jupiter.toFixed(2)}`);
  assert.ok(Math.abs(mars + 1.4) < 0.15, `Mars ${mars.toFixed(2)}`);
  assert.ok(Math.abs(saturn - 0.6) < 0.2, `Saturn ${saturn.toFixed(2)}`);
  assert.ok(venus < -4.2 && venus > -4.8, `Venus ${venus.toFixed(2)}`);
  // The point of drawing them: each outshines Sirius (-1.46) when well placed.
  for (const m of [venus, jupiter]) assert.ok(m < -1.46);
});

test("Saturn's rings add brightness only when they are open to us", () => {
  // Isolate the ring contribution: the magnitude minus the ring-less law.
  const ringTerm = (iso) => {
    const p = planetPosition('saturn', at(iso));
    return p.mag - (-8.88 + 5 * Math.log10(p.r * p.dist) + 0.044 * p.phaseAngle);
  };
  // Mar 23 2025: Earth crossed the ring plane — rings edge-on, nothing to add.
  assert.ok(ringTerm('2025-03-23T12:00:00Z') > -0.1, `edge-on ${ringTerm('2025-03-23T12:00:00Z').toFixed(2)}`);
  // Dec 2032 opposition: rings near their widest (~27°) — close to a magnitude brighter.
  assert.ok(ringTerm('2032-12-24T18:00:00Z') < -0.8, `open ${ringTerm('2032-12-24T18:00:00Z').toFixed(2)}`);
});

test('every body stays finite and in range across 1900-2050', () => {
  for (let k = 0; k < 300; k++) {
    const ms = Date.UTC(1900, 0, 1) + (k / 300) * (Date.UTC(2050, 0, 1) - Date.UTC(1900, 0, 1));
    const { moon, sun, planets } = skyBodies(new Date(ms));
    for (const b of [moon, sun, ...planets]) {
      assert.ok(Number.isFinite(b.ra) && b.ra >= 0 && b.ra < 360, `ra ${b.ra}`);
      assert.ok(Number.isFinite(b.dec) && b.dec >= -90 && b.dec <= 90, `dec ${b.dec}`);
    }
    for (const p of planets) assert.ok(Number.isFinite(p.mag) && p.mag > -5 && p.mag < 6, `${p.id} mag ${p.mag}`);
    assert.ok(moon.illum >= 0 && moon.illum <= 1);
  }
});

test('geometry helpers', () => {
  // stepToward walks along the great circle toward the target.
  const east = stepToward(0, 0, 90, 0, 1);
  assert.ok(Math.abs(east.ra - 1) < 1e-9 && Math.abs(east.dec) < 1e-9);
  const north = stepToward(30, 0, 30, 60, 2);
  assert.ok(Math.abs(north.ra - 30) < 1e-9 && Math.abs(north.dec - 2) < 1e-9);
  assert.deepEqual(stepToward(10, 20, 10, 20, 1), { ra: 10, dec: 20 }); // no direction to step
  // The Moon sits lower by its parallax: fully at the horizon, not at all overhead.
  assert.ok(Math.abs(parallaxAltitude(0, 0.95) + 0.95) < 1e-12);
  assert.ok(Math.abs(parallaxAltitude(90, 0.95) - 90) < 1e-9);
  assert.ok(Math.abs(angularSeparation(0, 0, 180, 0) - 180) < 1e-9);
});
