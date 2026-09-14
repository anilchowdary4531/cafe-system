# CASHFREE PPI CONTRACT CHANGES & DISCREPANCY AUDIT

**Document Version**: 1.0.0  
**Status**: AUDIT COMPARISON REPORT  
**Comparing**: Phase 2 Spec vs Official Current Cashfree Documentation (`2025-11-01`)

---

## 1. Summary of Endpoint & Contract Discrepancies

| Operation | Phase 2 Draft Contract | Official Cashfree Contract | Change Rationale / Correction |
| :--- | :--- | :--- | :--- |
| **API Version Header** | `x-api-version: 2023-03-01` | `x-api-version: 2025-11-01` | **Updated to current API version** required by Cashfree PPI gateway. |
| **Create User** | `POST /ppi/users` | `POST /ppi/user` | **Endpoint path singularized**: `/ppi/user`. |
| **Create Wallet** | `POST /ppi/wallets` | `POST /ppi/wallet` | **Endpoint path singularized**: `/ppi/wallet`. |
| **Credit Wallet** | `POST /ppi/wallets/{wallet_id}/credit` | `POST /ppi/wallet/credit` | **Wallet ID moved from URL path to JSON body**: `{ "wallet_id": "..." }`. |
| **Debit Wallet** | `POST /ppi/wallets/{wallet_id}/debit` | `POST /ppi/wallet/debit` | **Wallet ID moved from URL path to JSON body**: `{ "wallet_id": "..." }`. |
| **Refund Wallet** | `POST /ppi/wallets/{wallet_id}/refund` | `POST /ppi/wallet/refund` | **Wallet ID moved from URL path to JSON body**: `{ "wallet_id": "..." }`. |
| **Wallet Details** | `GET /ppi/wallets/{wallet_id}` | `GET /ppi/wallet/details` | **Endpoint changed to query param**: `GET /ppi/wallet/details?wallet_id=...`. |
| **Wallet Statement**| `GET /ppi/wallets/{wallet_id}/transactions` | `GET /ppi/wallet/statement` | **Endpoint changed to query param**: `GET /ppi/wallet/statement?wallet_id=...`. |
| **Eligibility** | `POST /ppi/wallets/eligibility` | `POST /ppi/wallet/eligibility` | **Endpoint path singularized**: `/ppi/wallet/eligibility`. |

---

## 2. Detailed Contract Field Changes

### 2.1 API Version Header
- **Phase 2 Assumption**: `x-api-version: 2023-03-01`
- **Official Specification**: `x-api-version: 2025-11-01`
- **Action**: [src/config/cashfreePpi.config.js](file:///Users/anilkumarthammineni/cafe-system/backend/src/config/cashfreePpi.config.js) must attach `x-api-version: "2025-11-01"` in `getPpiApiHeaders()`.

### 2.2 Endpoint Naming Structure
- **Phase 2 Assumption**: RESTful plural resources with path variables (`/ppi/wallets/{wallet_id}/credit`).
- **Official Specification**: Singular action routes taking parameters in request JSON body (`POST /ppi/wallet/credit`).
- **Action**: Update service calls in `cashfreePpiService.js` to send `wallet_id` inside JSON payload bodies instead of interpolating into URL strings.

### 2.3 Idempotency Field Names
- **Phase 2 Assumption**: Generic `idempotencyKey` camelCase headers.
- **Official Specification**: Standard snake_case request body attributes:
  - `idempotency_key` (String, unique per operation).
  - `reference_id` (Verified PG payment ID or top-up reference).
  - `order_id` (Tiffzy backend order reference ID).
