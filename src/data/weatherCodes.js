// WMO weather interpretation codes -> icon (OpenWeatherMap set) + optional animation.
// https://open-meteo.com/en/docs
// animation values: null | 'rain' | 'snow' | 'cloudy' | 'fog' | 'thunder'
export const WEATHER_CODES = {
  0: { description: 'Clear sky', icon: '01d', animation: null },
  1: { description: 'Mainly clear', icon: '01d', animation: null },
  2: { description: 'Partly cloudy', icon: '02d', animation: 'cloudy' },
  3: { description: 'Overcast', icon: '04d', animation: 'cloudy' },
  45: { description: 'Fog', icon: '50d', animation: 'fog' },
  48: { description: 'Depositing rime fog', icon: '50d', animation: 'fog' },
  51: { description: 'Light drizzle', icon: '09d', animation: 'rain' },
  53: { description: 'Moderate drizzle', icon: '09d', animation: 'rain' },
  55: { description: 'Dense drizzle', icon: '09d', animation: 'rain' },
  56: { description: 'Light freezing drizzle', icon: '09d', animation: 'rain' },
  57: { description: 'Dense freezing drizzle', icon: '09d', animation: 'rain' },
  61: { description: 'Slight rain', icon: '10d', animation: 'rain' },
  63: { description: 'Moderate rain', icon: '10d', animation: 'rain' },
  65: { description: 'Heavy rain', icon: '10d', animation: 'rain' },
  66: { description: 'Light freezing rain', icon: '13d', animation: 'rain' },
  67: { description: 'Heavy freezing rain', icon: '13d', animation: 'rain' },
  71: { description: 'Slight snow fall', icon: '13d', animation: 'snow' },
  73: { description: 'Moderate snow fall', icon: '13d', animation: 'snow' },
  75: { description: 'Heavy snow fall', icon: '13d', animation: 'snow' },
  77: { description: 'Snow grains', icon: '13d', animation: 'snow' },
  80: { description: 'Slight rain showers', icon: '09d', animation: 'rain' },
  81: { description: 'Moderate rain showers', icon: '09d', animation: 'rain' },
  82: { description: 'Violent rain showers', icon: '09d', animation: 'rain' },
  85: { description: 'Slight snow showers', icon: '13d', animation: 'snow' },
  86: { description: 'Heavy snow showers', icon: '13d', animation: 'snow' },
  95: { description: 'Thunderstorm', icon: '11d', animation: 'thunder' },
  96: { description: 'Thunderstorm with slight hail', icon: '11d', animation: 'thunder' },
  99: { description: 'Thunderstorm with heavy hail', icon: '11d', animation: 'thunder' }
};

export function weatherInfo(code) {
  return WEATHER_CODES[code] || { description: 'Unknown', icon: '50d', animation: null };
}

const THUNDER_CODES = new Set([95, 96, 99]);

// Open-Meteo's weather_code over-reports thunderstorms (95/96/99) on weak
// convective signals — we've observed code 95 with 0 mm precipitation and 1%
// cloud cover (i.e. a clear sky). When a "thunderstorm" has no precipitation,
// treat it as spurious and fall back to a cloud-cover-derived condition.
// `slot` is { weather_code, precipitation, cloud_cover } — works for the
// `current` object or a single hourly entry. (Demo/fictional data has no
// precipitation field, so their intentional storms pass through unchanged.)
export function effectiveWeatherCode(slot) {
  const code = slot?.weather_code;
  if (code == null || !THUNDER_CODES.has(code)) return code;
  const precip = slot.precipitation;
  if (typeof precip !== 'number' || precip > 0) return code; // real storm, or no precip data
  const cc = slot.cloud_cover;
  if (typeof cc !== 'number') return 2; // unknown cloud cover — at least not a storm
  if (cc < 20) return 0; // clear sky
  if (cc < 50) return 1; // mainly clear
  if (cc < 85) return 2; // partly cloudy
  return 3; // overcast
}
