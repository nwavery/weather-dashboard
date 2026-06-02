import { useLocationWeather } from '../hooks/useLocationWeather.js';
import { formatTemperature, tempClass, formatClock, formatShortTime } from '../lib/format.js';
import { weatherInfo } from '../data/weatherCodes.js';
import { WeatherAnimation } from './WeatherAnimation.jsx';
import { EditableName } from './EditableName.jsx';
import { DailyForecast } from './DailyForecast.jsx';
import { HourlyForecast } from './HourlyForecast.jsx';
import { Metrics } from './Metrics.jsx';
import { AirQuality } from './AirQuality.jsx';

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

export function WeatherCard({ location, now, status, onRename }) {
  const wx = useLocationWeather(location);
  const current = wx.weather?.current;
  const info = current ? weatherInfo(current.weather_code) : null;
  const cardClass = current ? tempClass(current.temperature_2m) : '';

  return (
    <div className={`card ${cardClass}`}>
      <WeatherAnimation type={info?.animation} />
      <div className="card-content">
        <div className="time-section">
          <h2>
            <EditableName name={location.name} onRename={onRename} />
            {location.badge ? <span className="location-badge">{location.badge}</span> : null}
          </h2>
          <div className="display-value">{formatClock(now, location.timeZone)}</div>
        </div>

        {wx.weatherError ? (
          <div className="error-display">Weather error: {wx.weatherError}</div>
        ) : (
          <>
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
                  <div className="display-value">
                    {current ? formatTemperature(current.temperature_2m) : 'Loading…'}
                  </div>
                </div>
                <div className="temp-details">
                  <span className="feels-like">
                    Feels like: {current ? formatTemperature(current.apparent_temperature) : '--'}
                  </span>
                  <span className="historical">{historicalText(wx.weather, wx.historical)}</span>
                </div>
              </div>
              <DailyForecast daily={wx.weather?.daily} timeZone={location.timeZone} />
            </div>

            <Metrics current={current} />
            <AirQuality air={wx.air} pollen={wx.pollen} pollenError={wx.pollenError} />
            <HourlyForecast hourly={wx.weather?.hourly} timeZone={location.timeZone} />
          </>
        )}

        {status ? <div className="info-display">{status}</div> : null}

        <div className="refresh-info">
          <p>Auto-refreshes every minute</p>
          <div>
            {wx.updatedAt ? `Updated: ${formatShortTime(wx.updatedAt, location.timeZone)}` : 'Last updated: -'}
          </div>
        </div>
      </div>
    </div>
  );
}
