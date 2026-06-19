// Unit system: 'imperial' (°F, mph, 12-hour) or 'metric' (°C, km/h, 24-hour).
//
// All weather data is fetched and stored canonically in °F / mph; we convert
// only at the display layer, so toggling units is instant and never needs a
// refetch (and internal thresholds — tempClass, headline dew points — stay in
// their original °F).

const STORAGE_KEY = 'skyglance:units';

// Regions that use Fahrenheit day-to-day: the US and its territories, plus
// Liberia, Myanmar, and the Cayman Islands. Everyone else defaults to metric.
const IMPERIAL_REGIONS = new Set(['US', 'AS', 'GU', 'MP', 'PR', 'VI', 'LR', 'MM', 'KY', 'BS', 'BZ', 'PW', 'FM', 'MH']);

// Best guess from the browser's locale/region.
export function defaultUnits() {
  try {
    let region = '';
    if (typeof Intl !== 'undefined' && Intl.Locale && navigator.language) {
      region = new Intl.Locale(navigator.language).region || '';
    }
    if (!region && navigator.language) region = navigator.language.split('-')[1] || '';
    return IMPERIAL_REGIONS.has(region.toUpperCase()) ? 'imperial' : 'metric';
  } catch {
    return 'imperial';
  }
}

export function loadUnits() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'metric' || v === 'imperial') return v;
  } catch {
    /* ignore */
  }
  return defaultUnits();
}

export function saveUnits(units) {
  try {
    localStorage.setItem(STORAGE_KEY, units);
  } catch {
    /* ignore */
  }
}

export const isMetric = (units) => units === 'metric';
export const fToC = (f) => (f - 32) * (5 / 9);
export const mphToKmh = (mph) => mph * 1.609344;
