# Add project specific ProGuard rules here.

# Project Specific Rules
-keep class com.tiffzy.app.** { *; }

# Serialization and Networking Rules
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*

# GSON and Generic Types (CRITICAL for DataStore/Lists)
-keep class com.google.gson.** { *; }
-keep class com.google.gson.reflect.TypeToken
-keep class * extends com.google.gson.reflect.TypeToken

# Retrofit / OkHttp
-keep class retrofit2.** { *; }
-keep class okhttp3.** { *; }
-dontwarn retrofit2.**
-dontwarn okhttp3.**

# DataStore & Preferences (Startup CRASH fix)
-keep class androidx.datastore.** { *; }
-keep class androidx.preferences.** { *; }
-keep class com.google.protobuf.** { *; }
-dontwarn androidx.datastore.**

# Coroutines & Lifecycle
-keep class kotlinx.coroutines.** { *; }
-keep class androidx.lifecycle.** { *; }
-dontwarn kotlinx.coroutines.**

# CameraX & ML Kit (Scanner stability)
-keep class androidx.camera.** { *; }
-keep class com.google.mlkit.** { *; }
-dontwarn androidx.camera.**
-dontwarn com.google.mlkit.**

# Socket.io
-keep class io.socket.** { *; }
-dontwarn io.socket.**

# Razorpay
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**
-keep class com.google.android.apps.nbu.paisa.** { *; }
-dontwarn com.google.android.apps.nbu.paisa.**

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Jetpack Compose
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**
