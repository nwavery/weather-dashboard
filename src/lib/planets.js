// Where the planets and the Moon are, for the page-background sky map.
//
// The map shows ~1600 real stars, but the five naked-eye planets and the Moon
// are the brightest things in the night sky — Venus outshines Sirius, the
// brightest star, about fifteen times over. A "real sky" without them is
// missing exactly what people point at and ask about.
//
// Planets: JPL's Keplerian elements for approximate positions (E. M. Standish,
// "Keplerian Elements for Approximate Positions of the Major Planets", Table 1,
// valid 1800-2050). Moon: the Astronomical Almanac's low-precision series. Both
// are expressed in the J2000 frame the star catalog uses, so a planet lands
// beside the right star. Light-time and aberration (under a minute of arc) are
// ignored — far below a pixel on the map.
//
// Pure functions of time, no imports — like skymap.js.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const OBLIQUITY_J2000 = 23.43928 * D2R;

// Julian centuries since J2000.0 (TT ≈ UT here; the ~70 s difference moves
// nothing visibly).
export function centuriesSinceJ2000(date) {
  return (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;
}

// [value at J2000, rate per century] for: semi-major axis a (AU), eccentricity
// e, inclination I (deg), mean longitude L (deg), longitude of perihelion
// `peri` (deg), longitude of the ascending node `node` (deg). Ecliptic and
// equinox of J2000.
const ELEMENTS = {
  mercury: {
    a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749],
    L: [252.2503235, 149472.67411175], peri: [77.45779628, 0.16047689], node: [48.33076593, -0.12534081]
  },
  venus: {
    a: [0.72333566, 0.0000039], e: [0.00677672, -0.00004107], I: [3.39467605, -0.0007889],
    L: [181.9790995, 58517.81538729], peri: [131.60246718, 0.00268329], node: [76.67984255, -0.27769418]
  },
  earth: { // Earth-Moon barycentre — within ~4700 km of Earth, invisible at these scales
    a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981], peri: [102.93768193, 0.32327364], node: [0, 0]
  },
  mars: {
    a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499], peri: [-23.94362959, 0.44441088], node: [49.55953891, -0.29257343]
  },
  jupiter: {
    a: [5.202887, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714],
    L: [34.39644051, 3034.74612775], peri: [14.72847983, 0.21252668], node: [100.47390909, 0.20469106]
  },
  saturn: {
    a: [9.53667594, -0.0012506], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609],
    L: [49.95424423, 1222.49362201], peri: [92.59887831, -0.41897216], node: [113.66242448, -0.28867794]
  }
};

// Display name, map tint, and the Astronomical Almanac (1992) visual-magnitude
// law: V = H + 5·log10(r·Δ) + f(phase angle i in degrees).
const PLANETS = [
  { id: 'mercury', name: 'Mercury', tint: [226, 212, 198], mag: (i) => -0.42 + 0.038 * i - 0.000273 * i ** 2 + 0.000002 * i ** 3 },
  { id: 'venus', name: 'Venus', tint: [255, 250, 230], mag: (i) => -4.4 + 0.0009 * i + 0.000239 * i ** 2 - 0.00000065 * i ** 3 },
  { id: 'mars', name: 'Mars', tint: [255, 150, 104], mag: (i) => -1.52 + 0.016 * i },
  { id: 'jupiter', name: 'Jupiter', tint: [255, 236, 202], mag: (i) => -9.4 + 0.005 * i },
  { id: 'saturn', name: 'Saturn', tint: [242, 218, 160], mag: (i) => -8.88 + 0.044 * i }
];

function solveKepler(M, e) {
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 15; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

// Heliocentric ecliptic J2000 position [x, y, z] in AU.
function heliocentric(id, T) {
  const el = ELEMENTS[id];
  const at = ([v, rate]) => v + rate * T;
  const a = at(el.a);
  const e = at(el.e);
  const I = at(el.I) * D2R;
  const peri = at(el.peri);
  const node = at(el.node);
  const M = ((((at(el.L) - peri) % 360) + 540) % 360) - 180; // mean anomaly, -180..180
  const E = solveKepler(M * D2R, e);
  const xp = a * (Math.cos(E) - e); // in the orbital plane, x toward perihelion
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const w = (peri - node) * D2R; // argument of perihelion
  const O = node * D2R;
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp
  ];
}

const norm = (v) => Math.hypot(v[0], v[1], v[2]);
const wrap360 = (deg) => ((deg % 360) + 360) % 360;

function eclipticAngles([x, y, z]) {
  return { lon: wrap360(Math.atan2(y, x) * R2D), lat: Math.atan2(z, Math.hypot(x, y)) * R2D };
}

function equatorialAngles([x, y, z]) {
  const c = Math.cos(OBLIQUITY_J2000);
  const s = Math.sin(OBLIQUITY_J2000);
  const ye = c * y - s * z;
  const ze = s * y + c * z;
  return { ra: wrap360(Math.atan2(ye, x) * R2D), dec: Math.atan2(ze, Math.hypot(x, ye)) * R2D };
}

// The Sun as seen from Earth: the reverse of Earth's heliocentric position.
export function sunPosition(date) {
  const [x, y, z] = heliocentric('earth', centuriesSinceJ2000(date));
  const v = [-x, -y, -z];
  return { ...eclipticAngles(v), ...equatorialAngles(v), dist: norm(v) };
}

// Saturn's rings brighten it by up to ~1.2 mag when open: tilt B of the ring
// plane toward Earth from the planet's geocentric ecliptic λ, β (Meeus ch. 45).
function saturnRingTerm(lon, lat, T) {
  const i = (28.075216 - 0.012998 * T) * D2R;
  const node = (169.50847 + 1.394681 * T) * D2R;
  const sinB = Math.sin(i) * Math.cos(lat * D2R) * Math.sin(lon * D2R - node) - Math.cos(i) * Math.sin(lat * D2R);
  return -2.6 * Math.abs(sinB) + 1.25 * sinB * sinB;
}

// A planet as seen from Earth: J2000 RA/Dec and ecliptic λ/β (degrees),
// distances (AU) and apparent visual magnitude.
export function planetPosition(id, date) {
  const T = centuriesSinceJ2000(date);
  const p = heliocentric(id, T);
  const earth = heliocentric('earth', T);
  const g = [p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]];
  const r = norm(p); // Sun-planet
  const dist = norm(g); // Earth-planet
  const R = norm(earth); // Sun-Earth
  const cosI = (r * r + dist * dist - R * R) / (2 * r * dist);
  const phaseAngle = Math.acos(Math.max(-1, Math.min(1, cosI))) * R2D;
  const ecl = eclipticAngles(g);
  const spec = PLANETS.find((q) => q.id === id);
  let mag = spec.mag(phaseAngle) + 5 * Math.log10(r * dist);
  if (id === 'saturn') mag += saturnRingTerm(ecl.lon, ecl.lat, T);
  return { ...ecl, ...equatorialAngles(g), dist, r, phaseAngle, mag };
}

// The Moon (geocentric): Astronomical Almanac low-precision series, good to
// ~0.3° in longitude and ~0.2° in latitude, 1900-2100. `hp` is the horizontal
// parallax in degrees — the Moon is close enough that it sits up to ~1° lower
// in the sky than the geocentric position says (see parallaxAltitude).
export function moonPosition(date) {
  const T = centuriesSinceJ2000(date);
  const s = (deg) => Math.sin(deg * D2R);
  const c = (deg) => Math.cos(deg * D2R);
  const lonOfDate =
    218.32 + 481267.881 * T +
    6.29 * s(135.0 + 477198.87 * T) - 1.27 * s(259.3 - 413335.36 * T) +
    0.66 * s(235.7 + 890534.22 * T) + 0.21 * s(269.9 + 954397.74 * T) -
    0.19 * s(357.5 + 35999.05 * T) - 0.11 * s(186.5 + 966404.03 * T);
  const lat =
    5.13 * s(93.3 + 483202.02 * T) + 0.28 * s(228.2 + 960400.89 * T) -
    0.28 * s(318.3 + 6003.15 * T) - 0.17 * s(217.6 - 407332.21 * T);
  const hp =
    0.9508 + 0.0518 * c(135.0 + 477198.87 * T) + 0.0095 * c(259.3 - 413335.36 * T) +
    0.0078 * c(235.7 + 890534.22 * T) + 0.0028 * c(269.9 + 954397.74 * T);
  // The series is referred to the equinox of date; the star catalog is J2000.
  // Undo general precession in longitude (1.397°/century — about 0.37° by
  // 2026, most of the Moon's own width) so the Moon sits among the right stars.
  const lon = wrap360(lonOfDate - 1.3972 * T);
  const v = [c(lat) * c(lon), c(lat) * s(lon), s(lat)];
  return { lon, lat, ...equatorialAngles(v), hp };
}

// Great-circle separation between two RA/Dec positions, degrees.
export function angularSeparation(ra1, dec1, ra2, dec2) {
  const d1 = dec1 * D2R;
  const d2 = dec2 * D2R;
  const cosSep = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos((ra1 - ra2) * D2R);
  return Math.acos(Math.max(-1, Math.min(1, cosSep))) * R2D;
}

// The point `stepDeg` along the great circle from (ra1, dec1) toward
// (ra2, dec2) — used to find which way the Moon's lit limb faces on the map.
export function stepToward(ra1, dec1, ra2, dec2, stepDeg) {
  const vec = (ra, dec) => [Math.cos(dec * D2R) * Math.cos(ra * D2R), Math.cos(dec * D2R) * Math.sin(ra * D2R), Math.sin(dec * D2R)];
  const u = vec(ra1, dec1);
  const v = vec(ra2, dec2);
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const w = [v[0] - dot * u[0], v[1] - dot * u[1], v[2] - dot * u[2]];
  const wn = norm(w);
  if (wn < 1e-9) return { ra: ra1, dec: dec1 }; // coincident or opposite: no direction
  const k = stepDeg * D2R;
  const p = [0, 1, 2].map((i) => Math.cos(k) * u[i] + (Math.sin(k) * w[i]) / wn);
  return { ra: wrap360(Math.atan2(p[1], p[0]) * R2D), dec: Math.asin(Math.max(-1, Math.min(1, p[2]))) * R2D };
}

// Topocentric altitude of the Moon from its geocentric altitude: an observer on
// the surface sees it lower by about hp·cos(alt).
export function parallaxAltitude(altDeg, hpDeg) {
  return altDeg - hpDeg * Math.cos(altDeg * D2R);
}

// Everything the sky map draws beyond the fixed stars, at one instant.
export function skyBodies(date) {
  const sun = sunPosition(date);
  const m = moonPosition(date);
  const elongation = angularSeparation(m.ra, m.dec, sun.ra, sun.dec);
  return {
    sun,
    // Illuminated fraction from the Sun-Moon elongation (0 new … 1 full).
    moon: { ...m, name: 'Moon', illum: (1 - Math.cos(elongation * D2R)) / 2 },
    planets: PLANETS.map((q) => ({ id: q.id, name: q.name, tint: q.tint, ...planetPosition(q.id, date) }))
  };
}
