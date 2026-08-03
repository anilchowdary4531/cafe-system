# Project Specific Rules
-keep class com.tiffzy.app.** { *; }

# Gson / Retrofit / OkHttp
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*
-keep class retrofit2.** { *; }
-keep class okhttp3.** { *; }
-keep class com.google.gson.** { *; }
-dontwarn retrofit2.**
-dontwarn okhttp3.**
-dontwarn com.google.gson.**

# DataStore & Preferences
-keep class androidx.datastore.** { *; }
-keep class androidx.preferences.** { *; }
-keep class com.google.protobuf.** { *; }
-dontwarn androidx.datastore.**

# Coroutines
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

# AndroidX Core & Lifecycle
-keep class androidx.core.** { *; }
-keep class androidx.lifecycle.** { *; }
-keep class androidx.activity.** { *; }
-keep class androidx.navigation.** { *; }
-dontwarn androidx.**

# Jetpack Compose / Material3
-keep class androidx.compose.** { *; }
-keep class androidx.compose.material3.** { *; }
-dontwarn androidx.compose.**

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Razorpay
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**
-keep class com.google.android.apps.nbu.paisa.** { *; }
-dontwarn com.google.android.apps.nbu.paisa.**

# Coil (Image Loading)
-keep class io.coilkt.** { *; }
-dontwarn io.coilkt.**

# ML Kit & CameraX
-keep class com.google.mlkit.** { *; }
-keep class androidx.camera.** { *; }
-dontwarn com.google.mlkit.**
-dontwarn androidx.camera.**

# Socket.io
-keep class io.socket.** { *; }
-dontwarn io.socket.**
