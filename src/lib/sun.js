// Where is the sun right now? We compute the sun's real position (altitude +
// azimuth) for a location and time, then use it to decide whether it's dark,
// which time-of-day phase we're in, and where to draw the sun on the card —
// rather than leaning on fixed clock hours.
//
// Uses the Astronomical Almanac's low-precision solar formulas (good to ~0.01°
// from 1950–2050), which is far more than enough for a weather backdrop.

const DEG = Math.PI / 180;

// Sun's horizontal coordinates at an instant for a lat/lon: altitude (degrees
// above the horizon, negative = below) and azimuth (degrees clockwise from
// north: 90 = east, 180 = south, 270 = west). Only the Date's UTC instant
// matters, so there's no timezone juggling.
export function solarPosition(date, latitude, longitude) {
  const jd = date.getTime() / 86400000 + 2440587.5; // ms-since-epoch -> Julian Day
  const n = jd - 2451545.0; // days since the J2000.0 epoch

  // Sun's apparent ecliptic position.
  const L = 280.460 + 0.9856474 * n; // mean longitude (deg)
  const g = (357.528 + 0.9856003 * n) * DEG; // mean anomaly (rad)
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG; // ecliptic long (rad)
  const epsilon = (23.439 - 0.0000004 * n) * DEG; // obliquity of the ecliptic (rad)

  // Equatorial coordinates of the sun.
  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)); // right ascension (rad)
  const dec = Math.asin(Math.sin(epsilon) * Math.sin(lambda)); // declination (rad)

  // Local hour angle = local sidereal time − right ascension.
  const gmst = 280.46061837 + 360.98564736629 * n; // Greenwich mean sidereal time (deg)
  const lst = (gmst + longitude) * DEG; // local sidereal time (rad, east-longitude positive)
  const H = lst - ra;

  const lat = latitude * DEG;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / DEG;

  // Azimuth measured from south (positive toward west), then shifted to be
  // clockwise from north.
  const azSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat));
  const azimuth = (azSouth / DEG + 180 + 360) % 360;

  // Hour angle in degrees, normalised to [-180, 180): negative before solar
  // noon, positive after. This runs monotonically morning→noon→afternoon
  // everywhere on Earth, so it's what we use to place the sun left→right
  // (compass azimuth misbehaves in the tropics and southern hemisphere, where
  // the sun can sit due north).
  const hourAngle = (((H / DEG) % 360) + 540) % 360 - 180;

  return { altitude, azimuth, hourAngle, declination: dec / DEG };
}

// Back-compat: just the altitude.
export function solarAltitude(date, latitude, longitude) {
  return solarPosition(date, latitude, longitude).altitude;
}

// Standard sunrise/sunset definition: the sun's upper limb touches the horizon,
// which (with mean atmospheric refraction) is when its center sits 0.833° below.
const HORIZON_DEG = -0.833;

// True after sundown and before sunup at the given location. Missing coordinates
// fall back to "sun up" (no moon), matching the prior daytime default.
export function isSunDown(date, latitude, longitude) {
  if (!validCoords(latitude, longitude)) return false;
  return solarAltitude(date, latitude, longitude) < HORIZON_DEG;
}

// Altitude (deg) boundaries between the time-of-day phases. The twilight band
// (sun between DUSK_DEG and DAY_DEG) is the golden-hour/civil-twilight glow we
// render as dawn or dusk; above it is full day, below it is night.
const DAY_DEG = 6; // sun comfortably up
const DUSK_DEG = -6; // end of civil twilight — properly dark below this

// Real time-of-day phase from the sun's position: 'dawn' | 'day' | 'dusk' |
// 'night'. Dawn vs dusk is decided by whether the sun is climbing or sinking.
// Returns null when coordinates are missing so callers can fall back to a
// clock-based phase.
export function sunPhase(date, latitude, longitude) {
  if (!validCoords(latitude, longitude)) return null;
  const alt = solarAltitude(date, latitude, longitude);
  if (alt > DAY_DEG) return 'day';
  if (alt < DUSK_DEG) return 'night';
  const altLater = solarAltitude(new Date(date.getTime() + 600000), latitude, longitude);
  return altLater >= alt ? 'dawn' : 'dusk';
}

// Where to draw the sun on the card, as { x, y } percentages of the card, or
// null when the sun is below the horizon / coordinates are missing. The view
// faces the equator (sun rises on the left/east, arcs across, sets on the
// right/west). x maps azimuth east→west across the width; y maps altitude
// horizon→zenith up the height.
export function sunScreenPosition(date, latitude, longitude) {
  if (!validCoords(latitude, longitude)) return null;
  const { altitude, hourAngle, declination } = solarPosition(date, latitude, longitude);
  if (altitude < HORIZON_DEG) return null; // sun is down — caller shows the moon instead

  // Horizontal position from the hour angle, scaled by the half-day arc H0 (the
  // hour angle at sunrise/sunset). East is on the right (map convention), so the
  // sun sits at the right edge at sunrise, centre at solar noon, and left edge at
  // sunset — consistent everywhere, independent of hemisphere/season.
  const cosH0 = clamp(-Math.tan(latitude * DEG) * Math.tan(declination * DEG), -1, 1);
  const H0 = Math.acos(cosH0) / DEG; // 0..180° (180 = sun up all day near the poles)
  const frac = H0 > 0 ? clamp(hourAngle / H0, -1, 1) : 0; // -1 sunrise … +1 sunset
  const x = clamp(50 - frac * 42, 8, 92);
  // Keep the sun in the upper "sky" band of this portrait card so it never sinks
  // into the content: low sun (horizon) → 27%, high sun (overhead) → 5%.
  const y = 27 - (clamp(altitude, 0, 52) / 52) * 22;
  return { x, y };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function validCoords(latitude, longitude) {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude)
  );
}

// ── Generic per-world day model ─────────────────────────────────────────────
// The real-Earth ephemeris above only fits genuine Earth places. Other worlds
// spin on their own canonical clock — Bespin every 12 h, Naboo every 26 h,
// Tatooine every 23 h — so we model their sky with a simple continuous day cycle
// of a given length rather than Earth's orbit. The sun climbs to WORLD_NOON_ALT
// at local midday and dips symmetrically below the horizon at night; phase,
// darkness and on-screen position come out the same shape as the real-sun
// helpers, so the rest of the card treats these worlds identically.
const WORLD_NOON_ALT = 64; // how high the sun rides at local noon (degrees)

// Local time as continuous hours since the Unix epoch for an IANA zone. Reading
// the wall-clock hour directly jumps at midnight; this doesn't, so a day cycle
// of any length advances smoothly across the boundary.
function zoneHours(date, timeZone) {
  try {
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
      .formatToParts(date)
      .reduce((a, x) => ((a[x.type] = x.value), a), {});
    const h = p.hour === '24' ? 0 : Number(p.hour); // some engines emit hour 24 at midnight
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, h, +p.minute, +p.second);
    return asUTC / 3600000;
  } catch {
    return date.getTime() / 3600000;
  }
}

function frac(v) {
  return v - Math.floor(v);
}

// Sky state for a world rotating once every `dayLengthHours`, anchored to its
// local clock so the sun rides highest at local noon. `phaseShift` (0..1)
// optionally rotates the cycle. Returns { phase, dark, altitude, pos } mirroring
// the real-sun helpers: phase ∈ 'dawn'|'day'|'dusk'|'night', and pos is { x, y }
// card percentages, or null when the sun is below the horizon.
export function worldSun(date, timeZone, dayLengthHours, phaseShift = 0) {
  const len = dayLengthHours > 0 ? dayLengthHours : 24;
  // cyclePos: 0 = local solar midnight, 0.5 = local solar noon.
  const cyclePos = frac(zoneHours(date, timeZone) / len + (phaseShift || 0));
  const altitude = WORLD_NOON_ALT * -Math.cos(2 * Math.PI * cyclePos);
  const rising = cyclePos < 0.5;

  let phase;
  if (altitude > DAY_DEG) phase = 'day';
  else if (altitude < DUSK_DEG) phase = 'night';
  else phase = rising ? 'dawn' : 'dusk';

  const dark = altitude < HORIZON_DEG;
  let pos = null;
  if (!dark) {
    const dayFrac = clamp((cyclePos - 0.25) / 0.5, 0, 1); // 0 sunrise … 1 sunset
    const x = clamp(92 - dayFrac * 84, 8, 92); // rises east (right) → sets west (left)
    const y = 27 - (clamp(altitude, 0, 52) / 52) * 22; // horizon 27% → zenith 5%
    pos = { x, y };
  }
  return { phase, dark, altitude, pos };
}

// Fraction through a world's local day (0 = solar midnight, 0.5 = solar noon) for
// a given rotation length. Shared with the fictional temperature model so a
// world's warmth rides the same cycle as its sky (warmest mid-"afternoon",
// coldest before "dawn") on whatever clock it spins — Bespin's 12 h included.
export function worldDayFraction(date, timeZone, dayLengthHours) {
  const len = dayLengthHours > 0 ? dayLengthHours : 24;
  return frac(zoneHours(date, timeZone) / len);
}
