import { formatTemperature, windDirection } from '../lib/format.js';

export function Metrics({ current }) {
  const c = current;
  return (
    <div className="extra-metrics">
      <div className="metric" title="Humidity">
        <i className="fas fa-tint"></i>
        <span className="metric-value">{c ? `${c.relative_humidity_2m}%` : '--'}</span>
        <span className="metric-label">Humidity</span>
      </div>
      <div className="metric" title="Dew point">
        <i className="fas fa-water"></i>
        <span className="metric-value">{c ? formatTemperature(c.dew_point_2m) : '--'}</span>
        <span className="metric-label">Dew Pt</span>
      </div>
      <div className="metric" title="Wind">
        <i className="fas fa-wind"></i>
        <span className="metric-value">{c ? `${Math.round(c.wind_speed_10m)} mph` : '--'}</span>
        <span className="metric-label">{c ? windDirection(c.wind_direction_10m) : 'Wind'}</span>
      </div>
      <div className="metric" title="UV index">
        <i className="fas fa-sun"></i>
        <span className="metric-value">{c ? Math.round(c.uv_index) : '--'}</span>
        <span className="metric-label">UV Index</span>
      </div>
    </div>
  );
}
