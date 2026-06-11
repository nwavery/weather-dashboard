// Minimal positional astronomy for the page-background sky map. Pure functions
// of (time, observer) — no imports — so they're trivially unit-testable.
//
// Conventions: angles in degrees; RA 0..360; azimuth from North through East
// (N=0, E=90, S=180, W=270); altitude above horizon.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// Greenwich Mean Sidereal Time in hours (good to ~0.1s/century — plenty here).
export function gmstHours(date) {
  const days = date.getTime() / 86400000 + 2440587.5 - 2451545.0; // days since J2000
  const g = (18.697374558 + 24.06570982441908 * days) % 24;
  return g < 0 ? g + 24 : g;
}

// Local sidereal time in degrees for an east-positive longitude.
export function lstDegrees(date, longitude) {
  const l = (gmstHours(date) * 15 + longitude) % 360;
  return l < 0 ? l + 360 : l;
}

// Equatorial (RA/Dec) → horizontal (alt/az) for an observer.
export function altAz(raDeg, decDeg, latDeg, lstDeg) {
  const H = (lstDeg - raDeg) * D2R; // hour angle, west-positive
  const dec = decDeg * D2R;
  const lat = latDeg * D2R;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(
    -Math.cos(dec) * Math.sin(H),
    Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.cos(H) * Math.sin(lat)
  );
  return { alt: alt * R2D, az: ((az * R2D) % 360 + 360) % 360 };
}

// Zenith-centered dome ("planisphere") projection: zenith at (cx, cy), the
// horizon a circle of radius R, north up. Returns canvas coordinates.
export function projectDome(altDeg, azDeg, cx, cy, R) {
  const r = ((90 - altDeg) / 90) * R;
  const az = azDeg * D2R;
  return { x: cx + r * Math.sin(az), y: cy - r * Math.cos(az) };
}

// B-V color index → subtle star tint [r, g, b].
export function starTint(bv10) {
  if (bv10 <= 0) return [185, 205, 255];  // blue-white (Rigel, Spica)
  if (bv10 <= 5) return [235, 240, 255];  // white (Sirius, Vega)
  if (bv10 <= 10) return [255, 244, 220]; // yellow-white (Capella, the Sun)
  if (bv10 <= 15) return [255, 224, 185]; // orange (Arcturus, Aldebaran)
  return [255, 205, 165];                 // red (Betelgeuse, Antares)
}
