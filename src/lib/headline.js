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
const BREWING_PROB = 70; // % chance within the next few hours
const BREWING_LOOKAHEAD_H = 3;

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

// Max precipitation probability over the next few hours. Hourly times are
// naive local-to-location strings, so compare against the wall-clock in the
// location's zone (same approach as HourlyForecast).
function upcomingPrecipProb(hourly, timeZone) {
  if (!hourly?.time || !hourly?.precipitation_probability) return 0;
  let nowZone;
  try {
    nowZone = new Date(new Date().toLocaleString('en-US', { timeZone }));
  } catch {
    nowZone = new Date();
  }
  nowZone.setMinutes(0, 0, 0);
  let start = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    if (new Date(hourly.time[i]) >= nowZone) {
      start = i;
      break;
    }
  }
  if (start === -1) return 0;
  let max = 0;
  for (let i = start; i < Math.min(start + BREWING_LOOKAHEAD_H + 1, hourly.time.length); i++) {
    const p = hourly.precipitation_probability[i];
    if (typeof p === 'number' && p > max) max = p;
  }
  return max;
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
  // Only flag a brewing storm while the sky still looks benign (codes 0-3).
  if (typeof code === 'number' && code <= 3 && upcomingPrecipProb(hourly, timeZone) >= BREWING_PROB) {
    return { label: 'Storm brewing', effect: null };
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
