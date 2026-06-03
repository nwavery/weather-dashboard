package com.weatherglance.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import com.weatherglance.data.PollenLevel
import com.weatherglance.data.Snapshot
import com.weatherglance.weather.Format
import com.weatherglance.weather.Sky
import com.weatherglance.weather.Units
import com.weatherglance.weather.WeatherCodes
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

/** Renders a [Snapshot] into display strings and writes them to every widget. */
object WidgetUpdater {
    suspend fun push(context: Context, snapshot: Snapshot, units: Units) {
        val w = snapshot.weather
        val condition = WeatherCodes.condition(w.code, w.isDay)
        val temp = Format.temp(w.tempC, units)
        val hi = Format.temp(w.highC, units)
        val lo = Format.temp(w.lowC, units)
        val updated = "Updated " +
            SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(w.fetchedAt))
        val skyRes = Sky.background(condition.bucket, w.isDay)

        val air = snapshot.air
        val aqi = air?.usAqi?.let { "AQI $it · ${air.category}" }.orEmpty()
        val pm25 = air?.pm25?.let { "PM2.5 ${it.roundToInt()}" }.orEmpty()

        val pollen = snapshot.pollen
        val hasPollen = pollen?.hasAny == true

        val manager = GlanceAppWidgetManager(context)
        manager.getGlanceIds(WeatherWidget::class.java).forEach { id ->
            updateAppWidgetState(context, id) { prefs ->
                prefs[WeatherWidget.KEY_TEMP] = temp
                prefs[WeatherWidget.KEY_EMOJI] = condition.emoji
                prefs[WeatherWidget.KEY_DESC] = condition.description
                prefs[WeatherWidget.KEY_NAME] = snapshot.place.name
                prefs[WeatherWidget.KEY_HI] = "H:$hi"
                prefs[WeatherWidget.KEY_LO] = "L:$lo"
                prefs[WeatherWidget.KEY_UPDATED] = updated
                prefs[WeatherWidget.KEY_SKY] = skyRes
                prefs[WeatherWidget.KEY_AQI] = aqi
                prefs[WeatherWidget.KEY_PM25] = pm25
                prefs[WeatherWidget.KEY_TREE] = chip("🌳", pollen?.tree)
                prefs[WeatherWidget.KEY_GRASS] = chip("🌿", pollen?.grass)
                prefs[WeatherWidget.KEY_WEED] = chip("🥀", pollen?.weed)
                prefs[WeatherWidget.KEY_HAS_POLLEN] = hasPollen
                prefs[WeatherWidget.KEY_HAS_DATA] = true
            }
        }
        WeatherWidget().updateAll(context)
    }

    private fun chip(emoji: String, level: PollenLevel?): String = "$emoji ${short(level?.category)}"

    private fun short(cat: String?): String = when (cat?.lowercase()) {
        null, "", "—", "off-season" -> "—"
        "very high" -> "V.high"
        "very low" -> "V.low"
        "moderate" -> "Mod"
        else -> cat
    }
}
