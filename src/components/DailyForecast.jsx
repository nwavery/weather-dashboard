import { formatTemperature } from '../lib/format.js';
import { weatherInfo } from '../data/weatherCodes.js';

const DISPLAY_DAYS = 5;

export function DailyForecast({ daily, timeZone }) {
  if (!daily?.time) {
    return (
      <div className="daily-forecast">
        <span className="section-label">5-Day Forecast</span>
        <div className="daily-forecast-container">
          <div className="daily-item-placeholder">Loading daily forecast…</div>
        </div>
      </div>
    );
  }

  const items = [];
  for (let i = 0; i < DISPLAY_DAYS && i < daily.time.length; i++) {
    const ds = daily.time[i]; // YYYY-MM-DD
    let label = '?? ??';
    if (typeof ds === 'string' && ds.length >= 10) {
      // Noon UTC for that calendar day avoids off-by-one timezone shifts.
      const dt = new Date(Date.UTC(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10), 12));
      label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', day: 'numeric' }).format(dt);
    }
    const info = weatherInfo(daily.weather_code?.[i]);
    items.push(
      <div className="daily-item" key={i}>
        <div className="daily-date">{label}</div>
        <div className="daily-icon">
          <img src={`https://openweathermap.org/img/wn/${info.icon}.png`} alt={info.description} title={info.description} />
        </div>
        <div className="daily-temp">
          <span className="daily-max">{formatTemperature(daily.temperature_2m_max?.[i])}</span>
          <span className="daily-sep">/</span>
          <span className="daily-min">{formatTemperature(daily.temperature_2m_min?.[i])}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="daily-forecast">
      <span className="section-label">5-Day Forecast</span>
      <div className="daily-forecast-container">{items}</div>
    </div>
  );
}
