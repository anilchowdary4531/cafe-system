import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  RECIPIENT_TYPES,
} from "../constants/notificationTypes.js";
import {
  registerDeviceToken,
  removeDeviceToken,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notificationService.js";

test("Centralized Notification System Audit & Idempotency", async (t) => {
  await t.test("should export correct NOTIFICATION_TYPES and PRIORITIES", () => {
    assert.equal(NOTIFICATION_TYPES.ORDER_PLACED, "ORDER_PLACED");
    assert.equal(NOTIFICATION_TYPES.PAYMENT_SUCCESS, "PAYMENT_SUCCESS");
    assert.equal(NOTIFICATION_TYPES.ORDER_ACCEPTED, "ORDER_ACCEPTED");
    assert.equal(NOTIFICATION_TYPES.FOOD_PREPARING, "FOOD_PREPARING");
    assert.equal(NOTIFICATION_TYPES.DELIVERY_PARTNER_ASSIGNED, "DELIVERY_PARTNER_ASSIGNED");
    assert.equal(NOTIFICATION_PRIORITIES.HIGH, "HIGH");
    assert.equal(RECIPIENT_TYPES.CUSTOMER, "CUSTOMER");
  });

  await t.test("should register and deactivate device tokens cleanly in memory mockup", async () => {
    const mockStore = new Map();
    const mockPrisma = {
      deviceToken: {
        upsert: async ({ where, update, create }) => {
          const key = where.deviceToken;
          if (mockStore.has(key)) {
            const updated = { ...mockStore.get(key), ...update };
            mockStore.set(key, updated);
            return updated;
          }
          const created = { id: 1, ...create };
          mockStore.set(key, created);
          return created;
        },
        updateMany: async ({ where, data }) => {
          const key = where.deviceToken;
          if (mockStore.has(key)) {
            mockStore.set(key, { ...mockStore.get(key), ...data });
          }
          return { count: 1 };
        },
      },
    };

    const registered = await registerDeviceToken({
      prisma: mockPrisma,
      customerId: 101,
      deviceToken: "fcm_test_token_123",
      platform: "ANDROID",
    });

    assert.equal(registered.deviceToken, "fcm_test_token_123");
    assert.equal(registered.isActive, true);

    await removeDeviceToken({
      prisma: mockPrisma,
      deviceToken: "fcm_test_token_123",
    });

    assert.equal(mockStore.get("fcm_test_token_123").isActive, false);
  });
});
