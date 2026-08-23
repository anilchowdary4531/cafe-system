package com.tiffzy.app.ui.customer.profile

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.tiffzy.app.data.model.Customer
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.components.TiffzyPrimaryButton
import com.tiffzy.app.ui.components.TiffzyTextField
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens
import com.tiffzy.app.utils.ImageUtils

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfileScreen(
    onBack: () -> Unit,
    viewModel: ProfileViewModel = viewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val currentNickname by viewModel.nickname.collectAsState()
    val currentAvatar by viewModel.avatar.collectAsState()
    
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var nickname by remember { mutableStateOf("") }
    var avatarUri by remember { mutableStateOf<String?>(null) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        uri?.let { avatarUri = it.toString() }
    }

    LaunchedEffect(Unit) {
        viewModel.loadProfile()
    }

    LaunchedEffect(uiState) {
        if (uiState is ProfileUiState.Success) {
            val customer = (uiState as ProfileUiState.Success).customer
            name = customer.name ?: ""
            email = customer.email ?: ""
            phone = customer.phone
            nickname = currentNickname ?: ""
            avatarUri = currentAvatar
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
            // Profile Picture Selection
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = Dimens.PaddingLarge),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box {
                        if (!avatarUri.isNullOrEmpty()) {
                            AsyncImage(
                                model = ImageUtils.resolveImageUrl(avatarUri),
                                contentDescription = "Profile Photo",
                                modifier = Modifier
                                    .size(100.dp)
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.surfaceVariant),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Surface(
                                modifier = Modifier.size(100.dp),
                                shape = CircleShape,
                                color = MaterialTheme.colorScheme.primaryContainer
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        Icons.Default.CameraAlt,
                                        contentDescription = null,
                                        modifier = Modifier.size(32.dp),
                                        tint = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        }
                        
                        // Close button to remove
                        if (!avatarUri.isNullOrEmpty()) {
                            IconButton(
                                onClick = { 
                                    avatarUri = null
                                    viewModel.removeAvatar()
                                },
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .size(24.dp)
                                    .background(MaterialTheme.colorScheme.error, CircleShape)
                            ) {
                                Icon(Icons.Default.Close, null, tint = Color.White, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    TextButton(
                        onClick = {
                            photoPickerLauncher.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                            )
                        }
                    ) {
                        Text(if (avatarUri.isNullOrEmpty()) "Upload Photo" else "Change Photo")
                    }
                }
            }

            Text(
                text = "PERSONAL INFO",
                style = MaterialTheme.typography.labelSmall,
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
                value = nickname,
                onValueChange = { nickname = it },
                label = "Nickname",
                placeholder = "How friends call you"
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
                onClick = { viewModel.updateProfile(name, email, nickname, avatarUri) },
                enabled = (uiState !is ProfileUiState.Loading && name.isNotBlank())
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
