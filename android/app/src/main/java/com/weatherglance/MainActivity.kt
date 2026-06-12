package com.weatherglance

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.weatherglance.data.DeviceLocation
import com.weatherglance.ui.WeatherGlanceTheme
import com.weatherglance.ui.WeatherScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val viewModel: WeatherViewModel by viewModels()

    private val locationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) resolveLocation()
            else viewModel.showError("Location permission denied — search for a city instead.")
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val state by viewModel.state.collectAsState()
            WeatherGlanceTheme {
                WeatherScreen(
                    state = state,
                    onRefresh = viewModel::refresh,
                    onSearch = viewModel::search,
                    onSelect = viewModel::selectPlace,
                    onToggleUnits = viewModel::toggleUnits,
                    onUseLocation = ::requestLocation,
                    onSaveKey = viewModel::setPollenKey
                )
            }
        }
    }

    private fun requestLocation() {
        val granted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) resolveLocation()
        else locationPermission.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
    }

    private fun resolveLocation() {
        lifecycleScope.launch {
            val place = DeviceLocation.current(this@MainActivity)
            if (place != null) viewModel.selectPlace(place)
            else viewModel.showError("Couldn't read your location — try searching for a city.")
        }
    }
}
