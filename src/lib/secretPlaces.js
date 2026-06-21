// Private named shortcuts: a custom search name that resolves to a fixed *real*
// location (real weather, not the fictional engine). Handy for pinning an exact
// spot that IP geolocation gets wrong on an always-on display.
//
// PRIVACY NOTE: these coordinates ship in the client bundle — only the *name* is
// private, not the location. Keep the repo private if that matters.

const SECRET_PLACES = [
  {
    name: 'Rohan',
    aliases: ['rohan'],
    latitude: 35.61622,
    longitude: -97.69454,
    timeZone: 'America/Chicago'
  }
];

// Match a typed query (case-insensitive) to a secret place; returns a plain real
// location object (no `fictional` flag) or null.
export function findSecretPlace(query) {
  if (!query) return null;
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const p = SECRET_PLACES.find((s) => s.name.toLowerCase() === q || (s.aliases || []).includes(q));
  if (!p) return null;
  return { name: p.name, latitude: p.latitude, longitude: p.longitude, timeZone: p.timeZone };
}
