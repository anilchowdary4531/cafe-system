package com.tiffzy.app.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "auth_prefs")

class AuthDataStore(private val context: Context) {

    companion object {
        private val AUTH_TOKEN = stringPreferencesKey("auth_token")
        private val CUSTOMER_NAME = stringPreferencesKey("customer_name")
        private val CUSTOMER_PHONE = stringPreferencesKey("customer_phone")
        private val USER_ROLE = stringPreferencesKey("user_role")
        private val ACCOUNT_TYPE = stringPreferencesKey("account_type") // "customer" or "staff"
        private val RESTAURANT_ID = stringPreferencesKey("restaurant_id")
    }

    val authToken: Flow<String?> = context.dataStore.data.map { preferences ->
        preferences[AUTH_TOKEN]
    }

    val userRole: Flow<String?> = context.dataStore.data.map { preferences ->
        preferences[USER_ROLE]
    }

    val accountType: Flow<String?> = context.dataStore.data.map { preferences ->
        preferences[ACCOUNT_TYPE]
    }

    val restaurantId: Flow<String?> = context.dataStore.data.map { preferences ->
        preferences[RESTAURANT_ID]
    }

    val customerName: Flow<String?> = context.dataStore.data.map { preferences ->
        preferences[CUSTOMER_NAME]
    }

    val customerPhone: Flow<String?> = context.dataStore.data.map { preferences ->
        preferences[CUSTOMER_PHONE]
    }

    suspend fun saveAuthToken(token: String) {
        context.dataStore.edit { preferences ->
            preferences[AUTH_TOKEN] = token
        }
    }

    suspend fun saveCustomerInfo(name: String?, phone: String) {
        context.dataStore.edit { preferences ->
            name?.let { preferences[CUSTOMER_NAME] = it }
            preferences[CUSTOMER_PHONE] = phone
            preferences[ACCOUNT_TYPE] = "customer"
        }
    }

    suspend fun saveStaffInfo(name: String, role: String, restaurantId: Int?) {
        context.dataStore.edit { preferences ->
            preferences[CUSTOMER_NAME] = name
            preferences[USER_ROLE] = role
            preferences[ACCOUNT_TYPE] = "staff"
            restaurantId?.let { preferences[RESTAURANT_ID] = it.toString() }
        }
    }

    suspend fun clearAuth() {
        context.dataStore.edit { preferences ->
            preferences.remove(AUTH_TOKEN)
            preferences.remove(CUSTOMER_NAME)
            preferences.remove(CUSTOMER_PHONE)
            preferences.remove(USER_ROLE)
            preferences.remove(ACCOUNT_TYPE)
            preferences.remove(RESTAURANT_ID)
        }
    }
}
