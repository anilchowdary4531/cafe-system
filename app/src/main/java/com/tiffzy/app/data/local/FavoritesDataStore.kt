package com.tiffzy.app.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tiffzy.app.data.model.FavoriteItem
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.ArrayList

private val Context.favoritesDataStore: DataStore<Preferences> by preferencesDataStore(name = "favorites_prefs")

class FavoritesDataStore(private val context: Context) {
    private val gson = Gson()
    
    companion object {
        private val FAVORITES_JSON = stringPreferencesKey("favorites_json")
    }

    val favorites: Flow<List<FavoriteItem>> = context.favoritesDataStore.data.map { preferences ->
        try {
            val json = preferences[FAVORITES_JSON] ?: "[]"
            val type = object : TypeToken<ArrayList<FavoriteItem>>() {}.type
            val list = gson.fromJson<ArrayList<FavoriteItem>>(json, type) ?: ArrayList<FavoriteItem>()
            // Filter out any items that might have been corrupted or have null required fields
            // GSON can bypass Kotlin's nullability checks during deserialization
            list.filter { it != null && it.restaurantSlug != null && it.key != null }
        } catch (e: Exception) {
            android.util.Log.e("FavoritesDataStore", "Error parsing favorites", e)
            emptyList<FavoriteItem>()
        }
    }

    suspend fun toggleFavorite(item: FavoriteItem) {
        context.favoritesDataStore.edit { preferences ->
            try {
                val currentJson = preferences[FAVORITES_JSON] ?: "[]"
                val type = object : TypeToken<ArrayList<FavoriteItem>>() {}.type
                val currentList: ArrayList<FavoriteItem> = gson.fromJson(currentJson, type) ?: ArrayList()
                
                val existing = currentList.find { it.key == item.key }
                if (existing != null) {
                    currentList.remove(existing)
                } else {
                    currentList.add(item)
                }
                
                preferences[FAVORITES_JSON] = gson.toJson(currentList)
            } catch (e: Exception) {
                android.util.Log.e("FavoritesDataStore", "Error toggling favorite", e)
            }
        }
    }
    
    suspend fun removeFavorite(key: String) {
        context.favoritesDataStore.edit { preferences ->
            try {
                val currentJson = preferences[FAVORITES_JSON] ?: "[]"
                val type = object : TypeToken<ArrayList<FavoriteItem>>() {}.type
                val currentList: ArrayList<FavoriteItem> = gson.fromJson(currentJson, type) ?: ArrayList()
                
                currentList.removeAll { it.key == key }
                preferences[FAVORITES_JSON] = gson.toJson(currentList)
            } catch (e: Exception) {
                android.util.Log.e("FavoritesDataStore", "Error removing favorite", e)
            }
        }
    }
}
