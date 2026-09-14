# TIFFZY CASHFREE PPI WALLET ARCHITECTURE & DESIGN SPECIFICATION

**Document Version**: 1.0.0-PREPARATION  
**Status**: ARCHITECTURE PREPARATION ONLY (Pending Cashfree Ticket ID: 8374090)  
**Target Platform**: Tiffzy Food Platform (Node.js/Fastify Backend + PostgreSQL/Prisma + Android App)

---

## 1. Overview & Conceptual Architecture

Tiffzy is preparing to integrate a **Closed-Loop Prepaid Payment Instrument (PPI)** powered by Cashfree Payments. The wallet will allow Tiffzy customers to hold digital balances exclusively for purchasing food, meals, and catering services directly from Tiffzy.

### System Topology & Control Flow

```
┌───────────────────────────────┐
│     Tiffzy Android App        │
│   (Client UI & Local State)   │
└───────────────┬───────────────┘
                │
                │ 1. HTTPS / JSON + JWT Bearer Auth (type: "customer")
                ▼
┌───────────────────────────────┐
│     Tiffzy Backend Server     │
│   (Fastify + Prisma ORM)      │
│ - Secret Management           │
│ - Business Rules Validation   │
│ - Server Price Enforcer       │
│ - Idempotency & DB Audit      │
└───────────────┬───────────────┘
                │
                │ 2. Server-to-Server Mutual TLS / REST API
                │    Headers: x-client-id, x-client-secret
                ▼
┌───────────────────────────────┐
│     Cashfree PPI REST API     │
│ (https://api.cashfree.com/ppi)│
└───────────────┬───────────────┘
                │
                │ 3. Authoritative Financial Ledger & Wallet
                ▼
┌───────────────────────────────┐
│    Cashfree PPI Wallet        │
│   (Authoritative Ledger)      │
└───────────────────────────────┘
```

### Strict Architectural Principles

1. **Zero Client Secrets**: The Tiffzy Android app must **NEVER** interact directly with Cashfree PPI APIs or store Cashfree PPI Client ID/Secret. All requests MUST pass through the Tiffzy Backend.
2. **Authoritative Ledger**: Cashfree PPI is the authoritative financial ledger for wallet balances. Tiffzy backend stores local mapping records, transaction audit trails, and synced balance caches.
3. **No Client-Controlled Amounts**: Wallet debit amounts for food orders are calculated strictly on the Tiffzy server from database menu pricing, never from client-supplied price parameters.
4. **Idempotency**: All money-moving API interactions (credits, debits, refunds) must supply unique server-generated idempotency keys.

---

## 2. Cashfree PG vs Cashfree PPI Separation

It is critical to distinguish between **Cashfree Payment Gateway (PG)** and **Cashfree Prepaid Payment Instrument (PPI)**:

| Attribute | Cashfree PG (Payment Gateway) | Cashfree PPI (Wallet) |
| :--- | :--- | :--- |
| **Primary Function** | Acquiring funds from external payment methods (UPI, Cards, Netbanking). | Storing closed-loop wallet balances, processing debits for food orders, and issuing wallet refunds. |
| **Existing Code Base** | `src/config/cashfree.config.js`<br>`src/services/cashfree.service.js`<br>`src/controllers/payment.controller.js`<br>`src/routes/payment.routes.js` | `src/config/cashfreePpi.config.js`<br>`src/services/cashfreePpiService.js`<br>`src/routes/ppiWallet.routes.js` |
| **Production Status** | **ACTIVE & UNTOUCHED**. Handles checkout for food orders. | **PREPARATION ONLY**. Disabled until Ticket 8374090 approval. |
| **Credentials** | `CASHFREE_CLIENT_ID`<br>`CASHFREE_CLIENT_SECRET`<br>`CASHFREE_ENV` | `CASHFREE_PPI_CLIENT_ID`<br>`CASHFREE_PPI_CLIENT_SECRET`<br>`CASHFREE_PPI_PROGRAM_ID`<br>`CASHFREE_PPI_ENV` |

---

## 3. Future Wallet Top-Up Separation & Security Flow

Top-ups use **Cashfree PG** for money collection and **Cashfree PPI** for wallet credit:

```
Customer (Android) ──────(1) Request Top-up (₹500)─────► Tiffzy Backend
                                                             │
Tiffzy Backend ──────────(2) Create PG Session ──────────► Cashfree PG API
                                                             │
Customer ────────────────(3) Pay via UPI/Card ───────────► Cashfree PG Checkout
                                                             │
Cashfree PG ─────────────(4) Webhook: PAYMENT_SUCCESS ──► Tiffzy Backend
                                                             │
Tiffzy Backend ──────────(5) Validate Payment Details ────┤ (Server Verification)
                             - Amount matches PG record     │
                             - Payment status === "PAID"    │
                             - Idempotency key verified    │
                                                             ▼
Tiffzy Backend ──────────(6) Credit Wallet (₹500) ────────► Cashfree PPI API
                                                             │
Cashfree PPI ────────────(7) Return Updated Balance ──────► Tiffzy Backend ──► Android App
```

---

## 4. Proposed Database Schema Mappings (Preparation Design Only)

The following schema extensions are proposed for future database migration upon Cashfree PPI approval:

### 1. Customer PPI User Mapping (`CustomerAccount` extension or `CustomerPpiMapping`)
```prisma
// Extension to CustomerAccount model
model CustomerPpiUser {
  id                 Int             @id @default(autoincrement())
  customerAccountId  Int             @unique @map("customer_account_id")
  customerAccount    CustomerAccount @relation(fields: [customerAccountId], references: [id], onDelete: Cascade)

  cashfreePpiUserId  String          @unique @map("cashfree_ppi_user_id")
  phone              String
  name               String?
  email              String?

  kycStatus          String          @default("NOT_STARTED") @map("kyc_status") // NOT_STARTED | MIN_KYC | FULL_KYC | VERIFIED
  kycDocType         String?         @map("kyc_doc_type")
  kycReferenceId     String?         @map("kyc_reference_id")

  createdAt          DateTime        @default(now()) @map("created_at")
  updatedAt          DateTime        @default(now()) @updatedAt @map("updated_at")

  @@index([cashfreePpiUserId])
  @@map("customer_ppi_users")
}
```

### 2. Cashfree PPI Wallet Mapping (`Wallet` extension)
```prisma
// Proposed extensions to Wallet model
model PpiWalletMetadata {
  id                 Int          @id @default(autoincrement())
  walletId           Int          @unique @map("wallet_id")
  wallet             Wallet       @relation(fields: [walletId], references: [id], onDelete: Cascade)

  cashfreeWalletId   String       @unique @map("cashfree_wallet_id")
  cashfreeProgramId  String       @map("cashfree_program_id")
  walletType         String       @default("CLOSED_LOOP") @map("wallet_type")
  walletStatus       String       @default("ACTIVE") @map("wallet_status") // ACTIVE | SUSPENDED | CLOSED

  lastSyncedBalance  Float        @default(0.0) @map("last_synced_balance")
  lastSyncedAt       DateTime?    @map("last_synced_at")

  createdAt          DateTime     @default(now()) @map("created_at")
  updatedAt          DateTime     @default(now()) @updatedAt @map("updated_at")

  @@index([cashfreeWalletId])
  @@index([cashfreeProgramId])
  @@map("ppi_wallet_metadata")
}
```

### 3. PPI Webhook Log & Idempotency
```prisma
model PpiWebhookLog {
  id                 Int          @id @default(autoincrement())
  eventId            String       @unique @map("event_id")
  eventType          String       @map("event_type")
  signature          String?
  payload            Json
  processed          Boolean      @default(false)
  processedAt        DateTime?    @map("processed_at")
  createdAt          DateTime     @default(now()) @map("created_at")

  @@index([eventId])
  @@index([eventType, processed])
  @@map("ppi_webhook_logs")
}
```

---

## 5. Existing Wallet Safety & Migration Coexistence Strategy

1. **Existing Local Wallet Operational Integrity**:
   - The existing local database wallet (`Wallet`, `WalletLedger`, `WalletTopup`) remains 100% active and untouched.
   - Food order checkout via local wallet (`POST /api/wallet/pay-order`) remains fully functional.
2. **Coexistence Mode**:
   - When Cashfree PPI is onboarded, new user signups will receive a Cashfree PPI wallet mapping.
   - Existing local wallet balances will continue to function. A feature flag (`ENABLE_CASHFREE_PPI_WALLET`) will dictate routing between legacy local ledger and Cashfree PPI ledger.
3. **Zero Automated Ledger Mutations**:
   - Existing balances will **NOT** be automatically altered or migrated without explicit admin reconciliation tools.

---

## 6. Information Required From Cashfree (Ticket ID: 8374090)

The following mandatory configuration parameters are currently pending Cashfree onboarding resolution:

1. **`cf_program_id`**: The official PPI program identifier assigned to Tiffzy by Cashfree.
2. **PPI API Credentials**:
   - `CASHFREE_PPI_CLIENT_ID`
   - `CASHFREE_PPI_CLIENT_SECRET`
3. **Approved Program Type & KYC Requirements**:
   - Confirmation of closed-loop small PPI vs full KYC rules.
   - Attribute specifications required during `createPpiUser`.
4. **Production Base URL & Whitelisting**:
   - Account activation on Cashfree Sandbox (`https://sandbox.cashfree.com/ppi`) and Production (`https://api.cashfree.com/ppi`).
5. **PPI Webhook Specifications**:
   - Formal webhook signing secret and payload schemas for PPI credit/debit events.

---

## 7. Recommended Next Steps

1. Maintain preparation skeleton files (`src/config/cashfreePpi.config.js`, `src/services/cashfreePpiService.js`, `src/routes/ppiWallet.routes.js`).
2. Await update on Cashfree Support Ticket **8374090**.
3. Upon receiving credentials and `cf_program_id`:
   - Set environment variables in `.env`.
   - Apply Prisma database migration for `CustomerPpiUser`, `PpiWalletMetadata`, and `PpiWebhookLog`.
   - Implement live API calls in `cashfreePpiService.js`.
