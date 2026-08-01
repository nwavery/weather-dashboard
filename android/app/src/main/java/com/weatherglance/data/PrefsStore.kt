package com.weatherglance.data

import android.content.Context
import com.weatherglance.weather.Units
import java.util.Locale

/** SharedPreferences: active place, units, and the optional Pollen API key. */
class PrefsStore(context: Context) {
    private val prefs =
        context.applicationContext.getSharedPreferences("weatherglance", Context.MODE_PRIVATE)

    var units: Units
        get() = if (prefs.getString(KEY_UNITS, defaultUnits()) == Units.IMPERIAL.name) Units.IMPERIAL else Units.METRIC
        set(value) {
            prefs.edit().putString(KEY_UNITS, value.name).apply()
        }

    /** Google Pollen API key (null/blank = pollen disabled, AQI still works). */
    var pollenApiKey: String?
        get() = prefs.getString(KEY_POLLEN_KEY, null)?.ifBlank { null }
        set(value) {
            prefs.edit().putString(KEY_POLLEN_KEY, value?.trim().orEmpty()).apply()
        }

    fun activePlace(): Place? {
        val name = prefs.getString(KEY_NAME, null) ?: return null
        val lat = prefs.getString(KEY_LAT, null)?.toDoubleOrNull() ?: return null
        val lon = prefs.getString(KEY_LON, null)?.toDoubleOrNull() ?: return null
        return Place(name, lat, lon, prefs.getString(KEY_REGION, null))
    }

    fun saveActivePlace(place: Place) {
        prefs.edit()
            .putString(KEY_NAME, place.name)
            .putString(KEY_LAT, place.lat.toString())
            .putString(KEY_LON, place.lon.toString())
            .putString(KEY_REGION, place.region)
            .apply()
    }

    private fun defaultUnits(): String =
        if (Locale.getDefault().country == "US") Units.IMPERIAL.name else Units.METRIC.name

    companion object {
        private const val KEY_NAME = "place_name"
        private const val KEY_LAT = "place_lat"
        private const val KEY_LON = "place_lon"
        private const val KEY_REGION = "place_region"
        private const val KEY_UNITS = "units"
        private const val KEY_POLLEN_KEY = "pollen_api_key"

        /** Fallback matches the web dashboard's default. */
        val DEFAULT_PLACE = Place("Oklahoma City", 35.4676, -97.5164, "Oklahoma")
    }
}
