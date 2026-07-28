package com.tiffzy.app.ui.customer.order

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.tiffzy.app.ui.components.TiffzyPrimaryButton
import com.tiffzy.app.ui.components.TiffzySecondaryButton
import com.tiffzy.app.ui.theme.Dimens

@Composable
fun OrderSuccessScreen(
    orderNo: String,
    onHomeClick: () -> Unit,
    onTrackOrderClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(Dimens.PaddingLarge),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.CheckCircle,
            contentDescription = null,
            modifier = Modifier.size(100.dp),
            tint = Color(0xFF16A34A)
        )
        
        Spacer(modifier = Modifier.height(Dimens.SpacingLarge))
        
        Text(
            text = "Order Placed!",
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.primary
        )
        
        Spacer(modifier = Modifier.height(Dimens.SpacingSmall))
        
        Text(
            text = "Order Number: #$orderNo",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        
        Spacer(modifier = Modifier.height(Dimens.SpacingLarge))
        
        Text(
            text = "We've received your order and the restaurant is starting to prepare it.",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        
        Spacer(modifier = Modifier.height(48.dp))
        
        TiffzyPrimaryButton(
            text = "Track Order",
            onClick = onTrackOrderClick
        )
        
        Spacer(modifier = Modifier.height(Dimens.SpacingMedium))
        
        TiffzySecondaryButton(
            text = "Back to Home",
            onClick = onHomeClick
        )
    }
}
