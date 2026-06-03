package com.weatherglance.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColors = darkColorScheme(
    primary = Color(0xFF7FB5E6),
    onPrimary = Color(0xFF06121F),
    background = Color(0xFF0B1020),
    onBackground = Color(0xFFF5F7FA),
    surface = Color(0xFF111A33),
    onSurface = Color(0xFFF5F7FA)
)

@Composable
fun WeatherGlanceTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkColors, content = content)
}
