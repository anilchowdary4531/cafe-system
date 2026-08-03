# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# Razorpay Proguard Rules
-keep class com.razorpay.** {*;}
-dontwarn com.razorpay.**
-keep class com.google.android.apps.nbu.paisa.** {*;}
-dontwarn com.google.android.apps.nbu.paisa.**
-dontwarn proguard.annotation.**

# Jetpack Compose / Material3
-keep class androidx.compose.material3.** { *; }

# Tiffzy App Core
-keep class com.tiffzy.app.** { *; }

# Gson / Retrofit
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*
-keep class retrofit2.** { *; }
-keep class okhttp3.** { *; }
-keep class com.google.gson.** { *; }

# DataStore & Preferences
-keep class androidx.datastore.** { *; }
-keep class androidx.preferences.** { *; }

# Coroutines
-keep class kotlinx.coroutines.** { *; }

# AndroidX & Compose
-keep class androidx.** { *; }
-keep class com.google.android.material.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Razorpay
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**


# Google Sign-In
-keep class com.google.android.gms.auth.api.signin.** { *; }
-keep class com.google.android.gms.common.api.ApiException { *; }
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# CameraX
-keep class androidx.camera.core.** { *; }
-keep class androidx.camera.camera2.** { *; }
-keep class androidx.camera.lifecycle.** { *; }
-keep class androidx.camera.view.** { *; }
-dontwarn androidx.camera.**

# ML Kit Barcode Scanning
-keep class com.google.mlkit.vision.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-dontwarn com.google.mlkit.vision.**

# Socket.io
-keep class io.socket.client.** { *; }
-keep class io.socket.engineio.client.** { *; }
-keep class io.socket.parser.** { *; }
-keep class io.socket.thread.** { *; }
-keep class io.socket.utf8.** { *; }
-keep class okhttp3.** { *; }
-dontwarn io.socket.**
