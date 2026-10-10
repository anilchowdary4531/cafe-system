# TIFFZY WALLET / PPI SANDBOX INTEGRATION — END-TO-END TEST REPORT

**Date**: October 9, 2026  
**Target Platform**: Tiffzy Food Platform (Node.js/Fastify + PostgreSQL/Prisma)  
**Test Environment**: Cashfree Sandbox Integration (`CASHFREE_ENVIRONMENT = sandbox`)  
**Overall Result**: **PASS** (100% Core Workflow & Security Validation Succeeded)

---

## 1. Environment & Test Execution Summary

| Parameter | Configuration / Value |
| :--- | :--- |
| **API Base URL** | `http://localhost:3000` |
| **Test Customer Account ID** | `58` |
| **Test Customer Phone** | `9000000001` |
| **Wallet ID** | `3` |
| **Cashfree PPI Environment** | `SANDBOX` |
| **Program ID** | `19222` |
| **Top-up Session ID** | `TOPUP_3_1791525467844` |
| **Test Order ID** | `922` (Amount: ₹150.00) |
| **Initial Wallet Balance** | ₹2500.00 |
| **Post-Topup Balance (+₹500)** | ₹3000.00 |
| **Post-Order Balance (-₹150)** | ₹2850.00 |
| **Post-Refund Balance (+₹150)** | ₹3000.00 |

---

## 2. End-to-End Test Matrix & Lifecycle Results

| Step # | Test Description | Trigger / Route | Expected Result | Actual Result | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | **Initial Wallet Balance** | `GET /api/wallet` | HTTP 200, valid wallet summary | Balance: ₹2500.00, Status: ACTIVE | ✅ **PASS** |
| **2** | **Transaction History** | `GET /api/wallet/transactions` | HTTP 200, paginated ledger list | Returned ledger array | ✅ **PASS** |
| **3** | **Top-Up Session Creation** | `POST /api/wallet/topup/create` (₹500) | HTTP 200, topupTxnId generated, PENDING in DB | `TOPUP_3_1791525467844` created | ✅ **PASS** |
| **4** | **Rejection of Below Min ₹10** | `POST /api/wallet/topup/create` (₹9) | HTTP 400 error | Rejection message: "Minimum top-up amount is ₹10" | ✅ **PASS** |
| **5** | **Rejection of Negative Topup** | `POST /api/wallet/topup/create` (-₹100) | HTTP 400 error | Rejection message: "Minimum top-up amount is ₹10" | ✅ **PASS** |
| **6** | **Rejection of Above Max Limit**| `POST /api/wallet/topup/create` (₹50,001) | HTTP 400 error | Rejection message: "Maximum single top-up limit is ₹50000" | ✅ **PASS** |
| **7** | **Balance Unchanged Check** | `GET /api/wallet` | Balance unchanged before payment | Balance remained unchanged | ✅ **PASS** |
| **8** | **Verify & Credit Top-Up** | `POST /api/wallet/topup/verify` | HTTP 200, Wallet.balance += ₹500 | Balance: ₹2500 -> ₹3000 | ✅ **PASS** |
| **9** | **Webhook / Topup Idempotency**| Duplicate `/api/wallet/topup/verify` | HTTP 200, no double-credit | Balance remained ₹3000 | ✅ **PASS** |
| **10** | **Food Order Wallet Payment** | `POST /api/wallet/pay-order` (₹150) | HTTP 200, Wallet.balance -= ₹150 | Balance: ₹3000 -> ₹2850, Order PAID | ✅ **PASS** |
| **11** | **Duplicate Order Payment** | Duplicate `/api/wallet/pay-order` | HTTP 400 error, no double-debit | Error: "Order has already been paid", Balance: ₹2850 | ✅ **PASS** |
| **12** | **Order Refund to Wallet** | `refundOrderToWallet()` | HTTP 200, Wallet.balance += ₹150 | Balance: ₹2850 -> ₹3000, Order REFUNDED | ✅ **PASS** |

---

## 3. Database Ledger Audit Sequence

The PostgreSQL database `wallet_ledgers` table logged the exact immutable financial sequence:

```
1. [WALLET_TOPUP] CREDIT ₹500 | Balance: ₹0    -> ₹500  | Ref: TOPUP_3_1791525218550 (SUCCESS)
2. [WALLET_TOPUP] CREDIT ₹500 | Balance: ₹500  -> ₹1000 | Ref: TOPUP_3_1791525269660 (SUCCESS)
3. [WALLET_TOPUP] CREDIT ₹500 | Balance: ₹1000 -> ₹1500 | Ref: TOPUP_3_1791525331611 (SUCCESS)
4. [WALLET_TOPUP] CREDIT ₹500 | Balance: ₹1500 -> ₹2000 | Ref: TOPUP_3_1791525374213 (SUCCESS)
5. [WALLET_TOPUP] CREDIT ₹500 | Balance: ₹2000 -> ₹2500 | Ref: TOPUP_3_1791525432214 (SUCCESS)
6. [ORDER_PAYMENT] DEBIT ₹150 | Balance: ₹2500 -> ₹2350 | Ref: Order #921            (SUCCESS)
7. [REFUND]       CREDIT ₹150 | Balance: ₹2350 -> ₹2500 | Ref: Order #921            (SUCCESS)
8. [WALLET_TOPUP] CREDIT ₹500 | Balance: ₹2500 -> ₹3000 | Ref: TOPUP_3_1791525467844 (SUCCESS)
9. [ORDER_PAYMENT] DEBIT ₹150 | Balance: ₹3000 -> ₹2850 | Ref: Order #922            (SUCCESS)
10.[REFUND]       CREDIT ₹150 | Balance: ₹2850 -> ₹3000 | Ref: Order #922            (SUCCESS)
```

---

## 4. Security & Compliance Verification

1. ✅ **Zero Client Secret Exposure**: Inspected frontend environment variables and responses. No Cashfree client secrets exist in client-side code.
2. ✅ **Authoritative Price Enforcement**: Order totals are retrieved from `Order.total` in PostgreSQL database. Client price parameter manipulation attempts are ignored.
3. ✅ **Multi-Layer Idempotency**: Unique DB constraint `idempotencyKey` on `wallet_ledgers` and `wallet_topups` prevents double-crediting or double-debiting.
4. ✅ **Customer Account Isolation**: Requests validate authenticated customer account context (`req.customerAccount.id`).

---

## 5. Acceptance Criteria Matrix

- [x] New customer wallet initialized correctly at ₹0
- [x] Valid ₹500 Cashfree Sandbox top-up session generated
- [x] Top-up verification credits wallet balance atomically
- [x] WalletLedger contains exactly one ₹500 CREDIT record per top-up
- [x] Duplicate top-up verification does not double-credit
- [x] Invalid ₹9 top-up rejected
- [x] Negative top-up rejected
- [x] ₹50,001 top-up rejected
- [x] Food order wallet checkout debits ₹150 atomically
- [x] Duplicate order payment call rejected without double-debit
- [x] Order cancellation refund credits ₹150 back to wallet
- [x] Database Wallet balance and WalletLedger remain 100% consistent
- [x] Cashfree client secrets never reached frontend or client logs

---

## 6. Final Status
**OVERALL RESULT**: **PASS**
