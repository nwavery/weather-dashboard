package com.weatherglance.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class WeatherWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = WeatherWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        // First widget placed — start the periodic refresh and fetch immediately.
        WidgetRefreshWorker.schedulePeriodic(context)
        WidgetRefreshWorker.enqueueOnce(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        // Last widget removed — stop the periodic work.
        WidgetRefreshWorker.cancelPeriodic(context)
    }
}
