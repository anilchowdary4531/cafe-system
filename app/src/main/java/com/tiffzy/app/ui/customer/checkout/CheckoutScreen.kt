package com.tiffzy.app.ui.customer.checkout

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tiffzy.app.data.model.*
import com.tiffzy.app.ui.components.*
import com.tiffzy.app.ui.theme.Dimens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutScreen(
    restaurantSlug: String,
    onBack: () -> Unit,
    onOrderSuccess: (OrderDetails) -> Unit,
    viewModel: CheckoutViewModel,
    authViewModel: com.tiffzy.app.ui.auth.AuthViewModel
) {
    val uiState by viewModel.uiState.collectAsState()
    val cartState by viewModel.getCartState().collectAsState()
    val scrollState = rememberScrollState()

    LaunchedEffect(restaurantSlug) {
        viewModel.loadCheckoutData(restaurantSlug)
    }

    LaunchedEffect(uiState.orderSuccess) {
        uiState.orderSuccess?.let { 
            onOrderSuccess(it.order) 
        }
    }

    Scaffold(
        topBar = {
            TiffzyTopBar(
                title = "Checkout",
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        bottomBar = {
            if (uiState.checkoutPreview != null) {
                CheckoutBottomBar(
                    total = uiState.checkoutPreview!!.total,
                    isLoading = uiState.isLoading,
                    onPlaceOrder = {
                        viewModel.placeOrder(
                            customerName = authViewModel.name ?: "Customer",
                            phone = authViewModel.phone,
                            email = authViewModel.email
                        )
                    }
                )
            }
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(Dimens.PaddingMedium)
            ) {
                // Restaurant Info Banner
                uiState.restaurant?.let { rest ->
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(bottom = Dimens.PaddingMedium),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(Dimens.PaddingMedium),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Storefront,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(28.dp)
                            )
                            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
                            Column {
                                Text(
                                    text = rest.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                                Text(
                                    text = "${cartState.items.sumOf { it.quantity }} items in cart",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                                )
                            }
                        }
                    }
                }

                // 1. Delivery Address Section
                SectionHeader("Delivery Address", Icons.Default.LocationOn)
                AddressSelector(
                    addresses = uiState.addresses,
                    selectedAddress = uiState.selectedAddress,
                    onSelect = { viewModel.selectAddress(it) }
                )
                
                Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

                // 2. Order Summary Section
                SectionHeader("Items Summary", Icons.Default.Receipt)
                OrderSummaryList(cartItems = cartState.items)
                
                Spacer(modifier = Modifier.height(Dimens.SpacingLarge))
                
                // 3. Delivery Instructions
                SectionHeader("Delivery Instructions", Icons.Default.EditNote)
                OutlinedTextField(
                    value = uiState.deliveryInstructions,
                    onValueChange = { viewModel.setInstructions(it) },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("e.g. Leave at door, call on arrival...") },
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant
                    )
                )

                Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

                // 4. Coupon Section
                SectionHeader("Offers & Coupons", Icons.Default.ConfirmationNumber)
                CouponSection(
                    appliedCoupon = null,
                    onApply = { /* Apply Coupon */ }
                )

                Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

                // 5. Payment Method Selector (Cashfree PG)
                SectionHeader("Payment Method", Icons.Default.Payment)
                PaymentMethodSelectorCard(
                    selectedMethod = "CASHFREE",
                    onSelectMethod = { /* Selected Method */ }
                )

                Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

                // Wallet / Pay Later Option (If Available)
                WalletSelector(
                    useWallet = uiState.useWallet,
                    onToggle = { viewModel.toggleWallet(it) },
                    balance = uiState.walletAccounts.find { it.restaurantId == uiState.restaurant?.id }?.pendingBalance ?: 0.0
                )

                Spacer(modifier = Modifier.height(Dimens.SpacingLarge))

                // 6. Detailed Bill Breakdown
                if (uiState.checkoutPreview != null) {
                    SectionHeader("Bill Breakdown", Icons.Default.RequestQuote)
                    BillDetailsCard(preview = uiState.checkoutPreview!!)
                }
                
                Spacer(modifier = Modifier.height(90.dp)) // Padding for fixed bottom bar
            }

            if (uiState.isLoading) {
                TiffzyLoadingIndicator()
            }
        }
    }
}

@Composable
fun SectionHeader(title: String, icon: ImageVector) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(bottom = Dimens.PaddingSmall)
    ) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
        Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
        Text(
            text = title.uppercase(),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 1.sp
        )
    }
}

@Composable
fun AddressSelector(
    addresses: List<Address>,
    selectedAddress: Address?,
    onSelect: (Address) -> Unit
) {
    if (addresses.isEmpty()) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
        ) {
            Text(
                text = "No addresses found. Add one in Profile.",
                modifier = Modifier.padding(Dimens.PaddingMedium),
                style = MaterialTheme.typography.bodySmall
            )
        }
    } else {
        addresses.forEach { address ->
            val isSelected = address.id == selectedAddress?.id
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
                    .clickable { onSelect(address) },
                border = if (isSelected) BorderStroke(1.dp, MaterialTheme.colorScheme.primary) else null,
                colors = CardDefaults.cardColors(
                    containerColor = if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.05f) 
                                    else MaterialTheme.colorScheme.surface
                )
            ) {
                Row(
                    modifier = Modifier.padding(Dimens.PaddingMedium),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(selected = isSelected, onClick = { onSelect(address) })
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = address.label, fontWeight = FontWeight.Bold)
                        Text(text = "${address.line1}, ${address.city}", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable
fun CouponSection(appliedCoupon: String?, onApply: (String) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingSmall),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.LocalOffer, null, tint = Color(0xFFEAB308))
            Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
            Text(text = "Apply Coupon", modifier = Modifier.weight(1f))
            TextButton(onClick = { /* Open Coupon Dialog */ }) {
                Text("VIEW ALL")
            }
        }
    }
}

@Composable
fun PaymentMethodSelectorCard(selectedMethod: String, onSelectMethod: (String) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.15f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            RadioButton(
                selected = true,
                onClick = { onSelectMethod("CASHFREE") }
            )
            Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
            Icon(
                Icons.Default.CreditCard,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(28.dp)
            )
            Spacer(modifier = Modifier.width(Dimens.SpacingMedium))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Cashfree Payment Gateway",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.colorScheme.let { MaterialTheme.typography.titleSmall }
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Surface(
                        color = Color(0xFF10B981),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = "SECURE",
                            color = Color.White,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                    }
                }
                Text(
                    text = "UPI (GPay, PhonePe, Paytm), Cards & Netbanking",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun WalletSelector(useWallet: Boolean, onToggle: (Boolean) -> Unit, balance: Double) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(Dimens.PaddingMedium),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.AccountBalanceWallet, null, tint = Color(0xFF10B981))
            Spacer(modifier = Modifier.width(Dimens.SpacingSmall))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = "Tiffzy Credit / Wallet", fontWeight = FontWeight.Bold)
                Text(text = "Available: Rs $balance", style = MaterialTheme.typography.bodySmall)
            }
            Switch(checked = useWallet, onCheckedChange = onToggle)
        }
    }
}

@Composable
fun BillDetailsCard(preview: CheckoutPreviewResponse) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            BillRow("Subtotal", preview.subtotal)
            BillRow("GST & Restaurant Taxes", preview.taxAmount)
            BillRow("Delivery Fee", preview.deliveryFee)
            BillRow("Packing Charges", preview.packingCharges)
            
            if (preview.couponDiscount > 0) {
                BillRow("Coupon Discount", -preview.couponDiscount, color = Color(0xFF10B981))
            }
            
            if (preview.walletApplied > 0) {
                BillRow("Wallet Applied", -preview.walletApplied, color = Color(0xFF10B981))
            }
            
            HorizontalDivider(modifier = Modifier.padding(vertical = Dimens.PaddingSmall))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(text = "Grand Total", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
                Text(text = "₹${preview.total.toInt()}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
fun BillRow(label: String, amount: Double, color: Color = MaterialTheme.colorScheme.onSurface) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            text = if (amount < 0) "-₹${Math.abs(amount).toInt()}" else "₹${amount.toInt()}", 
            style = MaterialTheme.typography.bodyMedium, 
            color = color,
            fontWeight = if (amount < 0) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
fun CheckoutBottomBar(total: Double, isLoading: Boolean, onPlaceOrder: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shadowElevation = 8.dp,
        color = MaterialTheme.colorScheme.surface
    ) {
        Row(
            modifier = Modifier
                .padding(Dimens.PaddingMedium)
                .navigationBarsPadding(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = "₹${total.toInt()}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
                Text(text = "VIEW DETAILED BILL", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            }
            
            Button(
                onClick = onPlaceOrder,
                modifier = Modifier
                    .weight(1.5f)
                    .height(Dimens.ButtonHeight),
                shape = RoundedCornerShape(12.dp),
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White)
                } else {
                    Text(text = "PLACE ORDER", fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable
fun OrderSummaryList(cartItems: List<CartItem>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(Dimens.PaddingMedium)) {
            cartItems.forEach { item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${item.quantity}x",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.width(32.dp)
                    )
                    Text(
                        text = item.menuItem.name,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = "₹${(item.menuItem.price * item.quantity).toInt()}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
