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

// Visible text of a render, tags stripped and whitespace collapsed.
const visible = (html) => unescape(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
// Every element carrying a title: { tag, cls, title, alt, parent }, where
// parent is the class of the element it sits directly inside.
const titled = (html) =>
  [...html.matchAll(/<(\w+)([^>]*?)\stitle="([^"]*)"([^>]*)>/g)].map((m) => {
    const attrs = m[2] + m[4];
    const alt = /alt="([^"]*)"/.exec(attrs);
    const parent = /<\w+ class="([^"]*)">\s*$/.exec(html.slice(0, m.index))?.[1] ?? '';
    return { tag: m[1], cls: /class="([^"]*)"/.exec(attrs)?.[1] ?? '', title: unescape(m[3]), alt: alt ? unescape(alt[1]) : null, parent };
  });
// The one exception the card view keeps: a daily or hourly forecast icon
// whose title repeats its own alt text. The image shows it, and the alt says
// it; the title adds nothing a touch screen misses.
const isForecastIcon = (t) =>
  t.tag === 'img' && t.alt === t.title && ['daily-icon', 'hourly-icon'].includes(t.parent);

// For each kind of tooltip the dashboard's card has, where the embed shows the
// same information instead. A tooltip of a kind not listed here fails the
// test: add it once the embed shows it.
const SHOWN_IN_EMBED = [
  // The current-condition icon: the embed drops its title and keeps the
  // image and its alt, which are what the title repeated.
  ['weather-icon', (t, embed) => new RegExp(`<img class="weather-icon"[^>]*alt="${t.alt?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(embed)],
  ['weather-desc', (t, embed) => textOf(embed, 'weather-detail').includes(t.title)],
  ['weather-alert', (t, embed) =>
    [...embed.matchAll(/<span class="alert-headline-text">([^<]*)<\/span>/g)].some((m) => unescape(m[1]) === t.title)],
  ['pollen-metric', (t, embed) => {
    const idx = /\(index (\d)\/5\)/.exec(t.title);
    return idx ? visible(embed).includes(`${idx[1]}/5`) : true; // no index: the category is already on the card
  }],
  ['metric', (t, embed) => t.title.split(', ').every((part) => visible(embed).toLowerCase().includes(part.toLowerCase()))],
  ['aqi-badge', (t, embed) => visible(embed).includes(t.title)],
  ['hourly-precip', (t, embed) => visible(embed).toLowerCase().includes(t.title.toLowerCase())],
  ['hourly-event', (t, embed) => [...embed.matchAll(/<span class="hourly-event-name">([^<]*)<\/span>/g)].some((m) => unescape(m[1]) === t.title)],
  ['twin-badge', (t, embed) => visible(embed).toLowerCase().includes(t.title.toLowerCase().replace(/^your /, ''))],
  ['moon-sign', (t, embed) => visible(embed).includes(t.title.replace('The Moon is currently in ', 'Moon in '))],
  // The embed drops the Sun x Moon blurb to fit the frame. The title only
  // named that blurb, so what has to stay is the season it is a blend of.
  ['sky-vibe', (_t, embed) => /☉ \S+ season/.test(visible(embed))]
];
const kindOf = (t) => SHOWN_IN_EMBED.find(([cls]) => t.cls.split(/\s+/).includes(cls));

// Demo cards (rain, snow, a storm with an alert, clear) and fictional cities
// with their own metric names and, for Pandora, a world event in the hourly.
const PAIRS = ['card:0', 'card:1', 'card:2', 'card:3', 'fic:Pandora', 'fic:Mordor', 'fic:Arrakis'];

test('the exception admits a forecast icon repeating its alt, and nothing else', () => {
  const allowed = (html) => titled(html).map(isForecastIcon);
  assert.deepEqual(allowed('<div class="daily-icon"><img src="a.png" alt="Clear sky" title="Clear sky"></div>'), [true]);
  assert.deepEqual(allowed('<div class="hourly-icon"><img src="a.png" alt="Fog" title="Fog"></div>'), [true]);
  for (const html of [
    '<div class="temp-display"><img class="weather-icon" src="a.png" alt="Clear sky" title="Clear sky"></div>',
    '<div class="daily-icon"><img src="a.png" alt="Clear sky" title="Clear sky, all day"></div>',
    '<div class="daily-icon"><span title="Clear sky">☀</span></div>',
    '<div class="daily-icon"><div><img src="a.png" alt="x" title="x"></div></div>',
    '<div class="hourly-icon hourly-event"><img src="a.png" alt="x" title="x"></div>'
  ]) {
    assert.deepEqual(allowed(html), [false], html);
  }
});

test('the card view has no hover-only text: no title but a forecast icon repeating its alt', { timeout: 120000 }, () => {
  const embeds = render([...PAIRS.map((p) => `${p}:embed`), '?demo=1&view=card', '?view=card&city=Gotham']);
  for (const [k, html] of Object.entries(embeds)) {
    const hover = titled(html).filter((t) => !isForecastIcon(t));
    assert.deepEqual(hover.map((t) => `${t.cls}: ${t.title}`), [], k);
  }
});

test("every tooltip on the dashboard's card is shown as text on the embed", { timeout: 120000 }, () => {
  const views = render(PAIRS.flatMap((p) => [`${p}:plain`, `${p}:embed`]));
  const covered = new Set();
  for (const p of PAIRS) {
    const plain = views[`${p}:plain`];
    const embed = views[`${p}:embed`];
    for (const t of titled(plain).filter((x) => !isForecastIcon(x))) {
      if (t.cls.includes('edit-location-btn')) continue; // the embed has no edit controls at all
      const kind = kindOf(t);
      assert.ok(kind, `${p}: no rule for the tooltip on "${t.cls}" ("${t.title}")`);
      assert.ok(kind[1](t, embed), `${p}: "${t.title}" (${t.cls}) is not shown on the embed`);
      covered.add(kind[0]);
    }
  }
  // The kinds the review named must have been met, or this proved nothing.
  for (const kind of ['weather-desc', 'weather-alert', 'pollen-metric', 'metric', 'aqi-badge', 'hourly-precip', 'hourly-event', 'moon-sign']) {
    assert.ok(covered.has(kind), `no card had a ${kind} tooltip`);
  }
});

test('fictional cards show the real name under each renamed metric, and only those', { timeout: 120000 }, () => {
  const { 'fic:Arrakis:embed': embed, 'fic:Arrakis:plain': plain } = render(['fic:Arrakis:embed', 'fic:Arrakis:plain']);
  const labels = [...plain.matchAll(/<span class="metric-label">([^<]*)<\/span>/g)].map((m) => m[1]);
  const renamed = labels.filter((l) => !['Humidity', 'Dew Pt', 'UV Index'].includes(l) && !/^[↑↓←→↖↗↘↙] /.test(l));
  assert.ok(renamed.length > 0, 'Arrakis lost its own metric names, so this proves nothing');
  assert.equal(count(embed, 'class="metric-real"'), renamed.length);
  // Pandora keeps "Humidity" as its own label: no second "Humidity" under it.
  const { 'fic:Pandora:embed': pandora } = render(['fic:Pandora:embed']);
  const pairs = [...pandora.matchAll(/<span class="metric-label">([^<]*)<\/span>(?:<span class="metric-real">([^<]*)<\/span>)?/g)];
  assert.ok(pairs.length === 4);
  for (const [, label, real] of pairs) assert.ok(!real || real.toLowerCase() !== label.toLowerCase(), `${label} repeated`);
  assert.ok(pairs.some(([, label]) => label === 'Humidity'), 'Pandora renamed Humidity, so the repeat case is untested');
});

test('an embed alert is a button with its headline, closed to start', { timeout: 120000 }, () => {
  const { 'card:2:embed': embed } = render(['card:2:embed']);
  assert.match(embed, /<button type="button" class="weather-alert weather-alert--\w+ alert-toggle" aria-expanded="false">/);
  assert.equal(count(embed, 'class="alert-headline-text"'), count(embed, ' alert-toggle"'));
});

test('a card with no detail or headline gets no empty lines', { timeout: 120000 }, () => {
  const cards = render(['card:0:embed', 'card:1:embed', 'card:3:embed', 'fic:Pandora:embed']);
  for (const [k, html] of Object.entries(cards)) {
    for (const cls of ['weather-detail']) {
      for (const t of textOf(html, cls)) assert.ok(t.trim().length > 0, `${k} has an empty ${cls}`);
    }
    for (const cls of ['alert-headline-text', 'hourly-event-name', 'metric-real']) {
      assert.ok(!new RegExp(`<span class="${cls}"></span>`).test(html), `${k} has an empty ${cls}`);
    }
  }
});

test('the card view renders when localStorage throws, as in a blocked third-party frame', { timeout: 120000 }, () => {
  const views = render(['?view=card&city=Gotham', '?demo=1&view=card'], { RENDER_STORAGE_THROWS: '1' });
  assert.equal(count(views['?view=card&city=Gotham'], 'class="card '), 1);
  assert.equal(count(views['?demo=1&view=card'], 'class="card '), 1);
});
