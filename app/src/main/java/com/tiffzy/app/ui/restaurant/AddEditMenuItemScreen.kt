package com.tiffzy.app.ui.restaurant

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.tiffzy.app.data.model.MenuItem
import com.tiffzy.app.ui.components.TiffzyTopBar
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddEditMenuItemScreen(
    menuItem: MenuItem? = null,
    onBack: () -> Unit,
    viewModel: RestaurantMenuViewModel = viewModel()
) {
    var name by remember { mutableStateOf(menuItem?.name ?: "") }
    var description by remember { mutableStateOf(menuItem?.description ?: "") }
    var category by remember { mutableStateOf(menuItem?.category ?: "") }
    var price by remember { mutableStateOf(menuItem?.price?.toString() ?: "") }
    var image by remember { mutableStateOf(menuItem?.image ?: "") }
    var isAvailable by remember { mutableStateOf(menuItem?.isAvailable ?: true) }
    
    val isSaving by viewModel.isSaving.collectAsState()
    var isUploading by remember { mutableStateOf(false) }

    val imageLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            isUploading = true
            viewModel.uploadImage(it) { url ->
                isUploading = false
                if (url != null) image = url
            }
        }
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = if (menuItem == null) "Add Item" else "Edit Item",
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
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(Dimens.PaddingLarge),
            verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
        ) {
            // Image Upload
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(MaterialTheme.shapes.large)
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .clickable { imageLauncher.launch("image/*") },
                contentAlignment = Alignment.Center
            ) {
                if (image.isNotEmpty()) {
                    AsyncImage(
                        model = image,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.3f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Change Image", color = androidx.compose.ui.graphics.Color.White, fontWeight = FontWeight.Bold)
                    }
                } else {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.CloudUpload, null, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.primary)
                        Text("Upload Image", style = MaterialTheme.typography.labelLarge)
                    }
                }
                
                if (isUploading) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp))
                }
            }

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Item Name") },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = category,
                onValueChange = { category = it },
                label = { Text("Category") },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = price,
                onValueChange = { price = it },
                label = { Text("Price (₹)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Description (Optional)") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3
            )

            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = isAvailable, onCheckedChange = { isAvailable = it })
                Text("Item is available for order")
            }

            Spacer(modifier = Modifier.weight(1f))

            Button(
                onClick = {
                    viewModel.saveMenuItem(
                        id = menuItem?.id,
                        name = name,
                        description = description.ifEmpty { null },
                        category = category,
                        image = image.ifEmpty { null },
                        price = price.toDoubleOrNull() ?: 0.0,
                        isAvailable = isAvailable,
                        onSuccess = onBack
                    )
                },
                modifier = Modifier.fillMaxWidth().height(Dimens.ButtonHeight),
                shape = MaterialTheme.shapes.medium,
                enabled = name.isNotEmpty() && category.isNotEmpty() && price.isNotEmpty() && !isSaving
            ) {
                if (isSaving) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                } else {
                    Text("SAVE ITEM", style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}
