package com.tiffzy.app.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

// Defined as extension on Context, will use applicationContext internally for delegate safety
private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "auth_prefs")

class AuthDataStore(context: Context) {
    // Crucial: Always use applicationContext to avoid multiple DataStore instances
    private val appContext = context.applicationContext

    companion object {
        private val AUTH_TOKEN = stringPreferencesKey("auth_token")
        private val CUSTOMER_NAME = stringPreferencesKey("customer_name")
        private val CUSTOMER_PHONE = stringPreferencesKey("customer_phone")
        private val USER_ROLE = stringPreferencesKey("user_role")
        private val ACCOUNT_TYPE = stringPreferencesKey("account_type") // "customer" or "staff"
        private val RESTAURANT_ID = stringPreferencesKey("restaurant_id")
        private val APP_LANGUAGE = stringPreferencesKey("app_language")
        private val REMEMBER_SESSION = androidx.datastore.preferences.core.booleanPreferencesKey("remember_session")
        private val AUTO_DETECT_LOCATION = androidx.datastore.preferences.core.booleanPreferencesKey("auto_detect_location")
        private val NOTIFICATIONS_ENABLED = androidx.datastore.preferences.core.booleanPreferencesKey("notifications_enabled")
    }

    val authToken: Flow<String?> = appContext.dataStore.data.map { preferences ->
        preferences[AUTH_TOKEN]
    }

    val appLanguage: Flow<String> = appContext.dataStore.data.map { preferences ->
        preferences[APP_LANGUAGE] ?: "en"
    }

    val rememberSession: Flow<Boolean> = appContext.dataStore.data.map { preferences ->
        preferences[REMEMBER_SESSION] ?: true
    }

    val autoDetectLocation: Flow<Boolean> = appContext.dataStore.data.map { preferences ->
        preferences[AUTO_DETECT_LOCATION] ?: true
    }

    val notificationsEnabled: Flow<Boolean> = appContext.dataStore.data.map { preferences ->
        preferences[NOTIFICATIONS_ENABLED] ?: true
    }

    val userRole: Flow<String?> = appContext.dataStore.data.map { preferences ->
        preferences[USER_ROLE]
    }

    val accountType: Flow<String?> = appContext.dataStore.data.map { preferences ->
        preferences[ACCOUNT_TYPE]
    }

    val restaurantId: Flow<String?> = appContext.dataStore.data.map { preferences ->
        preferences[RESTAURANT_ID]
    }

    val customerName: Flow<String?> = appContext.dataStore.data.map { preferences ->
        preferences[CUSTOMER_NAME]
    }

    val customerPhone: Flow<String?> = appContext.dataStore.data.map { preferences ->
        preferences[CUSTOMER_PHONE]
    }

    suspend fun saveAuthToken(token: String) {
        appContext.dataStore.edit { preferences ->
            preferences[AUTH_TOKEN] = token
        }
    }

    suspend fun updateSettings(remember: Boolean? = null, autoDetect: Boolean? = null, notify: Boolean? = null) {
        appContext.dataStore.edit { preferences ->
            remember?.let { preferences[REMEMBER_SESSION] = it }
            autoDetect?.let { preferences[AUTO_DETECT_LOCATION] = it }
            notify?.let { preferences[NOTIFICATIONS_ENABLED] = it }
        }
    }

    suspend fun saveCustomerInfo(name: String?, phone: String) {
        appContext.dataStore.edit { preferences ->
            name?.let { preferences[CUSTOMER_NAME] = it }
            preferences[CUSTOMER_PHONE] = phone
            preferences[ACCOUNT_TYPE] = "customer"
        }
    }

    suspend fun saveStaffInfo(name: String, role: String, restaurantId: Int?) {
        appContext.dataStore.edit { preferences ->
            preferences[CUSTOMER_NAME] = name
            preferences[USER_ROLE] = role
            preferences[ACCOUNT_TYPE] = "staff"
            restaurantId?.let { preferences[RESTAURANT_ID] = it.toString() }
        }
    }

    suspend fun saveLanguage(languageCode: String) {
        appContext.dataStore.edit { preferences ->
            preferences[APP_LANGUAGE] = languageCode
        }
    }

    suspend fun clearAuth() {
        appContext.dataStore.edit { preferences ->
            preferences.remove(AUTH_TOKEN)
            preferences.remove(CUSTOMER_NAME)
            preferences.remove(CUSTOMER_PHONE)
            preferences.remove(USER_ROLE)
            preferences.remove(ACCOUNT_TYPE)
            preferences.remove(RESTAURANT_ID)
        }
    }
}
