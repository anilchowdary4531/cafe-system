import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../config/prisma.js';
import { getNextKotNumber, createKotsForOrder, updateKotStatus, reprintKot } from '../services/kotService.js';
import { generateKotEscposBuffer } from '../services/escposService.js';

test('KOT System & Thermal Printer Test Suite', async (t) => {

  // Setup test environment
  let testRestaurant;
  let testPrinter;
  let testStation;

  await t.test('1. Setup Test Restaurant & Thermal Printer', async () => {
    testRestaurant = await prisma.restaurant.create({
      data: {
        name: 'Test KOT Cafe ' + Date.now(),
        slug: 'test-kot-cafe-' + Date.now(),
        nextKotNumber: 101,
      },
    });
    assert.equal(testRestaurant.nextKotNumber, 101);

    testPrinter = await prisma.printer.create({
      data: {
        restaurantId: testRestaurant.id,
        name: 'Main Thermal Printer',
        ipAddress: '127.0.0.1',
        port: 9100,
        paperWidth: '80mm',
        isActive: true,
        isDefault: true,
      },
    });
    assert.equal(testPrinter.name, 'Main Thermal Printer');

    testStation = await prisma.kitchenStation.create({
      data: {
        restaurantId: testRestaurant.id,
        name: 'Main Kitchen',
        code: 'MAIN',
        printerId: testPrinter.id,
        isActive: true,
      },
    });
    assert.equal(testStation.name, 'Main Kitchen');
  });

  await t.test('2. Atomic Sequential KOT Number Generation', async () => {
    const { kotNo: kot1 } = await prisma.$transaction((tx) => getNextKotNumber(tx, testRestaurant.id));
    assert.equal(kot1, 'KOT-101');

    const { kotNo: kot2 } = await prisma.$transaction((tx) => getNextKotNumber(tx, testRestaurant.id));
    assert.equal(kot2, 'KOT-102');

    const updatedRestaurant = await prisma.restaurant.findUnique({
      where: { id: testRestaurant.id },
    });
    assert.equal(updatedRestaurant.nextKotNumber, 103);
  });

  await t.test('3. ESC/POS Binary Buffer Generator', async () => {
    const testBuf = generateKotEscposBuffer({
      kot: {
        kotNo: 'KOT-103',
        orderNo: '#1001',
        tableNo: 'Table 5',
        stationName: 'Main Kitchen',
        items: [
          { itemName: 'Farmhouse Pizza', quantity: 1, variantName: 'Medium', modifiers: [{ optionName: 'Extra Cheese' }] },
        ],
      },
      paperWidth: '80mm',
    });
    assert(Buffer.isBuffer(testBuf));
    assert(testBuf.length > 20);

    // Verify ESC/POS init command 0x1B 0x40 (ESC @) at beginning
    assert.equal(testBuf[0], 0x1b);
    assert.equal(testBuf[1], 0x40);

    // Verify ESC/POS content matching
    assert(testBuf.includes(Buffer.from('KOT-103')));
    assert(testBuf.includes(Buffer.from('Farmhouse Pizza')));
    assert(testBuf.includes(Buffer.from('Medium')));
  });

  await t.test('4. End-to-End KOT Creation & Routing', async () => {
    // Create master order
    const order = await prisma.order.create({
      data: {
        restaurantId: testRestaurant.id,
        tableNo: '4',
        orderNo: 'ORD-5001',
        subtotal: 550,
        total: 550,
        status: 'PLACED',
        items: {
          create: [
            {
              itemName: 'Cheese Pizza',
              qty: 1,
              price: 350,
              total: 350,
              variantName: 'Medium',
              selectedModifiers: [{ name: 'Extra Cheese' }],
            },
            {
              itemName: 'Cold Coffee',
              qty: 2,
              price: 100,
              total: 200,
            },
          ],
        },
      },
      include: { items: true },
    });

    const kots = await createKotsForOrder({ prisma, order });
    assert.equal(Array.isArray(kots), true);
    assert(kots.length > 0);

    const firstKot = kots[0];
    assert.match(firstKot.kotNo, /^KOT-/);
    assert.equal(firstKot.status, 'PENDING');
    assert.equal(firstKot.items.length, 2);

    // Verify Variant & Addon details preserved in KOT item
    const pizzaItem = firstKot.items.find(i => i.itemName === 'Cheese Pizza');
    assert.ok(pizzaItem);
    assert.equal(pizzaItem.variantName, 'Medium');
    assert.equal(Array.isArray(pizzaItem.selectedModifiers), true);
  });

  await t.test('5. KOT Status Transitions (PENDING -> PREPARING -> READY)', async () => {
    const kots = await prisma.kitchenOrderTicket.findMany({
      where: { restaurantId: testRestaurant.id },
    });
    const targetKot = kots[0];

    // Transition to PREPARING
    const prepKot = await updateKotStatus({ prisma, kotId: targetKot.id, restaurantId: testRestaurant.id, nextStatus: 'PREPARING' });
    assert.equal(prepKot.status, 'PREPARING');

    // Transition to READY
    const readyKot = await updateKotStatus({ prisma, kotId: targetKot.id, restaurantId: testRestaurant.id, nextStatus: 'READY' });
    assert.equal(readyKot.status, 'READY');
  });

  await t.test('6. Reprint Counter & Thermal Dispatch', async () => {
    const kots = await prisma.kitchenOrderTicket.findMany({
      where: { restaurantId: testRestaurant.id },
    });
    const targetKot = kots[0];

    const result = await reprintKot({ prisma, kotId: targetKot.id, restaurantId: testRestaurant.id });
    assert.equal(result.kot.reprintCount, 1);
  });

  await t.test('7. Cleanup Test Data', async () => {
    await prisma.kitchenOrderTicketItem.deleteMany({
      where: { kot: { restaurantId: testRestaurant.id } },
    });
    await prisma.kitchenOrderTicket.deleteMany({
      where: { restaurantId: testRestaurant.id },
    });
    await prisma.orderItem.deleteMany({
      where: { order: { restaurantId: testRestaurant.id } },
    });
    await prisma.order.deleteMany({
      where: { restaurantId: testRestaurant.id },
    });
    await prisma.kitchenStation.deleteMany({
      where: { restaurantId: testRestaurant.id },
    });
    await prisma.printer.deleteMany({
      where: { restaurantId: testRestaurant.id },
    });
    await prisma.restaurant.delete({
      where: { id: testRestaurant.id },
    });
  });
});
