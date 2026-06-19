import { useLocationWeather } from '../hooks/useLocationWeather.js';
import { formatTemperature, tempClass, formatClock, formatShortTime, getTimePhase } from '../lib/format.js';
import { weatherInfo, effectiveWeatherCode } from '../data/weatherCodes.js';
import { isFictional, fictionalTheme, fictionalTwin, worldDispatch } from '../lib/fictionalCities.js';
import { headlineFlavor } from '../lib/headline.js';
import { isSunDown, sunPhase, solarPosition, sunScreenPosition } from '../lib/sun.js';
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

// Alert chips show a compact "until" time in the card's local zone.
function alertEnds(ends, timeZone) {
  if (!ends) return '';
  try {
    const t = new Date(ends).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
    return ` until ${t}`;
  } catch {
    return '';
  }
}

function historicalText(weather, historical) {
  if (!weather?.daily) return 'vs. Historical: --';
  const max = weather.daily.temperature_2m_max[0];
  const min = weather.daily.temperature_2m_min[0];
  if (typeof max !== 'number' || typeof min !== 'number') return 'vs. Historical: --';
  const predicted = (max + min) / 2;
  if (!historical) return `Today avg: ${formatTemperature(predicted)}`;
  const diff = Math.round(predicted - historical.baseline);
  const sym = diff > 0 ? '↑' : diff < 0 ? '↓' : '↔';
  const word = diff === 0 ? '' : diff > 0 ? 'warmer' : 'cooler';
  return `vs ${historical.years}y avg: ${sym} ${Math.abs(diff)}° ${word}`;
}

export function WeatherCard({ location, now, status, onRename, onLocate, rotating, onToggleRotate }) {
  const wx = useLocationWeather(location);
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
  // The moon (badge + the drawn one in the sky) shows through clear, mainly
  // clear, and cloudy/overcast skies — only active precipitation (rain, snow,
  // thunder) and fog hide it.
  const moonySky = animation == null || animation === 'cloudy';
  const showCelestial = isDark && moonySky;
  const moonP = showCelestial ? moonPhase(now) : null;
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
  const alerts = fic ? [] : wx.alerts || [];
  // A rare world event happening right now (Mt. Doom erupting…) takes over the
  // fictional card's tagline and ambient effect for its hour.
  const worldEvent = fic ? wx.event : null;
  const ficEffect = worldEvent?.effect || fic?.effect;
  // Rotating in-world "dispatch" ticker (deterministic by the clock). Yields to
  // a rare event's tagline when one is active.
  const dispatch = fic && !worldEvent ? worldDispatch(fic.id, now?.getTime ? now.getTime() : Date.now()) : null;

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
      />

      {/* Per-world ambient particles (bubbles, embers, spores…) — and flavor
          effects on real cards (blustery leaves, blowing dust, smoky haze) */}
      {fic ? (
        ficEffect ? <WorldEffects kind={ficEffect} /> : null
      ) : flavorEffect ? (
        <WorldEffects kind={flavorEffect} />
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
          <div className="display-value clock-value">{formatClock(now, location.timeZone)}</div>
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
                      src={`https://openweathermap.org/img/wn/${info.icon}@2x.png`}
                      alt={info.description}
                      title={info.description}
                    />
                  ) : null}
                  <div className="display-value temp-value">
                    {current ? formatTemperature(current.temperature_2m) : 'Loading…'}
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
                    {' '}Feels like {current ? formatTemperature(current.apparent_temperature) : '--'}
                  </span>
                  <span className="historical">
                    <i className="fas fa-history"></i>
                    {' '}{historicalText(wx.weather, wx.historical)}
                  </span>
                </div>
                {twin ? (
                  <div className="twin-badge" title="Your real weather matches a fictional world">
                    {twin.emoji} {twin.text}
                  </div>
                ) : null}
              </div>
              <DailyForecast daily={wx.weather?.daily} timeZone={location.timeZone} />
            </div>

            <Metrics current={current} labels={fic?.metrics} />
            <AirQuality
              air={wx.air}
              pollen={wx.pollen}
              pollenError={wx.pollenError}
              labels={fic ? { ...fic.air, pollen: fic.pollenLabels } : null}
            />
            <HourlyForecast hourly={wx.weather?.hourly} timeZone={location.timeZone} />

            {/* Official NWS alerts (Heat Advisory, Tornado Watch, …) */}
            {alerts.length > 0 ? (
              <div className="weather-alerts">
                {alerts.slice(0, 2).map((a) => (
                  <div key={a.id} className={`weather-alert weather-alert--${a.class}`} title={a.headline}>
                    <span className="alert-icon">⚠️</span> {a.event}
                    <span className="alert-ends">{alertEnds(a.ends, location.timeZone)}</span>
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
            {wx.updatedAt ? `Updated: ${formatShortTime(wx.updatedAt, location.timeZone)}` : 'Last updated: -'}
          </div>
        </div>
      </div>
    </div>
  );
}
