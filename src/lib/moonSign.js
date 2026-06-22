// Live astrology readout: the Moon's zodiac sign (its emotional "weather"), the
// Sun's current sign (the "season"), and the blend between them.
//
// Tropical zodiac (Western astrology): fixed 30° bands from the vernal equinox,
// read straight off ecliptic longitude. Positions use standard low-precision
// solar/lunar terms — far finer than the 30° sign bins need. Meanings follow
// traditional associations: the Moon = mood/instinct/comfort, the Sun = core
// self; each sign carries an element (fire/earth/air/water) and the Moon's
// essential dignities (rules Cancer, exalted in Taurus, fall in Scorpio,
// detriment in Capricorn).

const RAD = Math.PI / 180;

export function moonLongitude(date = new Date()) {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0; // days since J2000.0
  const L = 218.316 + 13.176396 * d;
  const M = 134.963 + 13.064993 * d;
  const Ms = 357.529 + 0.985608 * d;
  const D = 297.85 + 12.190749 * d;
  const F = 93.272 + 13.22935 * d;
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

export function sunLongitude(date = new Date()) {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = 280.46 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * RAD;
  const lon = L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  return ((lon % 360) + 360) % 360;
}

// element index = sign index % 4 → 0 fire, 1 earth, 2 air, 3 water
const ELEMENTS = ['fire', 'earth', 'air', 'water'];

const SIGNS = [
  { name: 'Aries', glyph: '♈', notes: [
    'feelings flare fast and cool fast — restless, brave, impatient to act',
    'emotional courage runs high; you want to act on it, not sit with it',
    'a short fuse over a warm heart — quick to spark, quick to forgive'
  ] },
  { name: 'Taurus', glyph: '♉', notes: [
    "the Moon's happiest seat (exalted): steady, sensual, calmed by comfort and routine",
    'emotionally grounded and slow to rattle; good food and familiar things soothe',
    'warm, loyal, and stubborn — feelings settle deep and rarely budge'
  ] },
  { name: 'Gemini', glyph: '♊', notes: [
    'feelings get talked and thought through; curious, restless, craving variety',
    'a busy, witty heart that processes emotion in words, not silence',
    'light and quick — but moods can scatter as fast as they arrive'
  ] },
  { name: 'Cancer', glyph: '♋', notes: [
    "the Moon's home sign (rulership): deeply feeling, nurturing, happiest close to home",
    'tides of emotion run strong; you protect, remember, and care fiercely',
    'tender and a touch moody — family and familiar places restore you'
  ] },
  { name: 'Leo', glyph: '♌', notes: [
    'warm, generous, dramatic feelings — you give big and need to feel appreciated',
    'a proud, sunny heart that loves attention, romance, and play',
    'loyal and expressive; affection and recognition keep your spirits bright'
  ] },
  { name: 'Virgo', glyph: '♍', notes: [
    'you show care by helping and fixing; a tidy, analytical heart that quietly worries',
    'emotions sorted into something useful — routine and order feel like love',
    'modest and observant; calm comes from being helpful and things just-so'
  ] },
  { name: 'Libra', glyph: '♎', notes: [
    'craves harmony and partnership; soothed by beauty, fairness, and good company',
    'feels best in balance and shrinks from conflict — relationships are home base',
    'charming and accommodating, though weighing everyone can stall your own feelings'
  ] },
  { name: 'Scorpio', glyph: '♏', notes: [
    "the Moon's hardest seat (in fall): intense, private, all-or-nothing depths",
    'emotions are powerful and guarded; you crave truth, depth, and total trust',
    'passionate and perceptive, slow to forgive — you feel everything fully'
  ] },
  { name: 'Sagittarius', glyph: '♐', notes: [
    'optimistic and freedom-loving; feelings need room, adventure, and meaning',
    "a restless, candid heart — you'd rather explore than brood, and you say it straight",
    'buoyant and philosophical; confinement chafes, the open horizon comforts'
  ] },
  { name: 'Capricorn', glyph: '♑', notes: [
    'the Moon sits uneasy here (detriment): reserved, self-reliant, feelings kept in check',
    'you steady emotion with work and structure; security comes from achievement',
    'cool on the surface, dutiful underneath — you take feelings seriously, quietly'
  ] },
  { name: 'Aquarius', glyph: '♒', notes: [
    'feelings processed at arm’s length; independent, inventive, warmed by friendship',
    'an emotionally cool, humanitarian heart that needs freedom and dislikes clinging',
    'detached but caring about the big picture; you bond over ideas, not drama'
  ] },
  { name: 'Pisces', glyph: '♓', notes: [
    'dreamy, empathic, and porous — you soak up the room’s mood and feel it all',
    'intuitive and compassionate; solitude, art, or rest refill you',
    'tender and imaginative, with boundaries that blur — escape calls when it’s too much'
  ] }
];

// Element-pair blends (keys are the two elements sorted alphabetically).
const BLENDS = {
  'air+air': 'double air — heady, social, and full of ideas',
  'air+earth': 'air + earth — plans meet ideas; practical, if a little detached',
  'air+fire': 'air + fire — sparks and ideas feed each other; lively and expressive',
  'air+water': 'air + water — thought meets feeling; empathic and imaginative',
  'earth+earth': 'double earth — grounded, steady, and practical',
  'earth+fire': 'fire + earth — drive meets patience; ambition that actually builds',
  'earth+water': 'earth + water — the fertile blend; nurturing and quietly productive',
  'fire+fire': 'double fire — bold, restless, high-energy',
  'fire+water': 'fire + water — passion meets feeling; intense and a touch stormy',
  'water+water': 'double water — deeply emotional and intuitive'
};

function signIndex(longitude) {
  return Math.floor(longitude / 30) % 12;
}

// A new blurb variant each day (stable within a UTC day) so the same Moon-sign
// stretch doesn't read identically for its ~2.5 days.
function pickNote(notes, date) {
  const day = Math.floor(date.getTime() / 86400000);
  return notes[((day % notes.length) + notes.length) % notes.length];
}

export function moonSign(date = new Date()) {
  const longitude = moonLongitude(date);
  const i = signIndex(longitude);
  const sign = SIGNS[i];
  return { name: sign.name, glyph: sign.glyph, element: ELEMENTS[i % 4], longitude, blurb: pickNote(sign.notes, date) };
}

export function sunSign(date = new Date()) {
  const i = signIndex(sunLongitude(date));
  return { name: SIGNS[i].name, glyph: SIGNS[i].glyph, element: ELEMENTS[i % 4] };
}

// The live Sun×Moon "combo": current Sun sign (season) + Moon sign, with the
// special new-moon (same sign) / full-moon (opposite) cases, else an element
// blend. Returns { sun, moon, relation, text }.
export function skyVibe(date = new Date()) {
  const si = signIndex(sunLongitude(date));
  const mi = signIndex(moonLongitude(date));
  const sun = { name: SIGNS[si].name, glyph: SIGNS[si].glyph };
  const moon = { name: SIGNS[mi].name, glyph: SIGNS[mi].glyph };
  const diff = ((mi - si) % 12 + 12) % 12;
  if (si === mi) {
    return { sun, moon, relation: 'new', text: `new-moon mood — Sun and Moon both in ${sun.name}, instinct and identity as one` };
  }
  if (diff === 6) {
    return { sun, moon, relation: 'full', text: `full-moon pull — ${sun.name} Sun opposite ${moon.name} Moon: what you are vs. what you feel` };
  }
  const key = [ELEMENTS[si % 4], ELEMENTS[mi % 4]].sort().join('+');
  return { sun, moon, relation: 'blend', text: BLENDS[key] };
}
