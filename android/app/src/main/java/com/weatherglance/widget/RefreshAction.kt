package com.weatherglance.widget

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import com.weatherglance.data.WeatherRepository

/** Tapping the ⟳ glyph refreshes weather for the active place. */
class RefreshAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        WeatherRepository(context).refresh()
    }
}
