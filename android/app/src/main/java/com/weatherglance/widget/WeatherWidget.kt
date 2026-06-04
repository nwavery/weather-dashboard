package com.weatherglance.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.action.actionStartActivity
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.getAppWidgetState
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.color.ColorProvider
import com.weatherglance.MainActivity
import com.weatherglance.R

class WeatherWidget : GlanceAppWidget() {

    override val sizeMode = SizeMode.Single

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val initial: Preferences = getAppWidgetState(context, id)
        if (initial[KEY_HAS_DATA] != true) {
            WidgetRefreshWorker.enqueueOnce(context)
        }
        provideContent { WidgetContent() }
    }

    @Composable
    private fun WidgetContent() {
        val prefs = currentState<Preferences>()
        val hasData = prefs[KEY_HAS_DATA] ?: false
        val skyRes = prefs[KEY_SKY] ?: R.drawable.sky_clear_day
        val white = ColorProvider(Color.White, Color.White)
        val faint = ColorProvider(Color(0xCCFFFFFF), Color(0xCCFFFFFF))
        val dim = ColorProvider(Color(0x99FFFFFF), Color(0x99FFFFFF))

        Box(
            modifier = GlanceModifier
                .fillMaxSize()
                .clickable(actionStartActivity<MainActivity>())
        ) {
            Image(
                provider = ImageProvider(skyRes),
                contentDescription = null,
                contentScale = ContentScale.FillBounds,
                modifier = GlanceModifier.fillMaxSize()
            )

            if (!hasData) {
                Box(
                    modifier = GlanceModifier.fillMaxSize().padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Tap to load weather",
                        style = TextStyle(color = white, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                    )
                }
                return@Box
            }

            Column(modifier = GlanceModifier.fillMaxSize().padding(12.dp)) {
                // Location + refresh
                Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = prefs[KEY_NAME] ?: "",
                        style = TextStyle(color = white, fontSize = 13.sp, fontWeight = FontWeight.Medium),
                        modifier = GlanceModifier.defaultWeight()
                    )
                    Text(
                        text = "⟳",
                        style = TextStyle(color = faint, fontSize = 15.sp),
                        modifier = GlanceModifier.clickable(actionRunCallback<RefreshAction>())
                    )
                }

                Spacer(modifier = GlanceModifier.defaultWeight())

                // Temp + condition, with H/L on the right
                Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(text = prefs[KEY_EMOJI] ?: "", style = TextStyle(color = white, fontSize = 22.sp))
                    Spacer(modifier = GlanceModifier.width(6.dp))
                    Text(
                        text = prefs[KEY_TEMP] ?: "",
                        style = TextStyle(color = white, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                    )
                    Spacer(modifier = GlanceModifier.defaultWeight())
                    Column(horizontalAlignment = Alignment.End) {
                        Text(prefs[KEY_HI] ?: "", style = TextStyle(color = faint, fontSize = 11.sp))
                        Text(prefs[KEY_LO] ?: "", style = TextStyle(color = faint, fontSize = 11.sp))
                    }
                }
                Text(
                    text = prefs[KEY_DESC] ?: "",
                    style = TextStyle(color = white, fontSize = 12.sp)
                )

                Spacer(modifier = GlanceModifier.defaultWeight())

                // Air quality + allergens
                val aqi = prefs[KEY_AQI].orEmpty()
                if (aqi.isNotEmpty()) {
                    Text(aqi, style = TextStyle(color = faint, fontSize = 11.sp, fontWeight = FontWeight.Medium))
                }
                if (prefs[KEY_HAS_POLLEN] == true) {
                    Row(modifier = GlanceModifier.fillMaxWidth()) {
                        Text(prefs[KEY_TREE] ?: "", style = TextStyle(color = white, fontSize = 11.sp), modifier = GlanceModifier.defaultWeight())
                        Text(prefs[KEY_GRASS] ?: "", style = TextStyle(color = white, fontSize = 11.sp), modifier = GlanceModifier.defaultWeight())
                        Text(prefs[KEY_WEED] ?: "", style = TextStyle(color = white, fontSize = 11.sp), modifier = GlanceModifier.defaultWeight())
                    }
                } else {
                    val pm = prefs[KEY_PM25].orEmpty()
                    Text(
                        text = pm.ifEmpty { "Add a Pollen key in the app" },
                        style = TextStyle(color = dim, fontSize = 10.sp)
                    )
                }

                Spacer(modifier = GlanceModifier.height(2.dp))
                Text(prefs[KEY_UPDATED] ?: "", style = TextStyle(color = dim, fontSize = 9.sp))
            }
        }
    }

    companion object {
        val KEY_TEMP = stringPreferencesKey("temp")
        val KEY_EMOJI = stringPreferencesKey("emoji")
        val KEY_DESC = stringPreferencesKey("desc")
        val KEY_NAME = stringPreferencesKey("name")
        val KEY_HI = stringPreferencesKey("hi")
        val KEY_LO = stringPreferencesKey("lo")
        val KEY_UPDATED = stringPreferencesKey("updated")
        val KEY_SKY = intPreferencesKey("sky")
        val KEY_AQI = stringPreferencesKey("aqi")
        val KEY_PM25 = stringPreferencesKey("pm25")
        val KEY_TREE = stringPreferencesKey("tree")
        val KEY_GRASS = stringPreferencesKey("grass")
        val KEY_WEED = stringPreferencesKey("weed")
        val KEY_HAS_POLLEN = booleanPreferencesKey("has_pollen")
        val KEY_HAS_DATA = booleanPreferencesKey("has_data")
    }
}
