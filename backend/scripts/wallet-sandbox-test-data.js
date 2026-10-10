/**
 * Wallet Sandbox Test Data & Scenario Definition
 * Safe specification script for Cashfree PPI / Tiffzy Wallet Sandbox Testing.
 * DOES NOT MODIFY FINANCIAL BALANCES OR INSERT FAKE RECORDS.
 */

export const SANDBOX_TEST_CUSTOMER = {
    name: "Tiffzy Wallet Sandbox Test User",
    email: "sandbox.wallet.test@tiffzy.com",
    phone: "9876543210",
    isSandboxData: true,
};

export const SANDBOX_TEST_AMOUNTS = {
    VALID_TOPUP: 500,
    VALID_ORDER: 150,
    EXPECTED_BALANCE_AFTER_TOPUP: 500,
    EXPECTED_BALANCE_AFTER_ORDER: 350,
    EXPECTED_BALANCE_AFTER_REFUND: 500,
};

export const SANDBOX_NEGATIVE_AMOUNTS = [
    { amount: 9, description: "Below minimum ₹10 limit", expectedResult: "REJECTED" },
    { amount: -100, description: "Negative top-up amount", expectedResult: "REJECTED" },
    { amount: 50001, description: "Above single top-up limit ₹50,000", expectedResult: "REJECTED" },
];

export const PRINT_SANDBOX_TEST_MATRIX = () => {
    console.log("==================================================");
    console.log("TIFFZY WALLET / PPI SANDBOX TEST SPECIFICATION");
    console.log("==================================================");
    console.log("Test Customer:", SANDBOX_TEST_CUSTOMER);
    console.log("Valid Amounts:", SANDBOX_TEST_AMOUNTS);
    console.log("Negative Test Cases:", SANDBOX_NEGATIVE_AMOUNTS);
    console.log("==================================================");
};

if (process.argv[1]?.endsWith("wallet-sandbox-test-data.js")) {
    PRINT_SANDBOX_TEST_MATRIX();
}
