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

// ── Tile maths, usable without a page ───────────────────────────────────────
import { radarTile, radarTileUrl, echoPatchOrigin, radarReading } from '../src/lib/radar.js';

// The formula as it stood inline in fetchRadar before it was exported, kept
// here to prove the move changed nothing but the pixel clamp.
function tileAsItWas(latitude, longitude) {
  const lat = Math.max(-85, Math.min(85, latitude));
  const n = 2 ** 7;
  const fx = ((longitude + 180) / 360) * n;
  const latR = (lat * Math.PI) / 180;
  const fy = ((1 - Math.asinh(Math.tan(latR)) / Math.PI) / 2) * n;
  const xt = Math.min(Math.max(Math.floor(fx), 0), n - 1);
  const yt = Math.min(Math.max(Math.floor(fy), 0), n - 1);
  return { xt, yt, px: Math.floor((fx - xt) * 256), py: Math.floor((fy - yt) * 256) };
}

test('radarTile finds the standard slippy-map tile', () => {
  // London is tile 511/340 at z10, so 63/42 at z7.
  const london = radarTile(51.5074, -0.1278);
  assert.deepEqual([london.z, london.x, london.y], [7, 63, 42]);
  assert.deepEqual(radarTile(0, 0), { z: 7, x: 64, y: 64, px: 0, py: 0 });
  assert.equal(radarTile(51.5074, -0.1278, 10).x, 511);
  assert.equal(radarTile(51.5074, -0.1278, 10).y, 340);
});

test('radarTile keeps the tile and the pixel inside the grid at every edge', () => {
  assert.deepEqual(radarTile(0, 180), { z: 7, x: 127, y: 64, px: 255, py: 0 }); // antimeridian
  assert.deepEqual(radarTile(0, -180), { z: 7, x: 0, y: 64, px: 0, py: 0 });
  assert.deepEqual(radarTile(90, 10), radarTile(85, 10)); // poles clamp to ±85
  assert.deepEqual(radarTile(-90, 10), radarTile(-85, 10));
  for (let lat = -90; lat <= 90; lat += 2.5) {
    for (let lon = -185; lon <= 185; lon += 2.5) {
      const t = radarTile(lat, lon);
      for (const [k, max] of [['x', 127], ['y', 127], ['px', 255], ['py', 255]]) {
        assert.ok(Number.isInteger(t[k]) && t[k] >= 0 && t[k] <= max, `${k}=${t[k]} at ${lat},${lon}`);
      }
    }
  }
});

test('radarTile matches the old inline maths, the sampled patch included', () => {
  for (let lat = -89; lat <= 89; lat += 0.77) {
    for (let lon = -181; lon <= 181; lon += 0.93) {
      const now = radarTile(lat, lon);
      const was = tileAsItWas(lat, lon);
      assert.equal(now.x, was.xt, `x at ${lat},${lon}`);
      assert.equal(now.y, was.yt, `y at ${lat},${lon}`);
      // The pixel can differ only where it was off the tile, and the patch
      // read around it is the same either way.
      assert.deepEqual(echoPatchOrigin(now.px, now.py), echoPatchOrigin(was.px, was.py), `patch at ${lat},${lon}`);
      if (was.px >= 0 && was.px <= 255) assert.equal(now.px, was.px);
      if (was.py >= 0 && was.py <= 255) assert.equal(now.py, was.py);
    }
  }
});

test('echoPatchOrigin centres a 3×3 patch and keeps it on the image', () => {
  assert.deepEqual(echoPatchOrigin(128, 64), { x0: 127, y0: 63 });
  assert.deepEqual(echoPatchOrigin(0, 0), { x0: 0, y0: 0 });
  assert.deepEqual(echoPatchOrigin(255, 255), { x0: 253, y0: 253 });
  assert.deepEqual(echoPatchOrigin(1, 254), { x0: 0, y0: 253 });
  assert.deepEqual(echoPatchOrigin(10, 10, 8, 8), { x0: 5, y0: 5 }); // a smaller image
});

test('radarTileUrl and radarReading build what fetchRadar returns', () => {
  const frame = { host: 'https://tilecache.rainviewer.com', path: '/v2/radar/1760925600', time: 1760925600 };
  assert.equal(
    radarTileUrl(frame, radarTile(51.5074, -0.1278)),
    'https://tilecache.rainviewer.com/v2/radar/1760925600/256/7/63/42/2/0_1.png'
  );
  const reading = radarReading(patch(...Array(9).fill(C.rain40)), frame);
  assert.deepEqual(reading, { precip: true, intensity: 'moderate', strong: true, observedAt: '2025-10-20T02:00:00.000Z' });
});

test('fetchRadarFrame’s 8 s abort also covers reading the body, as before the move', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { fetchRadarFrame } = await import('../src/lib/radar.js');
  // Headers arrive at once; the body never does unless the signal aborts it.
  const fetcher = async (_url, { signal }) => ({
    json: () =>
      new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted body')), { once: true }))
  });
  let settled = false;
  const pending = fetchRadarFrame({ baseUrl: 'https://slow-body.test', fetch: fetcher }).finally(() => (settled = true));
  const turns = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  };
  await turns();
  t.mock.timers.tick(7999);
  await turns();
  assert.equal(settled, false, 'gave up before 8 s');
  t.mock.timers.tick(1);
  await turns();
  assert.equal(settled, true, 'still waiting on the body after 8 s');
  assert.equal(await pending, null);
});
