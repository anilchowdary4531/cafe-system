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
        
        // Setup condition to keep splash screen visible during initialization
        var isReady by mutableStateOf(false)
        splashScreen.setKeepOnScreenCondition { !isReady }
        
        // Initialize language and other startup tasks asynchronously
        lifecycleScope.launch {
            try {
                val lang = dataStore.appLanguage.first()
                LanguageHelper.applyLanguage(this@MainActivity, lang)
            } catch (e: Exception) {
                LanguageHelper.applyLanguage(this@MainActivity, "en")
            } finally {
                isReady = true
            }
        }
        
        askNotificationPermission()
        
        setContent {
            val controller = rememberNavController()
            navController = controller
            
            // Handle initial intent if it contains payment success
            LaunchedEffect(intent) {
                if (intent.getBooleanExtra("payment_success", false)) {
                    val orderId = intent.getStringExtra("order_id") ?: ""
                    if (orderId.isNotEmpty()) {
                        controller.navigate("order_success/PENDING/$orderId") {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                }
            }
            
            // Re-fetch language code to handle dynamic changes (e.g. from Settings)
            val languageCode by dataStore.appLanguage.collectAsState(initial = "en")
            
            // Keying the entire theme/nav on languageCode forces a safe recomposition when language changes
            key(languageCode) {
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
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        
        // Handle deep links
        navController?.handleDeepLink(intent)
        
        // Handle Cashfree payment success
        if (intent.getBooleanExtra("payment_success", false)) {
            val orderId = intent.getStringExtra("order_id") ?: ""
            if (orderId.isNotEmpty()) {
                // Navigate to order success screen. 
                // We might not have the orderNo here, but Success screen can handle it.
                navController?.navigate("order_success/PENDING/$orderId") {
                    popUpTo(0) { inclusive = true }
                }
            }
        }
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
