/**
 * Firebase Cloud Messaging (FCM) Notification Service
 */

const sendFcmNotification = async ({ fcmToken, topic, type, title, body, data = {} }) => {
  try {
    const payload = {
      notification: {
        title,
        body
      },
      data: {
        type: type || 'GENERAL',
        title: title || '',
        body: body || '',
        ...data
      }
    };

    console.log(`[FCM Push] Sent (${type}): ${title} -> ${body}`, { target: fcmToken ? 'Token' : topic });
    return { success: true, payload };
  } catch (error) {
    console.error('[FCM Error]:', error);
    return { success: false, error: error.message };
  }
};

// Customer Notifications
const notifyCustomerOrderConfirmed = (fcmToken, orderId, restaurantName) =>
  sendFcmNotification({
    fcmToken,
    type: 'ORDER_CONFIRMED',
    title: 'Order Confirmed! 🎉',
    body: `Your order #${orderId} has been confirmed by ${restaurantName}.`,
    data: { orderId: String(orderId) }
  });

const notifyCustomerPreparing = (fcmToken, orderId) =>
  sendFcmNotification({
    fcmToken,
    type: 'PREPARING',
    title: 'Kitchen is Cooking! 🍳',
    body: `Your order #${orderId} is now being prepared fresh.`,
    data: { orderId: String(orderId) }
  });

const notifyCustomerOutForDelivery = (fcmToken, orderId, driverName) =>
  sendFcmNotification({
    fcmToken,
    type: 'OUT_FOR_DELIVERY',
    title: 'Out for Delivery! 🛵',
    body: `${driverName || 'Delivery Partner'} is on the way with order #${orderId}.`,
    data: { orderId: String(orderId) }
  });

const notifyCustomerDelivered = (fcmToken, orderId) =>
  sendFcmNotification({
    fcmToken,
    type: 'DELIVERED',
    title: 'Order Delivered! 😋',
    body: `Order #${orderId} has been delivered. Enjoy your meal!`,
    data: { orderId: String(orderId) }
  });

// Restaurant Notifications
const notifyRestaurantNewOrder = (fcmToken, orderId, amount) =>
  sendFcmNotification({
    fcmToken,
    topic: 'restaurant_orders',
    type: 'NEW_ORDER',
    title: 'New Order Received! 🔔',
    body: `New order #${orderId} worth ₹${amount} received. Tap to view.`,
    data: { orderId: String(orderId) }
  });

const notifyRestaurantSettlementPaid = (fcmToken, amount) =>
  sendFcmNotification({
    fcmToken,
    type: 'SETTLEMENT',
    title: 'Settlement Processed! 💰',
    body: `Daily settlement payout of ₹${amount} has been transferred via Cashfree.`,
    data: {}
  });

// Admin Notifications
const notifyAdminPaymentFailure = (fcmToken, orderId, reason) =>
  sendFcmNotification({
    fcmToken,
    topic: 'admin_alerts',
    type: 'PAYMENT_FAILURE',
    title: 'Payment Failure Alert ⚠️',
    body: `Order #${orderId} failed during Cashfree checkout: ${reason}`,
    data: { orderId: String(orderId) }
  });

module.exports = {
  sendFcmNotification,
  notifyCustomerOrderConfirmed,
  notifyCustomerPreparing,
  notifyCustomerOutForDelivery,
  notifyCustomerDelivered,
  notifyRestaurantNewOrder,
  notifyRestaurantSettlementPaid,
  notifyAdminPaymentFailure
};
