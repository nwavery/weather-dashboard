// Where is the sun right now? We decide "is it dark out" from the sun's actual
// altitude above the horizon for a location, rather than fixed clock hours — so
// the moon appears at real sundown and hides at real sunup, year-round and at
// any latitude.
//
// Uses the Astronomical Almanac's low-precision solar formulas (good to ~0.01°
// from 1950–2050), which is far more than enough to know whether the sun is up.

const DEG = Math.PI / 180;

// Solar altitude in degrees (angle above the horizon; negative = below) at a
// given instant for a latitude/longitude. `date` is any Date — only its UTC
// instant matters, so no timezone juggling is needed.
export function solarAltitude(date, latitude, longitude) {
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
  const sinAlt =
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / DEG;
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

function validCoords(latitude, longitude) {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude)
  );
}
