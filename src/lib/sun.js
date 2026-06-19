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
