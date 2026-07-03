// NWS apparent temperature: heat index (Rothfusz regression) when hot,
// wind chill when cold, actual temp in between.
//
// Open-Meteo's apparent_temperature subtracts for wind even at high temps,
// which suppresses "feels like" in breezy hot+humid conditions. NWS omits
// the wind term from heat index (wind speeds evaporation which is cooling,
// but also adds convective heat — the two roughly cancel, so NWS drops it).
//
// All inputs and output in °F.
export function feelsLike(tempF, rhPct, windMph) {
  if (typeof tempF !== 'number' || isNaN(tempF)) return tempF;

  // Wind chill: NWS formula, valid for T ≤ 50°F and wind > 3 mph.
  if (tempF <= 50 && typeof windMph === 'number' && windMph > 3) {
    const v = windMph ** 0.16;
    return Math.round(35.74 + 0.6215 * tempF - 35.75 * v + 0.4275 * tempF * v);
  }

  // Heat index: valid for T ≥ 80°F.
  if (tempF >= 80 && typeof rhPct === 'number' && !isNaN(rhPct)) {
    const T = tempF, RH = rhPct;

    // Simple estimate — if the result is below 80 the full formula isn't needed.
    const simple = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + RH * 0.094);
    if ((simple + T) / 2 < 80) return Math.round(T);

    // Rothfusz regression (NWS).
    let hi =
      -42.379 +
      2.04901523 * T +
      10.14333127 * RH -
      0.22475541 * T * RH -
      0.00683783 * T * T -
      0.05481717 * RH * RH +
      0.00122874 * T * T * RH +
      0.00085282 * T * RH * RH -
      0.00000199 * T * T * RH * RH;

    // Low-humidity adjustment (RH < 13 %, T 80–112 °F).
    if (RH < 13 && T >= 80 && T <= 112) {
      hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    }
    // High-humidity adjustment (RH > 85 %, T 80–87 °F).
    if (RH > 85 && T >= 80 && T <= 87) {
      hi += ((RH - 85) / 10) * ((87 - T) / 5);
    }

    return Math.round(hi);
  }

  return Math.round(tempF);
}
