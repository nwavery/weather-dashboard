// Headline "flavor" for real cities: the WMO weather code only describes the
// sky, so conditions like wind, humidity extremes, smoke, or an imminent storm
// never reach the headline on their own. This resolver picks AT MOST ONE
// modifier by severity and (optionally) an ambient particle effect to go with
// it. Fictional cities never use this — they have their own taglines.
//
// Precedence (most attention-worthy first):
//   Smoky haze > Blowing dust > incoming precip (on the way→imminent) >
//   Scorching/Frigid > Windy > dew-point comfort (Bone-dry → Miserable)

const WINDY_MPH = 20;
const GUSTY_MPH = 35;
const DUST_WIND_MPH = 30;
const DUST_MAX_RH = 25;
const SMOKE_AQI = 150;
const SCORCHING_F = 102;
const FRIGID_F = 10;
const BREWING_PROB = 70; // % chance that flags incoming precip…
const BREWING_MM = 0.5; // …or this much forecast precip in an upcoming slot — a real
//                          downpour can arrive on deceptively low stated odds, so the
//                          forecast amount and weather code count too, not just the %.
const LOOKAHEAD_MIN = 180; // look this far ahead (minutes) for incoming precip

const THUNDER_CODES = new Set([95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);

// The full dew-point comfort scale (°F): how the air actually feels, from
// bone-dry to miserable. This is the lowest-precedence flavor — it fills the
// headline whenever nothing more urgent (wind, smoke, temperature extremes…)
// claims it, so real cards always carry a comfort word. `detail` surfaces as a
// hover tooltip on the headline.
const DEW_SCALE = [
  { min: 76, label: 'Miserable', detail: 'dangerously saturated; high risk of heat exhaustion' },
  { min: 70, label: 'Oppressive', detail: 'thick, tropical, and exhausting' },
  { min: 65, label: 'Sticky', detail: 'uncomfortable and heavy; AC territory' },
  { min: 60, label: 'Muggy', detail: 'sticky and damp; sweat is slow to evaporate' },
  { min: 55, label: 'Noticeable humidity', detail: 'a hint of moisture, still very acceptable' },
  { min: 50, label: 'Ideal comfort', detail: 'the sweet spot — effortless and light' },
  { min: 40, label: 'Quite dry', detail: 'pleasant and fresh; great for being active' },
  { min: 30, label: 'Severely dry', detail: 'very crisp; skin starts to feel dry' },
  { min: -Infinity, label: 'Bone-dry', detail: 'harshly dry; chapped lips and static shocks' }
];

function dewComfort(dew) {
  if (typeof dew !== 'number' || Number.isNaN(dew)) return null;
  const band = DEW_SCALE.find((b) => dew >= b.min);
  return { label: band.label, effect: null, detail: `Dew point ${Math.round(dew)}° — ${band.detail}` };
}

// Current wall-clock in a location's zone. Open-Meteo's time arrays are naive
// local-to-location strings, so we compare against this (same trick as elsewhere).
function zoneNow(timeZone) {
  try {
    return new Date(new Date().toLocaleString('en-US', { timeZone }));
  } catch {
    return new Date();
  }
}

// Max precipitation probability over the look-ahead. Probability is hourly-only,
// so this scans the hourly series as a backstop trigger / detail.
function upcomingProb(hourly, now) {
  if (!hourly?.time || !hourly?.precipitation_probability) return 0;
  let max = 0;
  for (let i = 0; i < hourly.time.length; i++) {
    const min = (new Date(hourly.time[i]) - now) / 60000;
    if (min <= -60 || min > LOOKAHEAD_MIN) continue;
    const p = hourly.precipitation_probability[i];
    if (typeof p === 'number' && p > max) max = p;
  }
  return max;
}

// Soonest upcoming precipitation the current (still-benign) sky doesn't show yet
// — from 15-minute data when available (so "<30 min" is real, not guessed from an
// hour bucket), falling back to hourly. Triggers on a rain/snow/thunder code or a
// meaningful forecast amount, not just probability (a real downpour can sit at a
// low stated chance). Returns { kind, leadMin, maxMm, maxProb } or null when the
// next few hours look dry.
function upcomingPrecip(minutely, hourly, timeZone) {
  const now = zoneNow(timeZone);
  const useMin = Array.isArray(minutely?.time) && minutely.time.length > 0;
  const series = useMin ? minutely : hourly;
  if (!series?.time) return null;
  const slot = useMin ? 15 : 60; // minutes a slot represents
  const times = series.time;
  const mms = series.precipitation || [];
  const codes = series.weather_code || [];
  let kind = null;
  let leadMin = null;
  let maxMm = 0;
  for (let i = 0; i < times.length; i++) {
    const min = (new Date(times[i]) - now) / 60000;
    if (min <= -slot) continue; // slot already fully past
    if (min > LOOKAHEAD_MIN) break; // beyond the look-ahead
    const m = typeof mms[i] === 'number' ? mms[i] : 0;
    if (m > maxMm) maxMm = m;
    const c = codes[i];
    // Snow legitimately reports ~0 mm liquid-equivalent, so trust its code; rain
    // counts by code or by a meaningful forecast amount.
    if (kind === null && (THUNDER_CODES.has(c) || SNOW_CODES.has(c) || RAIN_CODES.has(c) || m >= BREWING_MM)) {
      kind = THUNDER_CODES.has(c) ? 'thunder' : SNOW_CODES.has(c) ? 'snow' : 'rain';
      leadMin = Math.max(0, Math.round(min));
    }
  }
  const maxProb = upcomingProb(hourly, now);
  if (kind === null) {
    if (maxProb < BREWING_PROB) return null; // dry, low odds → no heads-up
    kind = 'rain'; // high odds but no amount/code landed in a slot
    leadMin = LOOKAHEAD_MIN;
  }
  return { kind, leadMin, maxMm, maxProb };
}

// Tiered heads-up wording by lead time — an escalating gradient as it closes in:
// on the way (~3 h) → approaching (~2 h) → incoming (~1 h) → imminent (<30 min).
function leadLabel(kind, leadMin) {
  const noun = kind === 'thunder' ? 'Storm' : kind === 'snow' ? 'Snow' : 'Rain';
  if (leadMin < 30) return `${noun} imminent`;
  if (leadMin < 90) return `${noun} incoming`;
  if (leadMin < 150) return `${noun} approaching`;
  return kind === 'thunder' ? 'Storm brewing' : `${noun} on the way`;
}

// Returns { label, effect } or null. `effect` is a WorldEffects kind (or null);
// the card only renders it when the base animation isn't a precipitation scene.
export function headlineFlavor({ current, air, hourly, minutely, timeZone, effCode }) {
  if (!current) return null;
  const wind = current.wind_speed_10m ?? 0;
  const gusts = current.wind_gusts_10m ?? 0;
  const rh = current.relative_humidity_2m;
  const feels = current.apparent_temperature;
  const dew = current.dew_point_2m;
  const precip = current.precipitation ?? 0;
  // Prefer the card's effective code (phantom-storm-suppressed, and overridden by
  // a live NWS observation) so we don't flag "Rain incoming" while the sky is
  // already showing observed rain.
  const code = typeof effCode === 'number' ? effCode : current.weather_code;
  const aqi = air?.us_aqi;

  if (typeof aqi === 'number' && aqi >= SMOKE_AQI) {
    return { label: 'Smoky haze', effect: 'smoke' };
  }
  if (wind >= DUST_WIND_MPH && typeof rh === 'number' && rh <= DUST_MAX_RH && precip === 0) {
    return { label: 'Blowing dust', effect: 'sand' };
  }
  // Heads-up for incoming precip while the sky still looks benign (codes 0-3) and
  // it isn't already falling. Wording escalates as it closes in (on the way →
  // imminent), with the precise lead time + amount in the tooltip.
  if (typeof code === 'number' && code <= 3 && precip === 0) {
    const up = upcomingPrecip(minutely, hourly, timeZone);
    if (up) {
      const m = up.leadMin;
      const when = m < 60 ? `in ~${Math.max(5, Math.round(m / 5) * 5)} min` : `in ~${Math.round(m / 60)} h`;
      const detail =
        up.maxMm >= BREWING_MM
          ? `≈${Math.round(up.maxMm)} mm forecast ${when}`
          : `${up.maxProb}% chance within ${Math.round(LOOKAHEAD_MIN / 60)} h`;
      return { label: leadLabel(up.kind, m), effect: null, detail };
    }
  }
  if (typeof feels === 'number' && feels >= SCORCHING_F) {
    return { label: 'Scorching', effect: null };
  }
  if (typeof feels === 'number' && feels <= FRIGID_F) {
    return { label: 'Frigid', effect: null };
  }
  if (wind >= WINDY_MPH || gusts >= GUSTY_MPH) {
    return { label: 'Windy', effect: 'leaves' };
  }
  // Nothing urgent — fall through to the dew-point comfort word.
  return dewComfort(dew);
}
