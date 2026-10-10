package com.weatherglance.widget

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.weatherglance.data.WeatherRepository
import java.util.concurrent.TimeUnit

/** Refreshes the widget data, on demand and on a periodic schedule. */
class WidgetRefreshWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val ok = WeatherRepository(applicationContext).refresh().isSuccess
        return if (ok) Result.success() else Result.retry()
    }

    companion object {
        private const val PERIODIC = "weatherglance_periodic_refresh"
        private const val ONESHOT = "weatherglance_oneshot_refresh"

        fun enqueueOnce(context: Context) {
            val req = OneTimeWorkRequestBuilder<WidgetRefreshWorker>().build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(ONESHOT, ExistingWorkPolicy.REPLACE, req)
        }

        fun schedulePeriodic(context: Context) {
            // Android's minimum periodic interval is 15 minutes.
            val req = PeriodicWorkRequestBuilder<WidgetRefreshWorker>(30, TimeUnit.MINUTES).build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, req)
        }

        fun cancelPeriodic(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(PERIODIC)
        }
    }
}
