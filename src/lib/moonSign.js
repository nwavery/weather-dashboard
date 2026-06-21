// The Moon's zodiac sign — which slice of the ecliptic the Moon is currently
// passing through. The Moon races ~13°/day, so it changes sign every ~2.3 days,
// which makes for a fun, frequently-rotating "Moon in …" readout.
//
// Tropical zodiac (Western astrology): signs are fixed 30° bands measured from
// the vernal equinox, i.e. straight off the ecliptic longitude. The longitude
// uses the standard low-precision lunar terms — good to a few tenths of a
// degree, far finer than the 30° sign bins need.

const RAD = Math.PI / 180;

export function moonLongitude(date = new Date()) {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0; // days since J2000.0
  const L = 218.316 + 13.176396 * d; // Moon mean longitude
  const M = 134.963 + 13.064993 * d; // Moon mean anomaly
  const Ms = 357.529 + 0.985608 * d; // Sun mean anomaly
  const D = 297.85 + 12.190749 * d; // mean elongation Moon–Sun
  const F = 93.272 + 13.22935 * d; // Moon argument of latitude
  const lon =
    L +
    6.289 * Math.sin(M * RAD) +
    1.274 * Math.sin((2 * D - M) * RAD) +
    0.658 * Math.sin(2 * D * RAD) +
    0.214 * Math.sin(2 * M * RAD) -
    0.186 * Math.sin(Ms * RAD) -
    0.114 * Math.sin(2 * F * RAD);
  return ((lon % 360) + 360) % 360;
}

// Moon governs mood/instinct in astrology, so the blurbs lean emotional.
const SIGNS = [
  { name: 'Aries', glyph: '♈', blurb: 'bold, restless moods — act on impulse' },
  { name: 'Taurus', glyph: '♉', blurb: 'calm and grounded; craving comfort and good food' },
  { name: 'Gemini', glyph: '♊', blurb: 'chatty and curious; ideas flit fast' },
  { name: 'Cancer', glyph: '♋', blurb: 'tender and nostalgic; home is everything' },
  { name: 'Leo', glyph: '♌', blurb: 'warm and dramatic; ready to shine' },
  { name: 'Virgo', glyph: '♍', blurb: 'a tidy mind; tend, sort, and fix' },
  { name: 'Libra', glyph: '♎', blurb: 'seeking balance, harmony, and a little charm' },
  { name: 'Scorpio', glyph: '♏', blurb: 'deep, intense feelings; all or nothing' },
  { name: 'Sagittarius', glyph: '♐', blurb: 'restless wanderlust; chasing the big picture' },
  { name: 'Capricorn', glyph: '♑', blurb: 'focused and disciplined; get it done' },
  { name: 'Aquarius', glyph: '♒', blurb: 'cool, inventive, a touch contrarian' },
  { name: 'Pisces', glyph: '♓', blurb: 'dreamy and intuitive; feelings move like tides' }
];

export function moonSign(date = new Date()) {
  const longitude = moonLongitude(date);
  const sign = SIGNS[Math.floor(longitude / 30) % 12];
  return { ...sign, longitude };
}
