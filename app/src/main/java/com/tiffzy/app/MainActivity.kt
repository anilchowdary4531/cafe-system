package com.tiffzy.app

import android.content.Intent
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
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
        val dataStore = AuthDataStore(this)
        
        // Initial language application
        val initialLang = runBlocking { dataStore.appLanguage.first() }
        LanguageHelper.applyLanguage(this, initialLang)
        var currentLang = initialLang
        
        installSplashScreen()
        super.onCreate(savedInstanceState)
        instance = this
        
        askNotificationPermission()
        
        setContent {
            val controller = rememberNavController()
            navController = controller
            
            val languageCode by dataStore.appLanguage.collectAsState(initial = initialLang)
            
            LaunchedEffect(languageCode) {
                if (languageCode != currentLang) {
                    LanguageHelper.applyLanguage(this@MainActivity, languageCode)
                    currentLang = languageCode
                    recreate()
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
