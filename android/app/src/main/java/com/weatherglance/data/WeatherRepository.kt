package com.weatherglance.data

import android.content.Context
import com.weatherglance.weather.Units
import com.weatherglance.widget.WidgetUpdater
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/** Single entry point used by both the app UI and the widget worker. */
class WeatherRepository(context: Context) {
    private val appContext = context.applicationContext
    private val store = PrefsStore(appContext)

    val units: Units get() = store.units
    fun setUnits(u: Units) { store.units = u }

    val pollenApiKey: String? get() = store.pollenApiKey
    fun setPollenApiKey(key: String?) { store.pollenApiKey = key }

    fun activePlace(): Place = store.activePlace() ?: PrefsStore.DEFAULT_PLACE
    fun setPlace(place: Place) = store.saveActivePlace(place)

    suspend fun search(query: String): List<Place> = OpenMeteo.geocode(query)

    /**
     * Fetch weather + air quality (+ pollen if a key is set) for the active place,
     * then push it all to any installed widgets. Air-quality/pollen failures are
     * non-fatal; only a failed weather fetch fails the refresh.
     */
    suspend fun refresh(): Result<Snapshot> {
        val place = activePlace()
        return try {
            coroutineScope {
                val weatherD = async { OpenMeteo.current(place.lat, place.lon) }
                val airD = async { runCatching { OpenMeteo.airQuality(place.lat, place.lon) }.getOrNull() }
                val key = store.pollenApiKey
                val pollenD = async {
                    if (key.isNullOrBlank()) null
                    else runCatching { GooglePollen.fetch(place.lat, place.lon, key) }.getOrNull()
                }
                val snapshot = Snapshot(place, weatherD.await(), airD.await(), pollenD.await())
                WidgetUpdater.push(appContext, snapshot, store.units)
                Result.success(snapshot)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
