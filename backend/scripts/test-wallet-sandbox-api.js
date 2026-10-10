/**
 * Tiffzy Wallet Sandbox Non-Financial API Test Suite
 * Executes read-only and validation tests against the running backend server.
 * Uses environment variables: TIFFZY_API_URL, TIFFZY_TEST_TOKEN
 * DOES NOT EXPOSE SECRETS OR MANUALLY ALTER BALANCES.
 */

const API_URL = process.env.TIFFZY_API_URL || "http://localhost:3000";
const TOKEN = process.env.TIFFZY_TEST_TOKEN || "";

const logResult = (testName, pass, status, expected, actual, extra = "") => {
    const symbol = pass ? "✅ PASS" : "❌ FAIL";
    console.log(`[${symbol}] ${testName}`);
    console.log(`   HTTP Status : ${status}`);
    console.log(`   Expected    : ${expected}`);
    console.log(`   Actual      : ${actual}`);
    if (extra) console.log(`   Details     : ${extra}`);
    console.log("-".repeat(60));
};

async function runSandboxApiTests() {
    console.log("==================================================");
    console.log("TIFFZY WALLET SANDBOX NON-FINANCIAL API VALIDATION");
    console.log(`Base URL: ${API_URL}`);
    console.log(`Token Provided: ${TOKEN ? "YES (Masked)" : "NO (Will test unauthenticated/public handling)"}`);
    console.log("==================================================\n");

    const headers = {
        "Content-Type": "application/json",
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    };

    let initialBalance = null;

    // Test 1: GET /api/wallet
    try {
        const res = await fetch(`${API_URL}/api/wallet`, { headers });
        const data = await res.json().catch(() => ({}));
        if (res.status === 200 && data.wallet) {
            initialBalance = Number(data.wallet.balance);
            logResult("1. GET /api/wallet", true, res.status, "HTTP 200 with wallet summary", `Balance: ₹${initialBalance}, Status: ${data.wallet.status}`);
        } else if (res.status === 401) {
            logResult("1. GET /api/wallet", true, res.status, "HTTP 401 without Bearer token", data.message || "Unauthorized");
        } else {
            logResult("1. GET /api/wallet", false, res.status, "HTTP 200", JSON.stringify(data));
        }
    } catch (err) {
        logResult("1. GET /api/wallet", false, "CONN_ERROR", "Server reachable", err.message);
    }

    // Test 2: GET /api/wallet/transactions?page=1&limit=20
    try {
        const res = await fetch(`${API_URL}/api/wallet/transactions?page=1&limit=20`, { headers });
        const data = await res.json().catch(() => ({}));
        if (res.status === 200 && Array.isArray(data.transactions)) {
            logResult("2. GET /api/wallet/transactions", true, res.status, "HTTP 200 with transaction list", `Total: ${data.total}, Page: ${data.page}`);
        } else if (res.status === 401) {
            logResult("2. GET /api/wallet/transactions", true, res.status, "HTTP 401 without token", data.message || "Unauthorized");
        } else {
            logResult("2. GET /api/wallet/transactions", false, res.status, "HTTP 200", JSON.stringify(data));
        }
    } catch (err) {
        logResult("2. GET /api/wallet/transactions", false, "CONN_ERROR", "Server reachable", err.message);
    }

    if (!TOKEN) {
        console.log("\n⚠️ No TIFFZY_TEST_TOKEN provided. Remaining tests require authenticated customer token.");
        console.log("Provide TIFFZY_TEST_TOKEN=<jwt> to test authenticated session creation and limit validations.");
        return;
    }

    // Test 3: POST /api/wallet/topup/create with valid ₹500
    let createdTopupId = null;
    try {
        const res = await fetch(`${API_URL}/api/wallet/topup/create`, {
            method: "POST",
            headers,
            body: JSON.stringify({ amount: 500, returnUrl: "http://localhost:5173/profile?tab=wallet" }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 200 && data.session && data.session.topupTxnId) {
            createdTopupId = data.session.topupTxnId;
            logResult("3. POST /api/wallet/topup/create (₹500)", true, res.status, "HTTP 200 with topup session", `TopupID: ${createdTopupId}, Gateway: ${data.session.gateway}`);
        } else {
            logResult("3. POST /api/wallet/topup/create (₹500)", false, res.status, "HTTP 200 with session", data.message || JSON.stringify(data));
        }
    } catch (err) {
        logResult("3. POST /api/wallet/topup/create (₹500)", false, "CONN_ERROR", "Server reachable", err.message);
    }

    // Test 4: POST /api/wallet/topup/create with ₹9 (Below min limit ₹10)
    try {
        const res = await fetch(`${API_URL}/api/wallet/topup/create`, {
            method: "POST",
            headers,
            body: JSON.stringify({ amount: 9, returnUrl: "http://localhost:5173/profile?tab=wallet" }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 && data.message?.includes("Minimum top-up")) {
            logResult("4. Rejection of ₹9 Top-up", true, res.status, "HTTP 400 Minimum top-up limit error", data.message);
        } else {
            logResult("4. Rejection of ₹9 Top-up", false, res.status, "HTTP 400", data.message || JSON.stringify(data));
        }
    } catch (err) {
        logResult("4. Rejection of ₹9 Top-up", false, "CONN_ERROR", "Server reachable", err.message);
    }

    // Test 5: POST /api/wallet/topup/create with -₹100 (Negative amount)
    try {
        const res = await fetch(`${API_URL}/api/wallet/topup/create`, {
            method: "POST",
            headers,
            body: JSON.stringify({ amount: -100, returnUrl: "http://localhost:5173/profile?tab=wallet" }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 400) {
            logResult("5. Rejection of -₹100 Top-up", true, res.status, "HTTP 400 Negative amount error", data.message);
        } else {
            logResult("5. Rejection of -₹100 Top-up", false, res.status, "HTTP 400", data.message || JSON.stringify(data));
        }
    } catch (err) {
        logResult("5. Rejection of -₹100 Top-up", false, "CONN_ERROR", "Server reachable", err.message);
    }

    // Test 6: POST /api/wallet/topup/create with ₹50,001 (Above single top-up max limit ₹50,000)
    try {
        const res = await fetch(`${API_URL}/api/wallet/topup/create`, {
            method: "POST",
            headers,
            body: JSON.stringify({ amount: 50001, returnUrl: "http://localhost:5173/profile?tab=wallet" }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 && data.message?.includes("Maximum single top-up")) {
            logResult("6. Rejection of ₹50,001 Top-up", true, res.status, "HTTP 400 Maximum top-up limit error", data.message);
        } else {
            logResult("6. Rejection of ₹50,001 Top-up", false, res.status, "HTTP 400", data.message || JSON.stringify(data));
        }
    } catch (err) {
        logResult("6. Rejection of ₹50,001 Top-up", false, "CONN_ERROR", "Server reachable", err.message);
    }

    // Test 7: GET /api/wallet again (Verify balance HAS NOT INCREASED merely by creating session)
    try {
        const res = await fetch(`${API_URL}/api/wallet`, { headers });
        const data = await res.json().catch(() => ({}));
        if (res.status === 200 && data.wallet) {
            const newBalance = Number(data.wallet.balance);
            const unchanged = newBalance === initialBalance;
            logResult("7. Balance Unchanged After Top-up Session Creation", unchanged, res.status, `Balance remains ₹${initialBalance}`, `Current Balance: ₹${newBalance}`);
        } else {
            logResult("7. Balance Unchanged Check", false, res.status, "HTTP 200", JSON.stringify(data));
        }
    } catch (err) {
        logResult("7. Balance Unchanged Check", false, "CONN_ERROR", "Server reachable", err.message);
    }
}

runSandboxApiTests();
