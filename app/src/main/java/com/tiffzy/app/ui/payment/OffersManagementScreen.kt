package com.tiffzy.app.ui.payment

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.CouponItem
import com.tiffzy.app.data.model.CreateCouponRequest
import com.tiffzy.app.ui.components.TiffzyLoadingIndicator
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OffersManagementScreen(
    onBackClick: () -> Unit = {},
    viewModel: OffersViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var isCreatingCoupon by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.loadCoupons()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = "Offers & Promo Coupons", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadCoupons() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { isCreatingCoupon = true },
                icon = { Icon(Icons.Default.LocalOffer, contentDescription = "Create Coupon") },
                text = { Text("Create Coupon", fontWeight = FontWeight.Bold) },
                containerColor = MaterialTheme.colorScheme.primary
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = Dimens.PaddingMedium),
                verticalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
            ) {
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "ACTIVE RESTAURANT COUPONS (${uiState.coupons.size})",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        letterSpacing = 1.sp
                    )
                }

                items(uiState.coupons) { coupon ->
                    CouponCardRow(coupon = coupon)
                }

                item {
                    Spacer(modifier = Modifier.height(80.dp))
                }
            }

            if (uiState.isLoading) {
                TiffzyLoadingIndicator()
            }
        }
    }

    if (isCreatingCoupon) {
        CreateCouponDialog(
            onDismiss = { isCreatingCoupon = false },
            onSave = { request ->
                viewModel.createCoupon(request)
                isCreatingCoupon = false
            }
        )
    }
}

@Composable
fun CouponCardRow(coupon: CouponItem) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(14.dp)
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.Discount, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(32.dp))
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = coupon.code, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(color = Color(0xFF10B981).copy(alpha = 0.15f), shape = CircleShape) {
                        Text(
                            text = coupon.type,
                            color = Color(0xFF10B981),
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }

                val detailsText = when (coupon.type) {
                    "FLAT" -> "Flat ₹${coupon.discountValue.toInt()} OFF on min order ₹${coupon.minOrderAmount.toInt()}"
                    "PERCENTAGE" -> "${coupon.discountValue.toInt()}% OFF up to ₹${coupon.maxDiscount?.toInt() ?: 100} (min ₹${coupon.minOrderAmount.toInt()})"
                    "FREE_DELIVERY" -> "FREE Delivery on order above ₹${coupon.minOrderAmount.toInt()}"
                    else -> "Special promo discount"
                }

                Text(text = detailsText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun CreateCouponDialog(
    onDismiss: () -> Unit,
    onSave: (CreateCouponRequest) -> Unit
) {
    var code by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("FLAT") }
    var discountValueText by remember { mutableStateOf("") }
    var minOrderText by remember { mutableStateOf("199") }
    var maxDiscountText by remember { mutableStateOf("100") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Promo Coupon") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(value = code, onValueChange = { code = it }, label = { Text("Coupon Code (e.g. FESTIVE30)") }, singleLine = true, modifier = Modifier.fillMaxWidth())

                Text("Discount Type", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = type == "FLAT", onClick = { type = "FLAT" }, label = { Text("Flat ₹") })
                    FilterChip(selected = type == "PERCENTAGE", onClick = { type = "PERCENTAGE" }, label = { Text("% Off") })
                    FilterChip(selected = type == "FREE_DELIVERY", onClick = { type = "FREE_DELIVERY" }, label = { Text("Free Del") })
                }

                OutlinedTextField(value = discountValueText, onValueChange = { discountValueText = it }, label = { Text("Discount Value (${if (type == "PERCENTAGE") "%" else "₹"})") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = minOrderText, onValueChange = { minOrderText = it }, label = { Text("Min Order Amount (₹)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                if (type == "PERCENTAGE") {
                    OutlinedTextField(value = maxDiscountText, onValueChange = { maxDiscountText = it }, label = { Text("Max Discount Cap (₹)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val value = discountValueText.toDoubleOrNull() ?: 0.0
                    val minOrder = minOrderText.toDoubleOrNull() ?: 0.0
                    val maxDisc = maxDiscountText.toDoubleOrNull()
                    if (code.isNotBlank() && value > 0) {
                        onSave(CreateCouponRequest(code = code, type = type, discountValue = value, minOrderAmount = minOrder, maxDiscount = maxDisc))
                    }
                }
            ) { Text("Create Coupon") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
