import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daylightInfo } from '../src/lib/sunTimes.js';

// Rohan (Oklahoma City area). US DST in 2026: spring forward Sun Mar 8,
// fall back Sun Nov 1 — a 23-hour and a 25-hour local day.
const LAT = 35.61622;
const LON = -97.69454;
const TZ = 'America/Chicago';
const localDate = (d) => d.toLocaleDateString('en-CA', { timeZone: TZ });
const info = (iso) => daylightInfo(new Date(iso), LAT, LON, TZ);

test('fall-back day: built at midnight, tomorrow is still Monday (Nov 1 2026 "sunrise in 0m")', () => {
  // The always-on card rebuilds its sun times the moment the local day turns.
  const atMidnight = info('2026-11-01T05:00:05Z'); // Sun Nov 1, 12:00:05 AM CDT
  assert.equal(localDate(atMidnight.sunrise), '2026-11-01');
  assert.equal(localDate(atMidnight.nextSunrise), '2026-11-02');
  // The screenshot: Sun 6:27:37 PM CST, after sunset. Monday's sunrise is ~12 h 25 m away.
  const view = Date.parse('2026-11-02T00:27:37Z');
  const mins = Math.round((atMidnight.nextSunrise.getTime() - view) / 60000);
  assert.ok(mins > 740 && mins < 750, `countdown ${mins} min`);
});

test("spring-forward's next day: yesterday is Sunday, not Saturday", () => {
  // Mon Mar 9, 12:30 AM CDT. 24 h earlier was Sat 11:30 PM CST, the wrong day.
  const lateNight = info('2026-03-09T05:30:00Z');
  const noon = info('2026-03-09T17:00:00Z');
  assert.equal(lateNight.deltaSec, noon.deltaSec); // vs Sunday, not vs Saturday
  assert.ok(lateNight.deltaSec > 60 && lateNight.deltaSec < 150, `delta ${lateNight.deltaSec}s`); // ~+2 min/day in March
});

test("a day's sun times don't depend on what hour they were computed", () => {
  // Every hour (and half hour) of both DST days and an ordinary day.
  for (const [day, startIso, hours] of [
    ['2026-03-08', '2026-03-08T06:00:00Z', 23],
    ['2026-11-01', '2026-11-01T05:00:00Z', 25],
    ['2026-06-15', '2026-06-15T05:00:00Z', 24]
  ]) {
    const ref = info(startIso);
    for (let h = 0; h < hours * 2; h++) {
      const at = new Date(Date.parse(startIso) + h * 1800e3);
      assert.equal(localDate(at), day, `sample ${at.toISOString()} left the day`);
      const got = daylightInfo(at, LAT, LON, TZ);
      for (const k of ['sunrise', 'sunset', 'nextSunrise']) {
        assert.equal(got[k].getTime(), ref[k].getTime(), `${day} ${k} differs when built at ${at.toISOString()}`);
      }
      assert.equal(got.deltaSec, ref.deltaSec, `${day} delta differs when built at ${at.toISOString()}`);
    }
    assert.equal(localDate(ref.nextSunrise), new Date(Date.parse(`${day}T12:00:00Z`) + 86400e3).toISOString().slice(0, 10));
  }
});
