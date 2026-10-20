package com.weatherglance.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URLEncoder

/**
 * Google Pollen API (tree / grass / weed). Needs an API key — entered once in the
 * app and stored locally. Mirrors the web dashboard's pollen normalization.
 */
object GooglePollen {
    private val UPI = listOf("None", "Very low", "Low", "Moderate", "High", "Very high")

    suspend fun fetch(lat: Double, lon: Double, key: String): Pollen = withContext(Dispatchers.IO) {
        val url = "https://pollen.googleapis.com/v1/forecast:lookup" +
            "?key=${URLEncoder.encode(key, "UTF-8")}" +
            "&location.latitude=$lat&location.longitude=$lon&days=1&plantsDescription=false"
        val json = Http.getJson(url)
        val daily = json.optJSONArray("dailyInfo")
        val day = if (daily != null && daily.length() > 0) daily.getJSONObject(0) else null
        val types = day?.optJSONArray("pollenTypeInfo")

        var tree: PollenLevel? = null
        var grass: PollenLevel? = null
        var weed: PollenLevel? = null
        if (types != null) {
            for (i in 0 until types.length()) {
                val t = types.getJSONObject(i)
                val level = normalize(t)
                when (t.optString("code")) {
                    "TREE" -> tree = level
                    "GRASS" -> grass = level
                    "WEED" -> weed = level
                }
            }
        }
        Pollen(tree, grass, weed)
    }

    private fun normalize(t: JSONObject): PollenLevel {
        val idx = t.optJSONObject("indexInfo")
        if (idx != null && idx.has("value")) {
            val v = idx.optInt("value")
            val cat = idx.optString("category").ifBlank { UPI.getOrElse(v) { "—" } }
            return PollenLevel(v, cat)
        }
        // No index → either out of season or no data for this location.
        return PollenLevel(null, if (t.optBoolean("inSeason", false)) "—" else "Off-season")
    }
}
