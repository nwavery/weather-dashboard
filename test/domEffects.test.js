import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// What the page does after its first render: effects, timers, frame loops.
// Each case mounts the whole App in jsdom (test/support/domRun.mjs) at night,
// pumps requestAnimationFrame ten frames after the first three, and counts how
// many new frames were asked for. A canvas in a loop asks once per frame.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
function mount(search, alerts = 0, action = '') {
  const out = execFileSync(process.execPath, ['test/support/domRun.mjs', search, String(alerts), action], {
    cwd: ROOT,
    env: { ...process.env, TZ: 'UTC' },
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024
  });
  return JSON.parse(out);
}
const OPTS = { timeout: 120000 };

// ── The card view draws no continuous animation, for any city ───────────────

test('card view, real city at night with two alerts: no continuous frames', OPTS, () => {
  const r = mount('?view=card&city=Austin', 2);
  assert.equal(r.cards, 1);
  assert.equal(r.names[0], 'Austin, Texas');
  assert.ok(r.canvases >= 1, 'no star canvas, so this proves nothing');
  assert.equal(r.alerts, 2);
  assert.equal(r.rafRequestsOver10Frames, 0);
});

test('card view, fictional city with a drawn sky body: no continuous frames', OPTS, () => {
  const r = mount('?view=card&city=Pandora');
  assert.equal(r.names[0], 'Pandora');
  assert.ok(r.html.includes('world-sky-canvas'), 'no sky body canvas, so this proves nothing');
  assert.equal(r.rafRequestsOver10Frames, 0);
});

// ── The dashboard's effects are as they were ────────────────────────────────

test('dashboard: both real cities at night keep their star canvases moving', OPTS, () => {
  const r = mount('?rotate=0');
  assert.deepEqual(r.names, ['Oklahoma City, OK', 'Boston, MA']);
  // Two looping canvases: at least one new frame each, every frame.
  assert.ok(r.rafRequestsOver10Frames >= 20, `only ${r.rafRequestsOver10Frames} frames asked for`);
});

test('dashboard: the ?city= pin replaces the first card, and its sky body moves', OPTS, () => {
  const r = mount('?city=Pandora&rotate=0');
  assert.deepEqual(r.names, ['Pandora', 'Boston, MA']);
  assert.ok(r.html.includes('world-sky-canvas'));
  assert.ok(r.rafRequestsOver10Frames >= 30, `only ${r.rafRequestsOver10Frames} frames asked for`);
});

test('dashboard: a mouse drag is not taken over, so a wobbly tap still presses', OPTS, () => {
  // Drag-scrolling is for the embed only. On the dashboard a drag that ends
  // on the rename button must still open the rename box.
  const r = mount('?rotate=0', 0, 'drag-click');
  assert.equal(r.renameOpened, true);
});

// ── Alerts in the card view open on a tap ───────────────────────────────────

test('card view: an alert is a button that opens on a tap', OPTS, () => {
  const r = mount('?view=card&city=Austin', 2, 'tap');
  assert.equal(r.expandedBefore, 'false');
  assert.equal(r.expandedAfter, 'true');
  assert.equal(r.alertHeadlines.length, 2);
});
