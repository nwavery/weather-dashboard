// Date-aware seasonal & holiday flourishes for real-city cards. Returns a
// WorldEffects kind (or null). Holidays match the location's local calendar
// date; seasons are hemisphere-aware. Lower priority than weather "flavor"
// effects (windy leaves, smoke, dust), which the caller checks first.

export function seasonalEffect(date, latitude, timeZone, { isDark = false, hasPrecip = false } = {}) {
  if (typeof latitude !== 'number' || Number.isNaN(latitude)) return null;
  let mm;
  let dd;
  try {
    const ymd = date.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD in tz
    mm = Number(ymd.slice(5, 7));
    dd = Number(ymd.slice(8, 10));
  } catch {
    return null;
  }
  if (!mm) return null;
  const md = mm * 100 + dd; // e.g. 704 = Jul 4
  const south = latitude < 0;

  // ── Holidays (date-specific) take priority ──
  if (md === 1231 || md === 101) return isDark ? 'fireworks' : null; // New Year's
  if (md === 214) return 'hearts'; // Valentine's Day
  if (md === 704 && /America\//.test(timeZone || '')) return isDark ? 'fireworks' : null; // July 4th (Americas)
  if (md === 1031) return isDark ? 'bats' : null; // Halloween night
  if (md >= 1223 && md <= 1226 && !hasPrecip) return 'snowflakes'; // Christmas

  // ── Seasons (hemisphere-aware), lower priority ──
  const isSummer = south ? mm === 12 || mm <= 2 : mm >= 6 && mm <= 8;
  const isAutumn = south ? mm >= 3 && mm <= 5 : mm >= 9 && mm <= 11;
  if (isSummer && isDark) return 'fireflies'; // warm summer nights
  if (isAutumn && !hasPrecip) return 'leaves'; // drifting autumn leaves

  return null;
}
