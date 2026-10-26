import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import axios from "axios";
import {
    STAFF_OFFLINE_GRACE_PERIOD_HOURS,
    STAFF_OFFLINE_GRACE_PERIOD_MS,
    writeStaffSession,
    clearStaffSession,
    getActiveStaffSession,
    getStaffRefreshToken,
    getStaffLastValidatedAt,
    isStaffWithinOfflineGracePeriod,
    isStaffOfflineGracePeriodExpired,
} from "../utils/staffSessionStorage";
import { handleAuth401 } from "../utils/authInterceptor";

vi.mock("axios");

describe("Staff 72-Hour Offline Grace Period & Refresh Architecture", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.useRealTimers();
    });

    describe("Authoritative Configuration & Constants", () => {
        it("defines authoritative 72-hour grace period constants", () => {
            expect(STAFF_OFFLINE_GRACE_PERIOD_HOURS).toBe(72);
            expect(STAFF_OFFLINE_GRACE_PERIOD_MS).toBe(72 * 60 * 60 * 1000);
            expect(STAFF_OFFLINE_GRACE_PERIOD_MS).toBe(259200000);
        });
    });

    describe("Offline Session Preservation & Expiration", () => {
        it("Scenario 1: Reopen after 1 hour offline -> remains logged in", () => {
            const initialTime = 1700000000000;
            vi.useFakeTimers();
            vi.setSystemTime(initialTime);

            writeStaffSession({
                token: "staff_access_token_1h",
                refreshToken: "staff_refresh_token_1h",
                user: { id: 101, name: "Head Chef", role: "CHEF", designation: "Chef" },
                scope: "local",
                validatedAt: initialTime,
            });

            // Advance 1 hour (3,600,000 ms) while completely offline
            vi.advanceTimersByTime(1 * 60 * 60 * 1000);

            expect(isStaffWithinOfflineGracePeriod()).toBe(true);
            expect(isStaffOfflineGracePeriodExpired()).toBe(false);

            const activeSession = getActiveStaffSession();
            expect(activeSession).not.toBeNull();
            expect(activeSession.token).toBe("staff_access_token_1h");
            expect(activeSession.user.name).toBe("Head Chef");
        });

        it("Scenario 2: Reopen after 24 hours offline -> remains logged in", () => {
            const initialTime = 1700000000000;
            vi.useFakeTimers();
            vi.setSystemTime(initialTime);

            writeStaffSession({
                token: "staff_access_token_24h",
                refreshToken: "staff_refresh_token_24h",
                user: { id: 102, name: "Floor Server", role: "WAITER", designation: "Server" },
                scope: "local",
                validatedAt: initialTime,
            });

            // Advance 24 hours offline
            vi.advanceTimersByTime(24 * 60 * 60 * 1000);

            expect(isStaffWithinOfflineGracePeriod()).toBe(true);
            expect(isStaffOfflineGracePeriodExpired()).toBe(false);

            const activeSession = getActiveStaffSession();
            expect(activeSession).not.toBeNull();
            expect(activeSession.token).toBe("staff_access_token_24h");
        });

        it("Scenario 3: Reopen after 48 hours offline -> remains logged in", () => {
            const initialTime = 1700000000000;
            vi.useFakeTimers();
            vi.setSystemTime(initialTime);

            writeStaffSession({
                token: "staff_access_token_48h",
                refreshToken: "staff_refresh_token_48h",
                user: { id: 103, name: "Manager Alice", role: "MANAGER", designation: "Manager" },
                scope: "local",
                validatedAt: initialTime,
            });

            // Advance 48 hours offline
            vi.advanceTimersByTime(48 * 60 * 60 * 1000);

            expect(isStaffWithinOfflineGracePeriod()).toBe(true);
            expect(isStaffOfflineGracePeriodExpired()).toBe(false);

            const activeSession = getActiveStaffSession();
            expect(activeSession).not.toBeNull();
            expect(activeSession.token).toBe("staff_access_token_48h");
        });

        it("Scenario 4: Reopen after 71 hours offline (before 72 hours) -> remains logged in", () => {
            const initialTime = 1700000000000;
            vi.useFakeTimers();
            vi.setSystemTime(initialTime);

            writeStaffSession({
                token: "staff_access_token_71h",
                refreshToken: "staff_refresh_token_71h",
                user: { id: 104, name: "Owner Bob", role: "OWNER", designation: "Owner" },
                scope: "local",
                validatedAt: initialTime,
            });

            // Advance 71 hours offline
            vi.advanceTimersByTime(71 * 60 * 60 * 1000);

            expect(isStaffWithinOfflineGracePeriod()).toBe(true);
            expect(isStaffOfflineGracePeriodExpired()).toBe(false);

            const activeSession = getActiveStaffSession();
            expect(activeSession).not.toBeNull();
            expect(activeSession.token).toBe("staff_access_token_71h");
        });

        it("Scenario 5: Reopen at or after 72 hours offline -> session expires and is cleared", () => {
            const initialTime = 1700000000000;
            vi.useFakeTimers();
            vi.setSystemTime(initialTime);

            writeStaffSession({
                token: "staff_access_token_72h",
                refreshToken: "staff_refresh_token_72h",
                user: { id: 105, name: "Cashier Charlie", role: "CASHIER", designation: "Cashier" },
                scope: "local",
                validatedAt: initialTime,
            });

            // Advance exactly 72 hours + 1 second offline
            vi.advanceTimersByTime(72 * 60 * 60 * 1000 + 1000);

            expect(isStaffWithinOfflineGracePeriod()).toBe(false);
            expect(isStaffOfflineGracePeriodExpired()).toBe(true);

            // getActiveStaffSession detects expiration and clears session
            const activeSession = getActiveStaffSession();
            expect(activeSession).toBeNull();
            expect(localStorage.getItem("token")).toBeNull();
            expect(localStorage.getItem("user")).toBeNull();
            expect(localStorage.getItem("staff_refresh_token")).toBeNull();
            expect(localStorage.getItem("staff_last_validated_at")).toBeNull();
        });

        it("Opening/reopening app offline does NOT extend the authoritative 72h deadline", () => {
            const initialTime = 1700000000000;
            vi.useFakeTimers();
            vi.setSystemTime(initialTime);

            writeStaffSession({
                token: "staff_access_token_no_bump",
                refreshToken: "staff_refresh_token_no_bump",
                user: { id: 106, name: "Steward Dave", role: "STEWARD", designation: "Steward" },
                scope: "local",
                validatedAt: initialTime,
            });

            // Simulate repeated offline app open events over 70 hours
            for (let h = 1; h <= 70; h++) {
                vi.advanceTimersByTime(1 * 60 * 60 * 1000);
                getActiveStaffSession();
            }

            // At 70 hours, validatedAt must STILL be the original initialTime!
            expect(getStaffLastValidatedAt()).toBe(initialTime);

            // Advance 3 more hours (total 73 hours)
            vi.advanceTimersByTime(3 * 60 * 60 * 1000);

            // Now expired!
            expect(getActiveStaffSession()).toBeNull();
        });
    });

    describe("Token Refresh & Network Interceptor Handling", () => {
        it("Refreshes access token on 401 when online and retries original request", async () => {
            const initialTime = 1700000000000;
            vi.useFakeTimers();
            vi.setSystemTime(initialTime);

            writeStaffSession({
                token: "expired_staff_access_token",
                refreshToken: "valid_staff_refresh_token",
                user: { id: 201, name: "Chef Gordon", role: "CHEF", designation: "Senior Chef" },
                scope: "local",
                validatedAt: initialTime,
            });

            // Advance 2 hours
            vi.advanceTimersByTime(2 * 60 * 60 * 1000);

            // Mock refresh endpoint success
            axios.post.mockResolvedValueOnce({
                data: {
                    token: "new_rotated_access_token",
                    refreshToken: "new_rotated_refresh_token",
                    user: { id: 201, name: "Chef Gordon", role: "CHEF" },
                },
            });

            // Mock retried original request success
            axios.mockResolvedValueOnce({
                status: 200,
                data: { success: true, orders: [] },
            });

            const initialError = {
                response: { status: 401, data: { code: "TOKEN_EXPIRED" } },
                config: { url: "/kitchen/orders", headers: {} },
            };

            const result = await handleAuth401(initialError);

            expect(result.status).toBe(200);
            expect(result.data.success).toBe(true);

            // Access token and refresh token updated in storage
            expect(localStorage.getItem("token")).toBe("new_rotated_access_token");
            expect(localStorage.getItem("staff_refresh_token")).toBe("new_rotated_refresh_token");

            // Last validated timestamp updated to current time upon genuine server validation
            expect(getStaffLastValidatedAt()).toBe(initialTime + 2 * 60 * 60 * 1000);
        });

        it("Deduplicates multiple concurrent 401 requests into a single refresh call", async () => {
            writeStaffSession({
                token: "expired_token_concurrent",
                refreshToken: "refresh_token_concurrent",
                user: { id: 202, name: "Manager Maya", role: "MANAGER" },
                scope: "local",
            });

            let refreshCalls = 0;
            axios.post.mockImplementation((url) => {
                if (url.includes("/auth/staff/refresh")) {
                    refreshCalls++;
                    return Promise.resolve({
                        data: {
                            token: "new_shared_access_token",
                            refreshToken: "new_shared_refresh_token",
                            user: { id: 202, name: "Manager Maya", role: "MANAGER" },
                        },
                    });
                }
                return Promise.resolve({ status: 200, data: { ok: true } });
            });

            axios.mockImplementation((config) => {
                return Promise.resolve({
                    status: 200,
                    data: { url: config.url, tokenUsed: config.headers?.Authorization },
                });
            });

            // 5 simultaneous requests receiving 401
            const requests = [
                { response: { status: 401 }, config: { url: "/owner/tables", headers: {} } },
                { response: { status: 401 }, config: { url: "/owner/orders", headers: {} } },
                { response: { status: 401 }, config: { url: "/owner/reports", headers: {} } },
                { response: { status: 401 }, config: { url: "/owner/shifts", headers: {} } },
                { response: { status: 401 }, config: { url: "/owner/inventory", headers: {} } },
            ];

            const results = await Promise.all(requests.map((err) => handleAuth401(err)));

            // EXACTLY 1 refresh call was made
            expect(refreshCalls).toBe(1);

            // All 5 requests retried with the new access token
            results.forEach((res) => {
                expect(res.status).toBe(200);
                expect(res.data.tokenUsed).toBe("Bearer new_shared_access_token");
            });
        });

        it("Preserves staff session if refresh fails due to network offline while within 72h grace", async () => {
            const initialTime = 1700000000000;
            vi.useFakeTimers();
            vi.setSystemTime(initialTime);

            writeStaffSession({
                token: "expired_token_offline_network",
                refreshToken: "refresh_token_offline_network",
                user: { id: 203, name: "Cleaner Sam", role: "CLEANER" },
                scope: "local",
                validatedAt: initialTime,
            });

            // Advance 10 hours offline (< 72h)
            vi.advanceTimersByTime(10 * 60 * 60 * 1000);

            // Mock refresh failure due to network error (offline)
            const networkError = new Error("Network Error");
            networkError.code = "ERR_NETWORK";
            axios.post.mockRejectedValueOnce(networkError);

            const dispatchSpy = vi.spyOn(window, "dispatchEvent");

            const err401 = {
                response: { status: 401 },
                config: { url: "/tables/status", headers: {} },
            };

            await expect(handleAuth401(err401)).rejects.toThrow("Network Error");

            // Session MUST BE PRESERVED: do not log out
            expect(localStorage.getItem("token")).toBe("expired_token_offline_network");
            expect(localStorage.getItem("staff_refresh_token")).toBe("refresh_token_offline_network");
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                expect.objectContaining({ detail: { scope: "staff" } })
            );
        });

        it("Immediately evicts staff session if refresh fails due to server revocation (sessionVersion mismatch)", async () => {
            writeStaffSession({
                token: "expired_token_revoked",
                refreshToken: "refresh_token_revoked",
                user: { id: 204, name: "Swiper Tim", role: "SWIPER" },
                scope: "local",
            });

            // Mock refresh failure from backend returning 401 SESSION_VERSION_MISMATCH
            const revocationError = {
                response: {
                    status: 401,
                    data: { code: "SESSION_VERSION_MISMATCH", message: "Session invalidated" },
                },
            };
            axios.post.mockRejectedValueOnce(revocationError);

            const dispatchSpy = vi.spyOn(window, "dispatchEvent");

            const err401 = {
                response: { status: 401 },
                config: { url: "/api/staff/tasks", headers: {} },
            };

            await expect(handleAuth401(err401)).rejects.toBe(revocationError);

            // Session MUST BE CLEARED immediately
            expect(localStorage.getItem("token")).toBeNull();
            expect(localStorage.getItem("staff_refresh_token")).toBeNull();
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ detail: { scope: "staff" } })
            );
        });

        it("Explicit logout clears session and cannot be restored by refresh", () => {
            writeStaffSession({
                token: "staff_active_token",
                refreshToken: "staff_active_refresh",
                user: { id: 205, name: "Server Leo", role: "WAITER" },
                scope: "local",
            });

            expect(getActiveStaffSession()).not.toBeNull();
            expect(getStaffRefreshToken()).toBe("staff_active_refresh");

            // Explicit logout executed
            clearStaffSession("local");

            expect(getActiveStaffSession()).toBeNull();
            expect(getStaffRefreshToken()).toBeNull();
            expect(getStaffLastValidatedAt()).toBeNull();
            expect(localStorage.getItem("token")).toBeNull();
        });
    });

    describe("All Staff Designations Supported", () => {
        const designations = [
            { designation: "Owner", role: "OWNER" },
            { designation: "General Manager", role: "MANAGER" },
            { designation: "Executive Chef", role: "CHEF" },
            { designation: "Senior Chef", role: "CHEF" },
            { designation: "Server", role: "WAITER" },
            { designation: "Steward", role: "STEWARD" },
            { designation: "Cashier", role: "CASHIER" },
            { designation: "Cleaner", role: "CLEANER" },
            { designation: "Swiper", role: "SWIPER" },
        ];

        designations.forEach(({ designation, role }) => {
            it(`correctly stores and verifies 72h offline grace for designation: ${designation}`, () => {
                const now = Date.now();
                writeStaffSession({
                    token: `token_${designation}`,
                    refreshToken: `refresh_${designation}`,
                    user: { id: 300, name: `User ${designation}`, role, designation },
                    scope: "local",
                    validatedAt: now,
                });

                const session = getActiveStaffSession();
                expect(session).not.toBeNull();
                expect(session.user.role).toBe(role);
                expect(session.user.designation).toBe(designation);
                expect(isStaffWithinOfflineGracePeriod()).toBe(true);

                clearStaffSession("local");
            });
        });
    });
});
