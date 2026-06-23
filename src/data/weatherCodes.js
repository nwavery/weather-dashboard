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

// OpenWeatherMap icons come in day ('…d') and night ('…n') variants. Pick the
// night one when the sun is down, so a clear or partly-cloudy sky shows a moon
// instead of a sun after dark.
export function iconVariant(icon, isNight) {
  return isNight && typeof icon === 'string' ? icon.replace(/d$/, 'n') : icon;
}

// Codes that assert liquid precipitation is falling: drizzle (51-57), rain
// (61-67), rain showers (80-82), and thunderstorms (95-99). Open-Meteo
// over-reports these on weak signals — we've seen code 95 with 0 mm precip and
// 1% cloud (a clear sky), and the same happens with phantom drizzle/rain. Snow
// codes are deliberately excluded: light snow legitimately reports ~0 mm of
// liquid-equivalent precipitation, so 0 mm there isn't a reliable "spurious" tell.
const PRECIP_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

// Cloud-cover (%) → a non-precipitation WMO code (clear … overcast).
function cloudCoverCode(cc) {
  if (typeof cc !== 'number') return 2; // unknown cloud cover — at least not precipitating
  if (cc < 20) return 0; // clear sky
  if (cc < 50) return 1; // mainly clear
  if (cc < 85) return 2; // partly cloudy
  return 3; // overcast
}

// When a precipitation code reports exactly 0 mm of precipitation, treat it as
// spurious and fall back to a cloud-cover-derived condition (so a "rain" or
// "thunderstorm" over a dry sky renders as clear/cloudy instead).
// `slot` is { weather_code, precipitation, cloud_cover } — works for the
// `current` object or a single hourly entry. (Demo/fictional data has no
// precipitation field, so their intentional rain/storms pass through unchanged.)
//
// `observation` (optional, current slot only) is a fresh nearby NWS reading and
// is ground truth, so it overrides the model BOTH ways: surface real precip the
// model missed (`precipCode`), and drop model precip the station doesn't see
// (`dry`), falling back to the model's cloud cover. Omitted for hourly slots and
// fictional matches, leaving the model untouched.
export function effectiveWeatherCode(slot, observation) {
  const code = slot?.weather_code;
  if (observation) {
    if (observation.precipCode != null) return observation.precipCode;
    if (observation.dry && typeof code === 'number' && PRECIP_CODES.has(code)) {
      return cloudCoverCode(slot?.cloud_cover);
    }
  }
  if (code == null || !PRECIP_CODES.has(code)) return code;
  const precip = slot.precipitation;
  if (typeof precip !== 'number' || precip > 0) return code; // real precip, or no precip data
  return cloudCoverCode(slot.cloud_cover);
}
