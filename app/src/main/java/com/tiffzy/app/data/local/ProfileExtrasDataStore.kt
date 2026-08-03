package com.tiffzy.app.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.profileExtrasDataStore: DataStore<Preferences> by preferencesDataStore(name = "profile_extras")

class ProfileExtrasDataStore(private val context: Context) {

    fun getNickname(phone: String): Flow<String?> = context.profileExtrasDataStore.data.map { preferences ->
        preferences[stringPreferencesKey("${phone}_nickname")]
    }

    fun getAvatar(phone: String): Flow<String?> = context.profileExtrasDataStore.data.map { preferences ->
        preferences[stringPreferencesKey("${phone}_avatar")]
    }

    suspend fun saveProfileExtras(phone: String, nickname: String?, avatar: String?) {
        context.profileExtrasDataStore.edit { preferences ->
            nickname?.let { preferences[stringPreferencesKey("${phone}_nickname")] = it }
            avatar?.let { preferences[stringPreferencesKey("${phone}_avatar")] = it }
        }
    }
    
    suspend fun clearAvatar(phone: String) {
        context.profileExtrasDataStore.edit { preferences ->
            preferences.remove(stringPreferencesKey("${phone}_avatar"))
        }
    }
}
