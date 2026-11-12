package com.tiffzy.app.ui.payment

import com.tiffzy.app.data.model.CashfreeCreateOrderResponse
import com.tiffzy.app.data.model.PaymentResultStatus
import com.tiffzy.app.data.model.TopupStep
import com.tiffzy.app.data.model.WalletTopupCreateResponse
import com.tiffzy.app.data.model.WalletTopupSession
import com.tiffzy.app.data.model.resolvedCheckoutUrl
import com.tiffzy.app.data.model.resolvedGatewayOrderId
import com.tiffzy.app.data.model.resolvedProvider
import com.tiffzy.app.data.model.resolvedTopupTxnId
import org.junit.Assert.*
import org.junit.Test

class TwmPayHelperTest {

    @Test
    fun `isUpiOrExternalScheme detects UPI deep links and excludes web URLs`() {
        assertTrue(TwmCheckoutUrlHelper.isUpiOrExternalScheme("upi://pay?pa=merchant@upi&am=100.00"))
        assertTrue(TwmCheckoutUrlHelper.isUpiOrExternalScheme("tez://upi/pay?pa=merchant@upi"))
        assertTrue(TwmCheckoutUrlHelper.isUpiOrExternalScheme("phonepe://pay?pa=merchant@ybl"))
        assertTrue(TwmCheckoutUrlHelper.isUpiOrExternalScheme("paytmmp://pay?pa=merchant@paytm"))
        assertTrue(TwmCheckoutUrlHelper.isUpiOrExternalScheme("intent://pay/#Intent;scheme=upi;end"))

        assertFalse(TwmCheckoutUrlHelper.isUpiOrExternalScheme("https://pay.thewebsitemakers.in/checkout/123"))
        assertFalse(TwmCheckoutUrlHelper.isUpiOrExternalScheme("http://localhost:5173/payment-status"))
        assertFalse(TwmCheckoutUrlHelper.isUpiOrExternalScheme(""))
        assertFalse(TwmCheckoutUrlHelper.isUpiOrExternalScheme(null))
    }

    @Test
    fun `isTwmReturnUrl matches payment-status routes and signed return URLs`() {
        assertTrue(
            TwmCheckoutUrlHelper.isTwmReturnUrl(
                "https://www.tiffzy.com/payment-status?order_ref=TWM_1_42_1&status=paid&amount_paise=10000&txn=UTR1&signature=abc",
                null
            )
        )
        assertTrue(
            TwmCheckoutUrlHelper.isTwmReturnUrl(
                "https://custom.tiffzy.com/cb?order_ref=TWM_1_42_1&status=utr_submitted&signature=def",
                "https://custom.tiffzy.com/cb"
            )
        )
        assertFalse(
            TwmCheckoutUrlHelper.isTwmReturnUrl(
                "https://pay.thewebsitemakers.in/checkout/TWM_1_42_1",
                "https://www.tiffzy.com/payment-status"
            )
        )
    }

    @Test
    fun `extractTwmReturnParams parses standard and malformed double question mark queries`() {
        val standard = TwmCheckoutUrlHelper.extractTwmReturnParams(
            "https://www.tiffzy.com/payment-status?order_ref=TWM_1_10_1&status=paid&amount_paise=24950&txn=UTR123&signature=sig789"
        )
        assertNotNull(standard)
        assertEquals("TWM_1_10_1", standard?.orderRef)
        assertEquals("paid", standard?.status)
        assertEquals("24950", standard?.amountPaise)
        assertEquals("UTR123", standard?.txn)
        assertEquals("sig789", standard?.signature)

        val malformed = TwmCheckoutUrlHelper.extractTwmReturnParams(
            "https://www.tiffzy.com/payment-status?provider=twm_pay?order_ref=TWM_1_10_2&status=utr_submitted&amount_paise=15000&txn=UTR999&signature=sig456"
        )
        assertNotNull(malformed)
        assertEquals("TWM_1_10_2", malformed?.orderRef)
        assertEquals("utr_submitted", malformed?.status)
        assertEquals("15000", malformed?.amountPaise)
        assertEquals("UTR999", malformed?.txn)
        assertEquals("sig456", malformed?.signature)
    }

    @Test
    fun `isSafeHttpUrl rejects javascript and file schemes`() {
        assertTrue(TwmCheckoutUrlHelper.isSafeHttpUrl("https://pay.thewebsitemakers.in/checkout/abc"))
        assertTrue(TwmCheckoutUrlHelper.isSafeHttpUrl("http://localhost:5000/checkout"))
        assertFalse(TwmCheckoutUrlHelper.isSafeHttpUrl("javascript:alert(1)"))
        assertFalse(TwmCheckoutUrlHelper.isSafeHttpUrl("file:///etc/passwd"))
        assertFalse(TwmCheckoutUrlHelper.isSafeHttpUrl("upi://pay"))
    }

    @Test
    fun `CashfreeCreateOrderResponse resolves both camelCase and snake_case TWM Pay fields`() {
        val snakeResponse = CashfreeCreateOrderResponse(
            provider = "TWM_PAY",
            orderId = "42",
            checkoutUrlSnake = "https://pay.thewebsitemakers.in/checkout/TWM_1",
            orderRefSnake = "TWM_1"
        )
        assertEquals("https://pay.thewebsitemakers.in/checkout/TWM_1", snakeResponse.resolvedCheckoutUrl())
        assertEquals("TWM_1", snakeResponse.resolvedOrderRef())
        assertEquals("42", snakeResponse.resolvedOrderId())
        assertTrue(PaymentResultStatus.values().contains(PaymentResultStatus.HOSTED_CHECKOUT_READY))
    }

    @Test
    fun `mapTwmOutcomeStatus enforces non-paid pending and terminal transitions accurately`() {
        assertEquals(
            PaymentResultStatus.SUCCESS,
            TwmCheckoutUrlHelper.mapTwmOutcomeStatus(verified = true, paymentStatus = "PAID", gatewayStatus = "PAID")
        )
        assertEquals(
            PaymentResultStatus.PENDING,
            TwmCheckoutUrlHelper.mapTwmOutcomeStatus(verified = false, paymentStatus = "PENDING", gatewayStatus = "UTR_SUBMITTED")
        )
        assertEquals(
            PaymentResultStatus.PENDING,
            TwmCheckoutUrlHelper.mapTwmOutcomeStatus(verified = false, paymentStatus = "PENDING", gatewayStatus = "CREATED", allowPollIfPending = true)
        )
        assertEquals(
            PaymentResultStatus.CANCELLED,
            TwmCheckoutUrlHelper.mapTwmOutcomeStatus(verified = false, paymentStatus = "PENDING", gatewayStatus = "CREATED", allowPollIfPending = false)
        )
        assertEquals(
            PaymentResultStatus.FAILED,
            TwmCheckoutUrlHelper.mapTwmOutcomeStatus(verified = false, paymentStatus = "FAILED", gatewayStatus = "REJECTED")
        )
        assertEquals(
            PaymentResultStatus.FAILED,
            TwmCheckoutUrlHelper.mapTwmOutcomeStatus(verified = false, paymentStatus = "PENDING", gatewayStatus = "EXPIRED")
        )
    }

    @Test
    fun `WalletTopupCreateResponse and TopupStep resolve TWM Pay fields cleanly`() {
        val res = WalletTopupCreateResponse(
            success = true,
            provider = "twm_pay",
            topupTxnId = "TOPUP_9_400",
            orderRef = "TOPUP_9_400",
            checkoutUrl = "https://pay.thewebsitemakers.in/checkout/TOPUP_9_400",
            session = WalletTopupSession(
                topupTxnId = "TOPUP_9_400",
                amount = 250.0,
                provider = "TWM_PAY"
            )
        )
        assertEquals("TWM_PAY", res.resolvedProvider)
        assertEquals("TOPUP_9_400", res.resolvedTopupTxnId)
        assertEquals("TOPUP_9_400", res.resolvedGatewayOrderId)
        assertEquals("https://pay.thewebsitemakers.in/checkout/TOPUP_9_400", res.resolvedCheckoutUrl)

        val checkoutStep = TopupStep.TwmCheckout(
            topupTxnId = "TOPUP_9_400",
            orderRef = "TOPUP_9_400",
            checkoutUrl = res.resolvedCheckoutUrl!!,
            amount = 250.0,
            returnUrlPrefix = "https://tiffzy.com/profile/wallet"
        )
        assertEquals("TOPUP_9_400", checkoutStep.orderRef)

        val pendingUtr = TopupStep.Pending(
            topupTxnId = "TOPUP_9_400",
            orderRef = "TOPUP_9_400",
            amount = 250.0,
            gatewayStatus = "UTR_SUBMITTED",
            message = "UTR submitted — verifying UPI payment"
        )
        assertEquals("UTR_SUBMITTED", pendingUtr.gatewayStatus)
    }
}
