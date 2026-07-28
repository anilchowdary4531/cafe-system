package com.tiffzy.app.ui.customer.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.Customer
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyPrimaryButton
import com.tiffzy.app.ui.components.TiffzyTextField
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfileScreen(
    onBack: () -> Unit,
    viewModel: ProfileViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        viewModel.loadProfile()
    }

    LaunchedEffect(uiState) {
        if (uiState is ProfileUiState.Success) {
            val customer = (uiState as ProfileUiState.Success).customer
            name = customer.name ?: ""
            email = customer.email ?: ""
            phone = customer.phone
        }
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Edit Profile",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(Dimens.PaddingLarge)
        ) {
            Text(
                text = "PERSONAL INFO",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                letterSpacing = 4.sp,
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

            TiffzyTextField(
                value = name,
                onValueChange = { name = it },
                label = "Full Name",
                placeholder = "Enter your full name"
            )

            Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

            TiffzyTextField(
                value = email,
                onValueChange = { email = it },
                label = "Email Address",
                placeholder = "yourname@example.com"
            )

            Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

            TiffzyTextField(
                value = phone,
                onValueChange = { },
                label = "Phone Number",
                enabled = false
            )
            Text(
                text = "Phone number is verified via OTP and cannot be changed.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp, start = 4.dp)
            )

            Spacer(modifier = Modifier.height(48.dp))

            if (uiState is ProfileUiState.Error) {
                Text(
                    text = (uiState as ProfileUiState.Error).message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
            }

            TiffzyPrimaryButton(
                text = if (uiState is ProfileUiState.Loading) "Saving..." else "Update Profile",
                onClick = { viewModel.updateProfile(name, email) },
                enabled = uiState !is ProfileUiState.Loading && name.isNotBlank()
            )
            
            if (uiState is ProfileUiState.Success && (uiState as ProfileUiState.Success).customer.name == name && (uiState as ProfileUiState.Success).customer.email == email) {
                 Text(
                    text = "Profile updated successfully!",
                    color = Color(0xFF16A34A),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 16.dp).align(Alignment.CenterHorizontally)
                )
            }
        }
        
        if (uiState is ProfileUiState.Loading && name.isEmpty()) {
            TiffzyLoadingIndicator()
        }
    }
}
