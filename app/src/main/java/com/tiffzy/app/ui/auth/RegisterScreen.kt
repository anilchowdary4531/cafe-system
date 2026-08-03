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
import androidx.compose.ui.res.stringResource
import com.tiffzy.app.R
import com.tiffzy.app.data.model.CustomerRegisterRequest
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@Composable
fun RegisterScreen(
    viewModel: AuthViewModel,
    onAuthenticated: () -> Unit,
    onBack: () -> Unit
) {
    var username by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }

    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.Authenticated) {
            onAuthenticated()
        }
    }

    Scaffold(
        topBar = { TiffzyTopBar(title = stringResource(R.string.create_account), onBackClick = onBack) },
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
                text = stringResource(R.string.join_tiffzy),
                style = MaterialTheme.typography.displaySmall,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center
            )

            Text(
                text = stringResource(R.string.join_subtitle),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            TiffzyTextField(
                value = username,
                onValueChange = { username = it },
                label = stringResource(R.string.username),
                placeholder = "alex_99",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

            TiffzyTextField(
                value = phone,
                onValueChange = { phone = it },
                label = stringResource(R.string.phone_number),
                placeholder = "9876543210",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

            TiffzyTextField(
                value = password,
                onValueChange = { password = it },
                label = stringResource(R.string.password),
                placeholder = "Enter password",
                isPassword = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

            TiffzyTextField(
                value = name,
                onValueChange = { name = it },
                label = stringResource(R.string.full_name_optional),
                placeholder = "Alex Smith"
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

            TiffzyTextField(
                value = email,
                onValueChange = { email = it },
                label = stringResource(R.string.email_optional),
                placeholder = "alex@example.com",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            if (uiState is AuthUiState.Loading) {
                TiffzyLoadingIndicator()
            } else {
                TiffzyPrimaryButton(
                    text = stringResource(R.string.register),
                    onClick = {
                        viewModel.registerCustomer(
                            CustomerRegisterRequest(
                                username = username,
                                phone = phone,
                                password = password,
                                name = name.ifEmpty { null },
                                email = email.ifEmpty { null }
                            )
                        )
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
