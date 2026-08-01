package com.weatherglance.data

import android.annotation.SuppressLint
import android.content.Context
import android.location.Geocoder
import android.location.LocationManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Locale

/**
 * Best-effort device location using the framework LocationManager (no Play Services
 * dependency). The caller must confirm location permission first.
 */
object DeviceLocation {

    @SuppressLint("MissingPermission")
    suspend fun current(context: Context): Place? = withContext(Dispatchers.IO) {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: return@withContext null
        val providers = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        )
        val loc = providers.mapNotNull { p ->
            try {
                if (lm.isProviderEnabled(p)) lm.getLastKnownLocation(p) else null
            } catch (e: SecurityException) {
                null
            }
        }.maxByOrNull { it.time } ?: return@withContext null

        val name = reverseName(context, loc.latitude, loc.longitude) ?: "My location"
        Place(name, loc.latitude, loc.longitude)
    }

    @Suppress("DEPRECATION")
    private fun reverseName(context: Context, lat: Double, lon: Double): String? = try {
        val results = Geocoder(context, Locale.getDefault()).getFromLocation(lat, lon, 1)
        results?.firstOrNull()?.let { it.locality ?: it.subAdminArea ?: it.adminArea }
    } catch (e: Exception) {
        null
    }
}
