// Pure formatting / classification helpers shared across components.
//
// Weather values are stored canonically in °F / mph; the `units` argument
// ('imperial' | 'metric', default 'imperial') converts at display time.
import { fToC, mphToKmh } from './units.js';

export function formatTemperature(temp, units = 'imperial') {
  if (typeof temp !== 'number' || Number.isNaN(temp)) return '--';
  return units === 'metric' ? `${Math.round(fToC(temp))}°C` : `${Math.round(temp)}°F`;
}

// Wind speed from canonical mph.
export function formatWind(mph, units = 'imperial') {
  if (typeof mph !== 'number' || Number.isNaN(mph)) return '--';
  return units === 'metric' ? `${Math.round(mphToKmh(mph))} km/h` : `${Math.round(mph)} mph`;
}

export function tempClass(temp) {
  if (typeof temp !== 'number' || Number.isNaN(temp)) return '';
  if (temp < 32) return 'cold';
  if (temp < 50) return 'cool';
  if (temp < 70) return 'mild';
  if (temp < 85) return 'warm';
  return 'hot';
}

export function windDirection(degrees) {
  const dirs = ['↓ N', '↙ NE', '← E', '↖ SE', '↑ S', '↗ SW', '→ W', '↘ NW'];
  return dirs[Math.round(degrees / 45) % 8];
}

// Imperial → 12-hour clock; metric → 24-hour.
export function formatClock(date, timeZone, units = 'imperial') {
  return date.toLocaleTimeString(units === 'metric' ? 'en-GB' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: units !== 'metric',
    timeZone
  });
}

export function formatShortTime(date, timeZone, units = 'imperial') {
  return date.toLocaleTimeString(units === 'metric' ? 'en-GB' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: units !== 'metric',
    timeZone
  });
}

// en-CA yields YYYY-MM-DD
export function formatDateYYYYMMDD(date, timeZone) {
  return date.toLocaleDateString('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
}

// US AQI banding (0-500).
export function aqiInfo(aqi) {
  if (typeof aqi !== 'number' || Number.isNaN(aqi)) return { label: 'N/A', cls: 'aqi-na' };
  if (aqi <= 50) return { label: 'Good', cls: 'aqi-good' };
  if (aqi <= 100) return { label: 'Moderate', cls: 'aqi-moderate' };
  if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', cls: 'aqi-usg' };
  if (aqi <= 200) return { label: 'Unhealthy', cls: 'aqi-unhealthy' };
  if (aqi <= 300) return { label: 'Very Unhealthy', cls: 'aqi-very-unhealthy' };
  return { label: 'Hazardous', cls: 'aqi-hazardous' };
}

// Google Universal Pollen Index value (0-5) -> CSS class.
export function pollenClass(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'pollen-none';
  if (value <= 0) return 'pollen-none';
  if (value === 1) return 'pollen-verylow';
  if (value === 2) return 'pollen-low';
  if (value === 3) return 'pollen-moderate';
  if (value === 4) return 'pollen-high';
  return 'pollen-veryhigh';
}

// Returns 'dawn' | 'day' | 'dusk' | 'night' based on the local hour in the given timezone.
export function getTimePhase(now, timeZone) {
  if (!now || !timeZone) return 'night';
  try {
    const hourStr = now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone });
    const h = parseInt(hourStr, 10);
    if (h >= 5 && h < 8)   return 'dawn';
    if (h >= 8 && h < 18)  return 'day';
    if (h >= 18 && h < 21) return 'dusk';
    return 'night';
  } catch {
    return 'night';
  }
}
