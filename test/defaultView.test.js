import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The default view (no ?view=) must render byte for byte as main did. The
// fixture is main's (e16b5e7) server render of the whole App, made by
// test/support/renderViews.mjs with the clock frozen, Math.random seeded and
// TZ=UTC. Regenerate it only from a commit whose default view is meant to
// change.
//
// A first render runs no effects, so this can't see the ?city= pin, rotation
// or the canvases' frame loops; test/domEffects.test.js covers those.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/default-view.json', import.meta.url), 'utf8'));

function render(searches) {
  const out = execFileSync(process.execPath, ['test/support/renderViews.mjs', ...searches], {
    cwd: ROOT,
    env: { ...process.env, TZ: 'UTC' },
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024
  });
  return JSON.parse(out);
}

// The URLs main was rendered at, plus the ones that must render the same
// way: an unknown or empty view value is the default view.
const SAME_AS = {
  '?demo=1': '?demo=1',
  '': '',
  '?demo=1&view=': '?demo=1',
  '?demo=1&view=list': '?demo=1',
  '?demo=1&view=CARD': '?demo=1'
};

test('with no ?view= the whole App renders exactly as main did', { timeout: 120000 }, () => {
  const got = render(Object.keys(SAME_AS));
  for (const [search, fixtureKey] of Object.entries(SAME_AS)) {
    assert.ok(got[search] === FIXTURE[fixtureKey], `"${search}" renders differently from main's "${fixtureKey}"`);
  }
  // The fixture is not trivially small: four demo cards and the loading state.
  assert.ok(FIXTURE['?demo=1'].split('class="card ').length - 1 === 4);
});
