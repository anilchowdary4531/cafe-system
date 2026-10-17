import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import useCachedGet from "../hooks/useCachedGet";
import * as apiClient from "../utils/apiClient";

describe("useCachedGet In-Flight Deduplication & Retry Protection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deduplicates concurrent refresh calls into a single in-flight request", async () => {
        let resolveRequest;
        let callCount = 0;

        vi.spyOn(apiClient, "cachedGet").mockImplementation(() => {
            callCount++;
            return new Promise((resolve) => {
                resolveRequest = resolve;
            });
        });

        const { result } = renderHook(() =>
            useCachedGet("/customer/orders", {
                enabled: true,
                params: { phone: "919999999999" },
                scope: "customer:919999999999",
            })
        );

        // Initially 1 call triggered on mount
        expect(callCount).toBe(1);

        // Rapid subsequent refresh calls while first is in-flight
        let p1, p2, p3;
        act(() => {
            p1 = result.current.refresh({ force: true });
            p2 = result.current.refresh({ force: true });
            p3 = result.current.refresh({ force: true });
        });

        // callCount should STILL be 1 because in-flight request was deduplicated
        expect(callCount).toBe(1);
        expect(p1).toBe(p2);
        expect(p2).toBe(p3);

        // Resolve the in-flight request
        await act(async () => {
            resolveRequest({ phone: "919999999999", groups: [] });
            await p1;
        });

        expect(result.current.data).toEqual({ phone: "919999999999", groups: [] });
        expect(result.current.loading).toBe(false);

        // Now that in-flight request has finished, a subsequent refresh runs cleanly
        await act(async () => {
            resolveRequest = null;
            const p4 = result.current.refresh({ force: true });
            resolveRequest({ phone: "919999999999", groups: [] });
            await p4;
        });

        expect(callCount).toBe(2);
    });

    it("prevents duplicate concurrent requests on re-render / visibility changes", async () => {
        let callCount = 0;
        vi.spyOn(apiClient, "cachedGet").mockImplementation(() => {
            callCount++;
            return new Promise((resolve) => setTimeout(() => resolve({ phone: "919999999999", groups: [] }), 50));
        });

        const { rerender } = renderHook(
            ({ scope }) =>
                useCachedGet("/customer/orders", {
                    enabled: true,
                    params: { phone: "919999999999" },
                    scope,
                }),
            {
                initialProps: { scope: "customer:919999999999" },
            }
        );

        expect(callCount).toBe(1);

        // Re-rendering with identical props while initial call is running
        rerender({ scope: "customer:919999999999" });
        rerender({ scope: "customer:919999999999" });

        // Still exactly 1 call
        expect(callCount).toBe(1);
    });
});
