package com.tiffzy.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tiffzy.app.ui.theme.Dimens

@Composable
fun TiffzyFooter(
    onAboutUsClick: () -> Unit = {},
    onContactUsClick: () -> Unit = {},
    onHelpCenterClick: () -> Unit = {},
    onTermsClick: () -> Unit = {},
    onPrivacyClick: () -> Unit = {},
    onRefundPolicyClick: () -> Unit = {},
    onDeleteAccountClick: () -> Unit = {},
    onQrOrderingClick: () -> Unit = {},
    onPosDashboardClick: () -> Unit = {},
    onAnalyticsClick: () -> Unit = {},
    onInventoryClick: () -> Unit = {}
) {
    // Colors adapted to MaterialTheme (Dark/Light support)
    val footerBackgroundColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f)
    val textColor = MaterialTheme.colorScheme.onSurfaceVariant
    val headerColor = MaterialTheme.colorScheme.primary

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(footerBackgroundColor)
            .padding(Dimens.PaddingLarge)
    ) {
        // Brand Section
        BrandLogo(modifier = Modifier.size(80.dp, 32.dp))
        Spacer(modifier = Modifier.height(Dimens.PaddingSmall))
        Text(
            text = "Smart ordering platform for restaurants, cafes and dine-in businesses.",
            style = MaterialTheme.typography.bodySmall,
            color = textColor,
            modifier = Modifier.fillMaxWidth(0.8f)
        )

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        // Grid-like layout for sections
        Row(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                FooterHeader("Company", headerColor)
                FooterLink("About Us", textColor, onAboutUsClick)
                FooterLink("Contact Us", textColor, onContactUsClick)
            }
            Column(modifier = Modifier.weight(1f)) {
                FooterHeader("Products", headerColor)
                FooterLink("QR Ordering", textColor, onQrOrderingClick)
                FooterLink("POS Dashboard", textColor, onPosDashboardClick)
                FooterLink("Analytics", textColor, onAnalyticsClick)
                FooterLink("Inventory", textColor, onInventoryClick)
            }
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingLarge))

        Row(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                FooterHeader("Support", headerColor)
                FooterLink("Help Center", textColor, onHelpCenterClick)
                FooterLink("Terms", textColor, onTermsClick)
                FooterLink("Privacy", textColor, onPrivacyClick)
                FooterLink("Refund Policy", textColor, onRefundPolicyClick)
                FooterLink("Delete Account", textColor, onDeleteAccountClick)
            }
            Column(modifier = Modifier.weight(1f)) {
                FooterHeader("Get Our App", headerColor)
                Spacer(modifier = Modifier.height(Dimens.PaddingSmall))
                AppDownloadButton("Download for iOS")
                Spacer(modifier = Modifier.height(Dimens.PaddingSmall))
                AppDownloadButton("Download for Android")
                
                Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    SocialIcon("FB", textColor)
                    SocialIcon("IG", textColor)
                    SocialIcon("X", textColor)
                    SocialIcon("LI", textColor)
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

        Text(
            text = "© 2026 Tiffzy Technologies Pvt Ltd. All rights reserved.",
            style = MaterialTheme.typography.labelSmall,
            color = textColor.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun FooterHeader(text: String, color: Color) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = color,
        modifier = Modifier.padding(bottom = 8.dp)
    )
}

@Composable
private fun FooterLink(text: String, color: Color, onClick: () -> Unit = {}) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = color,
        modifier = Modifier
            .padding(vertical = 4.dp)
            .clickable { onClick() }
    )
}

@Composable
private fun AppDownloadButton(text: String) {
    Surface(
        modifier = Modifier.fillMaxWidth().height(40.dp),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = text,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

@Composable
private fun SocialIcon(text: String, color: Color) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.Black,
        color = color,
        modifier = Modifier.padding(end = 12.dp)
    )
}
