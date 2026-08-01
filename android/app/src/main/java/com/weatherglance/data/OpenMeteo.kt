package com.weatherglance.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URLEncoder

/**
 * Open-Meteo: keyless + global. Forecast and US AQI work everywhere; geocoding
 * powers the city search. (Open-Meteo's pollen is Europe-only, so US pollen
 * comes from [GooglePollen] instead.)
 */
object OpenMeteo {

    suspend fun current(lat: Double, lon: Double): Weather = withContext(Dispatchers.IO) {
        val url = "https://api.open-meteo.com/v1/forecast" +
            "?latitude=$lat&longitude=$lon" +
            "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m" +
            "&daily=temperature_2m_max,temperature_2m_min" +
            "&timezone=auto&forecast_days=1"
        val json = Http.getJson(url)
        val cur = json.getJSONObject("current")
        val daily = json.getJSONObject("daily")
        Weather(
            tempC = cur.getDouble("temperature_2m"),
            apparentC = cur.optDouble("apparent_temperature", cur.getDouble("temperature_2m")),
            code = cur.optInt("weather_code", 0),
            isDay = cur.optInt("is_day", 1) == 1,
            highC = daily.getJSONArray("temperature_2m_max").getDouble(0),
            lowC = daily.getJSONArray("temperature_2m_min").getDouble(0),
            humidity = cur.optInt("relative_humidity_2m", 0),
            windKmh = cur.optDouble("wind_speed_10m", 0.0),
            fetchedAt = System.currentTimeMillis()
        )
    }

    suspend fun airQuality(lat: Double, lon: Double): AirQuality = withContext(Dispatchers.IO) {
        val url = "https://air-quality-api.open-meteo.com/v1/air-quality" +
            "?latitude=$lat&longitude=$lon&current=us_aqi,pm2_5&timezone=auto"
        val cur = Http.getJson(url).optJSONObject("current")
        AirQuality(
            usAqi = cur?.optInt("us_aqi", -1)?.takeIf { it >= 0 },
            pm25 = cur?.optDouble("pm2_5", Double.NaN)?.takeIf { !it.isNaN() }
        )
    }

    suspend fun geocode(query: String): List<Place> = withContext(Dispatchers.IO) {
        if (query.isBlank()) return@withContext emptyList()
        val url = "https://geocoding-api.open-meteo.com/v1/search" +
            "?name=${URLEncoder.encode(query, "UTF-8")}&count=6&language=en&format=json"
        val arr = Http.getJson(url).optJSONArray("results") ?: return@withContext emptyList()
        (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            Place(
                name = o.getString("name"),
                lat = o.getDouble("latitude"),
                lon = o.getDouble("longitude"),
                region = o.optString("admin1").ifBlank { null },
                country = o.optString("country").ifBlank { null }
            )
        }
    }
}
