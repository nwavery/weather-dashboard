package com.weatherglance.weather

import kotlin.math.roundToInt

enum class Units { METRIC, IMPERIAL }

object Format {
    /** Celsius input -> rounded display string with a degree sign. */
    fun temp(celsius: Double, units: Units): String {
        val v = if (units == Units.IMPERIAL) celsius * 9.0 / 5.0 + 32.0 else celsius
        return "${v.roundToInt()}°"
    }

    fun unitLetter(units: Units): String = if (units == Units.IMPERIAL) "°F" else "°C"

    fun wind(kmh: Double, units: Units): String =
        if (units == Units.IMPERIAL) "${(kmh * 0.621371).roundToInt()} mph"
        else "${kmh.roundToInt()} km/h"
}
