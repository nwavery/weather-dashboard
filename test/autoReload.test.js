import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reloadDecision, triedFrom, withTried, RETRY_AFTER_MS } from '../src/lib/autoReload.js';

// The rule: a new deploy reaches an always-on display, including the
// ?view=card embed, during the quiet pre-dawn window; and a reload that
// doesn't take is tried at most once a night, never in a loop.

const OLD = 'index-OLD1.js';
const NEW = 'index-NEW2.js';
const NOW = Date.parse('2026-11-12T09:30:00Z');
const base = { mine: OLD, live: NEW, hour: 3, tried: null, nowMs: NOW };

test('reloads for a new bundle inside the quiet window, and only then', () => {
  assert.equal(reloadDecision(base), 'reload');
  assert.equal(reloadDecision({ ...base, hour: 4 }), 'reload');
  for (const hour of [0, 2, 5, 12, 23]) assert.equal(reloadDecision({ ...base, hour }), 'stay', `hour ${hour}`);
  assert.equal(reloadDecision({ ...base, live: OLD }), 'stay');
  assert.equal(reloadDecision({ ...base, live: null }), 'stay');
  assert.equal(reloadDecision({ ...base, mine: null }), 'stay'); // dev server: no bundle name
});

test('a reload that did not take is not tried again the same night', () => {
  const tried = { bundle: NEW, at: NOW - 60 * 60 * 1000 };
  assert.equal(reloadDecision({ ...base, tried }), 'stay');
  // The next night it is tried once more.
  assert.equal(reloadDecision({ ...base, tried: { bundle: NEW, at: NOW - RETRY_AFTER_MS } }), 'reload');
  // A newer deploy than the one that failed is tried at once.
  assert.equal(reloadDecision({ ...base, live: 'index-NEWER3.js', tried }), 'reload');
  // A record stamped in the future (clock moved back) doesn't block forever.
  assert.equal(reloadDecision({ ...base, tried: { bundle: NEW, at: NOW + 3600e3 } }), 'reload');
});

test('the attempt round-trips through the address and nothing else in it changes', () => {
  const href = 'https://skyglance.web.app/?city=Rohan&view=card';
  const marked = withTried(href, NEW, NOW);
  assert.deepEqual(triedFrom(new URL(marked).search), { bundle: NEW, at: NOW });
  const u = new URL(marked);
  assert.equal(u.searchParams.get('city'), 'Rohan');
  assert.equal(u.searchParams.get('view'), 'card');
  assert.equal(withTried(marked, null), href);
  for (const junk of ['', '?sgReload=', '?sgReload=evil.js~1', '?sgReload=index-a.js~x', '?sgReload=index-a.js']) {
    assert.equal(triedFrom(junk), null, junk);
  }
});

// startAutoReload itself, in a stubbed page: run in a child process per case,
// since runtime.js and view.js read the page's URL once at import.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = `
  const search = process.argv[1];
  const live = process.argv[2];
  const calls = { replace: [], replaceState: [], intervals: 0 };
  let interval = null;
  globalThis.setInterval = (fn) => { calls.intervals++; interval = fn; return 1; };
  const loc = { search, href: 'https://skyglance.test/' + search, replace: (u) => calls.replace.push(u) };
  globalThis.window = { location: loc, history: { state: null, replaceState: (_s, _t, u) => calls.replaceState.push(u) },
    matchMedia: () => ({ matches: false }), navigator: {} };
  globalThis.document = { querySelectorAll: () => [{ src: 'https://skyglance.test/assets/${OLD}' }], documentElement: {} };
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.fetch = async () => new Response('<script src="/assets/' + live + '"></script>');
  const RealDate = Date;
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [${NOW}])); } static now() { return ${NOW}; } };
  const { startAutoReload } = await import('./src/lib/autoReload.js');
  const started = startAutoReload();
  if (interval) await interval();
  process.stdout.write(JSON.stringify({ started, ...calls }));
`;
function page(search, live = NEW) {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', SCRIPT, search, live], {
    cwd: ROOT,
    env: { ...process.env, TZ: 'America/Chicago' }, // NOW is 3:30 AM there
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(out);
}

test('the card view runs it, a plain tab still does not', () => {
  const card = page('?city=Rohan&view=card');
  assert.equal(card.started, true);
  assert.equal(card.replace.length, 1);
  const to = new URL(card.replace[0]);
  assert.equal(to.searchParams.get('view'), 'card');
  assert.deepEqual(triedFrom(to.search), { bundle: NEW, at: NOW });
  const plain = page('?city=Rohan');
  assert.equal(plain.started, false);
  assert.equal(plain.intervals, 0);
});

test('after a reload that did not take, the next check does not reload again', () => {
  const stuck = page(`?city=Rohan&view=card&sgReload=${NEW}~${NOW - 3600e3}`);
  assert.equal(stuck.started, true);
  assert.deepEqual(stuck.replace, []);
  assert.deepEqual(stuck.replaceState, [], 'the record must stay while the reload has not taken');
});

test('after a reload that took, the record is tidied out of the address', () => {
  const done = page(`?city=Rohan&view=card&sgReload=${OLD}~${NOW - 60000}`, OLD);
  assert.deepEqual(done.replace, []);
  assert.equal(done.replaceState.length, 1);
  assert.equal(new URL(done.replaceState[0]).search, '?city=Rohan&view=card');
});
