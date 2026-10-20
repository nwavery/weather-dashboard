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

// ── Stale-but-dry station vs a weak radar echo ──────────────────────────────
// Universal Blue colours from RainViewer's published table, as [r, g, b, a].
import { summarizeEcho } from '../src/lib/radar.js';
const C = {
  rain8: [0xb6, 0xa9, 0x7e, 130], // 8 dBZ — tonight's echo over Rohan (Oct 19 2026)
  rain15: [0x88, 0xdd, 0xee, 255], // 15 dBZ — opaque, so alpha can't say more
  rain35: [0xff, 0xee, 0x00, 255],
  rain39: [0xff, 0xb7, 0x00, 255],
  rain40: [0xff, 0xaa, 0x00, 255],
  snow39: [0x32, 0x72, 0xff, 255],
  snow40: [0x2f, 0x6f, 0xff, 255],
  none: [0, 0, 0, 0]
};
const patch = (...colors) => Uint8ClampedArray.from([...colors, ...Array(9 - colors.length).fill(C.none)].flat());

test("tonight's incident: 9/9 pixels of an 8 dBZ echo is a weak echo, not a strong one", () => {
  const echo = summarizeEcho(patch(...Array(9).fill(C.rain8)));
  assert.equal(echo.precip, true);
  assert.equal(echo.strong, false);
  assert.equal(radarToCode(echo, 62), 61); // the old outcome: "Slight rain"…
  assert.equal(radarToCode(echo, 62, { recentDry: true }), null); // …now: trust the dry report
});

test('only 40+ dBZ colours count as strong, rain or snow', () => {
  for (const c of [C.rain15, C.rain35, C.rain39, C.snow39]) assert.equal(summarizeEcho(patch(c)).strong, false);
  for (const c of [C.rain40, C.snow40]) assert.equal(summarizeEcho(patch(c)).strong, true);
  // One strong pixel in the patch is enough.
  assert.equal(summarizeEcho(patch(C.rain8, C.rain8, C.rain40)).strong, true);
  // An unknown colour (palette changed) is never strong: fail toward dry.
  assert.equal(summarizeEcho(patch([0xff, 0xab, 0x00, 255])).strong, false);
  // An empty patch is no echo at all.
  assert.deepEqual(summarizeEcho(patch()), { precip: false, strong: false });
});

test('a strong echo still adds rain over a recent dry report', () => {
  const echo = summarizeEcho(patch(...Array(9).fill(C.rain40)));
  assert.equal(radarToCode(echo, 70, { recentDry: true }), 63); // broad and opaque → moderate rain
  assert.equal(radarToCode(echo, 30, { recentDry: true }), 73); // snow by temperature
});

test('without a recent dry report the radar rule is unchanged', () => {
  const weak = summarizeEcho(patch(C.rain8));
  assert.equal(radarToCode(weak, 62), 61);
  assert.equal(radarToCode(weak, 62, { recentDry: false }), 61);
});
