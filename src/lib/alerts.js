// Active National Weather Service alerts (Heat Advisory, Tornado Watch, …)
// for a point, via the free keyless api.weather.gov. US-only: non-US points
// (and any API hiccup) just resolve to no alerts. Cached briefly per point —
// the hook refreshes on its normal cadence anyway.

import { fetchWithTimeout } from './fetchTimeout.js';

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

// NWS sometimes leaves an older issuance of the same product in the active
// feed beside its update (seen Oct 2026: an Air Quality Alert issued at 2:57 PM
// and re-issued at 4:17 PM, identical text, no `references` link between them),
// so the card showed two copies of one alert. Collapse those to the newest:
// drop anything another alert formally supersedes, then anything carrying the
// same event and the same message text as a newer one.
export function dedupeAlerts(alerts) {
  const superseded = new Set(alerts.flatMap((a) => a.references || []));
  const newest = new Map();
  for (const a of alerts) {
    if (superseded.has(a.id)) continue;
    const key = a.text ? `${a.event}|${a.text}` : `id|${a.id}`;
    const prev = newest.get(key);
    if (!prev || Date.parse(a.sent || 0) > Date.parse(prev.sent || 0)) newest.set(key, a);
  }
  return alerts.filter((a) => newest.get(a.text ? `${a.event}|${a.text}` : `id|${a.id}`) === a);
}

// ── Alert timing, in the card's local zone ──────────────────────────────────
function localDay(ms, timeZone) {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone });
}
function fmtTime(ms, timeZone) {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
}
function fmtDate(ms, timeZone) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone });
}
function weekday(ms, timeZone, nowMs) {
  if (localDay(ms, timeZone) === localDay(nowMs, timeZone)) return '';
  return `${new Date(ms).toLocaleDateString('en-US', { weekday: 'short', timeZone })} `;
}

// Compact timing suffix for an alert line. A one-day alert keeps the short
// form (a weekday only when it isn't today). An alert whose window crosses a
// calendar day shows dates at both ends — "until 4:30 PM" alone hides that it
// started yesterday, and two such lines look like the same alert twice.
export function alertTiming(onsetStr, endsStr, timeZone, nowMs) {
  try {
    const onset = onsetStr ? Date.parse(onsetStr) : null;
    const ends = endsStr ? Date.parse(endsStr) : null;
    const upcoming = onset !== null && onset > nowMs;
    const multiDay = onset !== null && ends !== null && localDay(onset, timeZone) !== localDay(ends, timeZone);
    if (multiDay) {
      const start = upcoming ? `${fmtDate(onset, timeZone)}, ${fmtTime(onset, timeZone)}` : fmtDate(onset, timeZone);
      return ` · ${start} – ${fmtDate(ends, timeZone)}, ${fmtTime(ends, timeZone)}`;
    }
    if (upcoming) {
      const start = `${weekday(onset, timeZone, nowMs)}${fmtTime(onset, timeZone)}`;
      return ends !== null ? ` · ${start}–${fmtTime(ends, timeZone)}` : ` · from ${start}`;
    }
    if (ends !== null) return ` until ${weekday(ends, timeZone, nowMs)}${fmtTime(ends, timeZone)}`;
    if (onset !== null && localDay(onset, timeZone) !== localDay(nowMs, timeZone)) return ` · since ${fmtDate(onset, timeZone)}`;
    return '';
  } catch {
    return '';
  }
}

export async function fetchAlerts(location) {
  const { latitude, longitude } = location;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return [];
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;

  const res = await fetchWithTimeout(
    `https://api.weather.gov/alerts/active?point=${latitude.toFixed(4)},${longitude.toFixed(4)}`,
    { headers: { Accept: 'application/geo+json' } }
  );
  if (!res.ok) throw new Error(`Alerts API ${res.status}`);
  const data = await res.json();

  const now = Date.now();
  const alerts = dedupeAlerts((data?.features || [])
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
      onset: p.onset || p.effective || null,
      ends: p.ends || p.expires || null,
      sent: p.sent || null,
      references: (p.references || []).map((r) => r?.identifier || r?.['@id']).filter(Boolean),
      // The message itself, for spotting re-issues of the same alert.
      text: (p.parameters?.NWSheadline || []).join(' ') || (p.description || '').replace(/\s+/g, ' ').trim()
    })))
    .sort(
      (a, b) =>
        (CLASS_RANK[b.class] ?? 0) - (CLASS_RANK[a.class] ?? 0) ||
        (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
    );

  cache.set(key, { expires: Date.now() + ALERTS_TTL_MS, data: alerts });
  return alerts;
}
