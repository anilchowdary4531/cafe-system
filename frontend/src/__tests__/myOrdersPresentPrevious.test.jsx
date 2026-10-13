import { describe, it, expect } from "vitest";
import {
    isDeliveredOrder,
    isPresentOrder,
    getDeliveredTimestamp,
    getCreatedTimestamp,
} from "../utils/orderStatusGrouping";

describe("Tiffzy Web Customer — My Orders Present vs Previous Orders", () => {
    const filterAndSortOrders = (orders) => {
        const presentOrders = orders
            .filter(isPresentOrder)
            .sort((a, b) => getCreatedTimestamp(b) - getCreatedTimestamp(a));
        const previousOrders = orders
            .filter(isDeliveredOrder)
            .sort((a, b) => getDeliveredTimestamp(b) - getDeliveredTimestamp(a));
        return { presentOrders, previousOrders };
    };

    it("TEST 1: status = PLACED -> PRESENT ORDERS", () => {
        const order = { id: 101, status: "PLACED", createdAt: "2026-10-12T10:00:00.000Z" };
        expect(isPresentOrder(order)).toBe(true);
        expect(isDeliveredOrder(order)).toBe(false);

        const { presentOrders, previousOrders } = filterAndSortOrders([order]);
        expect(presentOrders.map((o) => o.id)).toEqual([101]);
        expect(previousOrders).toEqual([]);
    });

    it("TEST 2: status = PREPARING -> PRESENT ORDERS", () => {
        const order = { id: 102, status: "PREPARING", createdAt: "2026-10-12T10:10:00.000Z" };
        expect(isPresentOrder(order)).toBe(true);
        expect(isDeliveredOrder(order)).toBe(false);

        const { presentOrders, previousOrders } = filterAndSortOrders([order]);
        expect(presentOrders.map((o) => o.id)).toEqual([102]);
        expect(previousOrders).toEqual([]);
    });

    it("TEST 3: status = READY -> PRESENT ORDERS", () => {
        const order = { id: 103, status: "READY", createdAt: "2026-10-12T10:15:00.000Z" };
        expect(isPresentOrder(order)).toBe(true);
        expect(isDeliveredOrder(order)).toBe(false);

        const { presentOrders, previousOrders } = filterAndSortOrders([order]);
        expect(presentOrders.map((o) => o.id)).toEqual([103]);
        expect(previousOrders).toEqual([]);
    });

    it("TEST 4: status = OUT_FOR_DELIVERY -> PRESENT ORDERS", () => {
        const order = { id: 104, status: "OUT_FOR_DELIVERY", createdAt: "2026-10-12T10:20:00.000Z" };
        expect(isPresentOrder(order)).toBe(true);
        expect(isDeliveredOrder(order)).toBe(false);

        const { presentOrders, previousOrders } = filterAndSortOrders([order]);
        expect(presentOrders.map((o) => o.id)).toEqual([104]);
        expect(previousOrders).toEqual([]);
    });

    it("TEST 5: status = DELIVERED -> PREVIOUS ORDERS", () => {
        const order = {
            id: 105,
            status: "DELIVERED",
            createdAt: "2026-10-12T09:00:00.000Z",
            statusEvents: [{ status: "DELIVERED", createdAt: "2026-10-12T09:35:00.000Z" }],
        };
        expect(isDeliveredOrder(order)).toBe(true);
        expect(isPresentOrder(order)).toBe(false);

        const { presentOrders, previousOrders } = filterAndSortOrders([order]);
        expect(presentOrders).toEqual([]);
        expect(previousOrders.map((o) => o.id)).toEqual([105]);
    });

    it("TEST 6: Mixed orders (PLACED, PREPARING, OUT_FOR_DELIVERY, DELIVERED)", () => {
        const orders = [
            { id: 1, status: "PLACED", createdAt: "2026-10-12T08:00:00.000Z" },
            { id: 2, status: "PREPARING", createdAt: "2026-10-12T08:30:00.000Z" },
            { id: 3, status: "OUT_FOR_DELIVERY", createdAt: "2026-10-12T09:00:00.000Z" },
            {
                id: 4,
                status: "DELIVERED",
                createdAt: "2026-10-12T07:00:00.000Z",
                statusEvents: [{ status: "DELIVERED", createdAt: "2026-10-12T07:45:00.000Z" }],
            },
        ];

        const { presentOrders, previousOrders } = filterAndSortOrders(orders);

        // Present Orders: active orders sorted newest first
        expect(presentOrders.map((o) => o.id)).toEqual([3, 2, 1]);
        expect(presentOrders.map((o) => o.status)).toEqual(["OUT_FOR_DELIVERY", "PREPARING", "PLACED"]);

        // Previous Orders: delivered order
        expect(previousOrders.map((o) => o.id)).toEqual([4]);
        expect(previousOrders.map((o) => o.status)).toEqual(["DELIVERED"]);
    });

    it("TEST 7: Change an order from PREPARING to DELIVERED moves order from PRESENT to PREVIOUS", () => {
        const orderA = { id: "order-A", status: "PREPARING", createdAt: "2026-10-12T08:00:00.000Z" };
        const orderB = { id: "order-B", status: "DELIVERED", createdAt: "2026-10-12T07:00:00.000Z" };

        // Initial state
        const initial = filterAndSortOrders([orderA, orderB]);
        expect(initial.presentOrders.map((o) => o.id)).toEqual(["order-A"]);
        expect(initial.previousOrders.map((o) => o.id)).toEqual(["order-B"]);

        // Updated state: orderA transitioned to DELIVERED
        const updatedOrderA = {
            ...orderA,
            status: "DELIVERED",
            updatedAt: "2026-10-12T08:45:00.000Z",
            statusEvents: [{ status: "DELIVERED", createdAt: "2026-10-12T08:45:00.000Z" }],
        };

        const afterUpdate = filterAndSortOrders([updatedOrderA, orderB]);
        expect(afterUpdate.presentOrders).toEqual([]);
        expect(afterUpdate.previousOrders.map((o) => o.id)).toEqual(["order-A", "order-B"]);
    });

    it("TEST 8: No active orders -> empty PRESENT ORDERS", () => {
        const orders = [
            { id: 201, status: "DELIVERED", createdAt: "2026-10-12T07:00:00.000Z" },
            { id: 202, status: "DELIVERED", createdAt: "2026-10-12T08:00:00.000Z" },
        ];
        const { presentOrders, previousOrders } = filterAndSortOrders(orders);
        expect(presentOrders.length).toBe(0);
        expect(previousOrders.length).toBe(2);
    });

    it("TEST 9: No delivered orders -> empty PREVIOUS ORDERS", () => {
        const orders = [
            { id: 301, status: "PLACED", createdAt: "2026-10-12T09:00:00.000Z" },
            { id: 302, status: "PREPARING", createdAt: "2026-10-12T09:15:00.000Z" },
        ];
        const { presentOrders, previousOrders } = filterAndSortOrders(orders);
        expect(presentOrders.length).toBe(2);
        expect(previousOrders.length).toBe(0);
    });

    it("TEST 10: Verify no order appears in both sections", () => {
        const sampleOrders = [
            { id: 1, status: "PLACED", createdAt: "2026-10-12T09:00:00.000Z" },
            { id: 2, status: "ACCEPTED", createdAt: "2026-10-12T09:05:00.000Z" },
            { id: 3, status: "CONFIRMED", createdAt: "2026-10-12T09:10:00.000Z" },
            { id: 4, status: "PREPARING", createdAt: "2026-10-12T09:15:00.000Z" },
            { id: 5, status: "READY", createdAt: "2026-10-12T09:20:00.000Z" },
            { id: 6, status: "OUT_FOR_DELIVERY", createdAt: "2026-10-12T09:25:00.000Z" },
            { id: 7, status: "PICKED_UP", createdAt: "2026-10-12T09:30:00.000Z" },
            { id: 8, status: "DELIVERED", createdAt: "2026-10-12T09:35:00.000Z" },
            { id: 9, status: "delivered", createdAt: "2026-10-12T09:40:00.000Z" },
            { id: 10, status: "Delivered", createdAt: "2026-10-12T09:45:00.000Z" },
        ];

        const { presentOrders, previousOrders } = filterAndSortOrders(sampleOrders);

        const presentIds = new Set(presentOrders.map((o) => o.id));
        const previousIds = new Set(previousOrders.map((o) => o.id));

        // Intersection must be completely empty
        const intersection = [...presentIds].filter((id) => previousIds.has(id));
        expect(intersection).toEqual([]);

        // Union must contain all orders
        expect(presentOrders.length + previousOrders.length).toBe(sampleOrders.length);
    });

    it("Sorting: Present Orders sorted by newest createdAt, Previous Orders sorted by delivered timestamp", () => {
        const orders = [
            { id: "P1", status: "PLACED", createdAt: "2026-10-12T08:00:00.000Z" },
            { id: "P2", status: "PREPARING", createdAt: "2026-10-12T10:00:00.000Z" },
            { id: "P3", status: "READY", createdAt: "2026-10-12T09:00:00.000Z" },
            {
                id: "D1",
                status: "DELIVERED",
                createdAt: "2026-10-10T08:00:00.000Z",
                statusEvents: [{ status: "DELIVERED", createdAt: "2026-10-10T12:00:00.000Z" }],
            },
            {
                id: "D2",
                status: "DELIVERED",
                createdAt: "2026-10-11T08:00:00.000Z",
                statusEvents: [{ status: "DELIVERED", createdAt: "2026-10-11T09:00:00.000Z" }],
            },
        ];

        const { presentOrders, previousOrders } = filterAndSortOrders(orders);

        // P2 (10:00) > P3 (09:00) > P1 (08:00)
        expect(presentOrders.map((o) => o.id)).toEqual(["P2", "P3", "P1"]);

        // D2 delivered at Oct 11 09:00 > D1 delivered at Oct 10 12:00
        expect(previousOrders.map((o) => o.id)).toEqual(["D2", "D1"]);
    });
});
