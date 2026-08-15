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
    onShippingPolicyClick: () -> Unit = {},
    onQrOrderingClick: () -> Unit = {},
    onPosDashboardClick: () -> Unit = {},
    onAnalyticsClick: () -> Unit = {},
    onInventoryClick: () -> Unit = {},
    onLegalDisclosureClick: () -> Unit = {},
    onDownloadAndroidClick: () -> Unit = {},
    onDownloadIosClick: () -> Unit = {}
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

        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))
        
        // Legal Entity Notice Card (Added for Google Play Compliance)
        Surface(
            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
            shape = RoundedCornerShape(12.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.2f))
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = "Legal Entity Notice",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "Tiffzy is owned & operated by SURVETRA SERVICES.",
                    style = MaterialTheme.typography.labelSmall,
                    color = textColor
                )
            }
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingExtraLarge))

        // Grid-like layout for sections
        Row(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                FooterHeader("Company", headerColor)
                FooterLink("About Us", textColor, onAboutUsClick)
                FooterLink("Contact Us", textColor, onContactUsClick)
                FooterLink("Legal and Business Info", headerColor, onLegalDisclosureClick)
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
                FooterLink("Shipping Policy", textColor, onShippingPolicyClick)
                FooterLink("Delete Account", textColor, onDeleteAccountClick)
            }
            Column(modifier = Modifier.weight(1f)) {
                FooterHeader("Get Our App", headerColor)
                Spacer(modifier = Modifier.height(Dimens.PaddingSmall))
                AppDownloadButton("Download for iOS", onDownloadIosClick)
                Spacer(modifier = Modifier.height(Dimens.PaddingSmall))
                AppDownloadButton("Download for Android", onDownloadAndroidClick)
                
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
            text = "© 2026 SURVETRA SERVICES. All rights reserved.",
            style = MaterialTheme.typography.labelSmall,
            color = textColor.copy(alpha = 0.7f)
        )
        Text(
            text = "Tiffzy is owned and operated by SURVETRA SERVICES.",
            style = MaterialTheme.typography.labelSmall,
            color = textColor.copy(alpha = 0.5f)
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
private fun AppDownloadButton(text: String, onClick: () -> Unit = {}) {
    Surface(
        modifier = Modifier.fillMaxWidth().height(40.dp).clickable { onClick() },
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
