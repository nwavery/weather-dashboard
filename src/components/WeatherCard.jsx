import { useMemo } from 'react';
import { useLocationWeather } from '../hooks/useLocationWeather.js';
import { formatTemperature, tempClass, formatClock, formatShortTime, getTimePhase } from '../lib/format.js';
import { useUnits } from '../context/UnitsContext.jsx';
import { weatherInfo, effectiveWeatherCode, iconVariant } from '../data/weatherCodes.js';
import { isFictional, fictionalTheme, fictionalTwin, worldDispatch } from '../lib/fictionalCities.js';
import { headlineFlavor } from '../lib/headline.js';
import { isSunDown, sunPhase, solarPosition, sunScreenPosition } from '../lib/sun.js';
import { moonSign, skyVibe } from '../lib/moonSign.js';
import { daylightInfo, sunTimes } from '../lib/sunTimes.js';
import { seasonalEffect } from '../lib/seasonal.js';
import {
  WeatherAnimation,
  getSkyGradient,
  clearSkyGradient,
  moonPhase,
  moonPhaseName,
  moonEmoji,
  currentMeteorShower,
} from './WeatherAnimation.jsx';
import { WorldEffects } from './WorldEffects.jsx';
import { WorldSky } from './WorldSky.jsx';
import { WorldSilhouette } from './WorldSilhouette.jsx';
import { EditableName } from './EditableName.jsx';
import { DailyForecast } from './DailyForecast.jsx';
import { HourlyForecast } from './HourlyForecast.jsx';
import { Metrics } from './Metrics.jsx';
import { AirQuality } from './AirQuality.jsx';

// Compact alert timing in the card's local zone. A weekday is shown whenever
// the time isn't today, and an alert that hasn't started yet reads as an
// upcoming window — so e.g. a heat advisory for tomorrow evening doesn't look
// like it "ended" tonight (it used to print just "until 8:00 PM").
function fmtTime(date, timeZone) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
}
function dayPrefix(date, timeZone, nowMs) {
  try {
    const dayOf = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone });
    if (dayOf(date.getTime()) === dayOf(nowMs)) return '';
    return `${date.toLocaleDateString('en-US', { weekday: 'short', timeZone })} `;
  } catch {
    return '';
  }
}
function alertTiming(onsetStr, endsStr, timeZone, nowMs) {
  try {
    const ends = endsStr ? new Date(endsStr) : null;
    const onset = onsetStr ? new Date(onsetStr) : null;
    if (onset && onset.getTime() > nowMs) {
      const start = `${dayPrefix(onset, timeZone, nowMs)}${fmtTime(onset, timeZone)}`;
      return ends ? ` · ${start}–${fmtTime(ends, timeZone)}` : ` · from ${start}`;
    }
    if (ends) return ` until ${dayPrefix(ends, timeZone, nowMs)}${fmtTime(ends, timeZone)}`;
    return '';
  } catch {
    return '';
  }
}

// "3h 12m" / "45m" for a positive duration in ms.
function formatDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

// Daylight gained/lost vs yesterday, to the second (e.g. "+1 min 47 sec vs
// yesterday", "−12 sec vs yesterday"). Near a solstice it shrinks to a few
// seconds rather than rounding away to "same".
function formatDaylightDelta(sec) {
  if (typeof sec !== 'number') return null;
  const a = Math.abs(sec);
  const sign = sec > 0 ? '+' : sec < 0 ? '−' : '';
  const body = a < 60 ? `${a} sec` : `${Math.floor(a / 60)} min ${a % 60} sec`;
  return `${sign}${body} vs yesterday`;
}

function historicalText(weather, historical, units) {
  if (!weather?.daily) return 'vs. Historical: --';
  // Compare like with like: the baseline is the historical daily MEAN, so today
  // must be the daily mean too. Open-Meteo's forecast gives a full-day mean
  // (observed + forecast hours). The (max+min)/2 midpoint runs ~1-2° warm vs the
  // true mean, so only fall back to it when the mean field is unavailable.
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
  // The difference is the same number of degrees in °F or °C only by scale;
  // convert the gap to the displayed unit so "5° warmer" matches the reading.
  const diffF = predicted - historical.baseline;
  const diff = Math.round(units === 'metric' ? diffF * (5 / 9) : diffF);
  if (diff === 0) return `vs ${historical.years}y avg: ↔ right on average`;
  const sym = diff > 0 ? '↑' : '↓';
  const word = diff > 0 ? 'warmer' : 'cooler';
  return `vs ${historical.years}y avg: ${sym} ${Math.abs(diff)}° ${word}`;
}

export function WeatherCard({ location, now, status, onRename, onLocate, rotating, onToggleRotate }) {
  const wx = useLocationWeather(location);
  const { units } = useUnits();
  const current = wx.weather?.current;
  // The effective code drops phantom storms/rain (a code that claims
  // precipitation while 0 mm is falling). Use it everywhere — including the
  // animation — so the headline and the sky never disagree.
  const effCode = current ? effectiveWeatherCode(current) : undefined;
  const info = current ? weatherInfo(effCode) : null;
  const cardClass = current ? tempClass(current.temperature_2m) : '';
  // Fictional cities supply their own background gradient, animation, time-of-day
  // phase, and condition text; real cities derive them from the live weather.
  const fic = isFictional(location) ? fictionalTheme(location.theme) : null;
  const twin = fic ? null : fictionalTwin(wx.weather, wx.air);
  // Time-of-day phase (dawn/day/dusk/night) — drives the sky gradient and the
  // sun glow. Real cities derive it from the sun's actual position (golden-hour
  // twilight bands and all), falling back to the local clock only when we have
  // no coordinates. Fictional worlds use their scripted phase.
  const timePhase =
    fic?.phase || sunPhase(now, location.latitude, location.longitude) || getTimePhase(now, location.timeZone);
  // Is it actually dark out (sun below the horizon, sundown→sunup)? This — not
  // the gradient phase — gates the stars + phase-accurate moon and the moon
  // badge, so they appear together right at sundown, including through the
  // dawn/dusk twilight bands when the sun has already dropped below the horizon.
  const isDark = fic ? fic.phase === 'night' : isSunDown(now, location.latitude, location.longitude);
  // Real sun: its altitude smoothly colours the clear-sky gradient, and its
  // on-screen position draws the sun along its arc (low east → overhead → low
  // west). Both are null for fictional worlds / missing coordinates.
  const sunAltitude = fic ? null : solarPosition(now, location.latitude, location.longitude)?.altitude;
  const sunPos = fic ? null : sunScreenPosition(now, location.latitude, location.longitude);
  // Mood-driven worlds animate whatever their current (dynamic) weather code
  // says; single-mood worlds keep their pinned signature animation.
  const animation = fic
    ? (fic.liveAnim && info ? info.animation ?? null : fic.anim)
    : info?.animation || null;
  // Clear real-city skies use the continuous sun-altitude gradient; everything
  // else keeps the discrete per-phase gradients.
  const skyGrad = fic
    ? fic.gradient
    : animation == null && typeof sunAltitude === 'number'
      ? clearSkyGradient(sunAltitude)
      : getSkyGradient(animation, timePhase);
  const animClass = animation ? `anim-${animation}` : 'anim-clear';
  // The moon phase badge (and the drawn moon) show through clear, mainly clear,
  // and cloudy/overcast skies — only active precipitation (rain, snow, thunder)
  // and fog hide it. Fictional worlds with their own sky body (Coruscant's moon,
  // Pandora's gas giant…) are excluded: that body is their sky, so an extra
  // Earth moon-phase would just contradict it.
  const moonySky = animation == null || animation === 'cloudy';
  const showCelestial = isDark && moonySky && !fic?.skyBody;
  const moonP = showCelestial ? moonPhase(now) : null;
  // The Moon's zodiac sign (a fun astrology touch) — shown for real cities any
  // time of day, since the Moon sits in a sign 24/7. It drifts ~13°/day, so the
  // sign changes every ~2-3 days. Fictional worlds keep their own flavor.
  const mSign = fic ? null : moonSign(now);
  const vibe = fic ? null : skyVibe(now);
  // Sunrise/sunset + daylight for real cities. The times only change daily, so
  // memoize on the local calendar day (the scan is ~1400 cheap trig ops); the
  // live "until sunset" countdown below uses `now` directly.
  const lat = location.latitude;
  const lon = location.longitude;
  const tz = location.timeZone;
  let localDay = '';
  try {
    localDay = now.toLocaleDateString('en-CA', { timeZone: tz });
  } catch {
    /* ignore */
  }
  const sun = useMemo(() => {
    if (fic || typeof lat !== 'number' || typeof lon !== 'number') return null;
    const di = daylightInfo(now, lat, lon, tz);
    if (!di) return null;
    const tomorrow = sunTimes(new Date(now.getTime() + 86400e3), lat, lon, tz);
    return { ...di, nextSunrise: tomorrow?.sunrise || null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fic, lat, lon, tz, localDay]);
  // Meteor showers and the aurora need a genuinely clear sky — you can't see
  // them through cloud cover — so they keep the stricter gate.
  const clearDarkSky = isDark && animation == null;
  const shower = clearDarkSky ? currentMeteorShower(now) : null;
  // Aurora on clear nights: flagged fictional worlds (e.g. Asgard) or real cities
  // at auroral latitudes (|lat| >= 55°).
  const aurora = clearDarkSky && (fic ? !!fic.aurora : Math.abs(location.latitude ?? 0) >= 55);
  // Real-city headline flavor: one modifier by severity (Smoky haze > Blowing
  // dust > Storm brewing > Scorching/Frigid > Windy > dew-point comfort scale),
  // with an optional ambient effect — suppressed during precip animations,
  // which own the scene. The dew scale spans Bone-dry → Miserable, so a comfort
  // word is always on deck when nothing more urgent claims the headline.
  const flavor = fic
    ? null
    : headlineFlavor({ current, air: wx.air, hourly: wx.weather?.hourly, timeZone: location.timeZone });
  const flavorEffect =
    flavor?.effect && !['rain', 'snow', 'thunder'].includes(animation || '') ? flavor.effect : null;
  // Date-aware seasonal/holiday flourish (fireflies on summer nights, fireworks
  // on New Year's, hearts on Valentine's…) — real cities only, and yielding to
  // weather "flavor" effects which carry actual info.
  const seasonal = fic
    ? null
    : seasonalEffect(now, location.latitude, location.timeZone, {
        isDark,
        hasPrecip: ['rain', 'snow', 'thunder', 'fog'].includes(animation || '')
      });
  // Re-checked every clock tick so an alert drops the instant its end time
  // passes, without waiting for the next fetch (matters on always-on displays).
  const nowMs = now?.getTime ? now.getTime() : Date.now();
  const alerts = fic
    ? []
    : (wx.alerts || []).filter((a) => !a.ends || new Date(a.ends).getTime() > nowMs);
  // A rare world event happening right now (Mt. Doom erupting…) takes over the
  // fictional card's tagline and ambient effect for its hour.
  const worldEvent = fic ? wx.event : null;
  const ficEffect = worldEvent?.effect || fic?.effect;
  // Rotating in-world "dispatch" ticker (deterministic by the clock). Yields to
  // a rare event's tagline when one is active.
  const dispatch = fic && !worldEvent ? worldDispatch(fic.id, now?.getTime ? now.getTime() : Date.now()) : null;

  // Live sun countdown + daylight-change label (recomputed each clock tick).
  let sunUntil = null;
  let daylightDelta = null;
  if (sun && sun.polar == null) {
    const t = now.getTime();
    if (sun.sunrise && t < sun.sunrise.getTime()) sunUntil = `sunrise in ${formatDuration(sun.sunrise.getTime() - t)}`;
    else if (sun.sunset && t < sun.sunset.getTime()) sunUntil = `sunset in ${formatDuration(sun.sunset.getTime() - t)}`;
    else if (sun.nextSunrise) sunUntil = `sunrise in ${formatDuration(sun.nextSunrise.getTime() - t)}`;
    daylightDelta = formatDaylightDelta(sun.deltaSec);
  }

  return (
    <div
      className={`card ${cardClass} sky-card sky-phase-${timePhase} ${animClass} ${fic ? fic.className : ''} ${fic?.livePhase ? 'fic-livephase' : ''}`}
      style={{ '--sky-gradient': skyGrad }}
    >
      {/* Full-bleed sky background */}
      <div className="sky-bg" aria-hidden="true" />

      {/* World signature sky body (Polyphemus over Pandora, the dust-sun…) */}
      {fic?.skyBody ? <WorldSky kind={fic.skyBody} /> : null}

      {/* Animated weather layer */}
      <WeatherAnimation
        type={animation}
        timePhase={timePhase}
        night={isDark}
        weatherCode={effCode}
        twinSuns={fic?.twinSuns}
        aurora={aurora}
        wind={
          current
            ? { speed: current.wind_speed_10m, dir: current.wind_direction_10m, gust: current.wind_gusts_10m }
            : null
        }
        cloudCover={fic ? 0 : current?.cloud_cover ?? 0}
        precip={fic ? 0 : current?.precipitation ?? 0}
        sunPos={sunPos}
        hasSkyBody={!!fic?.skyBody}
      />

      {/* Per-world ambient particles (bubbles, embers, spores…) — and flavor
          effects on real cards (blustery leaves, blowing dust, smoky haze) */}
      {fic ? (
        ficEffect ? <WorldEffects kind={ficEffect} /> : null
      ) : flavorEffect ? (
        <WorldEffects kind={flavorEffect} />
      ) : seasonal ? (
        <WorldEffects kind={seasonal} />
      ) : null}

      {/* A drifting horizon silhouette — life in the world */}
      {fic?.silhouette ? <WorldSilhouette kind={fic.silhouette} /> : null}

      {/* Gradient scrim for text legibility */}
      <div className="card-scrim" aria-hidden="true" />

      <div className="card-content">
        {/* Header: city + clock */}
        <div className="time-section">
          <h2>
            <EditableName
              name={location.name}
              onRename={onRename}
              onLocate={onLocate}
              rotating={rotating}
              onToggleRotate={onToggleRotate}
            />
            {location.badge ? <span className="location-badge">{location.badge}</span> : null}
          </h2>
          <div className="display-value clock-value">{formatClock(now, location.timeZone, units)}</div>
          {showCelestial ? (
            <div className="celestial-badge">
              <span className="moon-glyph">{moonEmoji(moonP)}</span> {moonPhaseName(moonP)}
              {shower ? (
                <span className="meteor-bit">
                  {' · '}☄️ {shower.name}{shower.peak ? ' peak' : ''}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {wx.weatherError ? (
          <div className="error-display">Weather error: {wx.weatherError}</div>
        ) : (
          <>
            {/* Main temp + icon */}
            <div className="weather-section">
              <div className="temp-and-icon">
                <div className="temp-display">
                  {info ? (
                    <img
                      className="weather-icon"
                      src={`https://openweathermap.org/img/wn/${iconVariant(info.icon, isDark)}@2x.png`}
                      alt={info.description}
                      title={info.description}
                    />
                  ) : null}
                  <div className="display-value temp-value">
                    {current ? formatTemperature(current.temperature_2m, units) : 'Loading…'}
                  </div>
                </div>
                {info && (
                  <div className="weather-desc" title={flavor?.detail || undefined}>
                    {worldEvent?.tagline ||
                      fic?.condition ||
                      (flavor ? `${flavor.label} · ${info.description}` : info.description)}
                  </div>
                )}
                {dispatch ? <div className="world-dispatch">📻 {dispatch}</div> : null}
                <div className="temp-details">
                  <span className="feels-like">
                    <i className="fas fa-thermometer-half"></i>
                    {' '}Feels like {current ? formatTemperature(current.apparent_temperature, units) : '--'}
                  </span>
                  <span className="historical">
                    <i className="fas fa-history"></i>
                    {' '}{historicalText(wx.weather, wx.historical, units)}
                  </span>
                </div>
                {sun ? (
                  <div className="sun-times">
                    {sun.polar === 'day' ? (
                      <span>☀️ Midnight sun — daylight all day</span>
                    ) : sun.polar === 'night' ? (
                      <span>🌌 Polar night — no sunrise today</span>
                    ) : (
                      <span className="sun-riseset">
                        🌅 {formatShortTime(sun.sunrise, location.timeZone, units)} · 🌇{' '}
                        {formatShortTime(sun.sunset, location.timeZone, units)}
                      </span>
                    )}
                    {sunUntil ? <span className="sun-sub"> · {sunUntil}</span> : null}
                    {daylightDelta ? <span className="sun-sub"> · {daylightDelta}</span> : null}
                  </div>
                ) : null}
                {twin ? (
                  <div className="twin-badge" title="Your real weather matches a fictional world">
                    {twin.emoji} {twin.text}
                  </div>
                ) : null}
              </div>
              <DailyForecast daily={wx.weather?.daily} timeZone={location.timeZone} units={units} />
            </div>

            <Metrics current={current} labels={fic?.metrics} units={units} />
            <AirQuality
              air={wx.air}
              pollen={wx.pollen}
              pollenError={wx.pollenError}
              labels={fic ? { ...fic.air, pollen: fic.pollenLabels } : null}
            />
            <HourlyForecast
              hourly={wx.weather?.hourly}
              timeZone={location.timeZone}
              units={units}
              isNightAt={
                fic
                  ? () => isDark
                  : (instant) => isSunDown(instant, location.latitude, location.longitude)
              }
            />

            {/* Astrology readout: Moon's sign + the live Sun×Moon blend */}
            {mSign || vibe ? (
              <div className="astro-section">
                {mSign ? (
                  <div className="moon-sign" title={`The Moon is currently in ${mSign.name}`}>
                    <span className="moon-sign-glyph">{mSign.glyph}</span> Moon in {mSign.name}
                    <span className="moon-sign-blurb"> · {mSign.blurb}</span>
                  </div>
                ) : null}
                {vibe ? (
                  <div className="sky-vibe" title="Today's Sun × Moon blend">
                    <span className="sky-vibe-sun">☉ {vibe.sun.name} season</span>
                    <span className="sky-vibe-text"> · {vibe.text}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Official NWS alerts (Heat Advisory, Tornado Watch, …) */}
            {alerts.length > 0 ? (
              <div className="weather-alerts">
                {alerts.slice(0, 2).map((a) => (
                  <div key={a.id} className={`weather-alert weather-alert--${a.class}`} title={a.headline}>
                    <span className="alert-icon">⚠️</span> {a.event}
                    <span className="alert-ends">{alertTiming(a.onset, a.ends, location.timeZone, nowMs)}</span>
                    {alerts.length > 2 && a === alerts[1] ? (
                      <span className="alert-more"> +{alerts.length - 2} more</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}

        {status ? <div className="info-display">{status}</div> : null}

        <div className="refresh-info">
          <p>Auto-refreshes every 10 min</p>
          <div>
            {wx.updatedAt ? `Updated: ${formatShortTime(wx.updatedAt, location.timeZone, units)}` : 'Last updated: -'}
          </div>
        </div>
      </div>
    </div>
  );
}
