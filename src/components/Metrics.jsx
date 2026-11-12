import { formatTemperature, formatWind, windDirection } from '../lib/format.js';

// `labels` optionally renames the rows for a fictional world (e.g. Arrakis
// turns Wind into "Worm Sign"); the underlying numbers are unchanged.
//
// `embed` (the ?view=card frame): the real name, otherwise only in each row's
// tooltip, is shown under a fictional label, and the wind row names itself.
export function Metrics({ current, labels, units = 'imperial', embed = false }) {
  const c = current;
  const L = labels || {};
  const title = (real) => (embed ? undefined : real);
  // Only under a label that isn't already the real name.
  const real = (fictional, name) =>
    embed && fictional && fictional.toLowerCase() !== name.toLowerCase() ? <span className="metric-real">{name}</span> : null;
  const windLabel = L.wind || (c ? windDirection(c.wind_direction_10m) : 'Wind');
  return (
    <div className="extra-metrics">
      <div className="metric" title={title('Humidity')}>
        <i className="fas fa-tint"></i>
        <span className="metric-value">{c ? `${c.relative_humidity_2m}%` : '--'}</span>
        <span className="metric-label">{L.humidity || 'Humidity'}</span>
        {real(L.humidity, 'Humidity')}
      </div>
      <div className="metric" title={title('Dew point')}>
        <i className="fas fa-water"></i>
        <span className="metric-value">{c ? formatTemperature(c.dew_point_2m, units) : '--'}</span>
        <span className="metric-label">{L.dew || (embed ? 'Dew point' : 'Dew Pt')}</span>
        {real(L.dew, 'Dew point')}
      </div>
      <div className="metric" title={title('Wind')}>
        <i className="fas fa-wind"></i>
        <span className="metric-value">{c ? formatWind(c.wind_speed_10m, units) : '--'}</span>
        <span className="metric-label">{embed && !L.wind && c ? `Wind ${windLabel}` : windLabel}</span>
        {real(L.wind, 'Wind')}
      </div>
      <div className="metric" title={title('UV index')}>
        <i className="fas fa-sun"></i>
        <span className="metric-value">{c ? Math.round(c.uv_index) : '--'}</span>
        <span className="metric-label">{L.uv || (embed ? 'UV index' : 'UV Index')}</span>
        {real(L.uv, 'UV index')}
      </div>
    </div>
  );
}
