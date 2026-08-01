package com.weatherglance.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.weatherglance.UiState
import com.weatherglance.data.Place
import com.weatherglance.data.PollenLevel
import com.weatherglance.weather.Condition
import com.weatherglance.weather.Format
import com.weatherglance.weather.SkyBucket
import com.weatherglance.weather.WeatherCodes
import kotlin.math.roundToInt

private val White = Color.White
private val Faint = Color(0xCCFFFFFF)

private fun skyGradient(bucket: SkyBucket, isDay: Boolean): List<Color> = when (bucket) {
    SkyBucket.CLEAR -> if (isDay) listOf(Color(0xFF1E5BA8), Color(0xFF3E86C9), Color(0xFF8FC2EC))
    else listOf(Color(0xFF05070F), Color(0xFF0B1437), Color(0xFF1B2A5E))
    SkyBucket.CLOUDY -> if (isDay) listOf(Color(0xFF4A5A73), Color(0xFF6E7E96), Color(0xFF9AA7BC))
    else listOf(Color(0xFF0A0E1A), Color(0xFF1A2236), Color(0xFF2C3650))
    SkyBucket.FOG -> listOf(Color(0xFF4B5563), Color(0xFF6B7280), Color(0xFF9AA1AC))
    SkyBucket.RAIN -> listOf(Color(0xFF1B2430), Color(0xFF2B3A4E), Color(0xFF44566B))
    SkyBucket.SNOW -> listOf(Color(0xFF3A4A63), Color(0xFF5C7088), Color(0xFF9FB4CC))
    SkyBucket.STORM -> listOf(Color(0xFF080A12), Color(0xFF161A2B), Color(0xFF2A2F45))
}

@Composable
fun WeatherScreen(
    state: UiState,
    onRefresh: () -> Unit,
    onSearch: (String) -> Unit,
    onSelect: (Place) -> Unit,
    onToggleUnits: () -> Unit,
    onUseLocation: () -> Unit,
    onSaveKey: (String) -> Unit
) {
    var query by remember { mutableStateOf("") }
    val w = state.weather
    val condition: Condition? = w?.let { WeatherCodes.condition(it.code, it.isDay) }
    val colors = skyGradient(condition?.bucket ?: SkyBucket.CLOUDY, w?.isDay ?: true)

    Box(
        modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(colors))
    ) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("WeatherGlance", color = White, fontSize = 20.sp)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onToggleUnits) { Text(Format.unitLetter(state.units), color = White) }
                TextButton(onClick = onRefresh) { Text("⟳", color = White, fontSize = 20.sp) }
            }

            // Search
            Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    label = { Text("Search city") },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { if (query.isNotBlank()) onSearch(query) })
                )
                Spacer(Modifier.width(8.dp))
                Button(onClick = { if (query.isNotBlank()) onSearch(query) }) { Text("Go") }
            }
            TextButton(onClick = onUseLocation) { Text("📍  Use my location", color = White) }

            if (state.results.isNotEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0x33000000))
                ) {
                    Column(Modifier.padding(vertical = 4.dp)) {
                        state.results.forEach { place ->
                            Text(
                                text = place.label + (place.country?.let { " · $it" } ?: ""),
                                color = White,
                                modifier = Modifier.fillMaxWidth()
                                    .clickable { query = ""; onSelect(place) }
                                    .padding(horizontal = 16.dp, vertical = 12.dp)
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            when {
                state.loading && w == null ->
                    CircularProgressIndicator(color = White, modifier = Modifier.padding(40.dp))

                w != null && condition != null -> {
                    Text(condition.emoji, fontSize = 72.sp)
                    Text(
                        Format.temp(w.tempC, state.units),
                        color = White, fontSize = 76.sp, fontWeight = FontWeight.Bold
                    )
                    Text(condition.description, color = White, fontSize = 18.sp)
                    state.place?.let {
                        Text(it.label, color = Faint, fontSize = 15.sp, modifier = Modifier.padding(top = 2.dp))
                    }
                    Text(
                        "H:${Format.temp(w.highC, state.units)}   L:${Format.temp(w.lowC, state.units)}",
                        color = Faint, fontSize = 15.sp, modifier = Modifier.padding(top = 8.dp)
                    )

                    Spacer(Modifier.height(20.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        Stat("Feels", Format.temp(w.apparentC, state.units))
                        Stat("Humidity", "${w.humidity}%")
                        Stat("Wind", Format.wind(w.windKmh, state.units))
                    }

                    AllergensCard(state, onSaveKey)
                }
            }

            state.error?.let {
                Spacer(Modifier.height(16.dp))
                Text("⚠️  $it", color = White, textAlign = TextAlign.Center)
            }
        }
    }
}

@Composable
private fun Stat(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = White, fontSize = 18.sp)
        Text(label, color = Faint, fontSize = 12.sp)
    }
}

@Composable
private fun AllergensCard(state: UiState, onSaveKey: (String) -> Unit) {
    var keyInput by remember { mutableStateOf("") }
    Card(
        modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0x22000000))
    ) {
        Column(Modifier.padding(16.dp)) {
            Text("Air quality & allergens", color = White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Spacer(Modifier.height(10.dp))

            val air = state.air
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(air?.usAqi?.let { "AQI $it · ${air.category}" } ?: "AQI —", color = White)
                Text(air?.pm25?.let { "PM2.5 ${it.roundToInt()}" } ?: "", color = Faint)
            }

            Spacer(Modifier.height(12.dp))

            val pollen = state.pollen
            if (pollen != null && pollen.hasAny) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    PollenChip("🌳", "Tree", pollen.tree)
                    PollenChip("🌿", "Grass", pollen.grass)
                    PollenChip("🥀", "Weed", pollen.weed)
                }
            } else {
                Text(
                    if (state.pollenKeySet) "No pollen data for this location right now."
                    else "Add a Google Pollen API key for tree / grass / weed levels.",
                    color = Faint, fontSize = 13.sp
                )
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = keyInput,
                        onValueChange = { keyInput = it },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        label = { Text(if (state.pollenKeySet) "Replace Pollen key" else "Pollen API key") }
                    )
                    Spacer(Modifier.width(8.dp))
                    Button(onClick = { if (keyInput.isNotBlank()) { onSaveKey(keyInput); keyInput = "" } }) {
                        Text("Save")
                    }
                }
            }
        }
    }
}

@Composable
private fun PollenChip(emoji: String, label: String, level: PollenLevel?) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(emoji, fontSize = 22.sp)
        Text(level?.category ?: "—", color = White, fontSize = 13.sp)
        Text(label, color = Faint, fontSize = 11.sp)
    }
}
