import { useState } from 'react';
import { alertTiming } from '../lib/alerts.js';

// NWS alerts on the ?view=card embed. A touch screen can't hover, so each
// alert's headline is on the card, on one line, and a tap on the alert opens
// it in full. Each alert is a button at least 44px tall. Same two-alert limit
// and "+N more" as the dashboard.
export function EmbedAlerts({ alerts, timeZone, nowMs }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="weather-alerts">
      {alerts.slice(0, 2).map((a) => {
        const expanded = open.has(a.id);
        return (
          <button
            type="button"
            key={a.id}
            className={`weather-alert weather-alert--${a.class} alert-toggle${expanded ? ' alert-toggle--open' : ''}`}
            aria-expanded={a.headline ? expanded : undefined}
            onClick={a.headline ? () => toggle(a.id) : undefined}
          >
            <span className="alert-line">
              <span className="alert-icon">⚠️</span> {a.event}
              <span className="alert-ends">{alertTiming(a.onset, a.ends, timeZone, nowMs)}</span>
              {alerts.length > 2 && a === alerts[1] ? <span className="alert-more"> +{alerts.length - 2} more</span> : null}
            </span>
            {a.headline ? (
              <span className="alert-headline">
                <span className="alert-headline-text">{a.headline}</span>
                <span className="alert-chevron" aria-hidden="true">
                  {expanded ? '▴' : '▾'}
                </span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
