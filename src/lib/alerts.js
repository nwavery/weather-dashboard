// Active National Weather Service alerts (Heat Advisory, Tornado Watch, …)
// for a point, via the free keyless api.weather.gov. US-only: non-US points
// (and any API hiccup) just resolve to no alerts. Cached briefly per point —
// the hook refreshes on its normal cadence anyway.

const ALERTS_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

// Warnings outrank watches outrank advisories; NWS severity breaks ties.
const SEVERITY_RANK = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 };

function classOf(event) {
  if (/warning/i.test(event)) return 'warning';
  if (/watch/i.test(event)) return 'watch';
  return 'advisory';
}

const CLASS_RANK = { warning: 3, watch: 2, advisory: 1 };

export async function fetchAlerts(location) {
  const { latitude, longitude } = location;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return [];
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;

  const res = await fetch(
    `https://api.weather.gov/alerts/active?point=${latitude.toFixed(4)},${longitude.toFixed(4)}`,
    { headers: { Accept: 'application/geo+json' } }
  );
  if (!res.ok) throw new Error(`Alerts API ${res.status}`);
  const data = await res.json();

  const now = Date.now();
  const alerts = (data?.features || [])
    .map((f) => f?.properties)
    .filter((p) => {
      if (!p?.event) return false;
      // NWS keeps some alerts in the "active" feed past their end time until
      // they're formally cancelled/expired — drop any whose hazard has already
      // ended so a stale advisory doesn't linger (e.g. on an always-on display).
      const end = p.ends || p.expires;
      if (end && new Date(end).getTime() <= now) return false;
      return true;
    })
    .map((p) => ({
      id: p.id,
      event: p.event,
      class: classOf(p.event),
      severity: p.severity || 'Unknown',
      headline: p.headline || '',
      ends: p.ends || p.expires || null
    }))
    .sort(
      (a, b) =>
        (CLASS_RANK[b.class] ?? 0) - (CLASS_RANK[a.class] ?? 0) ||
        (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
    );

  cache.set(key, { expires: Date.now() + ALERTS_TTL_MS, data: alerts });
  return alerts;
}
