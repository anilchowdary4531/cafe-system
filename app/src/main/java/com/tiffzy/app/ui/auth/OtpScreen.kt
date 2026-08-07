package com.tiffzy.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@Composable
fun OtpScreen(
    viewModel: AuthViewModel,
    onAuthenticated: () -> Unit,
    onNavigateToCompleteProfile: () -> Unit,
    onBack: () -> Unit
) {
    var otp by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    val uiState by viewModel.uiState.collectAsState()
    val timerValue by viewModel.timerValue.collectAsState()

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.Authenticated) {
            onAuthenticated()
        } else if (uiState is AuthUiState.RequiresProfileCompletion) {
            viewModel.pendingProfileInfo = (uiState as AuthUiState.RequiresProfileCompletion).partialInfo
            onNavigateToCompleteProfile()
        }
    }

    Scaffold(
        topBar = { 
            TiffzyTopBar(
                title = "Verification",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(innerPadding)
                .padding(Dimens.PaddingLarge),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Enter Code",
                style = MaterialTheme.typography.displaySmall,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center
            )
            
            Text(
                text = "We've sent a 6-digit verification code to ${viewModel.email}",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            TiffzyTextField(
                value = otp,
                onValueChange = { if (it.length <= 6) otp = it },
                label = "6-Digit OTP",
                placeholder = "123456",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

            TiffzyTextField(
                value = name,
                onValueChange = { name = it },
                label = "Your Name (Optional)",
                placeholder = "John Doe",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (timerValue > 0) {
                    Text(
                        text = "Resend in ${timerValue}s",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    TextButton(onClick = { viewModel.resendOtp() }) {
                        Text(
                            text = "Resend OTP",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
                
                TextButton(onClick = onBack) {
                    Text(
                        text = "Change Email",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            if (uiState is AuthUiState.Loading) {
                TiffzyLoadingIndicator()
            } else {
                TiffzyPrimaryButton(
                    text = "Verify & Continue",
                    onClick = {
                        viewModel.otp = otp
                        viewModel.name = name.ifEmpty { null }
                        viewModel.verifyOtp()
                    }
                )
            }

            if (uiState is AuthUiState.Error) {
                Spacer(modifier = Modifier.height(Dimens.SpacingMedium))
                Text(
                    text = (uiState as AuthUiState.Error).message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}
