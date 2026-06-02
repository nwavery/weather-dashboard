import { formatTemperature } from '../lib/format.js';
import { weatherInfo } from '../data/weatherCodes.js';

const OFFSETS = [1, 3, 5, 7, 9, 11];

export function HourlyForecast({ hourly, timeZone }) {
  if (!hourly?.time) {
    return (
      <div className="hourly-forecast">
        <div className="hourly-forecast-container">
          <div className="hourly-item-placeholder">Loading hourly forecast…</div>
        </div>
      </div>
    );
  }

  // Start at the first hourly slot at/after the current hour in this timezone.
  const nowZone = new Date(new Date().toLocaleString('en-US', { timeZone }));
  nowZone.setMinutes(0, 0, 0);
  let start = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    if (new Date(hourly.time[i]) >= nowZone) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  const items = [];
  for (const off of OFFSETS) {
    const i = start + off;
    if (i >= hourly.time.length) break;
    const t = new Date(hourly.time[i]);
    const label = t.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone });
    const info = weatherInfo(hourly.weather_code?.[i]);
    items.push(
      <div className="hourly-item" key={i}>
        <div className="hourly-time">{label}</div>
        <div className="hourly-icon">
          <img src={`https://openweathermap.org/img/wn/${info.icon}.png`} alt={info.description} title={info.description} />
        </div>
        <div className="hourly-temp">{formatTemperature(hourly.temperature_2m?.[i])}</div>
      </div>
    );
  }

  return (
    <div className="hourly-forecast">
      <div className="hourly-forecast-container">{items}</div>
    </div>
  );
}
