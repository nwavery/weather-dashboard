// Headline "flavor" for real cities: the WMO weather code only describes the
// sky, so conditions like wind, humidity extremes, smoke, or an imminent storm
// never reach the headline on their own. This resolver picks AT MOST ONE
// modifier by severity and (optionally) an ambient particle effect to go with
// it. Fictional cities never use this — they have their own taglines.
//
// Precedence (most attention-worthy first):
//   Smoky haze > Blowing dust > Storm brewing > Scorching/Frigid > Windy >
//   dew-point comfort (Bone-dry → Miserable)

const WINDY_MPH = 20;
const GUSTY_MPH = 35;
const DUST_WIND_MPH = 30;
const DUST_MAX_RH = 25;
const SMOKE_AQI = 150;
const SCORCHING_F = 102;
const FRIGID_F = 10;
const BREWING_PROB = 70; // % chance that flags an incoming storm…
const BREWING_MM = 0.5; // …or this much forecast precip in an upcoming hour — a real
//                          downpour can arrive on deceptively low stated odds, so the
//                          forecast amount and weather code count too, not just the %.
const BREWING_LOOKAHEAD_H = 3;

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

// Scan the next few hours for precipitation the current (still-benign) sky
// doesn't show yet. Considers the forecast amount and weather code, not just the
// stated probability — a real downpour sometimes arrives on a deceptively low
// chance (we've seen ~16 mm forecast sitting at ~30%). Hourly times are naive
// local-to-location strings, so compare against the wall-clock in the location's
// zone (same approach as HourlyForecast). Returns the soonest incoming precip as
// { kind, maxProb, maxMm, hoursAway }, or null when the next few hours look dry.
function upcomingPrecip(hourly, timeZone) {
  if (!hourly?.time) return null;
  let nowZone;
  try {
    nowZone = new Date(new Date().toLocaleString('en-US', { timeZone }));
  } catch {
    nowZone = new Date();
  }
  nowZone.setMinutes(0, 0, 0);
  const start = hourly.time.findIndex((t) => new Date(t) >= nowZone);
  if (start === -1) return null;
  const end = Math.min(start + BREWING_LOOKAHEAD_H + 1, hourly.time.length);

  const probs = hourly.precipitation_probability || [];
  const mms = hourly.precipitation || [];
  const codes = hourly.weather_code || [];
  let maxProb = 0;
  let maxMm = 0;
  let kind = null;
  let hoursAway = null;
  for (let i = start; i < end; i++) {
    if (typeof probs[i] === 'number') maxProb = Math.max(maxProb, probs[i]);
    if (typeof mms[i] === 'number') maxMm = Math.max(maxMm, mms[i]);
    const c = codes[i];
    // Snow legitimately reports ~0 mm liquid-equivalent, so trust its code; rain
    // counts by code or by a meaningful forecast amount.
    const wet =
      THUNDER_CODES.has(c) ||
      SNOW_CODES.has(c) ||
      RAIN_CODES.has(c) ||
      (typeof mms[i] === 'number' && mms[i] >= BREWING_MM);
    if (wet && kind === null) {
      kind = THUNDER_CODES.has(c) ? 'thunder' : SNOW_CODES.has(c) ? 'snow' : 'rain';
      hoursAway = i - start;
    }
  }
  if (kind === null && maxProb < BREWING_PROB) return null; // dry, low odds → no heads-up
  if (kind === null) kind = 'rain'; // high odds but no amount/code landed yet
  return { kind, maxProb, maxMm, hoursAway: hoursAway ?? 0 };
}

// Returns { label, effect } or null. `effect` is a WorldEffects kind (or null);
// the card only renders it when the base animation isn't a precipitation scene.
export function headlineFlavor({ current, air, hourly, timeZone }) {
  if (!current) return null;
  const wind = current.wind_speed_10m ?? 0;
  const gusts = current.wind_gusts_10m ?? 0;
  const rh = current.relative_humidity_2m;
  const feels = current.apparent_temperature;
  const dew = current.dew_point_2m;
  const precip = current.precipitation ?? 0;
  const code = current.weather_code;
  const aqi = air?.us_aqi;

  if (typeof aqi === 'number' && aqi >= SMOKE_AQI) {
    return { label: 'Smoky haze', effect: 'smoke' };
  }
  if (wind >= DUST_WIND_MPH && typeof rh === 'number' && rh <= DUST_MAX_RH && precip === 0) {
    return { label: 'Blowing dust', effect: 'sand' };
  }
  // Heads-up for incoming precip while the sky still looks benign (codes 0-3) and
  // it isn't already falling. Named by what's actually coming.
  if (typeof code === 'number' && code <= 3 && precip === 0) {
    const up = upcomingPrecip(hourly, timeZone);
    if (up) {
      const label = up.kind === 'thunder' ? 'Storm brewing' : up.kind === 'snow' ? 'Snow incoming' : 'Rain incoming';
      const when = up.hoursAway <= 0 ? 'within the hour' : `in ~${up.hoursAway}h`;
      const detail =
        up.maxMm >= BREWING_MM
          ? `≈${Math.round(up.maxMm)} mm forecast ${when}`
          : `${up.maxProb}% chance of precip in the next ${BREWING_LOOKAHEAD_H}h`;
      return { label, effect: null, detail };
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
