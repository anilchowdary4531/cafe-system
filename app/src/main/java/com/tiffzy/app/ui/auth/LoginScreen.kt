package com.tiffzy.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.input.PasswordVisualTransformation
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onOtpSent: () -> Unit,
    onStaffLoggedIn: () -> Unit
) {
    var mode by remember { mutableStateOf("customer") } // "customer" or "staff"
    
    // Customer fields
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    
    // Staff fields
    var staffEmail by remember { mutableStateOf("") }
    var staffPassword by remember { mutableStateOf("") }
    
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.OtpSent) {
            onOtpSent()
        } else if (uiState is AuthUiState.Authenticated && mode == "staff") {
            onStaffLoggedIn()
        }
    }

    Scaffold(
        topBar = { TiffzyTopBar(title = if (mode == "customer") "Customer Sign In" else "Staff Sign In") },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(innerPadding)
                .padding(Dimens.PaddingLarge),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Tab Selector
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = Dimens.PaddingLarge),
                horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingSmall)
            ) {
                if (mode == "customer") {
                    TiffzyPrimaryButton(
                        text = "Customer",
                        onClick = { },
                        modifier = Modifier.weight(1f),
                        fullWidth = false
                    )
                    TiffzySoftButton(
                        text = "Staff",
                        onClick = { mode = "staff" },
                        modifier = Modifier.weight(1f),
                        fullWidth = false
                    )
                } else {
                    TiffzySoftButton(
                        text = "Customer",
                        onClick = { mode = "customer" },
                        modifier = Modifier.weight(1f),
                        fullWidth = false
                    )
                    TiffzyPrimaryButton(
                        text = "Staff",
                        onClick = { },
                        modifier = Modifier.weight(1f),
                        fullWidth = false
                    )
                }
            }

            Text(
                text = "Welcome to Tiffzy",
                style = MaterialTheme.typography.displaySmall,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center
            )
            
            Text(
                text = if (mode == "customer") "Premium Dining, Delivered to You" else "Login to manage your restaurant",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            if (mode == "customer") {
                TiffzyTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = "Phone Number",
                    placeholder = "e.g. 9876543210",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
                )

                Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

                TiffzyTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = "Email (Optional)",
                    placeholder = "you@example.com",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )
            } else {
                TiffzyTextField(
                    value = staffEmail,
                    onValueChange = { staffEmail = it },
                    label = "Staff Email",
                    placeholder = "admin@cafe.com",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )

                Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

                TiffzyTextField(
                    value = staffPassword,
                    onValueChange = { staffPassword = it },
                    label = "Password",
                    placeholder = "Enter password",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                )
            }

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            if (uiState is AuthUiState.Loading) {
                TiffzyLoadingIndicator()
            } else {
                TiffzyPrimaryButton(
                    text = if (mode == "customer") "Send OTP" else "Login",
                    onClick = {
                        if (mode == "customer") {
                            viewModel.phone = phone
                            viewModel.email = email.ifEmpty { null }
                            viewModel.sendOtp()
                        } else {
                            viewModel.staffEmail = staffEmail
                            viewModel.staffPassword = staffPassword
                            viewModel.staffLogin()
                        }
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
