package com.tiffzy.app.ui.customer.profile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.local.ProfileExtrasDataStore
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.CartRepository
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed class ProfileUiState {
    object Idle : ProfileUiState()
    object Loading : ProfileUiState()
    data class Success(val customer: Customer) : ProfileUiState()
    data class Error(val message: String) : ProfileUiState()
}

sealed class AddressUiState {
    object Idle : AddressUiState()
    object Loading : AddressUiState()
    data class Success(val addresses: List<Address>) : AddressUiState()
    data class Error(val message: String) : AddressUiState()
}

class ProfileViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = RestaurantRepository(RetrofitClient.apiService)
    private val authDataStore = AuthDataStore(application)
    private val profileExtrasDataStore = ProfileExtrasDataStore(application)
    private val cartRepository = CartRepository.getInstance()

    private val _uiState = MutableStateFlow<ProfileUiState>(ProfileUiState.Idle)
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    private val _nickname = MutableStateFlow<String?>(null)
    val nickname: StateFlow<String?> = _nickname.asStateFlow()

    private val _avatar = MutableStateFlow<String?>(null)
    val avatar: StateFlow<String?> = _avatar.asStateFlow()

    private val _lastOrder = MutableStateFlow<OrderDetails?>(null)
    val lastOrder: StateFlow<OrderDetails?> = _lastOrder.asStateFlow()

    private val _addressState = MutableStateFlow<AddressUiState>(AddressUiState.Idle)
    val addressState: StateFlow<AddressUiState> = _addressState.asStateFlow()

    fun loadProfile() {
        viewModelScope.launch {
            _uiState.value = ProfileUiState.Loading
            try {
                val response = repository.getProfile()
                _uiState.value = ProfileUiState.Success(response.customer)
                
                // Sync with local store
                authDataStore.saveCustomerInfo(response.customer.name, response.customer.phone)
                
                // Load local extras
                _nickname.value = profileExtrasDataStore.getNickname(response.customer.phone).first()
                _avatar.value = profileExtrasDataStore.getAvatar(response.customer.phone).first()

                // Fetch last order
                val ordersResponse = repository.getCustomerOrders(response.customer.phone)
                val allOrders = ordersResponse.groups.flatMap { it.orders }
                _lastOrder.value = allOrders.maxByOrNull { it.createdAt }
            } catch (e: Exception) {
                _uiState.value = ProfileUiState.Error(e.message ?: "Failed to load profile")
            }
        }
    }

    fun updateProfile(name: String, email: String, newNickname: String? = null, newAvatar: String? = null) {
        viewModelScope.launch {
            _uiState.value = ProfileUiState.Loading
            try {
                val response = repository.updateProfile(name, email)
                _uiState.value = ProfileUiState.Success(response.customer)
                authDataStore.saveCustomerInfo(response.customer.name, response.customer.phone)
                
                // Save local extras
                profileExtrasDataStore.saveProfileExtras(response.customer.phone, newNickname, newAvatar)
                _nickname.value = newNickname
                _avatar.value = newAvatar
            } catch (e: Exception) {
                _uiState.value = ProfileUiState.Error(e.message ?: "Failed to update profile")
            }
        }
    }

    fun removeAvatar() {
        viewModelScope.launch {
            val phone = authDataStore.customerPhone.first()
            if (phone != null) {
                profileExtrasDataStore.clearAvatar(phone)
                _avatar.value = null
            }
        }
    }

    fun loadAddresses() {
        viewModelScope.launch {
            _addressState.value = AddressUiState.Loading
            try {
                val response = repository.getAddresses()
                _addressState.value = AddressUiState.Success(response.addresses)
            } catch (e: Exception) {
                _addressState.value = AddressUiState.Error(e.message ?: "Failed to load addresses")
            }
        }
    }

    fun addAddress(request: CreateAddressRequest) {
        viewModelScope.launch {
            _addressState.value = AddressUiState.Loading
            try {
                repository.createAddress(request)
                loadAddresses()
            } catch (e: Exception) {
                _addressState.value = AddressUiState.Error(e.message ?: "Failed to add address")
            }
        }
    }

    fun deleteAddress(id: Int) {
        viewModelScope.launch {
            _addressState.value = AddressUiState.Loading
            try {
                repository.deleteAddress(id)
                loadAddresses()
            } catch (e: Exception) {
                _addressState.value = AddressUiState.Error(e.message ?: "Failed to delete address")
            }
        }
    }

    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            authDataStore.clearAuth()
            cartRepository.clearCart()
            onLoggedOut()
        }
    }
}
