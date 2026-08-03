package com.tiffzy.app.ui.customer.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tiffzy.app.ui.theme.Dimens

@Composable
fun PayLaterInfoSection(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.1f), shape = MaterialTheme.shapes.large)
            .border(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), shape = MaterialTheme.shapes.large)
            .padding(Dimens.PaddingLarge)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Star, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "LOYALTY UPDATES",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
        }
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "Earn up to 20 bonus points for clearing dues within 15 days. Overdue payments (30+ days) will result in point deductions.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            lineHeight = 16.sp
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Text(
            text = "How Digital Khata Works",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(12.dp))
        
        PayLaterInfoItem("Interest-Free Credit", "Enjoy dining now and paying later without interest charges.")
        Spacer(modifier = Modifier.height(12.dp))
        PayLaterInfoItem("Live Ledger Sync", "Every food order and payment is logged instantly.")
        Spacer(modifier = Modifier.height(12.dp))
        PayLaterInfoItem("Instant Online Repayment", "Repay anytime using UPI or cards.")
    }
}

@Composable
fun PayLaterInfoItem(title: String, desc: String) {
    Column {
        Text(text = title, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
        Text(text = desc, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
