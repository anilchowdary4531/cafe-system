package com.tiffzy.app.ui.customer.menu

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.tiffzy.app.data.local.FavoritesDataStore
import com.tiffzy.app.data.repository.CartRepository
import com.tiffzy.app.data.repository.RestaurantRepository
import com.tiffzy.app.data.remote.RetrofitClient

class MenuViewModelFactory(private val context: Context) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(MenuViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return MenuViewModel(
                repository = RestaurantRepository(RetrofitClient.apiService),
                cartRepository = CartRepository.getInstance(),
                favoritesDataStore = FavoritesDataStore(context)
            ) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
