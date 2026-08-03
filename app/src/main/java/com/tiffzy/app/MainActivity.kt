package com.tiffzy.app

import android.content.Intent
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavHostController
import androidx.navigation.compose.rememberNavController
import com.razorpay.PaymentData
import com.razorpay.PaymentResultWithDataListener
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.navigation.NavGraph
import com.tiffzy.app.ui.theme.TiffzyAppTheme
import com.tiffzy.app.utils.LanguageHelper
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

class MainActivity : ComponentActivity(), PaymentResultWithDataListener {
    
    private var navController: NavHostController? = null

    companion object {
        private var instance: MainActivity? = null
        fun getInstance(): MainActivity? = instance
        
        var onPaymentSuccess: ((String, PaymentData) -> Unit)? = null
        var onPaymentError: ((Int, String?, PaymentData?) -> Unit)? = null
    }

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        instance = this
        
        val dataStore = AuthDataStore(this)
        
        // Load initial language synchronously to avoid flicker and recreation loop
        val initialLang = runBlocking { 
            try {
                dataStore.appLanguage.first()
            } catch (e: Exception) {
                "en"
            }
        }
        LanguageHelper.applyLanguage(this, initialLang)
        
        askNotificationPermission()
        
        setContent {
            val controller = rememberNavController()
            navController = controller
            
            // Collected as state for UI updates, but we don't recreate the activity here anymore
            val languageCode by dataStore.appLanguage.collectAsState(initial = initialLang)
            
            LaunchedEffect(languageCode) {
                // If language changes after startup (e.g. from Settings), apply it
                if (languageCode != initialLang) {
                    LanguageHelper.applyLanguage(this@MainActivity, languageCode)
                    // Control the restart logic from where the language is changed, 
                    // not automatically in a loop.
                }
            }

            TiffzyAppTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    NavGraph(navController = controller)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        navController?.handleDeepLink(intent)
    }

    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    override fun onPaymentSuccess(razorpayPaymentId: String?, data: PaymentData?) {
        if (razorpayPaymentId != null && data != null) {
            onPaymentSuccess?.invoke(razorpayPaymentId, data)
        }
    }

    override fun onPaymentError(code: Int, response: String?, data: PaymentData?) {
        onPaymentError?.invoke(code, response ?: "Payment cancelled or failed", data)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) {
            instance = null
        }
        onPaymentSuccess = null
        onPaymentError = null
    }
}
