import { formatTemperature } from '../lib/format.js';
import { weatherInfo, effectiveWeatherCode, iconVariant } from '../data/weatherCodes.js';

const OFFSETS = [1, 3, 5, 7, 9, 11];

export function HourlyForecast({ hourly, timeZone, isNightAt }) {
  if (!hourly?.time) {
    return (
      <div className="hourly-forecast">
        <span className="section-label">Hourly</span>
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

  // Anchor for converting each slot's location-local wall-clock to a real
  // instant: the elapsed time from the current hour to the slot is the same in
  // any timezone, so (slot − nowZone) added to the real clock gives the slot's
  // true instant — used to ask whether the sun is up at that hour.
  const realNow = Date.now();

  const items = [];
  for (const off of OFFSETS) {
    const i = start + off;
    if (i >= hourly.time.length) break;
    const t = new Date(hourly.time[i]);
    const label = t.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    const info = weatherInfo(
      effectiveWeatherCode({
        weather_code: hourly.weather_code?.[i],
        precipitation: hourly.precipitation?.[i],
        cloud_cover: hourly.cloud_cover?.[i]
      })
    );
    const instant = new Date(realNow + (t.getTime() - nowZone.getTime()));
    const night = typeof isNightAt === 'function' ? isNightAt(instant) : false;
    const prob = hourly.precipitation_probability?.[i];
    const special = hourly.special?.[i];
    items.push(
      <div className="hourly-item" key={i}>
        <div className="hourly-time">{label}</div>
        {special ? (
          // A rare world event lands on this hour (e.g. 🌋 Mt. Doom erupts)
          <div className="hourly-icon hourly-event" title={special.name}>
            {special.emoji}
          </div>
        ) : (
          <div className="hourly-icon">
            <img src={`https://openweathermap.org/img/wn/${iconVariant(info.icon, night)}.png`} alt={info.description} title={info.description} />
          </div>
        )}
        <div className="hourly-temp">{formatTemperature(hourly.temperature_2m?.[i])}</div>
        {/* Keep the row height uniform: render the slot even when there's no data */}
        <div
          className={`hourly-precip${typeof prob === 'number' && prob > 0 ? '' : ' hourly-precip--none'}`}
          title="Chance of precipitation"
        >
          {typeof prob === 'number' ? `💧${Math.round(prob)}%` : ' '}
        </div>
      </div>
    );
  }

  return (
    <div className="hourly-forecast">
      <span className="section-label">Hourly</span>
      <div className="hourly-forecast-container">{items}</div>
    </div>
  );
}
