package com.weatherglance.data

data class Place(
    val name: String,
    val lat: Double,
    val lon: Double,
    val region: String? = null,
    val country: String? = null
) {
    /** "Austin, Texas" style label. */
    val label: String get() = listOfNotNull(name, region).joinToString(", ")
}

data class Weather(
    val tempC: Double,
    val apparentC: Double,
    val code: Int,
    val isDay: Boolean,
    val highC: Double,
    val lowC: Double,
    val humidity: Int,
    val windKmh: Double,
    val fetchedAt: Long
)

data class AirQuality(val usAqi: Int?, val pm25: Double?) {
    /** US EPA AQI category. */
    val category: String
        get() = when (val a = usAqi) {
            null -> "—"
            in 0..50 -> "Good"
            in 51..100 -> "Moderate"
            in 101..150 -> "Unhealthy (SG)"
            in 151..200 -> "Unhealthy"
            in 201..300 -> "Very unhealthy"
            else -> "Hazardous"
        }
}

/** A single allergen reading (Google Universal Pollen Index 0–5). */
data class PollenLevel(val value: Int?, val category: String)

data class Pollen(val tree: PollenLevel?, val grass: PollenLevel?, val weed: PollenLevel?) {
    val hasAny: Boolean get() = listOf(tree, grass, weed).any { it?.value != null }
}

/** Everything shown for one place, fetched together. */
data class Snapshot(
    val place: Place,
    val weather: Weather,
    val air: AirQuality?,
    val pollen: Pollen?
)
