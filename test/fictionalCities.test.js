import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eventForHour,
  fictionalStateFor,
  findFictional,
  fictionalByIndex,
  FICTIONAL_NAMES,
  FICTIONAL_COUNT,
  fictionalTheme
} from '../src/lib/fictionalCities.js';

// The world engine is a pure function of (world id, wall-clock), so fixed
// instants make every assertion here deterministic regardless of when the
// suite runs.
const BASE = Date.UTC(2026, 8, 6); // 2026-09-06T00:00Z
const HOUR = 3600e3;

function hourInZone(ms, tz) {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false })
    .formatToParts(new Date(ms))
    .find((p) => p.type === 'hour')?.value;
  return parseInt(h, 10) % 24;
}

// Hour offsets from BASE (0-71) at which each world's rare event is running.
// A deliberate golden table: every viewer must agree on when Mt. Doom erupts,
// so a diff here means a world's schedule changed. If you change an event's
// chance/window on purpose, regenerate its row with:
//   [...Array(72).keys()].filter((h) => eventForHour(id, BASE + h * HOUR))
const GOLDEN = {
  mordor: [17, 18, 33, 34, 55, 56],
  'mos-eisley': [],
  hoth: [58, 59],
  pandora: [71],
  atlantis: [61, 62],
  asgard: [38, 39],
  'jurassic-park': [24, 25, 48, 49],
  hogwarts: [38, 39, 61, 62],
  'the-shire': [21, 22, 44, 45, 69, 70],
  'bikini-bottom': [0, 22, 23, 44, 45],
  'halloween-town': [1, 2, 24, 25, 47, 48],
  springfield: [38, 39]
};

test('rare event schedule is deterministic and unchanged (golden table)', () => {
  for (const [id, hours] of Object.entries(GOLDEN)) {
    const got = [...Array(72).keys()].filter((h) => eventForHour(id, BASE + h * HOUR));
    assert.deepEqual(got, hours, `${id} schedule drifted`);
  }
});

test('a chance-1.0 event (Mordor) fires every day, only inside its local window', () => {
  // Mordor's window is 08-22 Istanbul time (UTC+3), so each UTC day block
  // contains exactly one local day's run.
  for (let d = 0; d < 60; d++) {
    const hits = [];
    for (let h = 0; h < 24; h++) {
      const ms = BASE + (d * 24 + h) * HOUR;
      if (eventForHour('mordor', ms)) hits.push(hourInZone(ms, 'Asia/Istanbul'));
    }
    assert.equal(hits.length, 2, `Mordor ran ${hits.length} hours on day ${d}, expected the two-hour run`);
    for (const h of hits) assert.ok(h >= 8 && h <= 22, `Mordor erupted at local ${h}:00 on day ${d}`);
  }
});

test('hidden worlds (Springfield) are alias-only and off the datalist', () => {
  assert.equal(findFictional('springfield'), null); // the real cities must geocode
  assert.equal(findFictional('Springfield, IL'), null);
  assert.equal(findFictional('homer')?.name, 'Springfield');
  assert.equal(findFictional('  SIMPSONS ')?.theme, 'springfield');
  assert.ok(!FICTIONAL_NAMES.includes('Springfield'));
});

test('fictionalByIndex wraps around the visible worlds', () => {
  assert.equal(fictionalByIndex(FICTIONAL_COUNT).name, fictionalByIndex(0).name);
  assert.equal(fictionalByIndex(-1).name, fictionalByIndex(FICTIONAL_COUNT - 1).name);
  assert.ok(fictionalByIndex(3).fictional);
  assert.equal(FICTIONAL_NAMES.length, FICTIONAL_COUNT);
});

// ── Hill Valley (Back to the Future) ─────────────────────────────────────────
// The strike is pinned to 10 PM local by its [22, 23] window, guaranteed on
// Nov 12 by `always`, and holds the weather at WMO 95 by `mood`.
const LA = 'America/Los_Angeles';
// Nov 12 is always PST (DST ends on the first Sunday of November, ≤ Nov 7).
const pst = (y, m, d, h) => Date.UTC(y, m - 1, d, h + 8);
const HV_MOODS = [1, 0, 2, 3, 61];

test('Hill Valley: the clock-tower strike only ever runs at 10-11 PM local', () => {
  const start = Date.UTC(2026, 0, 1);
  let starts = 0;
  const daysWithHit = new Set();
  for (let d = 0; d < 400; d++) {
    for (let h = 0; h < 24; h++) {
      for (const off of [0, 30 * 60e3]) {
        const ms = start + (d * 24 + h) * HOUR + off;
        if (!eventForHour('hill-valley', ms)) continue;
        const lh = hourInZone(ms, LA);
        assert.ok(lh === 22 || lh === 23, `strike running at local ${lh}:00`);
        if (lh === 22) starts++;
        daysWithHit.add(Math.floor(ms / 86400e3));
      }
    }
  }
  assert.ok(starts > 0, 'the strike never started');
  const frac = daysWithHit.size / 400;
  assert.ok(frac > 0.2 && frac < 0.5, `fires on ${frac} of ordinary days; expected ~0.35`);
});

test('Hill Valley: the strike is guaranteed every Nov 12 (the night of the 1955 storm)', () => {
  for (let y = 2026; y <= 2045; y++) {
    for (const h of [22, 23]) {
      const ev = eventForHour('hill-valley', pst(y, 11, 12, h));
      assert.ok(ev, `no strike at ${h}:00 on Nov 12 ${y}`);
      assert.equal(ev.mood, 95);
      assert.equal(ev.emoji, '⚡');
    }
    assert.equal(eventForHour('hill-valley', pst(y, 11, 12, 21)), null, `struck early in ${y}`);
    assert.equal(eventForHour('hill-valley', pst(y, 11, 13, 0)), null, `ran past midnight in ${y}`);
  }
});

test('Hill Valley: the storm is real while the strike runs (event mood → weather code)', () => {
  // 8 PM on Nov 12: the strike is two ticks out on the hourly strip.
  const st = fictionalStateFor('hill-valley', pst(2026, 11, 12, 20));
  const { hourly, current } = st.weather;
  assert.equal(st.event, null); // not running yet (and no `window` → no forced preview)
  assert.equal(hourly.time[2], '2026-11-12T22:00');
  assert.equal(hourly.special[2]?.emoji, '⚡');
  assert.ok(hourly.special[3], 'second hour of the run is not marked');
  assert.equal(hourly.special[1], null);
  assert.equal(hourly.special[4], null);
  assert.equal(hourly.weather_code[2], 95);
  assert.equal(hourly.weather_code[3], 95);
  assert.equal(hourly.precipitation_probability[2], 90);
  hourly.weather_code.forEach((c, i) => {
    if (!hourly.special[i]) assert.ok(HV_MOODS.includes(c), `slot ${i} code ${c} is outside the world's moods`);
  });
  assert.ok(HV_MOODS.includes(current.weather_code));

  // 10:30 PM: mid-strike.
  const mid = fictionalStateFor('hill-valley', pst(2026, 11, 12, 22) + 30 * 60e3);
  assert.equal(mid.event?.mood, 95);
  assert.equal(mid.weather.current.weather_code, 95);
  assert.equal(mid.weather.hourly.weather_code[0], 95);
  assert.equal(mid.weather.hourly.precipitation_probability[0], 90);
  assert.ok(mid.weather.hourly.precipitation_probability[2] >= 30, 'an active shower tapers, it does not cut to 0%');
});

test('Hill Valley: daily min/max envelope every temperature the card can show', () => {
  for (const ms of [pst(2026, 11, 12, 20), pst(2026, 11, 12, 22) + 30 * 60e3, Date.UTC(2026, 6, 4, 19)]) {
    const { hourly, daily, current } = fictionalStateFor('hill-valley', ms).weather;
    hourly.time.forEach((t, i) => {
      const j = daily.time.indexOf(t.slice(0, 10));
      if (j === -1) return;
      const temp = hourly.temperature_2m[i];
      const lo = daily.temperature_2m_min[j];
      const hi = daily.temperature_2m_max[j];
      assert.ok(temp >= lo && temp <= hi, `${t}: ${temp}° outside day ${j} [${lo}, ${hi}]`);
    });
    assert.ok(current.temperature_2m >= daily.temperature_2m_min[0] && current.temperature_2m <= daily.temperature_2m_max[0]);
  }
});

test('worlds without an event mood keep their own mood beats', () => {
  // Golden table: Mt. Doom runs at hours 17-18 → strip slots 5-6 from noon.
  const mordor = fictionalStateFor('mordor', Date.UTC(2026, 8, 6, 12)).weather;
  assert.ok(mordor.hourly.special[5] && mordor.hourly.special[6], 'expected Mt. Doom on the strip');
  for (const c of mordor.hourly.weather_code) assert.ok([45, 48].includes(c), `Mordor code ${c}`);
  assert.ok([45, 48].includes(mordor.current.weather_code));
  // Halloween Town: hours 1-2 → slots 1-2 from midnight.
  const ht = fictionalStateFor('halloween-town', Date.UTC(2026, 8, 6, 0)).weather;
  assert.ok(ht.hourly.special[1] && ht.hourly.special[2], 'expected the Pumpkin on the strip');
  for (const c of ht.hourly.weather_code) assert.ok([45, 3, 2, 48, 51, 61].includes(c), `Halloween Town code ${c}`);
});

test('Hill Valley: aliases resolve, and it joins the datalist and the rotation', () => {
  for (const q of ['bttf', 'DeLorean', 'hill valley', ' Back to the Future ']) {
    const p = findFictional(q);
    assert.equal(p?.name, 'Hill Valley', `query "${q}"`);
    assert.equal(p.theme, 'hill-valley');
    assert.equal(p.timeZone, LA);
    assert.ok(p.fictional);
  }
  assert.ok(FICTIONAL_NAMES.includes('Hill Valley'));
  const rotation = Array.from({ length: FICTIONAL_COUNT }, (_, i) => fictionalByIndex(i).name);
  assert.ok(rotation.includes('Hill Valley'));
  assert.equal(FICTIONAL_COUNT, 25);

  const theme = fictionalTheme('hill-valley');
  assert.equal(theme.silhouette, 'delorean');
  assert.equal(theme.effect, 'courthouse');
  assert.ok(theme.realSun);
  assert.equal(theme.pollenLabels.tree, 'Twin Pines');
  assert.equal(fictionalStateFor('hill-valley', BASE).historical.years, 30); // "vs 30y avg": 1955 ↔ 1985
});
