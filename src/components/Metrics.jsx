import { formatTemperature, windDirection } from '../lib/format.js';

export function Metrics({ current }) {
  const c = current;
  return (
    <div className="extra-metrics">
      <div className="metric" title="Humidity">
        <i className="fas fa-tint"></i> <span>{c ? `${c.relative_humidity_2m}%` : '--'}</span>
      </div>
      <div className="metric" title="Dew point">
        <i className="fas fa-water"></i> <span>{c ? formatTemperature(c.dew_point_2m) : '--'}</span>
      </div>
      <div className="metric" title="Wind">
        <i className="fas fa-wind"></i>{' '}
        <span>{c ? `${Math.round(c.wind_speed_10m)} mph ${windDirection(c.wind_direction_10m)}` : '--'}</span>
      </div>
      <div className="metric" title="UV index">
        <i className="fas fa-sun"></i> <span>{c ? `UV: ${Math.round(c.uv_index)}` : '--'}</span>
      </div>
    </div>
  );
}
