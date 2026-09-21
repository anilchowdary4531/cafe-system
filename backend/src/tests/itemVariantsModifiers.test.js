import test from "node:test";
import assert from "node:assert/strict";
import { toPriceSubunitItems } from "../services/billingService.js";

test("Item Variants, Modifiers & Add-ons Test Suite", async (t) => {
    // Shared Mock Database State
    const mockMenuItems = [
        {
            id: 101,
            restaurantId: 1,
            name: "Coca Cola",
            price: 60,
            isAvailable: true,
            variants: [],
            modifierGroups: [],
        },
        {
            id: 102,
            restaurantId: 1,
            name: "Margherita Pizza",
            price: 200, // Base price for Small
            isAvailable: true,
            variants: [
                { id: 201, name: "Small", price: 200, isAvailable: true },
                { id: 202, name: "Medium", price: 300, isAvailable: true },
                { id: 203, name: "Large", price: 400, isAvailable: true },
            ],
            modifierGroups: [
                {
                    id: 301,
                    name: "Crust",
                    isRequired: true,
                    minSelect: 1,
                    maxSelect: 1,
                    isAvailable: true,
                    modifiers: [
                        { id: 401, name: "Normal Crust", price: 0, isAvailable: true },
                        { id: 402, name: "Cheese Burst", price: 80, isAvailable: true },
                    ],
                },
                {
                    id: 302,
                    name: "Add-ons",
                    isRequired: false,
                    minSelect: 0,
                    maxSelect: 2,
                    isAvailable: true,
                    modifiers: [
                        { id: 501, name: "Extra Cheese", price: 50, isAvailable: true },
                        { id: 502, name: "Olives", price: 30, isAvailable: true },
                        { id: 503, name: "Jalapenos", price: 30, isAvailable: true },
                    ],
                },
            ],
        },
    ];

    await t.test("1. Simple unconfigured item (Coke ₹60) evaluates correctly", () => {
        const inputItems = [{ menuItemId: 101, qty: 2 }];
        const result = toPriceSubunitItems({ menuItems: mockMenuItems, items: inputItems });

        assert.equal(result.length, 1);
        assert.equal(result[0].menuItemId, 101);
        assert.equal(result[0].itemName, "Coca Cola");
        assert.equal(result[0].unitPrice, 60);
        assert.equal(result[0].priceSubunit, 6000); // 60.00 * 100
        assert.equal(result[0].variantId, null);
        assert.equal(result[0].selectedModifiers, null);
    });

    await t.test("2. Valid size variant selection (Large Pizza ₹400) uses variant price", () => {
        const inputItems = [
            {
                menuItemId: 102,
                qty: 1,
                variantId: 203, // Large
                selectedModifiers: [{ groupName: "Crust", modifierId: 401, name: "Normal Crust", price: 0 }],
            },
        ];
        const result = toPriceSubunitItems({ menuItems: mockMenuItems, items: inputItems });

        assert.equal(result.length, 1);
        assert.equal(result[0].variantId, 203);
        assert.equal(result[0].variantName, "Large");
        assert.equal(result[0].variantPrice, 400);
        assert.equal(result[0].unitPrice, 400);
        assert.equal(result[0].priceSubunit, 40000); // 400 * 100
    });

    await t.test("3. Portion variant + add-ons calculates authoritative subtotal", () => {
        // Medium Pizza (300) + Cheese Burst (80) + Extra Cheese (50) = 430
        const inputItems = [
            {
                menuItemId: 102,
                qty: 2,
                variantId: 202, // Medium (300)
                selectedModifiers: [
                    { groupName: "Crust", modifierId: 402, name: "Cheese Burst", price: 80 },
                    { groupName: "Add-ons", modifierId: 501, name: "Extra Cheese", price: 50 },
                ],
            },
        ];
        const result = toPriceSubunitItems({ menuItems: mockMenuItems, items: inputItems });

        assert.equal(result.length, 1);
        assert.equal(result[0].variantPrice, 300);
        assert.equal(result[0].unitPrice, 430);
        assert.equal(result[0].priceSubunit, 43000); // 430 * 100
        assert.equal(result[0].selectedModifiers.length, 2);
    });

    await t.test("4. Missing required modifier group throws validation error", () => {
        const inputItems = [
            {
                menuItemId: 102,
                qty: 1,
                variantId: 201, // Small
                selectedModifiers: [], // Missing required 'Crust' selection!
            },
        ];

        assert.throws(
            () => {
                toPriceSubunitItems({ menuItems: mockMenuItems, items: inputItems });
            },
            {
                name: "Error",
                message: /Selection required for group 'Crust' in item 'Margherita Pizza'/,
            }
        );
    });

    await t.test("5. Selecting more than maxSelect options throws validation error", () => {
        const inputItems = [
            {
                menuItemId: 102,
                qty: 1,
                variantId: 201,
                selectedModifiers: [
                    { modifierGroupId: 301, modifierId: 401, name: "Normal Crust", price: 0 },
                    { modifierGroupId: 302, modifierId: 501, name: "Extra Cheese", price: 50 },
                    { modifierGroupId: 302, modifierId: 502, name: "Olives", price: 30 },
                    { modifierGroupId: 302, modifierId: 503, name: "Jalapenos", price: 30 }, // 3 add-ons, maxSelect is 2!
                ],
            },
        ];

        assert.throws(
            () => {
                toPriceSubunitItems({ menuItems: mockMenuItems, items: inputItems });
            },
            {
                name: "Error",
                message: /Maximum 2 selection\(s\) allowed for 'Add-ons'/,
            }
        );
    });

    await t.test("6. Tamper resistance: Client-sent price overrides are strictly ignored", () => {
        const inputItems = [
            {
                menuItemId: 102,
                qty: 1,
                variantId: 203, // Large (DB price: 400)
                variantPrice: 1.00, // Attack attempt: client sends 1 INR
                selectedModifiers: [
                    { modifierGroupId: 301, modifierId: 402, name: "Cheese Burst", price: 0.01 }, // Attack attempt
                ],
            },
        ];
        const result = toPriceSubunitItems({ menuItems: mockMenuItems, items: inputItems });

        // Server MUST calculate 400 + 80 = 480 (48000 subunits) ignoring client 1.00 / 0.01
        assert.equal(result[0].variantPrice, 400);
        assert.equal(result[0].unitPrice, 480);
        assert.equal(result[0].priceSubunit, 48000);
        assert.equal(result[0].selectedModifiers[0].price, 80);
    });

    await t.test("7. Inactive variant is rejected", () => {
        const mockMenuItemsWithInactiveVariant = [
            {
                ...mockMenuItems[1],
                variants: [
                    { id: 201, name: "Small", price: 200, isActive: false }, // Inactive!
                ],
            },
        ];

        const inputItems = [{ menuItemId: 102, qty: 1, variantId: 201 }];

        assert.throws(
            () => {
                toPriceSubunitItems({ menuItems: mockMenuItemsWithInactiveVariant, items: inputItems });
            },
            {
                name: "Error",
                message: /Variant not found or inactive for item 'Margherita Pizza'/,
            }
        );
    });

    await t.test("8. Snapshot object structure preserves historical state", () => {
        const orderItemSnapshot = {
            id: 99,
            orderId: 1001,
            menuItemId: 102,
            itemName: "Margherita Pizza",
            variantId: 203,
            variantName: "Large",
            variantPrice: 400,
            selectedModifiers: [
                { modifierGroupId: 301, groupName: "Crust", modifierId: 402, name: "Cheese Burst", price: 80 },
                { modifierGroupId: 302, groupName: "Add-ons", modifierId: 501, name: "Extra Cheese", price: 50 },
            ],
            price: 530,
            qty: 2,
            total: 1060,
        };

        assert.equal(orderItemSnapshot.variantName, "Large");
        assert.equal(orderItemSnapshot.price, 530);
        assert.equal(orderItemSnapshot.total, 1060);
        assert.equal(orderItemSnapshot.selectedModifiers.length, 2);
    });
});
