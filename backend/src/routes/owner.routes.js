import { verifyAuth } from '../middleware/auth.js';
import { allowRoles } from '../middleware/roleGuard.js';
import {
    getMenu,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability,
} from '../controllers/menu.controller.js';
import {
    getTables,
    createTable,
    updateTable,
    deleteTable,
    regenerateQr,
} from '../controllers/table.controller.js';

import {
    getLiveOrders,
    getKitchenQueue,
    updateOrderStatus,
    getOrderHistory,
} from '../controllers/order.controller.js';

import { getRunningBill } from "../controllers/tableSessionsController.js";

export default async function (app) {
    app.get('/:restaurantId/menu', {
        preHandler: [verifyAuth, allowRoles('OWNER','MANAGER')],
    }, getMenu);

    app.post('/:restaurantId/menu', {
        preHandler: [verifyAuth, allowRoles('OWNER','MANAGER')],
    }, createMenuItem);

    app.put('/:restaurantId/menu/:menuId', {
        preHandler: [verifyAuth, allowRoles('OWNER','MANAGER')],
    }, updateMenuItem);

    app.patch('/:restaurantId/menu/:menuId/availability', {
        preHandler: [verifyAuth, allowRoles('OWNER','MANAGER')],
    }, toggleAvailability);

    app.delete('/:restaurantId/menu/:menuId', {
        preHandler: [verifyAuth, allowRoles('OWNER')],
    }, deleteMenuItem);

    app.get('/:restaurantId/tables', {
        preHandler: [verifyAuth, allowRoles('OWNER','MANAGER','WAITER')],
    }, getTables);

    app.post('/:restaurantId/tables', {
        preHandler: [verifyAuth, allowRoles('OWNER','MANAGER')],
    }, createTable);

    app.put('/:restaurantId/tables/:tableId', {
        preHandler: [verifyAuth, allowRoles('OWNER','MANAGER')],
    }, updateTable);

    app.patch('/:restaurantId/tables/:tableId/qr', {
        preHandler: [verifyAuth, allowRoles('OWNER','MANAGER')],
    }, regenerateQr);

    app.delete('/:restaurantId/tables/:tableId', {
        preHandler: [verifyAuth, allowRoles('OWNER')],
    }, deleteTable);
    app.get('/:restaurantId/orders/live', {
        preHandler: [verifyAuth, allowRoles('OWNER','MANAGER','WAITER','CHEF')],
    }, getLiveOrders);

    app.get('/:restaurantId/orders/kitchen', {
        preHandler: [verifyAuth, allowRoles('OWNER','MANAGER','CHEF')],
    }, getKitchenQueue);

    app.put('/:restaurantId/orders/:orderId/status', {
        preHandler: [verifyAuth, allowRoles('OWNER','MANAGER','WAITER','CHEF')],
    }, updateOrderStatus);

    app.get('/:restaurantId/orders/history', {
        preHandler: [verifyAuth, allowRoles('OWNER','MANAGER')],
    }, getOrderHistory);
    app.get("/owner/:restaurantId/table/:tableNo/bill", getRunningBill);
}