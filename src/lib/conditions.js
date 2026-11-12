// What a card shows for "now", decided from the raw fetches. This used to live
// inside WeatherCard.jsx; it is here so another app (the Avery Home dashboard's
// Node server) can import the same rules instead of copying them. No React, no
// DOM, no ambient clock: every time rule takes `nowMs` from the caller.
//
// What a server gets out of the box: the forecast, station and alert rules
// work in Node with the fetchers' results as they are. Radar does not.
// fetchRadar needs a page and a canvas, and in Node it always returns null, so
// effectiveConditionCode then runs without the radar fallback. A server gets
// that input only by decoding the tile itself: fetchRadarFrame for the frame,
// radarTile and radarTileUrl for the PNG, its own PNG decoder for the 3x3 RGBA
// patch at echoPatchOrigin, then radarReading(patch, frame).

import { effectiveWeatherCode, isPrecipCode } from '../data/weatherCodes.js';
import { freshObservation, recentDryObservation } from './observation.js';
import { radarToCode } from './radar.js';
import { formatTemperature } from './format.js';

function requireClock(nowMs) {
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) {
    throw new TypeError(`nowMs must be epoch milliseconds, got ${nowMs}`);
  }
}

// The WMO code to render for the current slot, or undefined when there is no
// forecast yet. Inputs are what the fetchers return: `current` from
// fetchWeather, `observation` from fetchObservation, `radar` from fetchRadar
// (each may be null).
//
// The order of authority:
// 1. A station report no older than OBS_MAX_AGE_MS (90 min) is ground truth
//    both ways: its precip replaces the model's code, and its "dry" drops model
//    precip to a cloud-cover code. Radar is not consulted at all.
// 2. Otherwise the model, with phantom precip (a liquid precip code over 0 mm)
//    dropped to its cloud cover.
// 3. Then, only if that is not already a liquid precip code, a radar echo may
//    add precip, rain or snow by temperature. "No echo" can mean "no coverage",
//    so radar never removes anything.
// 4. If the station said dry within OBS_DRY_TRUST_MS (4 h) but is too old for
//    rule 1, only a strong (40+ dBZ) echo may do that.
//
// Snow codes are not in isPrecipCode, so rule 3 can replace a model snow code
// with radar's rain or snow code.
//
// Both station windows are measured against `nowMs`. Before the move, the
// 90-minute one read Date.now() while the 4 h one read the card's clock, so
// they now agree. The card passes its clock tick, and in a background tab
// Chrome runs that one-second tick as rarely as once a minute after five
// minutes hidden, and not at all if it freezes the tab. A render that happens between ticks, such as a fetch
// landing, then judges freshness against the last tick: a report can stay
// fresh up to about a minute past 90 minutes of real time. The next tick
// corrects it.
export function effectiveConditionCode({ current, observation, radar, nowMs }) {
  requireClock(nowMs);
  if (!current) return undefined;
  const obs = freshObservation(observation, nowMs);
  let code = effectiveWeatherCode(current, obs);
  if (!obs && typeof code === 'number' && !isPrecipCode(code)) {
    const rc = radarToCode(radar, current.temperature_2m, {
      recentDry: recentDryObservation(observation, nowMs)
    });
    if (rc != null) code = rc;
  }
  return code;
}

// "vs 10y avg: ↑ 5° warmer" for the card. `weather` is fetchWeather's result
// and `historical` is fetchHistoricalAverage's { baseline, years } (°F), or null.
//
// Compare like with like: the baseline is the historical daily MEAN, so today
// must be the daily mean too. Open-Meteo's forecast gives a full-day mean
// (observed + forecast hours). The (max+min)/2 midpoint runs ~1-2° warm vs the
// true mean, so it is only the fallback when the mean field is unavailable.
export function historicalText(weather, historical, units) {
  if (!weather?.daily) return 'vs. Historical: --';
  const mean = weather.daily.temperature_2m_mean?.[0];
  const max = weather.daily.temperature_2m_max[0];
  const min = weather.daily.temperature_2m_min[0];
  const predicted =
    typeof mean === 'number' && !Number.isNaN(mean)
      ? mean
      : typeof max === 'number' && typeof min === 'number'
        ? (max + min) / 2
        : null;
  if (predicted == null) return 'vs. Historical: --';
  if (!historical) return `Today avg: ${formatTemperature(predicted, units)}`;
  // The gap is converted to the displayed unit before rounding, so "5° warmer"
  // matches the reading. A 0.8 °F gap is "1° warmer" but "right on average" in °C.
  const diffF = predicted - historical.baseline;
  const diff = Math.round(units === 'metric' ? diffF * (5 / 9) : diffF);
  if (diff === 0) return `vs ${historical.years}y avg: ↔ right on average`;
  const sym = diff > 0 ? '↑' : '↓';
  const word = diff > 0 ? 'warmer' : 'cooler';
  return `vs ${historical.years}y avg: ${sym} ${Math.abs(diff)}° ${word}`;
}

// "3h 12m" / "45m" for a positive duration in ms.
function formatDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

// Daylight gained/lost vs yesterday, to the second ("+1 min 47 sec vs
// yesterday", "−12 sec vs yesterday"; the minus is U+2212). Near a solstice it
// shrinks to a few seconds rather than rounding away to "same".
function formatDaylightDelta(sec) {
  if (typeof sec !== 'number') return null;
  const a = Math.abs(sec);
  const sign = sec > 0 ? '+' : sec < 0 ? '−' : '';
  const body = a < 60 ? `${a} sec` : `${Math.floor(a / 60)} min ${a % 60} sec`;
  return `${sign}${body} vs yesterday`;
}

// The live sun line: { until, daylightDelta }, each a string or null. `sun` is
// daylightInfo()'s result for the local day. Before sunrise it counts to
// sunrise, then to sunset, then to tomorrow's sunrise (daylightInfo steps by
// calendar day, so that stays right on a 23 or 25 hour day). At the exact
// sunrise instant it has already moved on to sunset. Polar days and nights get
// neither line; the card shows its own text for those.
export function sunCountdown(sun, nowMs) {
  requireClock(nowMs);
  if (!sun || sun.polar != null) return { until: null, daylightDelta: null };
  const t = nowMs;
  let until = null;
  if (sun.sunrise && t < sun.sunrise.getTime()) until = `sunrise in ${formatDuration(sun.sunrise.getTime() - t)}`;
  else if (sun.sunset && t < sun.sunset.getTime()) until = `sunset in ${formatDuration(sun.sunset.getTime() - t)}`;
  else if (sun.nextSunrise) until = `sunrise in ${formatDuration(sun.nextSunrise.getTime() - t)}`;
  return { until, daylightDelta: formatDaylightDelta(sun.deltaSec) };
}

// The alerts still in force at `nowMs`. fetchAlerts already drops ended alerts,
// but its result is cached and refetched every few minutes, so an always-on
// display re-checks each tick to drop an alert the instant it ends. An alert
// with no end time stays. One whose end time does not parse is dropped.
export function liveAlerts(alerts, nowMs) {
  requireClock(nowMs);
  return (alerts || []).filter((a) => !a.ends || new Date(a.ends).getTime() > nowMs);
}
