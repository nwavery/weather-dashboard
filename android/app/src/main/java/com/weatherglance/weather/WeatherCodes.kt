package com.weatherglance.weather

/** Buckets used to choose a sky gradient + describe conditions. */
enum class SkyBucket { CLEAR, CLOUDY, FOG, RAIN, SNOW, STORM }

data class Condition(
    val description: String,
    val emoji: String,
    val bucket: SkyBucket
)

/** WMO weather-code interpretation (same mapping the web dashboard uses). */
object WeatherCodes {
    fun condition(code: Int, isDay: Boolean): Condition = when (code) {
        0 -> Condition("Clear sky", if (isDay) "☀️" else "🌙", SkyBucket.CLEAR)
        1 -> Condition("Mainly clear", if (isDay) "🌤️" else "🌙", SkyBucket.CLEAR)
        2 -> Condition("Partly cloudy", if (isDay) "⛅" else "☁️", SkyBucket.CLOUDY)
        3 -> Condition("Overcast", "☁️", SkyBucket.CLOUDY)
        45, 48 -> Condition("Fog", "🌫️", SkyBucket.FOG)
        51, 53, 55 -> Condition("Drizzle", "🌦️", SkyBucket.RAIN)
        56, 57 -> Condition("Freezing drizzle", "🌧️", SkyBucket.RAIN)
        61, 63, 65 -> Condition("Rain", "🌧️", SkyBucket.RAIN)
        66, 67 -> Condition("Freezing rain", "🌧️", SkyBucket.RAIN)
        71, 73, 75 -> Condition("Snow", "🌨️", SkyBucket.SNOW)
        77 -> Condition("Snow grains", "🌨️", SkyBucket.SNOW)
        80, 81, 82 -> Condition("Rain showers", "🌦️", SkyBucket.RAIN)
        85, 86 -> Condition("Snow showers", "🌨️", SkyBucket.SNOW)
        95 -> Condition("Thunderstorm", "⛈️", SkyBucket.STORM)
        96, 99 -> Condition("Thunderstorm with hail", "⛈️", SkyBucket.STORM)
        else -> Condition("—", "🌡️", SkyBucket.CLOUDY)
    }
}
