package com.tiffzy.app.ui.customer.home

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.Address
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.LocationRepository
import com.tiffzy.app.utils.LocationHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class LocationState {
    object Idle : LocationState()
    object Loading : LocationState()
    data class PermissionRequired(val isPermanentlyDenied: Boolean) : LocationState()
    object GpsDisabled : LocationState()
    data class Success(
        val latitude: Double,
        val longitude: Double,
        val addressName: String = "Current Location"
    ) : LocationState()
    data class Error(val message: String) : LocationState()
}

class LocationViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = LocationRepository(RetrofitClient.apiService)
    private val locationHelper = LocationHelper(application)

    private val _locationState = MutableStateFlow<LocationState>(LocationState.Idle)
    val locationState: StateFlow<LocationState> = _locationState.asStateFlow()

    private val _addresses = MutableStateFlow<List<Address>>(emptyList())
    val addresses: StateFlow<List<Address>> = _addresses.asStateFlow()

    private val _lastSelectedLocation = MutableStateFlow<LocationState.Success?>(null)
    val lastSelectedLocation: StateFlow<LocationState.Success?> = _lastSelectedLocation.asStateFlow()

    fun selectLocation(latitude: Double, longitude: Double, name: String = "Selected Location") {
        val success = LocationState.Success(latitude, longitude, name)
        _lastSelectedLocation.value = success
        _locationState.value = success
    }

    fun resetState() {
        _locationState.value = LocationState.Idle
    }

    fun fetchCurrentLocation() {
        if (!locationHelper.isLocationPermissionGranted()) {
            _locationState.value = LocationState.PermissionRequired(false)
            return
        }

        if (!locationHelper.isGpsEnabled()) {
            _locationState.value = LocationState.GpsDisabled
            return
        }

        viewModelScope.launch {
            _locationState.value = LocationState.Loading
            try {
                val location = locationHelper.getCurrentLocation()
                if (location != null) {
                    val success = LocationState.Success(location.latitude, location.longitude)
                    _lastSelectedLocation.value = success
                    _locationState.value = success
                } else {
                    _locationState.value = LocationState.Error("Unable to retrieve location")
                }
            } catch (e: Exception) {
                _locationState.value = LocationState.Error(e.message ?: "Unknown error")
            }
        }
    }

    fun loadSavedAddresses() {
        viewModelScope.launch {
            try {
                val savedAddresses = repository.getAddresses()
                _addresses.value = savedAddresses
            } catch (e: Exception) {
                // Silently fail or log for now, as addresses are optional foundation
            }
        }
    }
}
