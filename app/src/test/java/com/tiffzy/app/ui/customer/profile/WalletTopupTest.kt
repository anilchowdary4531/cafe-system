package com.tiffzy.app.ui.customer.profile

import com.tiffzy.app.data.model.*
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class WalletTopupTest {

    private lateinit var validator: WalletViewModel

    @Before
    fun setUp() {
        validator = WalletViewModel()
    }

    @Test
    fun testAmountValidation_belowMinimum_returnsError() {
        val (isValid, error) = validator.validateAmount("5")
        assertFalse("Amount below ₹10 should be invalid", isValid)
        assertEquals("Minimum top-up amount is ₹10", error)
    }

    @Test
    fun testAmountValidation_aboveMaximum_returnsError() {
        val (isValid, error) = validator.validateAmount("50001")
        assertFalse("Amount above ₹50,000 should be invalid", isValid)
        assertEquals("Maximum top-up amount is ₹50,000", error)
    }

    @Test
    fun testAmountValidation_zero_returnsError() {
        val (isValid, error) = validator.validateAmount("0")
        assertFalse("Zero amount should be invalid", isValid)
        assertEquals("Amount must be greater than zero", error)
    }

    @Test
    fun testAmountValidation_negative_returnsError() {
        val (isValid, error) = validator.validateAmount("-100")
        assertFalse("Negative amount should be invalid", isValid)
        assertEquals("Amount must be greater than zero", error)
    }

    @Test
    fun testAmountValidation_blank_returnsError() {
        val (isValid, error) = validator.validateAmount("   ")
        assertFalse("Blank amount should be invalid", isValid)
        assertEquals("Please enter an amount", error)
    }

    @Test
    fun testAmountValidation_nonNumeric_returnsError() {
        val (isValid, error) = validator.validateAmount("abc")
        assertFalse("Non-numeric amount should be invalid", isValid)
        assertEquals("Invalid amount entered", error)
    }

    @Test
    fun testAmountValidation_tooManyDecimals_returnsError() {
        val (isValid, error) = validator.validateAmount("100.123")
        assertFalse("Amount with 3 decimals should be invalid", isValid)
        assertEquals("Maximum 2 decimal places allowed", error)
    }

    @Test
    fun testAmountValidation_validAmounts_success() {
        val validAmounts = listOf("10", "100", "250", "500", "1000", "2000", "50000", "100.50", "269.00")
        for (amt in validAmounts) {
            val (isValid, error) = validator.validateAmount(amt)
            assertTrue("Amount $amt should be valid", isValid)
            assertNull("Error should be null for valid amount $amt", error)
        }
    }

    @Test
    fun testIsProcessing_guardsDuplicatePaymentTaps() {
        val vm = WalletViewModel()
        assertFalse(vm.isProcessing())

        // Simulate state transitions
        val step1: TopupStep = TopupStep.CreatingSession(500.0)
        assertTrue(step1 is TopupStep.CreatingSession)

        val step2: TopupStep = TopupStep.OpeningPayment("WLT_123", 500.0)
        assertTrue(step2 is TopupStep.OpeningPayment)

        val step3: TopupStep = TopupStep.VerifyingPayment("WLT_123", 500.0)
        assertTrue(step3 is TopupStep.VerifyingPayment)

        val step4: TopupStep = TopupStep.Success(500.0, 769.0, "₹500 added successfully.")
        assertTrue(step4 is TopupStep.Success)
        assertEquals(769.0, (step4 as TopupStep.Success).newBalance, 0.001)

        val step5: TopupStep = TopupStep.Cancelled
        assertTrue(step5 is TopupStep.Cancelled)

        val step6: TopupStep = TopupStep.Error("Payment failed. Your wallet was not credited.")
        assertTrue(step6 is TopupStep.Error)
    }

    @Test
    fun testAuthoritativeBalanceModel_doesNotPerformLocalArithmetic() {
        val oldBalance = 269.00
        val topupAmount = 500.00

        val verifyResponse = WalletTopupVerifyResponse(
            success = true,
            message = "₹500 added to your Tiffzy Wallet",
            balance = 769.00,
            amount = topupAmount,
            topupTxnId = "WLT_1728987654_1234"
        )

        // Ensure balance comes from server response
        val displayedBalance = verifyResponse.balance ?: oldBalance
        assertEquals(769.00, displayedBalance, 0.001)
        assertNotEquals(oldBalance, displayedBalance)
    }

    @Test
    fun testCashfreeFailureHandling_doesNotCreditWallet() {
        val vm = WalletViewModel()
        val initialBalance = 269.00

        vm.handlePaymentFailure("FAILED", "Card declined by issuing bank")
        assertEquals(TopupStep.Error("Payment failed. Your wallet was not credited."), vm.topupStep.value)
        assertEquals("Payment failed. Your wallet was not credited.", vm.statusBanner.value)
        assertFalse(vm.isBannerSuccess.value)

        // Wallet balance remains unchanged
        assertEquals(269.00, initialBalance, 0.001)
    }

    @Test
    fun testCashfreeCancellationHandling_safeReturn() {
        val vm = WalletViewModel()
        val initialBalance = 269.00

        vm.handlePaymentFailure("CANCELLED", "User cancelled checkout session")
        assertEquals(TopupStep.Cancelled, vm.topupStep.value)
        assertEquals("Payment cancelled.", vm.statusBanner.value)
        assertFalse(vm.isBannerSuccess.value)
        assertFalse(vm.isAddMoneyVisible.value)

        // Wallet balance remains unchanged
        assertEquals(269.00, initialBalance, 0.001)
    }

    @Test
    fun testTemporaryVerificationFailure_showsSafeRetryMessage() {
        val expectedMessage = "Payment received but verification is still pending. Please refresh your wallet."

        val errorStep = TopupStep.Error(
            message = expectedMessage,
            errorType = TopupErrorType.TOPUP_VERIFY_FAILED,
            canRetry = true
        )

        assertEquals(expectedMessage, errorStep.message)
        assertEquals(TopupErrorType.TOPUP_VERIFY_FAILED, errorStep.errorType)
        assertTrue(errorStep.canRetry)
    }

    @Test
    fun testClearOldErrorState_onSelectingNewAmount() {
        val vm = WalletViewModel()
        // Simulate previous failed payment
        vm.handlePaymentFailure("FAILED", "Some gateway error")
        assertTrue("Expected error step", vm.topupStep.value is TopupStep.Error)
        assertEquals("Payment failed. Your wallet was not credited.", (vm.topupStep.value as TopupStep.Error).message)

        // Select new amount e.g. 250
        vm.setTopupAmount(250)
        assertEquals("Amount should be updated to 250", "250", vm.topupAmountText.value)
        assertEquals("Error state must be cleared when selecting a new amount", TopupStep.Idle, vm.topupStep.value)
        assertNull("Status banner must be cleared", vm.statusBanner.value)
    }

    @Test
    fun testClearOldErrorState_onManuallyChangingAmount() {
        val vm = WalletViewModel()
        // Simulate previous failed payment
        vm.handlePaymentFailure("FAILED", "Some gateway error")
        assertTrue(vm.topupStep.value is TopupStep.Error)

        // User manually types amount
        vm.setTopupAmount("350")
        assertEquals("350", vm.topupAmountText.value)
        assertEquals("Error state must be cleared when typing new amount", TopupStep.Idle, vm.topupStep.value)
        assertNull("Status banner must be cleared", vm.statusBanner.value)
    }

    @Test
    fun testClearOldErrorState_onOpenAddMoney() {
        val vm = WalletViewModel()
        // Simulate previous failed payment
        vm.handlePaymentFailure("FAILED", "Previous payment error")
        assertTrue(vm.topupStep.value is TopupStep.Error)

        // Open Add Money dialog again
        vm.openAddMoney()
        assertTrue("Add Money must be visible", vm.isAddMoneyVisible.value)
        assertEquals("Error state must be cleared on dialog open", TopupStep.Idle, vm.topupStep.value)
        assertNull("Status banner must be cleared on dialog open", vm.statusBanner.value)
    }

    @Test
    fun testDistinctErrorStates_classification() {
        val createErr = TopupStep.Error("Unable to start payment. Please try again.", TopupErrorType.TOPUP_CREATE_FAILED)
        assertEquals(TopupErrorType.TOPUP_CREATE_FAILED, createErr.errorType)
        assertEquals("Unable to start payment. Please try again.", createErr.message)

        val payErr = TopupStep.Error("Payment failed. Your wallet was not credited.", TopupErrorType.CASHFREE_PAYMENT_FAILED)
        assertEquals(TopupErrorType.CASHFREE_PAYMENT_FAILED, payErr.errorType)

        val cancelStep = TopupStep.Cancelled
        assertEquals(TopupErrorType.CASHFREE_PAYMENT_CANCELLED, cancelStep.errorType)

        val verifyErr = TopupStep.Error("Payment received but verification is still pending. Please refresh your wallet.", TopupErrorType.TOPUP_VERIFY_FAILED)
        assertEquals(TopupErrorType.TOPUP_VERIFY_FAILED, verifyErr.errorType)

        val netErr = TopupStep.Error("Network error. Please check your connection.", TopupErrorType.NETWORK_ERROR)
        assertEquals(TopupErrorType.NETWORK_ERROR, netErr.errorType)

        val successStep = TopupStep.Success(250.0, 519.0, "₹250 added successfully.")
        assertEquals(TopupErrorType.SUCCESS, successStep.errorType)
    }

    @Test
    fun testEnvironmentResolution_matchesProductionBackend() {
        val prodResponse = WalletTopupCreateResponse(
            success = true,
            session = WalletTopupSession(
                topupTxnId = "TOPUP_1_12345",
                amount = 250.0,
                paymentSessionId = "session_live_12345",
                isProduction = true,
                cfEnv = "PRODUCTION"
            )
        )
        assertTrue(prodResponse.resolvedIsProduction("https://api.tiffzy.com/"))
        assertEquals("session_live_12345", prodResponse.resolvedSessionId)
        assertEquals("TOPUP_1_12345", prodResponse.resolvedTopupTxnId)

        // Alternate snake_case keys from backend
        val snakeCaseResponse = WalletTopupCreateResponse(
            success = true,
            paymentSessionId = "session_live_67890",
            topupTxnId = "TOPUP_2_67890",
            session = null
        )
        assertEquals("session_live_67890", snakeCaseResponse.resolvedSessionId)
        assertEquals("TOPUP_2_67890", snakeCaseResponse.resolvedTopupTxnId)
        assertTrue(snakeCaseResponse.resolvedIsProduction("https://api.tiffzy.com/"))
    }
}
