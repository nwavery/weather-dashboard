// Deterministic demo data, activated with ?demo=1.
//
// It lets the design competition (and any screenshotting) render the entire UI
// and every weather effect without depending on geolocation, the Open-Meteo
// network calls, or the pollen backend. Four cards cover the headline effects:
// heavy rain, snow, thunderstorm, and clear sky.

export function isDemo() {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('demo') === '1';
  } catch {
    return false;
  }
}

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Plausible chance-of-precipitation for a WMO code (heavier condition → higher).
function probFor(code) {
  if (code === 95 || code === 96 || code === 99) return 90;            // thunder
  if (code === 65 || code === 75 || code === 82 || code === 86) return 95; // heavy rain/snow
  if (code === 63 || code === 73 || code === 81) return 80;            // moderate
  if (code === 61 || code === 71 || code === 80 || code === 85) return 65; // light
  if (code >= 51 && code <= 57) return 55;                             // drizzle
  if (code === 66 || code === 67 || code === 77) return 70;            // freezing/grains
  if (code === 3) return 10;
  if (code === 2) return 5;
  return 0;                                                            // clear / fog
}

// Build an Open-Meteo-shaped weather object around a base condition.
function makeWeather({ temp, code, feels, humidity, dew, wind, windDir, uv, dailyCodes, hourlyCodes }) {
  const now = new Date();

  const daily = { time: [], temperature_2m_max: [], temperature_2m_min: [], weather_code: [] };
  const dCodes = dailyCodes || [code, 2, 1, 3, code, 61];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    daily.time.push(isoDate(d));
    daily.temperature_2m_max.push(Math.round(temp + 6 - i * 1.5));
    daily.temperature_2m_min.push(Math.round(temp - 9 - i));
    daily.weather_code.push(dCodes[i % dCodes.length]);
  }

  const hourly = { time: [], temperature_2m: [], weather_code: [], precipitation_probability: [] };
  const base = new Date(now);
  base.setMinutes(0, 0, 0);
  const hCodes = hourlyCodes || [code, code, 2, 1, code, 3];
  for (let i = 0; i < 24; i++) {
    const t = new Date(base.getTime() + i * 3600 * 1000);
    const hCode = hCodes[i % hCodes.length];
    hourly.time.push(`${isoDate(t)}T${pad(t.getHours())}:00`);
    hourly.temperature_2m.push(Math.round(temp + Math.sin(i / 3) * 4));
    hourly.weather_code.push(hCode);
    hourly.precipitation_probability.push(probFor(hCode));
  }

  return {
    current: {
      temperature_2m: temp,
      relative_humidity_2m: humidity,
      apparent_temperature: feels,
      weather_code: code,
      wind_speed_10m: wind,
      wind_direction_10m: windDir,
      uv_index: uv,
      dew_point_2m: dew
    },
    daily,
    hourly
  };
}

const CAT = ['None', 'Very Low', 'Low', 'Moderate', 'High', 'Very High'];
const pollenType = (v) =>
  v == null ? { value: null, category: 'n/a', inSeason: false } : { value: v, category: CAT[v], inSeason: true };
const pollen = (t, g, w) => ({ tree: pollenType(t), grass: pollenType(g), weed: pollenType(w), regionCode: 'US' });

const CARDS = [
  {
    key: 'demo-rain', name: 'Seattle, WA', timeZone: 'America/Los_Angeles', badge: 'Demo',
    weather: makeWeather({ temp: 54, code: 65, feels: 51, humidity: 88, dew: 50, wind: 12, windDir: 200, uv: 2 }),
    air: { us_aqi: 38, pm2_5: 9, ozone: 41 }, pollen: pollen(1, 2, null), historical: { baseline: 61, years: 10 }
  },
  {
    key: 'demo-snow', name: 'Reykjavík', timeZone: 'Atlantic/Reykjavik', badge: 'Demo',
    weather: makeWeather({ temp: 27, code: 75, feels: 18, humidity: 92, dew: 23, wind: 19, windDir: 320, uv: 1 }),
    air: { us_aqi: 21, pm2_5: 5, ozone: 30 }, pollen: pollen(null, null, null), historical: { baseline: 33, years: 10 }
  },
  {
    key: 'demo-storm', name: 'Austin, TX', timeZone: 'America/Chicago', badge: 'Demo',
    weather: makeWeather({ temp: 78, code: 95, feels: 82, humidity: 71, dew: 67, wind: 9, windDir: 160, uv: 6 }),
    air: { us_aqi: 64, pm2_5: 15, ozone: 68 }, pollen: pollen(3, 4, 1), historical: { baseline: 80, years: 10 },
    alerts: [
      { id: 'demo-alert-1', event: 'Severe Thunderstorm Watch', class: 'watch', severity: 'Severe', headline: 'Severe Thunderstorm Watch until 9:00 PM CDT', ends: new Date(Date.now() + 4 * 3600e3).toISOString() }
    ]
  },
  {
    key: 'demo-clear', name: 'Santorini', timeZone: 'Europe/Athens', badge: 'Demo',
    weather: makeWeather({ temp: 84, code: 0, feels: 86, humidity: 35, dew: 54, wind: 7, windDir: 60, uv: 9 }),
    air: { us_aqi: 45, pm2_5: 11, ozone: 79 }, pollen: pollen(2, 1, null), historical: { baseline: 78, years: 10 }
  }
];

export const DEMO_LOCATIONS = CARDS.map(({ key, name, timeZone, badge }) => ({
  key, name, latitude: 0, longitude: 0, timeZone, badge
}));

const STATE_BY_KEY = Object.fromEntries(
  CARDS.map((c) => [
    c.key,
    {
      loading: false,
      weather: c.weather,
      weatherError: null,
      air: c.air,
      pollen: c.pollen,
      pollenError: null,
      historical: c.historical,
      alerts: c.alerts || [],
      updatedAt: new Date()
    }
  ])
);

export function demoStateFor(key) {
  return STATE_BY_KEY[key] || null;
}
