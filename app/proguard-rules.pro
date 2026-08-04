# Project Specific Rules
-keep class com.tiffzy.app.** { *; }

# Serialization and Networking Rules
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*

# GSON and Generic Types
-keep class com.google.gson.** { *; }
-keep class com.google.gson.reflect.TypeToken
-keep class * extends com.google.gson.reflect.TypeToken

# Retrofit / OkHttp
-keep class retrofit2.** { *; }
-keep class okhttp3.** { *; }
-dontwarn retrofit2.**
-dontwarn okhttp3.**

# DataStore & Preferences
-keep class androidx.datastore.** { *; }
-keep class androidx.preferences.** { *; }
-keep class com.google.protobuf.** { *; }
-dontwarn androidx.datastore.**

# Coroutines & Lifecycle
-keep class kotlinx.coroutines.** { *; }
-keep class androidx.lifecycle.** { *; }
-dontwarn kotlinx.coroutines.**

# CameraX
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# Firebase & ML Kit Component System (Fix for startup crash)
-keep public class * implements com.google.firebase.components.ComponentRegistrar
-keep public class * implements com.google.mlkit.common.internal.model.ModelRegistrar
-keep class com.google.firebase.components.** { *; }
-keep class com.google.mlkit.common.internal.** { *; }
-keep class com.google.firebase.provider.FirebaseInitProvider
-keep class com.google.mlkit.common.internal.MlKitInitProvider

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ML Kit
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# ODML (Needed for ML Kit)
-keep class com.google.android.odml.** { *; }
-dontwarn com.google.android.odml.**

# DataTransport (Needed for Firebase/ML Kit)
-keep class com.google.android.datatransport.** { *; }
-dontwarn com.google.android.datatransport.**

# Socket.io
-keep class io.socket.** { *; }
-dontwarn io.socket.**

# Razorpay
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**
-keep class com.google.android.apps.nbu.paisa.** { *; }
-dontwarn com.google.android.apps.nbu.paisa.**

# Jetpack Compose
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**
