package com.tiffzy.app.data.remote

import com.tiffzy.app.BuildConfig
import com.tiffzy.app.data.local.AuthDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object RetrofitClient {
    val BASE_URL = BuildConfig.BASE_URL

    private var authToken: String? = null
    private var authDataStore: AuthDataStore? = null

    fun init(dataStore: AuthDataStore) {
        authDataStore = dataStore
    }

    fun setToken(token: String?) {
        authToken = token
    }

    private val authInterceptor = Interceptor { chain ->
        val request = chain.request()
        val path = request.url.encodedPath
        
        // Skip adding Authorization header for auth endpoints
        if (path.contains("customer/send-otp") || 
            path.contains("customer/verify-otp") ||
            path.contains("customer/register") ||
            path.contains("customer/password-login") ||
            path.contains("customer/google-login") ||
            path.contains("customer/public/delete-account") ||
            path.contains("login")) {
            return@Interceptor chain.proceed(request)
        }

        // If authToken is null, try fetching it from DataStore (blocking)
        if (authToken == null) {
            authDataStore?.let { dataStore ->
                runBlocking {
                    authToken = dataStore.authToken.first()
                }
            }
        }

        val requestBuilder = request.newBuilder()
        authToken?.let {
            requestBuilder.addHeader("Authorization", "Bearer $it")
        }
        chain.proceed(requestBuilder.build())
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        // ALWAYS enable basic logging for debugging production issues
        level = HttpLoggingInterceptor.Level.BASIC
        // Redact sensitive headers
        redactHeader("Authorization")
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .build()

    val apiService: ApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
