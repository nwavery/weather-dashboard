import { aqiInfo, pollenClass } from '../lib/format.js';

// `embed`: the index is shown as text too, since the tooltip is the only place
// it appears otherwise and a touch screen can't hover.
function PollenItem({ icon, label, info, embed }) {
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
    <div className="metric pollen-metric" title={embed ? undefined : title}>
      <i className={`fas ${icon}`}></i>{' '}
      <span>
        {label}: <strong className={`pollen-level ${cls}`}>{text}</strong>
        {embed && hasValue ? <span className="pollen-index"> {info.value}/5</span> : null}
      </span>
    </div>
  );
}

function PollenRow({ pollen, pollenError, pollenLabels, embed }) {
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
    const L = pollenLabels || {};
    return (
      <div className="pollen-metrics">
        <PollenItem icon="fa-tree" label={L.tree || 'Tree'} info={pollen.tree} embed={embed} />
        <PollenItem icon="fa-seedling" label={L.grass || 'Grass'} info={pollen.grass} embed={embed} />
        <PollenItem icon="fa-cannabis" label={L.weed || 'Weed'} info={pollen.weed} embed={embed} />
      </div>
    );
  }
  if (pollen) return <div className="pollen-note">Pollen data not available for this location.</div>;
  return <div className="pollen-note">Loading pollen…</div>;
}

// `labels` optionally reskins the section for a fictional world (Pandora's air
// reports "Unobtanium" instead of AQI); the numbers are unchanged.
export function AirQuality({ air, pollen, pollenError, labels, embed = false }) {
  const aq = air ? aqiInfo(air.us_aqi) : null;
  const L = labels || {};
  return (
    <div className="air-quality">
      <div className="aq-header">
        <span className="aq-title">
          <i className="fas fa-lungs"></i> {L.title || 'Air Quality & Allergens'}
        </span>
        {air ? (
          <span className={`aqi-badge ${aq.cls}`} title={embed ? undefined : 'US Air Quality Index'}>
            {L.aqi || 'AQI'} {Math.round(air.us_aqi)} · {aq.label}
          </span>
        ) : null}
      </div>

      {air ? (
        <div className="aq-metrics">
          <div className="metric" title={embed ? undefined : 'Fine particulate matter (PM2.5), µg/m³'}>
            <i className="fas fa-smog"></i> <span>{L.pm || 'PM2.5'} {Math.round(air.pm2_5)}</span>
          </div>
          <div className="metric" title={embed ? undefined : 'Ground-level ozone (O₃), µg/m³'}>
            <i className="fas fa-cloud"></i> <span>{L.ozone || 'O₃'} {Math.round(air.ozone)}</span>
          </div>
        </div>
      ) : (
        <div className="pollen-note">Air quality unavailable right now.</div>
      )}

      {embed && air ? (
        // What the badge and the two readings are, otherwise only in tooltips.
        <div className="aq-legend">US Air Quality Index · fine particulate matter (PM2.5) and ground-level ozone (O₃) in µg/m³</div>
      ) : null}
      <PollenRow pollen={pollen} pollenError={pollenError} pollenLabels={L.pollen} embed={embed} />
    </div>
  );
}
