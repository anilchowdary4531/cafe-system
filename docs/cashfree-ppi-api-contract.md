# CASHFREE PPI API CONTRACT & INTEGRATION SPECIFICATION

**Document Version**: 2.0.0-PHASE2  
**Status**: SPECIFICATION & CONTRACT AUDIT (Pending Cashfree Ticket ID: 8374090)  
**Target Backend**: Tiffzy Food Delivery Platform (Fastify + Prisma + Node.js)

---

## 1. Global API Conventions

### Base URLs
- **Sandbox Environment**: `https://sandbox.cashfree.com/ppi`
- **Production Environment**: `https://api.cashfree.com/ppi`

### Required Request Headers
All server-to-server requests sent from Tiffzy Backend to Cashfree PPI API must contain:

```http
Content-Type: application/json
x-client-id: <CASHFREE_PPI_CLIENT_ID>
x-client-secret: <CASHFREE_PPI_CLIENT_SECRET>
x-api-version: 2023-03-01
```

*Note: Credentials must NEVER be embedded in source code or exposed to client applications.*

---

## 2. Cashfree PPI API Endpoints Contract

### 2.1 Create PPI User
- **HTTP Method**: `POST`
- **Endpoint**: `/ppi/users`
- **Tiffzy Service Function**: `createPpiUser({ phone, name, email, dob, gender })`
- **Request Payload**:
  ```json
  {
    "phone": "9177764632",
    "name": "Mahesh Babu",
    "email": "mahesh@example.com",
    "dob": "1995-08-15",
    "gender": "MALE"
  }
  ```
  - `phone` *(Required, String)*: 10-digit customer mobile number.
  - `name` *(Required, String)*: Full legal name.
  - `email` *(Optional, String)*: Customer email address.
- **Expected Success Response (200 / 201 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "cf_user_id": "cf_u_9847192847",
    "phone": "9177764632",
    "user_status": "ACTIVE",
    "kyc_status": "MIN_KYC",
    "created_at": "2026-09-13T17:23:00Z"
  }
  ```
- **Error Handling**: `400 Bad Request` (Invalid phone / duplicate user), `401 Unauthorized` (Invalid credentials).

---

### 2.2 Check Wallet Eligibility
- **HTTP Method**: `POST`
- **Endpoint**: `/ppi/wallets/eligibility`
- **Tiffzy Service Function**: `checkWalletEligibility({ phone })`
- **Request Payload**:
  ```json
  {
    "phone": "9177764632",
    "program_id": "<CASHFREE_PPI_PROGRAM_ID>"
  }
  ```
- **Expected Success Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "eligible": true,
    "kyc_required": false,
    "allowed_wallet_types": ["CLOSED_LOOP"]
  }
  ```

---

### 2.3 Create Wallet
- **HTTP Method**: `POST`
- **Endpoint**: `/ppi/wallets`
- **Tiffzy Service Function**: `createWallet({ cashfreePpiUserId, walletId, programId })`
- **Request Payload**:
  ```json
  {
    "cf_user_id": "cf_u_9847192847",
    "wallet_id": "tiffzy_w_104829",
    "program_id": "<CASHFREE_PPI_PROGRAM_ID>",
    "currency": "INR"
  }
  ```
  - `wallet_id` *(Required, String)*: **Server-generated** unique Tiffzy wallet string. Must be generated using secure random UUID / ID generator by Tiffzy backend.
- **Expected Success Response (200 / 201 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "cf_wallet_id": "cf_w_8741928374",
    "wallet_id": "tiffzy_w_104829",
    "cf_user_id": "cf_u_9847192847",
    "balance": 0.00,
    "currency": "INR",
    "wallet_status": "ACTIVE"
  }
  ```

---

### 2.4 Get Wallet Details & Balance
- **HTTP Method**: `GET`
- **Endpoint**: `/ppi/wallets/{wallet_id}`
- **Tiffzy Service Function**: `getWalletDetails({ cashfreeWalletId })`
- **Expected Success Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "cf_wallet_id": "cf_w_8741928374",
    "wallet_id": "tiffzy_w_104829",
    "balance": 450.00,
    "currency": "INR",
    "wallet_status": "ACTIVE"
  }
  ```

---

### 2.5 Get Wallet Statement
- **HTTP Method**: `GET`
- **Endpoint**: `/ppi/wallets/{wallet_id}/transactions?page_number=1&page_size=20`
- **Tiffzy Service Function**: `getWalletStatement({ cashfreeWalletId, page, limit })`
- **Expected Success Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "total_records": 12,
    "page_number": 1,
    "page_size": 20,
    "data": [
      {
        "transaction_id": "cf_txn_99214",
        "type": "DEBIT",
        "amount": 250.00,
        "balance_after": 450.00,
        "reference_id": "order_78192",
        "remark": "Tiffzy Order #78192",
        "created_at": "2026-09-13T16:30:00Z"
      }
    ]
  }
  ```

---

### 2.6 Credit PPI Wallet (Top-Up Fulfillment)
- **HTTP Method**: `POST`
- **Endpoint**: `/ppi/wallets/{wallet_id}/credit`
- **Tiffzy Service Function**: `creditWallet({ cashfreeWalletId, amount, referenceId, idempotencyKey, remark })`
- **Request Payload**:
  ```json
  {
    "amount": 500.00,
    "reference_id": "cf_pg_order_991823",
    "remark": "Wallet top-up via Cashfree PG",
    "idempotency_key": "topup_credit_991823"
  }
  ```
- **Expected Success Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "transaction_id": "cf_txn_881923",
    "wallet_id": "tiffzy_w_104829",
    "amount": 500.00,
    "balance_after": 950.00,
    "created_at": "2026-09-13T17:00:00Z"
  }
  ```

---

### 2.7 Debit PPI Wallet (Order Payment)
- **HTTP Method**: `POST`
- **Endpoint**: `/ppi/wallets/{wallet_id}/debit`
- **Tiffzy Service Function**: `debitWallet({ cashfreeWalletId, amount, orderId, idempotencyKey, remark })`
- **Request Payload**:
  ```json
  {
    "amount": 250.00,
    "order_id": "78192",
    "remark": "Tiffzy Food Order #78192",
    "idempotency_key": "debit_order_78192"
  }
  ```
- **Expected Success Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "transaction_id": "cf_txn_99214",
    "wallet_id": "tiffzy_w_104829",
    "amount": 250.00,
    "balance_after": 700.00,
    "created_at": "2026-09-13T17:15:00Z"
  }
  ```

---

### 2.8 Refund to PPI Wallet
- **HTTP Method**: `POST`
- **Endpoint**: `/ppi/wallets/{wallet_id}/refund`
- **Tiffzy Service Function**: `refundWallet({ cashfreeWalletId, amount, originalTxnId, refundId, idempotencyKey })`
- **Request Payload**:
  ```json
  {
    "amount": 250.00,
    "original_transaction_id": "cf_txn_99214",
    "refund_id": "ref_order_78192",
    "idempotency_key": "refund_78192"
  }
  ```
- **Expected Success Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "refund_id": "ref_order_78192",
    "transaction_id": "cf_txn_102938",
    "wallet_id": "tiffzy_w_104829",
    "amount": 250.00,
    "balance_after": 950.00,
    "created_at": "2026-09-13T17:20:00Z"
  }
  ```

---

## 3. Webhook Signature Verification Contract

- **Endpoint**: `POST /api/v1/wallet/ppi/webhook`
- **Headers Received from Cashfree PPI**:
  ```http
  x-webhook-signature: <HMAC_SHA256_BASE64_SIGNATURE>
  x-webhook-timestamp: <UNIX_TIMESTAMP_MS>
  ```
- **Verification Algorithm**:
  1. Compute raw string: `timestamp + "." + rawBodyPayload`
  2. Generate HMAC SHA-256 using `CASHFREE_PPI_CLIENT_SECRET` (or dedicated Webhook Secret).
  3. Compare computed digest against `x-webhook-signature` using `crypto.timingSafeEqual`.
  4. Reject requests if signature mismatch or timestamp delta > 300 seconds.

---

## 4. Pending Ticket ID 8374090 Dependencies

The following values MUST be supplied by Cashfree before live execution:
- `CASHFREE_PPI_CLIENT_ID`
- `CASHFREE_PPI_CLIENT_SECRET`
- `CASHFREE_PPI_PROGRAM_ID` (`cf_program_id`)
- Final approved KYC fields specification.
