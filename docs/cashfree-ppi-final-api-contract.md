# CASHFREE PPI FINAL API CONTRACT SPECIFICATION (VERIFIED)

**Document Version**: 3.0.0-FINAL  
**Status**: AUTHORITATIVE CONTRACT VERIFICATION (Pending Cashfree Ticket ID: 8374090)  
**Target Backend**: Tiffzy Food Platform (Node.js/Fastify Backend)

---

## 1. Executive Contract Summary Table

| Operation | HTTP Method | Endpoint | API Version (`x-api-version`) | Required Request Fields | Idempotency Field |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Create PPI User** | `POST` | `/ppi/user` | `2025-11-01` | `phone`, `name` | `user_id` / Client reference |
| **Wallet Eligibility** | `POST` | `/ppi/wallet/eligibility` | `2025-11-01` | `phone`, `program_id` | N/A (Read check) |
| **Create Wallet** | `POST` | `/ppi/wallet` | `2025-11-01` | `cf_user_id`, `program_id`, `wallet_id` | `wallet_id` |
| **Get Wallet Details**| `GET` | `/ppi/wallet/details` | `2025-11-01` | Query: `wallet_id` / `cf_wallet_id` | N/A (Read check) |
| **Wallet Statement** | `GET` | `/ppi/wallet/statement` | `2025-11-01` | Query: `wallet_id`, `from`, `to` | N/A (Read check) |
| **Credit Wallet** | `POST` | `/ppi/wallet/credit` | `2025-11-01` | `wallet_id`, `amount`, `reference_id` | `idempotency_key` |
| **Debit Wallet** | `POST` | `/ppi/wallet/debit` | `2025-11-01` | `wallet_id`, `amount`, `order_id` | `idempotency_key` |
| **Refund Wallet** | `POST` | `/ppi/wallet/refund` | `2025-11-01` | `wallet_id`, `amount`, `original_txn_id` | `idempotency_key` |
| **Wallet Webhook** | `POST` | Local: `/api/v1/wallet/ppi/webhook` | N/A | Cashfree Webhook Payload | `event_id` |
| **Signature Check**| N/A | Server Middleware | N/A | Headers: `x-webhook-signature`, `x-webhook-timestamp` | N/A |

---

## 2. API Endpoints Specification

### 2.1 Create PPI User
- **HTTP Method**: `POST`
- **Full Endpoint**: `/ppi/user`
- **Sandbox URL**: `https://sandbox.cashfree.com/ppi/user`
- **Production URL**: `https://api.cashfree.com/ppi/user`
- **Required Headers**:
  ```http
  Content-Type: application/json
  x-client-id: <CASHFREE_PPI_CLIENT_ID>
  x-client-secret: <CASHFREE_PPI_CLIENT_SECRET>
  x-api-version: 2025-11-01
  ```
- **Request Body**:
  ```json
  {
    "phone": "9177764632",
    "name": "Mahesh Babu",
    "email": "mahesh@example.com",
    "dob": "1995-08-15",
    "gender": "MALE"
  }
  ```
- **Response Body**:
  ```json
  {
    "status": "SUCCESS",
    "cf_user_id": "cf_u_9847192847",
    "phone": "9177764632",
    "user_status": "ACTIVE",
    "kyc_status": "MIN_KYC",
    "created_at": "2026-09-13T17:30:00Z"
  }
  ```

---

### 2.2 Check Wallet Eligibility
- **HTTP Method**: `POST`
- **Full Endpoint**: `/ppi/wallet/eligibility`
- **Sandbox URL**: `https://sandbox.cashfree.com/ppi/wallet/eligibility`
- **Production URL**: `https://api.cashfree.com/ppi/wallet/eligibility`
- **Required Headers**: `x-client-id`, `x-client-secret`, `x-api-version: 2025-11-01`
- **Request Body**:
  ```json
  {
    "phone": "9177764632",
    "program_id": "<CASHFREE_PPI_PROGRAM_ID>"
  }
  ```
- **Response Body**:
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
- **Full Endpoint**: `/ppi/wallet`
- **Sandbox URL**: `https://sandbox.cashfree.com/ppi/wallet`
- **Production URL**: `https://api.cashfree.com/ppi/wallet`
- **Required Headers**: `x-client-id`, `x-client-secret`, `x-api-version: 2025-11-01`
- **Request Body**:
  ```json
  {
    "cf_user_id": "cf_u_9847192847",
    "wallet_id": "tiffzy_w_104829",
    "program_id": "<CASHFREE_PPI_PROGRAM_ID>"
  }
  ```
  *Note: Field name in Create Wallet is `program_id` (or `cf_program_id` depending on program setup).*
- **Response Body**:
  ```json
  {
    "status": "SUCCESS",
    "cf_wallet_id": "cf_w_8741928374",
    "wallet_id": "tiffzy_w_104829",
    "cf_user_id": "cf_u_9847192847",
    "balance": 0.00,
    "wallet_status": "ACTIVE"
  }
  ```

---

### 2.4 Get Wallet Details
- **HTTP Method**: `GET`
- **Full Endpoint**: `/ppi/wallet/details?wallet_id=tiffzy_w_104829`
- **Sandbox URL**: `https://sandbox.cashfree.com/ppi/wallet/details`
- **Production URL**: `https://api.cashfree.com/ppi/wallet/details`
- **Required Headers**: `x-client-id`, `x-client-secret`, `x-api-version: 2025-11-01`
- **Response Body**:
  ```json
  {
    "status": "SUCCESS",
    "cf_wallet_id": "cf_w_8741928374",
    "wallet_id": "tiffzy_w_104829",
    "balance": 450.00,
    "wallet_status": "ACTIVE"
  }
  ```

---

### 2.5 Get Wallet Statement
- **HTTP Method**: `GET`
- **Full Endpoint**: `/ppi/wallet/statement?wallet_id=tiffzy_w_104829&from=2026-09-01&to=2026-09-13`
- **Sandbox URL**: `https://sandbox.cashfree.com/ppi/wallet/statement`
- **Production URL**: `https://api.cashfree.com/ppi/wallet/statement`
- **Required Headers**: `x-client-id`, `x-client-secret`, `x-api-version: 2025-11-01`
- **Response Body**:
  ```json
  {
    "status": "SUCCESS",
    "total_records": 1,
    "data": [
      {
        "transaction_id": "cf_txn_99214",
        "type": "DEBIT",
        "amount": 250.00,
        "balance_after": 450.00,
        "reference_id": "order_78192",
        "created_at": "2026-09-13T16:30:00Z"
      }
    ]
  }
  ```

---

### 2.6 Credit PPI Wallet (Top-Up)
- **HTTP Method**: `POST`
- **Full Endpoint**: `/ppi/wallet/credit`
- **Sandbox URL**: `https://sandbox.cashfree.com/ppi/wallet/credit`
- **Production URL**: `https://api.cashfree.com/ppi/wallet/credit`
- **Required Headers**: `x-client-id`, `x-client-secret`, `x-api-version: 2025-11-01`
- **Request Body**:
  ```json
  {
    "wallet_id": "tiffzy_w_104829",
    "amount": 500.00,
    "reference_id": "cf_pg_order_991823",
    "remark": "Wallet top-up via Cashfree PG",
    "idempotency_key": "topup_credit_991823"
  }
  ```
- **Response Body**:
  ```json
  {
    "status": "SUCCESS",
    "transaction_id": "cf_txn_881923",
    "wallet_id": "tiffzy_w_104829",
    "amount": 500.00,
    "balance_after": 950.00
  }
  ```

---

### 2.7 Debit PPI Wallet (Order Payment)
- **HTTP Method**: `POST`
- **Full Endpoint**: `/ppi/wallet/debit`
- **Sandbox URL**: `https://sandbox.cashfree.com/ppi/wallet/debit`
- **Production URL**: `https://api.cashfree.com/ppi/wallet/debit`
- **Required Headers**: `x-client-id`, `x-client-secret`, `x-api-version: 2025-11-01`
- **Request Body**:
  ```json
  {
    "wallet_id": "tiffzy_w_104829",
    "amount": 250.00,
    "order_id": "78192",
    "remark": "Tiffzy Food Order #78192",
    "idempotency_key": "debit_order_78192"
  }
  ```
- **Response Body**:
  ```json
  {
    "status": "SUCCESS",
    "transaction_id": "cf_txn_99214",
    "wallet_id": "tiffzy_w_104829",
    "amount": 250.00,
    "balance_after": 700.00
  }
  ```

---

### 2.8 Refund to PPI Wallet
- **HTTP Method**: `POST`
- **Full Endpoint**: `/ppi/wallet/refund`
- **Sandbox URL**: `https://sandbox.cashfree.com/ppi/wallet/refund`
- **Production URL**: `https://api.cashfree.com/ppi/wallet/refund`
- **Required Headers**: `x-client-id`, `x-client-secret`, `x-api-version: 2025-11-01`
- **Request Body**:
  ```json
  {
    "wallet_id": "tiffzy_w_104829",
    "amount": 250.00,
    "original_transaction_id": "cf_txn_99214",
    "refund_id": "ref_order_78192",
    "idempotency_key": "refund_78192"
  }
  ```
- **Response Body**:
  ```json
  {
    "status": "SUCCESS",
    "refund_id": "ref_order_78192",
    "transaction_id": "cf_txn_102938",
    "wallet_id": "tiffzy_w_104829",
    "amount": 250.00,
    "balance_after": 950.00
  }
  ```

---

### 2.9 Webhook Signature Verification Algorithm

- **Headers Sent by Cashfree PPI Webhook**:
  - `x-webhook-signature`: Base64 encoded HMAC-SHA256 signature.
  - `x-webhook-timestamp`: Epoch timestamp in milliseconds or seconds.
- **Signing Formula**:
  `rawSignaturePayload = timestamp + "." + rawBodyString`
- **Secret Key**: `CASHFREE_PPI_CLIENT_SECRET` (or dedicated Webhook Secret provided in Cashfree dashboard).
- **Verification Logic**:
  ```javascript
  const expectedSignature = crypto
    .createHmac("sha256", process.env.CASHFREE_PPI_CLIENT_SECRET)
    .update(timestamp + "." + rawBodyString)
    .digest("base64");

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedSignature)
  );
  ```
