package com.tiffzy.app.ui.customer.profile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.local.FavoritesDataStore
import com.tiffzy.app.data.model.FavoriteItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class FavoritesViewModel(application: Application) : AndroidViewModel(application) {
    private val dataStore = FavoritesDataStore(application)

    private val _favorites = MutableStateFlow<List<FavoriteItem>>(emptyList())
    val favorites: StateFlow<List<FavoriteItem>> = _favorites.asStateFlow()

    init {
        viewModelScope.launch {
            try {
                dataStore.favorites.collect {
                    _favorites.value = it
                }
            } catch (e: Exception) {
                android.util.Log.e("FavoritesViewModel", "Error collecting favorites", e)
                _favorites.value = emptyList()
            }
        }
    }

    fun removeFavorite(key: String) {
        viewModelScope.launch {
            dataStore.removeFavorite(key)
        }
    }
}
