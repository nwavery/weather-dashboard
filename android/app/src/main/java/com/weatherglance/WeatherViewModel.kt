package com.weatherglance

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.weatherglance.data.AirQuality
import com.weatherglance.data.Place
import com.weatherglance.data.Pollen
import com.weatherglance.data.Weather
import com.weatherglance.data.WeatherRepository
import com.weatherglance.weather.Units
import com.weatherglance.widget.WidgetRefreshWorker
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class UiState(
    val loading: Boolean = false,
    val place: Place? = null,
    val weather: Weather? = null,
    val air: AirQuality? = null,
    val pollen: Pollen? = null,
    val units: Units = Units.METRIC,
    val pollenKeySet: Boolean = false,
    val error: String? = null,
    val results: List<Place> = emptyList()
)

class WeatherViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = WeatherRepository(app)
    private val _state = MutableStateFlow(
        UiState(units = repo.units, place = repo.activePlace(), pollenKeySet = repo.pollenApiKey != null)
    )
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        WidgetRefreshWorker.schedulePeriodic(app)
        refresh()
    }

    fun refresh() {
        _state.value = _state.value.copy(loading = true, error = null)
        viewModelScope.launch {
            _state.value = repo.refresh().fold(
                onSuccess = { snap ->
                    _state.value.copy(
                        loading = false, place = snap.place, weather = snap.weather,
                        air = snap.air, pollen = snap.pollen, units = repo.units,
                        pollenKeySet = repo.pollenApiKey != null, error = null
                    )
                },
                onFailure = { e ->
                    _state.value.copy(loading = false, error = e.message ?: "Could not load weather")
                }
            )
        }
    }

    fun search(query: String) {
        viewModelScope.launch {
            _state.value = try {
                _state.value.copy(results = repo.search(query))
            } catch (e: Exception) {
                _state.value.copy(results = emptyList())
            }
        }
    }

    fun selectPlace(place: Place) {
        repo.setPlace(place)
        _state.value = _state.value.copy(place = place, results = emptyList())
        refresh()
    }

    fun toggleUnits() {
        val next = if (repo.units == Units.IMPERIAL) Units.METRIC else Units.IMPERIAL
        repo.setUnits(next)
        _state.value = _state.value.copy(units = next)
        viewModelScope.launch { repo.refresh() }
    }

    fun setPollenKey(key: String) {
        repo.setPollenApiKey(key.ifBlank { null })
        _state.value = _state.value.copy(pollenKeySet = repo.pollenApiKey != null)
        refresh()
    }

    fun showError(message: String) {
        _state.value = _state.value.copy(error = message, loading = false)
    }
}
