package com.tiffzy.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.tiffzy.app.R
import com.tiffzy.app.data.model.VerifyOtpResponse
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@Composable
fun CompleteProfileScreen(
    viewModel: AuthViewModel,
    partialInfo: VerifyOtpResponse,
    onAuthenticated: () -> Unit,
    onBack: () -> Unit
) {
    var name by remember { mutableStateOf(partialInfo.name ?: "") }
    var phone by remember { mutableStateOf("") }
    val email = partialInfo.email ?: ""
    val picture = partialInfo.picture
    
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.Authenticated) {
            onAuthenticated()
        }
    }

    Scaffold(
        topBar = { TiffzyTopBar(title = "Complete Profile", onBackClick = onBack) },
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
                text = "Almost There!",
                style = MaterialTheme.typography.displaySmall,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center
            )

            Text(
                text = "Please provide your phone number to complete registration.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            // Profile Picture
            if (!picture.isNullOrEmpty()) {
                AsyncImage(
                    model = picture,
                    contentDescription = "Profile Picture",
                    modifier = Modifier
                        .size(100.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentScale = ContentScale.Crop
                )
                Spacer(modifier = Modifier.height(Dimens.SpacingMedium))
            }

            TiffzyTextField(
                value = name,
                onValueChange = { name = it },
                label = "Full Name",
                placeholder = "Enter your full name",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

            TiffzyTextField(
                value = phone,
                onValueChange = { phone = it },
                label = "Phone Number",
                placeholder = "9876543210",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingMedium))

            TiffzyTextField(
                value = email,
                onValueChange = { },
                label = "Email",
                enabled = false,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
            )

            Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

            if (uiState is AuthUiState.Loading) {
                TiffzyLoadingIndicator()
            } else {
                TiffzyPrimaryButton(
                    text = "Finish Registration",
                    onClick = {
                        if (phone.length < 10) {
                            // Show error or handle validation
                        } else {
                            // Call google login again with phone
                            viewModel.loginWithGoogle(
                                idToken = "", // Backend already has info if we send googleId/email
                                email = email,
                                name = name,
                                googleId = partialInfo.googleId,
                                picture = picture,
                                phone = phone
                            )
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
