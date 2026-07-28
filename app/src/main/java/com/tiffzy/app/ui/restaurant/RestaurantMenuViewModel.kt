package com.tiffzy.app.ui.restaurant

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.data.model.MenuItem
import com.tiffzy.app.data.model.MenuRequest
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.FileOutputStream

sealed class MenuUiState {
    object Loading : MenuUiState()
    data class Success(val menu: List<MenuItem>) : MenuUiState()
    data class Error(val message: String) : MenuUiState()
}

class RestaurantMenuViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = RestaurantRepository(RetrofitClient.apiService)
    private val authDataStore = AuthDataStore(application)

    private val _uiState = MutableStateFlow<MenuUiState>(MenuUiState.Loading)
    val uiState: StateFlow<MenuUiState> = _uiState.asStateFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    init {
        loadMenu()
    }

    fun loadMenu() {
        viewModelScope.launch {
            _uiState.value = MenuUiState.Loading
            try {
                val ridString = authDataStore.restaurantId.first()
                if (ridString != null) {
                    val restaurantId = ridString.toInt()
                    val menu = repository.getOwnerMenu(restaurantId)
                    _uiState.value = MenuUiState.Success(menu)
                } else {
                    _uiState.value = MenuUiState.Error("Unauthorized")
                }
            } catch (e: Exception) {
                _uiState.value = MenuUiState.Error(e.message ?: "Failed to load menu")
            }
        }
    }

    fun saveMenuItem(
        id: Int? = null,
        name: String,
        description: String?,
        category: String,
        image: String?,
        price: Double,
        isAvailable: Boolean,
        onSuccess: () -> Unit
    ) {
        viewModelScope.launch {
            _isSaving.value = true
            try {
                val ridString = authDataStore.restaurantId.first()
                if (ridString != null) {
                    val restaurantId = ridString.toInt()
                    val request = MenuRequest(name, description, category, image, price, isAvailable)
                    if (id == null) {
                        repository.createMenuItem(restaurantId, request)
                    } else {
                        repository.updateMenuItem(restaurantId, id, request)
                    }
                    loadMenu()
                    onSuccess()
                }
            } catch (e: Exception) {
                // Error handling
            } finally {
                _isSaving.value = false
            }
        }
    }

    fun deleteMenuItem(menuId: Int) {
        viewModelScope.launch {
            try {
                val ridString = authDataStore.restaurantId.first()
                if (ridString != null) {
                    repository.deleteMenuItem(ridString.toInt(), menuId)
                    loadMenu()
                }
            } catch (e: Exception) {
                // Error handling
            }
        }
    }

    fun toggleAvailability(item: MenuItem) {
        viewModelScope.launch {
            try {
                val ridString = authDataStore.restaurantId.first()
                if (ridString != null) {
                    val restaurantId = ridString.toInt()
                    val request = MenuRequest(
                        name = item.name,
                        description = item.description,
                        category = item.category,
                        image = item.image,
                        price = item.price,
                        isAvailable = !item.isAvailable
                    )
                    repository.updateMenuItem(restaurantId, item.id, request)
                    loadMenu()
                }
            } catch (e: Exception) {
                // Error handling
            }
        }
    }

    fun uploadImage(uri: Uri, onResult: (String?) -> Unit) {
        viewModelScope.launch {
            try {
                val ridString = authDataStore.restaurantId.first()
                if (ridString != null) {
                    val file = uriToFile(uri)
                    val requestFile = file.asRequestBody("image/*".toMediaTypeOrNull())
                    val body = MultipartBody.Part.createFormData("file", file.name, requestFile)
                    val response = repository.uploadMenuImage(ridString.toInt(), body)
                    onResult(response.upload.publicUrl)
                }
            } catch (e: Exception) {
                onResult(null)
            }
        }
    }

    private fun uriToFile(uri: Uri): File {
        val inputStream = getApplication<Application>().contentResolver.openInputStream(uri)
        val file = File(getApplication<Application>().cacheDir, "upload_${System.currentTimeMillis()}.jpg")
        val outputStream = FileOutputStream(file)
        inputStream?.copyTo(outputStream)
        inputStream?.close()
        outputStream.close()
        return file
    }
}
