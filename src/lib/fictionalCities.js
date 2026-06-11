// Fictional pop-culture "cities" with thematic, deterministic weather + custom
// card backgrounds. Searching one of these names (the rename ✏️ has a datalist
// of them) swaps a card to a fully fabricated, on-theme forecast — no API calls.
//
// Data is shaped exactly like the real Open-Meteo payloads the cards consume,
// the same trick the ?demo=1 harness uses.

import { effectiveWeatherCode } from '../data/weatherCodes.js';

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "Now" expressed as the wall-clock in `tz`, so generated hourly/daily times match
// the location's local time — exactly like Open-Meteo returns for real cities.
function nowInZone(tz) {
  if (!tz) return new Date();
  try {
    return new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  } catch {
    return new Date();
  }
}

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

// ── Dynamic weather engine ───────────────────────────────────────────────────
// Fictional weather is a pure function of (world id, wall-clock time): it drifts
// hour to hour and day to day, but every viewer sees the same Mordor at the same
// moment, and a reload doesn't reroll it. Each world's `dyn` config keeps the
// evolution inside its signature envelope (it still never rains on Tatooine).

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// Integer-keyed hash → [0,1)
function rand01(seed, k) {
  let h = (seed ^ Math.imul(k | 0, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth 1-D value noise in [0,1), continuous in u
function noise1(seed, u) {
  const k = Math.floor(u);
  const f = u - k;
  const s = f * f * (3 - 2 * f);
  return rand01(seed, k) * (1 - s) + rand01(seed, k + 1) * s;
}

const MOOD_MS = 3 * 3600 * 1000; // conditions shift on ~3-hour beats

// The condition for a moment, picked from the world's mood list. The first mood
// is the signature and wins ~55% of beats; the rest split the remainder.
function moodAt(seed, ms, moods) {
  if (!moods || moods.length === 0) return null;
  if (moods.length === 1) return moods[0];
  const r = rand01(seed ^ 0x9e3779b9, Math.floor(ms / MOOD_MS));
  if (r < 0.55) return moods[0];
  return moods[1 + Math.floor(((r - 0.55) / 0.45) * (moods.length - 1))];
}

// Diurnal temperature curve from a zoned wall-clock Date: -1 around 3am, +1
// around 3pm.
function diurnal(zoned) {
  const h = zoned.getHours() + zoned.getMinutes() / 60;
  return Math.cos(((h - 15) / 24) * 2 * Math.PI);
}

const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function makeWeather(c) {
  const { temp, code, feels, humidity, dew, wind, windDir, uv, precipProb } = c.weather;
  const dyn = c.dyn || {};
  const seed = hashStr(c.id);
  const lock = !!dyn.lockPhase;
  // Phase-locked worlds are a frozen moment of day, so they skip the diurnal
  // swing (no afternoon warm-up on a card whose sky is always night) and keep
  // their slow multi-hour drift instead.
  const amp = lock ? 0 : dyn.amp ?? 8;
  const drift = dyn.drift ?? 4;
  const moods = dyn.moods || [code];

  const nowMs = Date.now();
  const now = nowInZone(c.timeZone);

  const tempAt = (ms, zoned) =>
    temp + (amp / 2) * diurnal(zoned) + (noise1(seed ^ 0x51ab, ms / (6 * 3600e3)) * 2 - 1) * drift;

  const curCode = moodAt(seed, nowMs, moods);
  const curTemp = tempAt(nowMs, now);
  const wob = noise1(seed ^ 0x77f3, nowMs / (4 * 3600e3)); // humidity/wind channel

  const current = {
    temperature_2m: Math.round(curTemp),
    relative_humidity_2m: clampN(Math.round(humidity + (wob * 2 - 1) * 12), 2, 100),
    apparent_temperature: Math.round(curTemp + (feels - temp)),
    weather_code: curCode,
    wind_speed_10m: Math.max(0, Math.round(wind * (0.65 + wob * 0.7))),
    wind_direction_10m: Math.round((windDir + (wob * 2 - 1) * 40 + 360) % 360),
    uv_index: lock ? uv : Math.max(0, Math.round(uv * Math.max(0, diurnal(now)))),
    dew_point_2m: Math.round(Math.min(dew + (curTemp - temp) * 0.5, curTemp - 1))
  };

  // Daily: one mood sample + drift per day, spread around the base temp.
  const spread = Math.max(amp, drift * 1.5, 6);
  const daily = { time: [], temperature_2m_max: [], temperature_2m_min: [], weather_code: [] };
  for (let i = 0; i < 6; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dayMs = nowMs + i * 86400e3;
    const dn = rand01(seed ^ 0xd417, Math.floor(dayMs / 86400e3)) * 2 - 1;
    daily.time.push(isoDate(d));
    daily.temperature_2m_max.push(Math.round(temp + spread / 2 + dn * drift));
    daily.temperature_2m_min.push(Math.round(temp - spread / 2 + dn * drift));
    daily.weather_code.push(moodAt(seed, dayMs, moods));
  }

  // Hourly: same temp curve + mood timeline, so the strip agrees with "now".
  const hourly = { time: [], temperature_2m: [], weather_code: [], precipitation_probability: [] };
  const base = new Date(now);
  base.setMinutes(0, 0, 0);
  const baseMs = nowMs - (nowMs % 3600e3);
  for (let i = 0; i < 24; i++) {
    const t = new Date(base.getTime() + i * 3600 * 1000);
    const hMs = baseMs + i * 3600e3;
    const hCode = moodAt(seed, hMs, moods);
    hourly.time.push(`${isoDate(t)}T${pad(t.getHours())}:00`);
    hourly.temperature_2m.push(Math.round(tempAt(hMs, t)));
    hourly.weather_code.push(hCode);
    // precipProb overrides per-world (Atlantis is underwater: always 100%)
    hourly.precipitation_probability.push(typeof precipProb === 'number' ? precipProb : probFor(hCode));
  }

  return { current, daily, hourly };
}

const CAT = ['None', 'Very Low', 'Low', 'Moderate', 'High', 'Very High'];
const ptype = (v) =>
  v == null ? { value: null, category: 'n/a', inSeason: false } : { value: v, category: CAT[v], inSeason: true };
const pollen = (t, g, w) => ({ tree: ptype(t), grass: ptype(g), weed: ptype(w), regionCode: 'FIC' });

// animation: null | 'rain' | 'snow' | 'cloudy' | 'fog' | 'thunder'  (null+day => sun, null+night => stars)
const CITIES = [
  {
    id: 'mos-eisley', name: 'Mos Eisley', world: 'Tatooine', timeZone: 'Africa/Nairobi',
    aliases: ['mos eisley', 'tatooine'],
    gradient: 'linear-gradient(to bottom,#3a1a06 0%,#9c4a12 22%,#d98324 48%,#e8a24a 70%,#f3c884 100%)',
    anim: null, phase: 'day', condition: 'Scorching · Twin Suns', twinSuns: true,
    weather: ({ temp: 121, code: 0, feels: 131, humidity: 4, dew: 18, wind: 22, windDir: 95, uv: 12, precipProb: 0 }),
    dyn: { lockPhase: true, drift: 6, moods: [0, 1] },
    air: { us_aqi: 96, pm2_5: 40, ozone: 58 }, pollen: pollen(null, null, null), historical: { baseline: 119, years: 10 }
  },
  {
    id: 'hoth', name: 'Hoth', world: 'Outer Rim', timeZone: 'Antarctica/McMurdo',
    aliases: ['hoth'],
    gradient: 'linear-gradient(to bottom,#1b2b44 0%,#33567f 30%,#6f9ec9 60%,#b8d6ee 85%,#e8f2fb 100%)',
    anim: 'snow', phase: 'day', condition: 'Blizzard · Whiteout',
    weather: ({ temp: -42, code: 75, feels: -61, humidity: 78, dew: -48, wind: 35, windDir: 350, uv: 1 }),
    dyn: { amp: 6, drift: 4, moods: [75, 73, 71, 77, 3] },
    air: { us_aqi: 8, pm2_5: 2, ozone: 22 }, pollen: pollen(null, null, null), historical: { baseline: -38, years: 10 }
  },
  {
    id: 'cloud-city', name: 'Cloud City', world: 'Bespin', timeZone: 'Europe/Lisbon',
    aliases: ['cloud city', 'bespin'],
    gradient: 'linear-gradient(to bottom,#7a2f1e 0%,#c85a2a 25%,#e88a3c 50%,#f0b15e 72%,#f7d79b 100%)',
    anim: 'cloudy', phase: 'dusk', condition: 'Breezy · Endless Sunset',
    weather: ({ temp: 71, code: 2, feels: 70, humidity: 60, dew: 56, wind: 18, windDir: 270, uv: 5 }),
    dyn: { lockPhase: true, drift: 4, moods: [2, 1, 3] },
    air: { us_aqi: 28, pm2_5: 7, ozone: 40 }, pollen: pollen(null, null, null), historical: { baseline: 70, years: 10 }
  },
  {
    id: 'mustafar', name: 'Mustafar', world: 'Outer Rim', timeZone: 'Pacific/Auckland',
    aliases: ['mustafar'],
    gradient: 'linear-gradient(to bottom,#1a0402 0%,#4d0d04 30%,#8f1d06 55%,#d6440c 78%,#ff7a1a 100%)',
    anim: 'fog', phase: 'night', condition: 'Volcanic · Ash Fall', effect: 'embers',
    weather: ({ temp: 451, code: 45, feels: 460, humidity: 2, dew: 35, wind: 14, windDir: 180, uv: 14, precipProb: 0 }),
    dyn: { lockPhase: true, drift: 12, moods: [45, 48] },
    air: { us_aqi: 480, pm2_5: 320, ozone: 180 }, pollen: pollen(null, null, null), historical: { baseline: 449, years: 10 }
  },
  {
    id: 'wakanda', name: 'Wakanda', world: 'Africa (hidden)', timeZone: 'Africa/Nairobi',
    aliases: ['wakanda'],
    gradient: 'linear-gradient(to bottom,#0c3b2e 0%,#16614a 28%,#2f8f5e 55%,#7cb86a 80%,#e7d98a 100%)',
    anim: null, phase: 'day', condition: 'Lush · Vibranium Clear',
    weather: ({ temp: 79, code: 1, feels: 81, humidity: 65, dew: 66, wind: 6, windDir: 120, uv: 8 }),
    dyn: { amp: 11, drift: 4, moods: [1, 0, 2, 3, 61] },
    air: { us_aqi: 12, pm2_5: 3, ozone: 28 }, pollen: pollen(2, 3, 1), historical: { baseline: 77, years: 10 }
  },
  {
    id: 'atlantis', name: 'Atlantis', world: 'Lost City', timeZone: 'Atlantic/Azores',
    aliases: ['atlantis'],
    gradient: 'linear-gradient(to bottom,#021015 0%,#04313f 30%,#076173 55%,#0b97a8 80%,#3fd0d6 100%)',
    anim: 'rain', phase: 'night', condition: 'Submerged · Gentle Currents', effect: 'bubbles',
    weather: ({ temp: 61, code: 51, feels: 60, humidity: 100, dew: 61, wind: 2, windDir: 0, uv: 0, precipProb: 100 }),
    dyn: { lockPhase: true, drift: 2, moods: [51, 53, 61] },
    air: { us_aqi: 5, pm2_5: 1, ozone: 10 }, pollen: pollen(null, null, null), historical: { baseline: 60, years: 10 }
  },
  {
    id: 'gotham', name: 'Gotham City', world: 'New Jersey', timeZone: 'America/New_York',
    aliases: ['gotham', 'gotham city'],
    gradient: 'linear-gradient(to bottom,#05060a 0%,#0c1018 30%,#14202e 58%,#1d2e40 82%,#274055 100%)',
    anim: 'rain', phase: 'night', condition: 'Grim · Steady Rain',
    weather: ({ temp: 49, code: 63, feels: 44, humidity: 90, dew: 46, wind: 16, windDir: 40, uv: 0 }),
    dyn: { lockPhase: true, drift: 5, moods: [63, 61, 65, 51, 45, 95] },
    air: { us_aqi: 120, pm2_5: 55, ozone: 70 }, pollen: pollen(1, null, null), historical: { baseline: 52, years: 10 }
  },
  {
    id: 'the-shire', name: 'The Shire', world: 'Eriador', timeZone: 'Europe/London',
    aliases: ['the shire', 'shire', 'hobbiton'],
    gradient: 'linear-gradient(to bottom,#2e6fa8 0%,#5fa0d0 25%,#8fc4a0 55%,#7cb86a 78%,#9bd07a 100%)',
    anim: null, phase: 'day', condition: 'Pleasant · Second Breakfast', effect: 'pollen',
    weather: ({ temp: 64, code: 1, feels: 65, humidity: 70, dew: 54, wind: 5, windDir: 230, uv: 5 }),
    dyn: { amp: 12, drift: 4, moods: [1, 0, 2, 61, 3] },
    air: { us_aqi: 10, pm2_5: 2, ozone: 24 }, pollen: pollen(2, 3, 5), historical: { baseline: 62, years: 10 }
  },
  {
    id: 'mordor', name: 'Mordor', world: 'Middle-earth', timeZone: 'Asia/Istanbul',
    aliases: ['mordor', 'mount doom'],
    gradient: 'linear-gradient(to bottom,#0a0806 0%,#1c1411 30%,#33201a 55%,#5c2a1e 78%,#8a3520 100%)',
    anim: 'fog', phase: 'dusk', condition: 'Ashen · The Eye Watches', effect: 'embers',
    weather: ({ temp: 109, code: 45, feels: 116, humidity: 12, dew: 30, wind: 28, windDir: 200, uv: 9, precipProb: 0 }),
    dyn: { lockPhase: true, drift: 7, moods: [45, 48] },
    air: { us_aqi: 300, pm2_5: 180, ozone: 150 }, pollen: pollen(null, null, null), historical: { baseline: 100, years: 10 }
  },
  {
    id: 'pandora', name: 'Pandora', world: 'Alpha Centauri', timeZone: 'Pacific/Auckland',
    aliases: ['pandora'],
    gradient: 'linear-gradient(to bottom,#040a18 0%,#0a1a3a 30%,#10324f 55%,#1b5e6e 80%,#2bd0c0 100%)',
    anim: null, phase: 'night', condition: 'Bioluminescent · Floating Peaks', effect: 'spores',
    weather: ({ temp: 82, code: 0, feels: 86, humidity: 95, dew: 78, wind: 7, windDir: 100, uv: 3 }),
    dyn: { lockPhase: true, drift: 4, moods: [0, 1, 2, 51] },
    air: { us_aqi: 9, pm2_5: 2, ozone: 20 }, pollen: pollen(4, 5, 3), historical: { baseline: 80, years: 10 }
  },
  {
    id: 'dagobah', name: 'Dagobah', world: 'Outer Rim', timeZone: 'Asia/Jakarta',
    aliases: ['dagobah'],
    gradient: 'linear-gradient(to bottom,#0c1208 0%,#1b2a14 30%,#2f4421 55%,#4a5f30 80%,#6b7a44 100%)',
    anim: 'fog', phase: 'day', condition: 'Murky · Do or Do Not',
    weather: ({ temp: 76, code: 45, feels: 80, humidity: 96, dew: 73, wind: 4, windDir: 200, uv: 2, precipProb: 60 }),
    dyn: { amp: 5, drift: 3, moods: [45, 48, 51, 53] },
    air: { us_aqi: 35, pm2_5: 9, ozone: 30 }, pollen: pollen(4, 3, 2), historical: { baseline: 75, years: 10 }
  },
  {
    id: 'coruscant', name: 'Coruscant', world: 'Core Worlds', timeZone: 'Asia/Tokyo',
    aliases: ['coruscant'],
    gradient: 'linear-gradient(to bottom,#06070f 0%,#0e1326 30%,#1a2444 55%,#34304f 78%,#6b4a52 100%)',
    anim: 'cloudy', phase: 'night', condition: 'Hazy · Endless City', effect: 'traffic',
    weather: ({ temp: 68, code: 3, feels: 66, humidity: 50, dew: 49, wind: 11, windDir: 300, uv: 3 }),
    dyn: { lockPhase: true, drift: 3, moods: [3, 2, 45] },
    air: { us_aqi: 142, pm2_5: 60, ozone: 88 }, pollen: pollen(null, null, null), historical: { baseline: 67, years: 10 }
  },
  {
    id: 'naboo', name: 'Naboo', world: 'Mid Rim', timeZone: 'Europe/Rome',
    aliases: ['naboo', 'theed'],
    gradient: 'linear-gradient(to bottom,#0b4a6e 0%,#1f7fae 25%,#41a7d0 50%,#8fd0c0 78%,#d8f0c8 100%)',
    anim: null, phase: 'day', condition: 'Serene · Lakeside Clear',
    weather: ({ temp: 72, code: 1, feels: 73, humidity: 58, dew: 55, wind: 6, windDir: 150, uv: 7 }),
    dyn: { amp: 11, drift: 3, moods: [1, 0, 2] },
    air: { us_aqi: 11, pm2_5: 3, ozone: 26 }, pollen: pollen(2, 2, 1), historical: { baseline: 71, years: 10 }
  },
  {
    id: 'rivendell', name: 'Rivendell', world: 'Eriador', timeZone: 'Europe/London',
    aliases: ['rivendell', 'imladris'],
    gradient: 'linear-gradient(to bottom,#1a2236 0%,#3b4a5e 25%,#7d7a5e 50%,#c4a45e 75%,#e8cf86 100%)',
    anim: 'fog', phase: 'day', condition: 'Misty · The Last Homely House',
    weather: ({ temp: 58, code: 45, feels: 57, humidity: 82, dew: 52, wind: 4, windDir: 240, uv: 3 }),
    dyn: { amp: 9, drift: 3, moods: [45, 2, 1, 51] },
    air: { us_aqi: 7, pm2_5: 2, ozone: 20 }, pollen: pollen(3, 2, 1), historical: { baseline: 57, years: 10 }
  },
  {
    id: 'winterfell', name: 'Winterfell', world: 'The North', timeZone: 'Europe/Oslo',
    aliases: ['winterfell'],
    gradient: 'linear-gradient(to bottom,#12161f 0%,#222c3a 30%,#3a4655 58%,#5a6675 82%,#8a96a4 100%)',
    anim: 'snow', phase: 'day', condition: 'Bitter · Winter Is Coming',
    weather: ({ temp: 24, code: 73, feels: 13, humidity: 80, dew: 19, wind: 20, windDir: 0, uv: 1 }),
    dyn: { amp: 7, drift: 5, moods: [73, 71, 75, 3, 77] },
    air: { us_aqi: 14, pm2_5: 3, ozone: 25 }, pollen: pollen(null, null, null), historical: { baseline: 28, years: 10 }
  },
  {
    id: 'emerald-city', name: 'Emerald City', world: 'Land of Oz', timeZone: 'America/Chicago',
    aliases: ['emerald city', 'oz'],
    gradient: 'linear-gradient(to bottom,#053b2a 0%,#0a6e43 28%,#16a85e 55%,#5fd07e 80%,#c8f0a0 100%)',
    anim: null, phase: 'day', condition: 'Radiant · Off to See the Wizard',
    weather: ({ temp: 74, code: 0, feels: 75, humidity: 45, dew: 50, wind: 8, windDir: 270, uv: 8 }),
    dyn: { amp: 10, drift: 4, moods: [0, 1, 2] },
    air: { us_aqi: 9, pm2_5: 2, ozone: 22 }, pollen: pollen(2, 5, 3), historical: { baseline: 73, years: 10 }
  },
  {
    id: 'jurassic-park', name: 'Jurassic Park', world: 'Isla Nublar', timeZone: 'America/Costa_Rica',
    aliases: ['jurassic park', 'isla nublar'],
    gradient: 'linear-gradient(to bottom,#0a1410 0%,#152a1e 28%,#21402c 52%,#2e5038 75%,#3a6242 100%)',
    anim: 'thunder', phase: 'dusk', condition: 'Tropical · Storm Incoming',
    weather: ({ temp: 84, code: 95, feels: 92, humidity: 88, dew: 78, wind: 18, windDir: 110, uv: 4 }),
    dyn: { amp: 7, drift: 4, moods: [95, 80, 81, 61] },
    air: { us_aqi: 40, pm2_5: 10, ozone: 45 }, pollen: pollen(4, 4, 2), historical: { baseline: 82, years: 10 }
  },
  {
    id: 'hundred-acre-wood', name: 'Hundred Acre Wood', world: 'Ashdown Forest', timeZone: 'Europe/London',
    aliases: ['hundred acre wood', '100 acre wood', 'acre wood', 'pooh'],
    gradient: 'linear-gradient(to bottom,#5a8fc0 0%,#8fb6dc 25%,#cdd29a 52%,#e6c878 76%,#f2dd92 100%)',
    anim: 'cloudy', phase: 'day', condition: 'Blustery · A Rather Blustery Day', effect: 'leaves',
    weather: ({ temp: 62, code: 2, feels: 60, humidity: 68, dew: 50, wind: 22, windDir: 250, uv: 4 }),
    dyn: { amp: 9, drift: 4, moods: [2, 3, 1, 61] },
    air: { us_aqi: 8, pm2_5: 2, ozone: 22 }, pollen: pollen(3, 3, 1), historical: { baseline: 61, years: 10 }
  },
  {
    id: 'arrakis', name: 'Arrakis', world: 'Dune', timeZone: 'Africa/Cairo',
    aliases: ['arrakis', 'dune', 'spice'],
    gradient: 'linear-gradient(to bottom,#3a1402 0%,#7a3308 24%,#b85e16 50%,#d98a2e 74%,#e8b057 100%)',
    anim: null, phase: 'day', condition: 'Spice Bloom · Shai-Hulud Stirs', effect: 'sand',
    weather: ({ temp: 116, code: 0, feels: 124, humidity: 5, dew: 22, wind: 26, windDir: 110, uv: 13, precipProb: 0 }),
    dyn: { amp: 30, drift: 5, moods: [0, 1] },
    air: { us_aqi: 110, pm2_5: 52, ozone: 60 }, pollen: pollen(null, null, null), historical: { baseline: 114, years: 10 }
  },
  {
    id: 'asgard', name: 'Asgard', world: 'The Nine Realms', timeZone: 'Atlantic/Reykjavik',
    aliases: ['asgard', 'bifrost', 'valhalla'],
    gradient: 'linear-gradient(to bottom,#05060f 0%,#0c1030 28%,#1a1a55 52%,#3a2a6e 74%,#caa24a 100%)',
    anim: null, phase: 'night', condition: 'Eternal · Bifröst Shimmer', aurora: true,
    weather: ({ temp: 58, code: 1, feels: 57, humidity: 60, dew: 45, wind: 8, windDir: 0, uv: 1 }),
    dyn: { lockPhase: true, drift: 3, moods: [1, 0, 2] },
    air: { us_aqi: 6, pm2_5: 1, ozone: 18 }, pollen: pollen(1, 1, null), historical: { baseline: 57, years: 10 }
  },
  {
    id: 'hogwarts', name: 'Hogwarts', world: 'Scottish Highlands', timeZone: 'Europe/London',
    aliases: ['hogwarts', 'hogsmeade'],
    gradient: 'linear-gradient(to bottom,#14101f 0%,#241d36 28%,#33304f 52%,#445166 76%,#6b7d6a 100%)',
    anim: 'rain', phase: 'dusk', condition: 'Misty · Mischief Managed', effect: 'sparkles',
    weather: ({ temp: 52, code: 63, feels: 48, humidity: 88, dew: 48, wind: 12, windDir: 240, uv: 2 }),
    dyn: { amp: 8, drift: 4, moods: [63, 61, 51, 3, 65] },
    air: { us_aqi: 12, pm2_5: 3, ozone: 24 }, pollen: pollen(2, 2, 1), historical: { baseline: 51, years: 10 }
  },
  {
    id: 'bikini-bottom', name: 'Bikini Bottom', world: 'Pacific Ocean', timeZone: 'Pacific/Honolulu',
    aliases: ['bikini bottom', 'spongebob'],
    gradient: 'linear-gradient(to bottom,#02232e 0%,#06556b 26%,#0a9fb0 52%,#3fd0c6 76%,#e8e07a 100%)',
    anim: 'rain', phase: 'day', condition: 'Submerged · F is for Friends', effect: 'bubbles',
    weather: ({ temp: 76, code: 51, feels: 78, humidity: 100, dew: 74, wind: 3, windDir: 90, uv: 0, precipProb: 100 }),
    dyn: { lockPhase: true, drift: 2, moods: [51, 53, 61] },
    air: { us_aqi: 6, pm2_5: 1, ozone: 12 }, pollen: pollen(null, null, null), historical: { baseline: 75, years: 10 }
  },
  {
    id: 'narnia', name: 'Narnia', world: 'The Wardrobe', timeZone: 'Europe/London',
    aliases: ['narnia', 'wardrobe'],
    gradient: 'linear-gradient(to bottom,#243a5e 0%,#4a6f9e 28%,#86a8cc 54%,#bcd4ea 78%,#eef5fb 100%)',
    anim: 'snow', phase: 'day', condition: 'Always Winter · Never Christmas',
    weather: ({ temp: 20, code: 73, feels: 9, humidity: 82, dew: 15, wind: 14, windDir: 0, uv: 1 }),
    dyn: { amp: 6, drift: 4, moods: [73, 71, 75, 3] },
    air: { us_aqi: 7, pm2_5: 1, ozone: 20 }, pollen: pollen(null, null, null), historical: { baseline: 24, years: 10 }
  },
  {
    // Hidden Easter egg: "Springfield" is a real city (many of them), so it must
    // geocode normally. Reachable only via the 'simpsons'/'homer' aliases, kept
    // off the datalist and out of the rotation (see `hidden`).
    id: 'springfield', name: 'Springfield', world: 'USA', timeZone: 'America/Chicago', hidden: true,
    aliases: ['simpsons', 'homer'],
    gradient: 'linear-gradient(to bottom,#1a6fc4 0%,#3f97df 26%,#7dc0ef 52%,#bfe0f5 76%,#f2e06a 100%)',
    anim: null, phase: 'day', condition: "Sunny · Mmm… Weather",
    weather: ({ temp: 72, code: 1, feels: 73, humidity: 55, dew: 54, wind: 7, windDir: 200, uv: 7 }),
    dyn: { amp: 10, drift: 4, moods: [1, 0, 2, 3] },
    air: { us_aqi: 78, pm2_5: 22, ozone: 70 }, pollen: pollen(3, 4, 2), historical: { baseline: 71, years: 10 }
  }
];

// Hidden cities (Easter eggs) are excluded from the search datalist and rotation.
const VISIBLE = CITIES.filter((c) => !c.hidden);

export const FICTIONAL_NAMES = VISIBLE.map((c) => c.name);
export const FICTIONAL_COUNT = VISIBLE.length;

function placeOf(c) {
  return { name: c.name, latitude: 0, longitude: 0, timeZone: c.timeZone, fictional: true, theme: c.id, badge: c.world };
}

// The i-th fictional city as a location object (wraps around). Used by the
// per-card "rotate through fictional cities" feature.
export function fictionalByIndex(i) {
  const n = VISIBLE.length;
  return placeOf(VISIBLE[((i % n) + n) % n]);
}

function byId(id) {
  return CITIES.find((c) => c.id === id) || null;
}

export function isFictional(location) {
  return !!location?.fictional;
}

// Match a typed query to a fictional city (exact name/alias, or a >=3-char substring).
export function findFictional(query) {
  if (!query) return null;
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const c = CITIES.find((city) => {
    if (city.aliases.includes(q)) return true;
    // Hidden cities (e.g. Springfield) are alias-only, so the real city geocodes.
    if (!city.hidden && city.name.toLowerCase() === q) return true;
    if (q.length >= 3) {
      if (!city.hidden && city.name.toLowerCase().includes(q)) return true;
      if (city.aliases.some((a) => a.includes(q))) return true;
    }
    return false;
  });
  if (!c) return null;
  return placeOf(c);
}

export function fictionalStateFor(id) {
  const c = byId(id);
  if (!c) return null;
  return {
    loading: false,
    weather: makeWeather(c),
    weatherError: null,
    air: c.air,
    pollen: c.pollen,
    pollenError: null,
    historical: c.historical,
    updatedAt: new Date()
  };
}

export function fictionalTheme(id) {
  const c = byId(id);
  if (!c) return null;
  const livePhase = !!c.dyn && !c.dyn.lockPhase;
  return {
    gradient: c.gradient,
    anim: c.anim,
    // Live-phase worlds report no pinned phase, so the card follows the world's
    // real local time (the fixed gradient gets dimmed at dusk/night via CSS).
    phase: livePhase ? null : c.phase,
    livePhase,
    // Worlds with multiple moods animate whatever the current data says
    // (rain layer when the mood is rain), instead of one pinned animation.
    liveAnim: !!c.dyn?.moods && c.dyn.moods.length > 1,
    condition: c.condition,
    className: `fic-${c.id}`,
    twinSuns: !!c.twinSuns,
    aurora: !!c.aurora,
    effect: c.effect || null
  };
}

// When a REAL city's weather matches a fictional world's signature, return a
// playful wink { emoji, text } (or null). Not used for fictional cities — those
// already ARE the worlds. Temperatures are °F (we fetch with imperial units).
export function fictionalTwin(weather, air) {
  const cur = weather?.current;
  if (!cur) return null;
  const code = effectiveWeatherCode(cur);
  const temp = typeof cur.temperature_2m === 'number' ? cur.temperature_2m : null;
  const aqi = typeof air?.us_aqi === 'number' ? air.us_aqi : null;
  const storm = code === 95 || code === 96 || code === 99;
  const snow = (code >= 71 && code <= 77) || code === 85 || code === 86;
  const heavySnow = code === 75 || code === 86;
  const fog = code === 45 || code === 48;

  if (aqi !== null && aqi >= 150) return { emoji: '🌋', text: 'Mustafar air quality' };
  if (storm) return { emoji: '⛈️', text: 'Jurassic Park vibes' };
  if (heavySnow || (snow && temp !== null && temp <= 15)) return { emoji: '❄️', text: 'Hoth conditions' };
  if (temp !== null && temp >= 105) return { emoji: '🌅', text: 'Basically Mos Eisley' };
  if (temp !== null && temp <= 5) return { emoji: '🐺', text: 'Winter is coming (Winterfell)' };
  if (fog) return { emoji: '🌫️', text: 'Dagobah out there' };
  return null;
}
