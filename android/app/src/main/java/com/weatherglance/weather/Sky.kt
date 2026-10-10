package com.weatherglance.weather

import androidx.annotation.DrawableRes
import com.weatherglance.R

/** Maps a condition bucket + day/night to the widget's sky gradient drawable. */
object Sky {
    @DrawableRes
    fun background(bucket: SkyBucket, isDay: Boolean): Int = when (bucket) {
        SkyBucket.CLEAR -> if (isDay) R.drawable.sky_clear_day else R.drawable.sky_clear_night
        SkyBucket.CLOUDY -> if (isDay) R.drawable.sky_cloudy_day else R.drawable.sky_cloudy_night
        SkyBucket.FOG -> R.drawable.sky_fog
        SkyBucket.RAIN -> R.drawable.sky_rain
        SkyBucket.SNOW -> R.drawable.sky_snow
        SkyBucket.STORM -> R.drawable.sky_storm
    }
}
