import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { viewFromSearch } from '../src/lib/view.js';

// ?view=card: the single-card embed. These server-render it (see
// test/support/renderViews.mjs) and check what the frame gets.

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function render(args, env = {}) {
  const out = execFileSync(process.execPath, ['test/support/renderViews.mjs', ...args], {
    cwd: ROOT,
    env: { ...process.env, TZ: 'UTC', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024
  });
  return JSON.parse(out);
}

const count = (html, needle) => html.split(needle).length - 1;
const unescape = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const textOf = (html, cls) =>
  [...html.matchAll(new RegExp(`<div class="${cls}">([^<]*)</div>`, 'g'))].map((m) => unescape(m[1]));

test('only view=card, exactly, is the card view', () => {
  assert.equal(viewFromSearch('?view=card'), 'card');
  assert.equal(viewFromSearch('?city=Rohan&view=card'), 'card');
  assert.equal(viewFromSearch('view=card'), 'card');
  for (const s of ['', '?view=', '?view=CARD', '?view=cards', '?view=card2', '?views=card', '?demo=1', undefined, null]) {
    assert.equal(viewFromSearch(s), 'dashboard', String(s));
  }
});

test('the card view renders the first card alone, without the dashboard around it', { timeout: 120000 }, () => {
  const views = render(['?demo=1&view=card', '?demo=1', '?view=card&city=Gotham&rotate=1', '?city=Gotham&rotate=1']);
  const card = views['?demo=1&view=card'];
  const dash = views['?demo=1'];
  assert.equal(count(card, 'class="card '), 1);
  assert.equal(count(dash, 'class="card '), 4);
  // The same first card the dashboard shows.
  const firstName = (h) => /<span class="location-name">([^<]*)<\/span>/.exec(h)[1];
  assert.equal(firstName(card), firstName(dash));
  // No star map behind it, no fullscreen button, no rename/locate/rotate.
  // Checked on a real (non-demo) city too, since demo mode never draws the
  // star map, and against the dashboard at the same URL, which has them all.
  const real = views['?view=card&city=Gotham&rotate=1'];
  const realDash = views['?city=Gotham&rotate=1'];
  for (const absent of ['skymap-canvas', 'fullscreen-btn', 'edit-location-btn']) {
    assert.ok(count(realDash, absent) > 0, `the dashboard lost ${absent}, so this check proves nothing`);
    assert.equal(count(real, absent), 0, absent);
    assert.equal(count(card, absent), 0, absent);
  }
  assert.equal(count(card, 'class="units-btn"'), 1);
  // Even asked to rotate, the card view is one card.
  assert.equal(count(real, 'class="card '), 1);
  assert.equal(count(realDash, 'class="card '), 2);
});

test('what the dashboard only shows on hover, the card view shows as text', { timeout: 120000 }, () => {
  // Demo card 2 has a condition detail and an alert with a headline.
  const { 'card:2:plain': plain, 'card:2:embed': embed } = render(['card:2:plain', 'card:2:embed']);
  const descTitle = unescape(/<div class="weather-desc" title="([^"]*)"/.exec(plain)[1]);
  const alertTitles = [...plain.matchAll(/class="weather-alert [^"]*" title="([^"]*)"/g)].map((m) => unescape(m[1]));
  assert.ok(descTitle.length > 0 && alertTitles.length > 0, 'the fixture lost its tooltips');
  assert.deepEqual(textOf(embed, 'weather-detail'), [descTitle]);
  assert.deepEqual(textOf(embed, 'alert-headline'), alertTitles);
  // The pollen index, otherwise only in each pollen tooltip.
  const plainIdx = [...plain.matchAll(/pollen \u2014 [^"(]*\(index (\d)\/5\)/g)].map((m) => `${m[1]}/5`);
  const embedIdx = [...embed.matchAll(/<span class="pollen-index"> (\d\/5)<\/span>/g)].map((m) => m[1]);
  assert.ok(plainIdx.length > 0);
  assert.deepEqual(embedIdx, plainIdx);
  // And none of it leaks into the dashboard's card.
  for (const cls of ['weather-detail', 'alert-headline', 'pollen-index']) assert.equal(count(plain, cls), 0, cls);
});

test('a card with no detail or headline gets no empty lines', { timeout: 120000 }, () => {
  const cards = render(['card:0:embed', 'card:1:embed', 'card:3:embed']);
  for (const [k, html] of Object.entries(cards)) {
    for (const cls of ['weather-detail', 'alert-headline']) {
      for (const t of textOf(html, cls)) assert.ok(t.trim().length > 0, `${k} has an empty ${cls}`);
    }
  }
});

test('the card view renders when localStorage throws, as in a blocked third-party frame', { timeout: 120000 }, () => {
  const views = render(['?view=card&city=Gotham', '?demo=1&view=card'], { RENDER_STORAGE_THROWS: '1' });
  assert.equal(count(views['?view=card&city=Gotham'], 'class="card '), 1);
  assert.equal(count(views['?demo=1&view=card'], 'class="card '), 1);
});
