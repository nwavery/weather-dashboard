// Pure formatting / classification helpers shared across components.

export function formatTemperature(temp) {
  if (typeof temp !== 'number' || Number.isNaN(temp)) return '--';
  return `${Math.round(temp)}°F`;
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

export function formatClock(date, timeZone) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone
  });
}

export function formatShortTime(date, timeZone) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
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
