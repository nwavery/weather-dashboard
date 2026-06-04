import { aqiInfo, pollenClass } from '../lib/format.js';

function PollenItem({ icon, label, info }) {
  const hasValue = info && typeof info.value === 'number';
  const cls = hasValue ? pollenClass(info.value) : 'pollen-none';
  // Show the category when we have one ("Moderate", "Out of season", …);
  // otherwise show "None" for "no data / no measurable pollen right now".
  const text = info?.category && info.category !== 'n/a' ? info.category : 'None';
  const title = hasValue
    ? `${label} pollen — ${info.category} (index ${info.value}/5)`
    : info?.category === 'Out of season'
      ? `${label} pollen — out of season`
      : `${label} pollen — none right now (out of season)`;
  return (
    <div className="metric pollen-metric" title={title}>
      <i className={`fas ${icon}`}></i>{' '}
      <span>
        {label}: <strong className={`pollen-level ${cls}`}>{text}</strong>
      </span>
    </div>
  );
}

function PollenRow({ pollen, pollenError }) {
  if (pollenError) {
    const s = pollenError.status;
    const msg =
      s === 503
        ? 'service not configured'
        : s === 429
          ? 'rate limited — try later'
          : s === 403
            ? 'unavailable'
            : 'temporarily unavailable';
    return <div className="pollen-note">Pollen {msg}.</div>;
  }
  if (pollen && (pollen.tree || pollen.grass || pollen.weed)) {
    return (
      <div className="pollen-metrics">
        <PollenItem icon="fa-tree" label="Tree" info={pollen.tree} />
        <PollenItem icon="fa-seedling" label="Grass" info={pollen.grass} />
        <PollenItem icon="fa-cannabis" label="Weed" info={pollen.weed} />
      </div>
    );
  }
  if (pollen) return <div className="pollen-note">Pollen data not available for this location.</div>;
  return <div className="pollen-note">Loading pollen…</div>;
}

export function AirQuality({ air, pollen, pollenError }) {
  const aq = air ? aqiInfo(air.us_aqi) : null;
  return (
    <div className="air-quality">
      <div className="aq-header">
        <span className="aq-title">
          <i className="fas fa-lungs"></i> Air Quality &amp; Allergens
        </span>
        {air ? (
          <span className={`aqi-badge ${aq.cls}`} title="US Air Quality Index">
            AQI {Math.round(air.us_aqi)} · {aq.label}
          </span>
        ) : null}
      </div>

      {air ? (
        <div className="aq-metrics">
          <div className="metric" title="Fine particulate matter (PM2.5), µg/m³">
            <i className="fas fa-smog"></i> <span>PM2.5 {Math.round(air.pm2_5)}</span>
          </div>
          <div className="metric" title="Ground-level ozone (O₃), µg/m³">
            <i className="fas fa-cloud"></i> <span>O₃ {Math.round(air.ozone)}</span>
          </div>
        </div>
      ) : (
        <div className="pollen-note">Air quality unavailable right now.</div>
      )}

      <PollenRow pollen={pollen} pollenError={pollenError} />
    </div>
  );
}
