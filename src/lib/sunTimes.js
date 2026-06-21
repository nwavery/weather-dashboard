// Sunrise / sunset for a location's local day, and how much daylight there is
// vs. yesterday. Built on the same solar-altitude model as the rest of the app:
// we find where the sun crosses the standard sunrise/sunset altitude (its centre
// 0.833° below the horizon) by scanning the day and bisecting the crossing.

import { solarAltitude } from './sun.js';

const HORIZON = -0.833;

function validCoords(lat, lon) {
  return typeof lat === 'number' && typeof lon === 'number' && !Number.isNaN(lat) && !Number.isNaN(lon);
}

// A timezone's UTC offset (ms) at a given instant — computed explicitly via
// Intl, so it never depends on the *browser's* timezone (the naive
// toLocaleString round-trip breaks when the viewer's zone equals the location's).
function tzOffsetMs(instantMs, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const p = {};
  for (const part of dtf.formatToParts(new Date(instantMs))) p[part.type] = part.value;
  const hour = p.hour === '24' ? 0 : Number(p.hour);
  const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second));
  return asUTC - instantMs;
}

// The UTC instant of local midnight (start of `date`'s calendar day in `tz`).
function localMidnight(date, timeZone) {
  const ymd = date.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD in tz
  const guessMs = new Date(`${ymd}T00:00:00Z`).getTime();
  if (Number.isNaN(guessMs)) return new Date(date.getTime());
  let midnight = guessMs - tzOffsetMs(guessMs, timeZone);
  midnight = guessMs - tzOffsetMs(midnight, timeZone); // second pass handles DST edges
  return new Date(midnight);
}

// Bisect the altitude=HORIZON crossing between two times (~ms precision).
function refine(loMs, hiMs, lat, lon) {
  const above = (ms) => solarAltitude(new Date(ms), lat, lon) >= HORIZON;
  const loAbove = above(loMs);
  for (let i = 0; i < 16; i++) {
    const mid = (loMs + hiMs) / 2;
    if (above(mid) === loAbove) loMs = mid;
    else hiMs = mid;
  }
  return new Date((loMs + hiMs) / 2);
}

// { sunrise, sunset } as Dates (either null at high latitudes when the sun
// doesn't cross the horizon that day), plus `polar`: 'day' | 'night' | null.
export function sunTimes(date, lat, lon, timeZone) {
  if (!validCoords(lat, lon)) return null;
  const start = localMidnight(date, timeZone).getTime();
  const STEP = 120000; // 2-minute scan
  let sunrise = null;
  let sunset = null;
  let prev = solarAltitude(new Date(start), lat, lon);
  for (let m = 1; m <= 720; m++) {
    const t = start + m * STEP;
    const a = solarAltitude(new Date(t), lat, lon);
    if (sunrise === null && prev < HORIZON && a >= HORIZON) sunrise = refine(t - STEP, t, lat, lon);
    if (sunset === null && prev >= HORIZON && a < HORIZON) sunset = refine(t - STEP, t, lat, lon);
    prev = a;
  }
  let polar = null;
  if (!sunrise && !sunset) polar = solarAltitude(new Date(start + 12 * 3600e3), lat, lon) > 0 ? 'day' : 'night';
  return { sunrise, sunset, polar };
}

// Today's sun times + daylight length and the change vs. yesterday (minutes).
export function daylightInfo(date, lat, lon, timeZone) {
  const today = sunTimes(date, lat, lon, timeZone);
  if (!today) return null;
  const yest = sunTimes(new Date(date.getTime() - 86400e3), lat, lon, timeZone);
  const lenOf = (t) => (t && t.sunrise && t.sunset ? t.sunset.getTime() - t.sunrise.getTime() : null);
  const dayMs = lenOf(today);
  const yestMs = lenOf(yest);
  const deltaMin = dayMs != null && yestMs != null ? Math.round((dayMs - yestMs) / 60000) : null;
  return { sunrise: today.sunrise, sunset: today.sunset, polar: today.polar, dayMs, deltaMin };
}
