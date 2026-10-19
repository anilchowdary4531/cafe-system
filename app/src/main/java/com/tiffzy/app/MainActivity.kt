package com.tiffzy.app

import android.content.Intent
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
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
import com.cashfree.pg.api.CFPaymentGatewayService
import com.cashfree.pg.core.api.callback.CFCheckoutResponseCallback
import com.cashfree.pg.core.api.utils.CFErrorResponse
import com.razorpay.PaymentData
import com.razorpay.PaymentResultWithDataListener
import com.tiffzy.app.data.local.AuthDataStore
import com.tiffzy.app.navigation.NavGraph
import com.tiffzy.app.ui.theme.TiffzyAppTheme
import com.tiffzy.app.utils.LanguageHelper
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity(), PaymentResultWithDataListener, CFCheckoutResponseCallback {
    
    private var navController: NavHostController? = null

    companion object {
        private var instance: MainActivity? = null
        fun getInstance(): MainActivity? = instance
        
        var onPaymentSuccess: ((String, PaymentData) -> Unit)? = null
        var onPaymentError: ((Int, String?, PaymentData?) -> Unit)? = null

        var cashfreeCheckoutCallback: CFCheckoutResponseCallback? = null
    }

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        instance = this
        
        try {
            CFPaymentGatewayService.getInstance().setCheckoutCallback(this)
        } catch (e: Exception) {
            android.util.Log.e("CASHFREE_DEBUG", "Failed to register Cashfree callback in onCreate: ${e.message}")
        }
        
        val dataStore = AuthDataStore(this)
        
        // Initialize language and other startup tasks asynchronously
        lifecycleScope.launch {
            try {
                val lang = dataStore.appLanguage.first()
                LanguageHelper.applyLanguage(this@MainActivity, lang)
            } catch (e: Exception) {
                LanguageHelper.applyLanguage(this@MainActivity, "en")
            }
        }
        
        askNotificationPermission()
        
        setContent {
            val controller = rememberNavController()
            navController = controller
            
            // Handle initial intent if it contains payment success
            LaunchedEffect(intent) {
                if (intent.getBooleanExtra("payment_success", false)) {
                    com.tiffzy.app.data.repository.CartRepository.getInstance().clearCart()
                    val orderId = intent.getStringExtra("order_id") ?: ""
                    val orderIdInt = orderId.toIntOrNull()
                    if (orderIdInt != null) {
                        controller.navigate("order_detail/$orderIdInt") {
                            popUpTo(0) { inclusive = false }
                        }
                    } else if (orderId.isNotEmpty()) {
                        controller.navigate("order_success/PENDING/$orderId") {
                            popUpTo(0) { inclusive = false }
                        }
                    }
                }
            }
            
            // Re-fetch language code and dark theme to handle dynamic changes
            val languageCode by dataStore.appLanguage.collectAsState(initial = "en")
            val darkTheme by dataStore.darkTheme.collectAsState(initial = false)
            
            // Keying the entire theme/nav forces a safe recomposition when theme or language changes
            key(languageCode, darkTheme) {
                TiffzyAppTheme(darkTheme = darkTheme) {
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
            com.tiffzy.app.data.repository.CartRepository.getInstance().clearCart()
            val orderId = intent.getStringExtra("order_id") ?: ""
            val orderIdInt = orderId.toIntOrNull()
            if (orderIdInt != null) {
                navController?.navigate("order_detail/$orderIdInt") {
                    popUpTo(0) { inclusive = false }
                }
            } else if (orderId.isNotEmpty()) {
                navController?.navigate("order_success/PENDING/$orderId") {
                    popUpTo(0) { inclusive = false }
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

    override fun onResume() {
        super.onResume()
        lifecycleScope.launch {
            try {
                val dataStore = AuthDataStore(this@MainActivity)
                val token = dataStore.authToken.first()
                val role = dataStore.userRole.first()
                val type = dataStore.accountType.first()
                if (!token.isNullOrBlank() && (type == "customer" || role == null || role.isEmpty())) {
                    com.tiffzy.app.service.SocketManager.connectWithAuth(token)
                }
            } catch (e: Exception) {
                // Ignore presence check error
            }
        }
    }

    override fun onPause() {
        super.onPause()
        try {
            com.tiffzy.app.service.SocketManager.disconnect()
        } catch (e: Exception) {
            // Ignore
        }
    }

    override fun onPaymentVerify(orderId: String) {
        android.util.Log.d("CASHFREE_DEBUG", "MainActivity onPaymentVerify: orderId=$orderId")
        cashfreeCheckoutCallback?.onPaymentVerify(orderId)
    }

    override fun onPaymentFailure(cfErrorResponse: CFErrorResponse, orderId: String) {
        val status = cfErrorResponse.status ?: "FAILED"
        val message = cfErrorResponse.message ?: "Transaction failed"
        android.util.Log.e("CASHFREE_DEBUG", "MainActivity onPaymentFailure: status=$status, message=$message, orderId=$orderId")
        cashfreeCheckoutCallback?.onPaymentFailure(cfErrorResponse, orderId)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) {
            instance = null
        }
        onPaymentSuccess = null
        onPaymentError = null
        cashfreeCheckoutCallback = null
    }
}
