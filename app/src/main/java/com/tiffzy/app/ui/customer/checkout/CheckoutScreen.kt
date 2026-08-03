package com.tiffzy.app.ui.customer.checkout

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.MainActivity
import com.tiffzy.app.data.model.Address
import com.tiffzy.app.data.repository.CartRepository
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens
import org.json.JSONObject
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutScreen(
    onOrderSuccess: (String, String) -> Unit,
    onBack: () -> Unit,
    viewModel: CheckoutViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val fulfillment by viewModel.fulfillment.collectAsState()
    val paymentMethod by viewModel.paymentMethod.collectAsState()
    val isPayLaterEligible by viewModel.isPayLaterEligible.collectAsState()
    val customerName by viewModel.customerName.collectAsState()
    val customerPhone by viewModel.customerPhone.collectAsState()
    
    val cartItems by CartRepository.getInstance().cartItems.collectAsState()
    val restaurant by CartRepository.getInstance().currentRestaurant.collectAsState()

    val context = LocalContext.current
    val activity = context as? MainActivity

    if (uiState is CheckoutUiState.Success) {
        val order = (uiState as CheckoutUiState.Success).orderDetails
        LaunchedEffect(Unit) {
            onOrderSuccess(order.orderNo, order.id.toString())
        }
    }

    LaunchedEffect(uiState) {
        if (uiState is CheckoutUiState.RazorpayReady) {
            val readyState = uiState as CheckoutUiState.RazorpayReady
            val checkout = com.razorpay.Checkout()
            checkout.setKeyID(readyState.razorpayData.keyId)

            MainActivity.onPaymentSuccess = { paymentId, data ->
                viewModel.onRazorpaySuccess(
                    paymentId,
                    data.orderId ?: readyState.razorpayData.orderId,
                    data.signature ?: "",
                    readyState.paymentId,
                    readyState.orderDetails
                )
            }

            MainActivity.onPaymentError = { code, response, _ ->
                viewModel.onRazorpayFailure(code, response ?: "Payment cancelled")
            }

            try {
                val options = JSONObject()
                options.put("name", "Tiffzy")
                options.put("description", "Order #${readyState.orderDetails.orderNo}")
                options.put("order_id", readyState.razorpayData.orderId)
                options.put("amount", readyState.razorpayData.amount)
                options.put("currency", readyState.razorpayData.currency)

                val prefill = JSONObject()
                prefill.put("name", customerName)
                prefill.put("contact", customerPhone)
                options.put("prefill", prefill)

                // Premium coloring for Razorpay UI
                val theme = JSONObject()
                theme.put("color", "#F5B94E") // Tiffzy Gold
                options.put("theme", theme)

                checkout.open(activity, options)
            } catch (e: Exception) {
                viewModel.onRazorpayFailure(e.message ?: "Error opening Razorpay")
            }
        }
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Checkout",
                subtitle = restaurant?.name ?: "Confirm Order",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (uiState is CheckoutUiState.Loading) {
            TiffzyLoadingIndicator()
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
            ) {
                // 1. Order Summary
                SectionHeader("Order Summary", Icons.Default.ShoppingBag)
                Card(
                    modifier = Modifier.padding(horizontal = Dimens.PaddingLarge),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = MaterialTheme.shapes.large
                ) {
                    Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
                        cartItems.forEach { item ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "${item.quantity}x ${item.menuItem.name}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.weight(1f),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = "₹${String.format(Locale.getDefault(), "%.2f", item.menuItem.price * item.quantity)}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

                // 2. Fulfillment
                val tableNo = CartRepository.getInstance().selectedTable.collectAsState().value
                SectionHeader("Fulfillment", Icons.Default.LocationOn)
                Row(
                    modifier = Modifier.padding(horizontal = Dimens.PaddingLarge),
                    horizontalArrangement = Arrangement.spacedBy(Dimens.SpacingMedium)
                ) {
                    if (tableNo != null) {
                        FulfillmentChip(
                            label = "Dine-in (Table $tableNo)",
                            selected = fulfillment == "dinein",
                            modifier = Modifier.weight(1f)
                        ) { viewModel.fulfillment.value = "dinein" }
                    }
                    FulfillmentChip(
                        label = "Self-Pickup",
                        selected = fulfillment == "pickup",
                        modifier = Modifier.weight(1f)
                    ) { viewModel.fulfillment.value = "pickup" }
                }

                Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

                // 4. Payment Method
                SectionHeader("Payment Method", Icons.Default.Payments)
                Column(
                    modifier = Modifier.padding(horizontal = Dimens.PaddingLarge),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (isPayLaterEligible) {
                        PaymentOptionItem(
                            title = "Tiffzy Pay Later",
                            subtitle = "Digital Khata - Pay monthly",
                            selected = paymentMethod == "PAY_LATER",
                            onClick = { viewModel.paymentMethod.value = "PAY_LATER" },
                            icon = Icons.Default.CheckCircle,
                            iconTint = Color(0xFFF59E0B)
                        )
                    }
                    PaymentOptionItem(
                        title = "Counter Payment",
                        subtitle = "Pay at the restaurant",
                        selected = paymentMethod == "CASH",
                        onClick = { viewModel.paymentMethod.value = "CASH" }
                    )
                }

                Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

                // 5. Billing Details
                SectionHeader("Billing Details", null)
                val subtotal = cartItems.sumOf { it.menuItem.price * it.quantity }
                val tax = if (restaurant?.taxEnabled == true) (subtotal * restaurant!!.taxPercent) / 100.0 else 0.0
                val total = subtotal + tax

                Card(
                    modifier = Modifier.padding(horizontal = Dimens.PaddingLarge),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                ) {
                    Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
                        BillingRowItem("Item Total", subtotal)
                        if (tax > 0) {
                            BillingRowItem("Taxes & Charges", tax)
                        }
                        HorizontalDivider(modifier = Modifier.padding(vertical = Dimens.PaddingSmall), color = MaterialTheme.colorScheme.outlineVariant)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = "Total Amount", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Black)
                            Text(
                                text = "₹${String.format(Locale.getDefault(), "%.2f", total)}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Black,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

                if (uiState is CheckoutUiState.Error) {
                    Text(
                        text = (uiState as CheckoutUiState.Error).message,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(horizontal = Dimens.PaddingLarge),
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
                }

                Box(modifier = Modifier.padding(horizontal = Dimens.PaddingLarge)) {
                    TiffzyPrimaryButton(
                        text = "Confirm & Place Order",
                        onClick = { viewModel.placeOrder() }
                    )
                }
                
                Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
            }
        }
    }
}

@Composable
fun SectionHeader(title: String, icon: ImageVector?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Dimens.PaddingLarge, vertical = Dimens.PaddingSmall),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(icon, null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
        }
        Text(
            text = title.uppercase(),
            style = MaterialTheme.typography.labelLarge,
            letterSpacing = 2.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun BillingRowItem(label: String, amount: Double) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodySmall)
        Text(text = "₹${String.format(Locale.getDefault(), "%.2f", amount)}", style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
fun PaymentOptionItem(
    title: String,
    subtitle: String,
    selected: Boolean,
    onClick: () -> Unit,
    icon: ImageVector? = null,
    iconTint: Color = MaterialTheme.colorScheme.primary
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .border(
                1.dp,
                if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                MaterialTheme.shapes.medium
            ),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            RadioButton(selected = selected, onClick = onClick)
            Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
                Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
fun AddressItem(address: Address, selected: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .border(
                1.dp,
                if (selected) MaterialTheme.colorScheme.primary else Color.Transparent,
                MaterialTheme.shapes.medium
            ),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.LocationOn,
                contentDescription = null,
                tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = address.label,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${address.line1}, ${address.city}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (selected) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "Selected",
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
fun AddAddressDialog(onDismiss: () -> Unit, onConfirm: (String, String, String, String, String) -> Unit) {
    var label by remember { mutableStateOf("Home") }
    var line1 by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var state by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add New Address") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                TiffzyTextField(value = label, onValueChange = { label = it }, label = "Label (e.g. Home, Office)")
                TiffzyTextField(value = line1, onValueChange = { line1 = it }, label = "Address Line 1")
                TiffzyTextField(value = city, onValueChange = { city = it }, label = "City")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TiffzyTextField(value = state, onValueChange = { state = it }, label = "State", modifier = Modifier.weight(1f))
                    TiffzyTextField(value = pin, onValueChange = { pin = it }, label = "Pincode", modifier = Modifier.weight(1f))
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(label, line1, city, state, pin) }) {
                Text("Add")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun FulfillmentChip(label: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        modifier = modifier
            .clickable { onClick() }
            .border(
                1.dp,
                if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                CircleShape
            )
            .clip(CircleShape),
        color = if (selected) MaterialTheme.colorScheme.primary else Color.Transparent
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            style = MaterialTheme.typography.labelLarge,
            color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )
    }
}
