package com.tiffzy.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@Composable
fun DeleteAccountScreen(
    viewModel: AuthViewModel,
    onAccountDeleted: () -> Unit,
    onBack: () -> Unit
) {
    var identifier by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var step by remember { mutableStateOf(1) } // 1: Request, 2: Verify

    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.OtpSent) {
            step = 2
        } else if (uiState is AuthUiState.AccountDeleted) {
            onAccountDeleted()
        }
    }

    Scaffold(
        topBar = { TiffzyTopBar(title = "Delete Account", onBackClick = onBack) },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(innerPadding)
                .padding(Dimens.PaddingLarge)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "Account Deletion",
                style = MaterialTheme.typography.displaySmall,
                color = MaterialTheme.colorScheme.error,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center
            )

            Text(
                text = "This action is permanent and cannot be undone.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            if (step == 1) {
                TiffzyTextField(
                    value = identifier,
                    onValueChange = { identifier = it },
                    label = "Email or Phone",
                    placeholder = "Enter registered email or phone",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
                )

                Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

                if (uiState is AuthUiState.Loading) {
                    TiffzyLoadingIndicator()
                } else {
                    TiffzyPrimaryButton(
                        text = "Request OTP to Delete",
                        onClick = { viewModel.requestDeleteOtp(identifier) },
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError
                    )
                }
            } else {
                Text(
                    text = "Verification code sent to your registered contact.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

                TiffzyTextField(
                    value = otp,
                    onValueChange = { otp = it },
                    label = "6-Digit OTP",
                    placeholder = "123456",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )

                Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

                if (uiState is AuthUiState.Loading) {
                    TiffzyLoadingIndicator()
                } else {
                    TiffzyPrimaryButton(
                        text = "Permanently Delete My Account",
                        onClick = { viewModel.confirmDeleteAccount(identifier, otp) },
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError
                    )
                }

                TextButton(onClick = { step = 1; viewModel.resetState() }) {
                    Text("Change Email/Phone", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            if (uiState is AuthUiState.Error) {
                Spacer(modifier = Modifier.height(Dimens.SpacingMedium))
                Text(
                    text = (uiState as AuthUiState.Error).message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
