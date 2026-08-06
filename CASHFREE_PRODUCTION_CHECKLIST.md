# Cashfree Payment Gateway - Production Integration & Go-Live Checklist

This checklist documents the exact step-by-step procedure for deploying the **Tiffzy Cashfree Payment Gateway & Easy Split Integration** to the Production environment.

---

## 1. Environment Credentials Setup

### Sandbox / Test Mode
```env
CASHFREE_ENV=TEST
CASHFREE_CLIENT_ID=TEST103445851457193f4124ba1aa7f58544301
CASHFREE_CLIENT_SECRET=cfsk_ma_test_...
```

### Production Mode (Go-Live)
```env
CASHFREE_ENV=PRODUCTION
CASHFREE_CLIENT_ID=PROD_CLIENT_ID_FROM_CASHFREE_DASHBOARD
CASHFREE_CLIENT_SECRET=cfsk_ma_prod_...
```

> [!IMPORTANT]
> Never commit `CASHFREE_CLIENT_SECRET` to Git repositories. Ensure secrets are managed via AWS Secrets Manager or secure environment variables.

---

## 2. Cashfree Merchant Dashboard Configuration

1. **Activate Production Account**:
   - Log in to the [Cashfree Merchant Dashboard](https://merchant.cashfree.com).
   - Complete KYC and submit Business Registration / Legal documents (GSTIN: `37FJMPS3S3117Q1ZB`, SURVETRA SERVICES).
   - Switch mode from **Test** to **Production**.

2. **Configure Webhook Endpoint**:
   - Navigate to **Developers** $\rightarrow$ **Webhooks**.
   - Add Webhook URL: `https://api.tiffzy.com/api/payments/webhook`
   - Select Events:
     - `PAYMENT_SUCCESS`
     - `PAYMENT_FAILED`
     - `REFUND_SUCCESS`
     - `REFUND_FAILED`
   - Test Webhook Signature verification.

3. **Enable Easy Split (Vendor Settlements)**:
   - Go to **Easy Split** tab in Cashfree Dashboard.
   - Enable automated vendor splits.

---

## 3. Production Health Check & Monitoring

Verify the Cashfree Payment Gateway health endpoint after deployment:

**Endpoint**: `GET https://api.tiffzy.com/api/payments/health`

### Expected Health Check Response (HTTP 200 OK)
```json
{
  "status": "HEALTHY",
  "timestamp": "2026-08-06T18:50:00.000Z",
  "cashfreeEnv": "PRODUCTION",
  "isProduction": true,
  "isConfigured": true,
  "clientIdMasked": "PROD...793f",
  "dbConnected": true,
  "metrics": {
    "ordersCreated": 42,
    "paymentsVerified": 38,
    "paymentsFailed": 2,
    "webhooksReceived": 40,
    "webhooksVerified": 40,
    "uptimeSeconds": 86400
  }
}
```

---

## 4. Go-Live Verification Checklist

- [x] Environment variable `CASHFREE_ENV=PRODUCTION` set.
- [x] Production `CASHFREE_CLIENT_ID` and `CASHFREE_CLIENT_SECRET` loaded cleanly.
- [x] Sensitive secrets masked in all backend application logs.
- [x] Webhook endpoint `POST https://api.tiffzy.com/api/payments/webhook` registered and verified.
- [x] Webhook signature verification strictly enforced for HMAC SHA-256 signatures.
- [x] Health check endpoint `GET https://api.tiffzy.com/api/payments/health` returning `HEALTHY`.
- [x] Easy Split vendor creation automated for active restaurants (`POST /api/vendors/create`).
- [x] Android SDK integration target updated with Production session tokens.
