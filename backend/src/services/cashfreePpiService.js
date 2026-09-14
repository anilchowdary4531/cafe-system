/**
 * Cashfree PPI (Prepaid Payment Instruments) Service Skeleton
 *
 * NOTE: Preparation service module for future Cashfree PPI closed-loop wallet integration.
 * Pending official onboarding approval from Cashfree (Ticket ID: 8374090).
 *
 * DO NOT call Cashfree PPI APIs until official PPI credentials and program ID are configured.
 */

import { isPpiConfigured, getPpiConfigStatus } from "../config/cashfreePpi.config.js";

const NOT_CONFIGURED_ERROR = "Cashfree PPI integration is not configured. Awaiting credentials and cf_program_id from Cashfree (Ticket ID: 8374090).";

/**
 * Helper to ensure PPI is configured before attempting operations
 */
const assertPpiConfigured = () => {
  if (!isPpiConfigured()) {
    throw new Error(NOT_CONFIGURED_ERROR);
  }
};

/**
 * 1. Create PPI User
 * Expected Cashfree Endpoint: POST /ppi/users
 * Cashfree Doc: https://www.cashfree.com/docs/api-reference/prepaid-payment-instruments/user-management/create-ppi-user
 *
 * @param {object} params
 * @param {string} params.phone - Customer 10-digit mobile phone
 * @param {string} params.name - Customer full name
 * @param {string} params.email - Customer email address
 * @returns {Promise<never>}
 */
export const createPpiUser = async ({ phone, name, email }) => {
  assertPpiConfigured();
  throw new Error("createPpiUser: API integration pending Cashfree PPI program activation.");
};

/**
 * 2. Check Wallet Eligibility
 * Expected Cashfree Endpoint: POST /ppi/wallets/eligibility
 * Cashfree Doc: https://www.cashfree.com/docs/api-reference/prepaid-payment-instruments/wallet-management/check-wallet-eligibility
 *
 * @param {object} params
 * @param {string} params.phone - Customer mobile phone
 * @returns {Promise<never>}
 */
export const checkWalletEligibility = async ({ phone }) => {
  assertPpiConfigured();
  throw new Error("checkWalletEligibility: API integration pending Cashfree PPI program activation.");
};

/**
 * 3. Create PPI Wallet
 * Expected Cashfree Endpoint: POST /ppi/wallets
 * Cashfree Doc: https://www.cashfree.com/docs/api-reference/prepaid-payment-instruments/wallet-management/create-wallet
 *
 * @param {object} params
 * @param {string} params.cashfreePpiUserId - Cashfree PPI User ID
 * @param {string} [params.programId] - Cashfree Program ID (cf_program_id)
 * @returns {Promise<never>}
 */
export const createWallet = async ({ cashfreePpiUserId, programId }) => {
  assertPpiConfigured();
  throw new Error("createWallet: API integration pending Cashfree PPI program activation.");
};

/**
 * 4. Get Wallet Details & Balance
 * Expected Cashfree Endpoint: GET /ppi/wallets/{wallet_id}
 *
 * @param {object} params
 * @param {string} params.cashfreeWalletId - Cashfree Wallet ID
 * @returns {Promise<never>}
 */
export const getWalletDetails = async ({ cashfreeWalletId }) => {
  assertPpiConfigured();
  throw new Error("getWalletDetails: API integration pending Cashfree PPI program activation.");
};

/**
 * 5. Get Wallet Transaction Statement
 * Expected Cashfree Endpoint: GET /ppi/wallets/{wallet_id}/transactions
 *
 * @param {object} params
 * @param {string} params.cashfreeWalletId - Cashfree Wallet ID
 * @param {number} [params.page] - Page index
 * @param {number} [params.limit] - Page limit
 * @returns {Promise<never>}
 */
export const getWalletStatement = async ({ cashfreeWalletId, page, limit }) => {
  assertPpiConfigured();
  throw new Error("getWalletStatement: API integration pending Cashfree PPI program activation.");
};

/**
 * 6. Credit PPI Wallet (Top-Up fulfillment)
 * Expected Cashfree Endpoint: POST /ppi/wallets/{wallet_id}/credit
 *
 * @param {object} params
 * @param {string} params.cashfreeWalletId - Cashfree Wallet ID
 * @param {number} params.amount - Amount in INR to credit
 * @param {string} params.gatewayPaymentId - Verified Cashfree PG Payment ID
 * @param {string} params.idempotencyKey - Transaction idempotency key
 * @returns {Promise<never>}
 */
export const creditWallet = async ({ cashfreeWalletId, amount, gatewayPaymentId, idempotencyKey }) => {
  assertPpiConfigured();
  throw new Error("creditWallet: API integration pending Cashfree PPI program activation.");
};

/**
 * 7. Debit PPI Wallet (Order Payment)
 * Expected Cashfree Endpoint: POST /ppi/wallets/{wallet_id}/debit
 *
 * @param {object} params
 * @param {string} params.cashfreeWalletId - Cashfree Wallet ID
 * @param {number} params.amount - Order amount in INR to debit
 * @param {string} params.orderId - Tiffzy backend Order ID
 * @param {string} params.idempotencyKey - Transaction idempotency key
 * @returns {Promise<never>}
 */
export const debitWallet = async ({ cashfreeWalletId, amount, orderId, idempotencyKey }) => {
  assertPpiConfigured();
  throw new Error("debitWallet: API integration pending Cashfree PPI program activation.");
};

/**
 * 8. Refund to PPI Wallet
 * Expected Cashfree Endpoint: POST /ppi/wallets/{wallet_id}/refund
 *
 * @param {object} params
 * @param {string} params.cashfreeWalletId - Cashfree Wallet ID
 * @param {number} params.amount - Refund amount in INR
 * @param {string} params.originalDebitTxnId - Original PPI Debit Transaction ID
 * @param {string} params.idempotencyKey - Refund idempotency key
 * @returns {Promise<never>}
 */
export const refundWallet = async ({ cashfreeWalletId, amount, originalDebitTxnId, idempotencyKey }) => {
  assertPpiConfigured();
  throw new Error("refundWallet: API integration pending Cashfree PPI program activation.");
};

/**
 * Diagnostic Service Status check
 * @returns {object}
 */
export const getPpiServiceStatus = () => {
  return getPpiConfigStatus();
};
