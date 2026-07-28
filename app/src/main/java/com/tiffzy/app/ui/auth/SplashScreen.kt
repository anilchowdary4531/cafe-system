package com.tiffzy.app.ui.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tiffzy.app.R
import com.tiffzy.app.ui.components.BrandLogo
import com.tiffzy.app.ui.theme.Dimens
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first

@Composable
fun SplashScreen(
    viewModel: AuthViewModel,
    onNavigateToHome: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onNavigateToRestaurantDashboard: () -> Unit
) {
    LaunchedEffect(Unit) {
        delay(2000) // Brand exposure
        if (viewModel.checkAuthStatus()) {
            val accountType = com.tiffzy.app.data.local.AuthDataStore(
                com.tiffzy.app.MainActivity.getInstance()?.applicationContext ?: return@LaunchedEffect
            ).accountType.first()
            
            if (accountType == "staff") {
                onNavigateToRestaurantDashboard()
            } else {
                onNavigateToHome()
            }
        } else {
            onNavigateToLogin()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Image(
                painter = painterResource(id = R.drawable.tiffzy_logo),
                contentDescription = "Tiffzy Logo",
                modifier = Modifier.size(180.dp)
            )
            
            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "PREMIUM LUXURY DINING",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f),
                letterSpacing = 2.sp
            )
            
            Spacer(modifier = Modifier.height(64.dp))
            
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = MaterialTheme.colorScheme.primary,
                strokeWidth = 2.dp
            )
        }
    }
}
