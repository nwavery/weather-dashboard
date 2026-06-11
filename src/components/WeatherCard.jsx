import { useLocationWeather } from '../hooks/useLocationWeather.js';
import { formatTemperature, tempClass, formatClock, formatShortTime, getTimePhase } from '../lib/format.js';
import { weatherInfo, effectiveWeatherCode } from '../data/weatherCodes.js';
import { isFictional, fictionalTheme, fictionalTwin } from '../lib/fictionalCities.js';
import { headlineFlavor } from '../lib/headline.js';
import {
  WeatherAnimation,
  getSkyGradient,
  moonPhase,
  moonPhaseName,
  moonEmoji,
  currentMeteorShower,
} from './WeatherAnimation.jsx';
import { WorldEffects } from './WorldEffects.jsx';
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
  const info = current ? weatherInfo(effectiveWeatherCode(current)) : null;
  const cardClass = current ? tempClass(current.temperature_2m) : '';
  // Fictional cities supply their own background gradient, animation, time-of-day
  // phase, and condition text; real cities derive them from the live weather.
  const fic = isFictional(location) ? fictionalTheme(location.theme) : null;
  const twin = fic ? null : fictionalTwin(wx.weather, wx.air);
  const timePhase = fic?.phase || getTimePhase(now, location.timeZone);
  // Mood-driven worlds animate whatever their current (dynamic) weather code
  // says; single-mood worlds keep their pinned signature animation.
  const animation = fic
    ? (fic.liveAnim && info ? info.animation ?? null : fic.anim)
    : info?.animation || null;
  const skyGrad = fic ? fic.gradient : getSkyGradient(info?.animation || null, timePhase);
  const animClass = animation ? `anim-${animation}` : 'anim-clear';
  // Real night sky: on clear nights surface the moon phase + any active meteor shower
  const isClearNight = timePhase === 'night' && (!animation || animation === 'clear');
  const moonP = isClearNight ? moonPhase(now) : null;
  const shower = isClearNight ? currentMeteorShower(now) : null;
  // Aurora on clear nights: flagged fictional worlds (e.g. Asgard) or real cities
  // at auroral latitudes (|lat| >= 55°).
  const aurora = isClearNight && (fic ? !!fic.aurora : Math.abs(location.latitude ?? 0) >= 55);
  // Real-city headline flavor: one modifier by severity (Smoky haze > Blowing
  // dust > Storm brewing > Scorching/Frigid > Windy > Muggy), with an optional
  // ambient effect — suppressed during precip animations, which own the scene.
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

  return (
    <div
      className={`card ${cardClass} sky-card sky-phase-${timePhase} ${animClass} ${fic ? fic.className : ''} ${fic?.livePhase ? 'fic-livephase' : ''}`}
      style={{ '--sky-gradient': skyGrad }}
    >
      {/* Full-bleed sky background */}
      <div className="sky-bg" aria-hidden="true" />

      {/* Animated weather layer */}
      <WeatherAnimation
        type={animation}
        timePhase={timePhase}
        weatherCode={current?.weather_code}
        twinSuns={fic?.twinSuns}
        aurora={aurora}
      />

      {/* Per-world ambient particles (bubbles, embers, spores…) — and flavor
          effects on real cards (blustery leaves, blowing dust, smoky haze) */}
      {fic ? (
        ficEffect ? <WorldEffects kind={ficEffect} /> : null
      ) : flavorEffect ? (
        <WorldEffects kind={flavorEffect} />
      ) : null}

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
          {isClearNight ? (
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
                  <div className="weather-desc">
                    {worldEvent?.tagline ||
                      fic?.condition ||
                      (flavor ? `${flavor.label} · ${info.description}` : info.description)}
                  </div>
                )}
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

            <Metrics current={current} />
            <AirQuality air={wx.air} pollen={wx.pollen} pollenError={wx.pollenError} />
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
