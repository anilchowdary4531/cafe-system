import test from "node:test";
import assert from "node:assert/strict";
import { CustomerPresenceManager } from "../realtime/presenceManager.js";

// Helper to create mock prisma context
const createMockPrisma = () => {
  const store = {
    customerAccounts: new Map(),
  };

  return {
    store,
    customerAccount: {
      update: async ({ where, data }) => {
        const acc = store.customerAccounts.get(where.id);
        if (!acc) throw new Error("Customer not found: " + where.id);
        const updated = { ...acc, ...data };
        store.customerAccounts.set(where.id, updated);
        return updated;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const [id, acc] of store.customerAccounts.entries()) {
          if (where.isOnline === undefined || acc.isOnline === where.isOnline) {
            store.customerAccounts.set(id, { ...acc, ...data });
            count++;
          }
        }
        return { count };
      },
      count: async () => {
        return store.customerAccounts.size;
      },
      findUnique: async ({ where }) => {
        return store.customerAccounts.get(where.id) || null;
      },
    },
  };
};

// Helper to create mock Socket.IO and staff namespace
const createMockSockets = () => {
  const emittedEvents = [];

  const createRoomBroadcaster = (roomName) => ({
    emit: (event, payload) => {
      emittedEvents.push({ room: roomName, event, payload });
    },
  });

  const mockStaff = {
    to: (roomName) => createRoomBroadcaster(roomName),
  };

  const mockIo = {
    to: (roomName) => createRoomBroadcaster(roomName),
  };

  return { mockIo, mockStaff, emittedEvents };
};

// Helper to create mock client socket
const createMockClientSocket = (socketId) => {
  const joinedRooms = new Set();
  return {
    id: socketId,
    join: (r) => joinedRooms.add(r),
    leave: (r) => joinedRooms.delete(r),
    joinedRooms,
  };
};

test("Customer Presence Manager — Comprehensive Test Suite", async (t) => {
  await t.test("1. Customer socket connects -> Marked ONLINE and broadcasts customer:online", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.store.customerAccounts.set(101, { id: 101, name: "Alice", isOnline: false, lastSeenAt: null });
    const { mockIo, mockStaff, emittedEvents } = createMockSockets();

    const manager = new CustomerPresenceManager({
      prisma: mockPrisma,
      io: mockIo,
      staffNamespace: mockStaff,
      graceMs: 100, // fast grace period for testing
    });

    const socketA = createMockClientSocket("sock-alice-1");
    await manager.handleCustomerConnected(101, socketA);

    assert.equal(manager.isCustomerOnline(101), true, "Alice should be online in memory");
    assert.equal(manager.getOnlineCount(), 1, "Total online count should be 1");

    const dbAcc = mockPrisma.store.customerAccounts.get(101);
    assert.equal(dbAcc.isOnline, true, "Alice should be marked isOnline: true in DB");
    assert.ok(dbAcc.lastSeenAt, "lastSeenAt timestamp should be set in DB");

    const onlineEvents = emittedEvents.filter((e) => e.event === "customer:online");
    assert.ok(onlineEvents.length >= 1, "Should emit customer:online event");
    assert.equal(onlineEvents[0].payload.customerId, 101);
    assert.equal(onlineEvents[0].payload.isOnline, true);
  });

  await t.test("2. Customer socket disconnects -> Marked OFFLINE after grace period", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.store.customerAccounts.set(102, { id: 102, name: "Bob", isOnline: false, lastSeenAt: null });
    const { mockIo, mockStaff, emittedEvents } = createMockSockets();

    const manager = new CustomerPresenceManager({
      prisma: mockPrisma,
      io: mockIo,
      staffNamespace: mockStaff,
      graceMs: 50,
    });

    const socketBob = createMockClientSocket("sock-bob-1");
    await manager.handleCustomerConnected(102, socketBob);
    assert.equal(manager.isCustomerOnline(102), true);

    // Disconnect
    await manager.handleCustomerDisconnected("sock-bob-1");

    // Immediately after disconnect, customer has 0 active sockets but remains online during grace period
    assert.equal(manager.hasActiveSockets(102), false, "No active sockets connected");
    assert.equal(manager.isCustomerOnline(102), true, "Remains online during grace period");
    const dbAccBeforeGrace = mockPrisma.store.customerAccounts.get(102);
    assert.equal(dbAccBeforeGrace.isOnline, true, "DB status should remain true during grace period");

    // Wait for grace period to expire
    await new Promise((resolve) => setTimeout(resolve, 80));

    const dbAccAfterGrace = mockPrisma.store.customerAccounts.get(102);
    assert.equal(dbAccAfterGrace.isOnline, false, "DB status should be false after grace period");
    assert.ok(dbAccAfterGrace.lastSeenAt, "lastSeenAt should be updated upon disconnect");

    const offlineEvents = emittedEvents.filter((e) => e.event === "customer:offline");
    assert.ok(offlineEvents.length >= 1, "Should emit customer:offline event");
    assert.equal(offlineEvents[0].payload.customerId, 102);
    assert.equal(offlineEvents[0].payload.isOnline, false);
  });

  await t.test("3. Customer reconnects before grace period expires -> Remains ONLINE without extra offline transition", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.store.customerAccounts.set(103, { id: 103, name: "Charlie", isOnline: false, lastSeenAt: null });
    const { mockIo, mockStaff, emittedEvents } = createMockSockets();

    const manager = new CustomerPresenceManager({
      prisma: mockPrisma,
      io: mockIo,
      staffNamespace: mockStaff,
      graceMs: 150,
    });

    const sock1 = createMockClientSocket("sock-charlie-1");
    await manager.handleCustomerConnected(103, sock1);

    // Disconnect
    await manager.handleCustomerDisconnected("sock-charlie-1");

    // Reconnect within 40ms (grace period is 150ms)
    await new Promise((resolve) => setTimeout(resolve, 40));
    const sock2 = createMockClientSocket("sock-charlie-2");
    await manager.handleCustomerConnected(103, sock2);

    // Wait until past the original grace period
    await new Promise((resolve) => setTimeout(resolve, 160));

    assert.equal(manager.isCustomerOnline(103), true, "Charlie should still be online");
    const dbAcc = mockPrisma.store.customerAccounts.get(103);
    assert.equal(dbAcc.isOnline, true, "DB isOnline must remain true");

    const offlineEvents = emittedEvents.filter((e) => e.event === "customer:offline");
    assert.equal(offlineEvents.length, 0, "No customer:offline should have been emitted");
  });

  await t.test("4. Multi-device: Multiple sockets for 1 customer count as 1 online customer", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.store.customerAccounts.set(104, { id: 104, name: "Dave", isOnline: false, lastSeenAt: null });
    const { mockIo, mockStaff, emittedEvents } = createMockSockets();

    const manager = new CustomerPresenceManager({
      prisma: mockPrisma,
      io: mockIo,
      staffNamespace: mockStaff,
      graceMs: 100,
    });

    const phoneSocket = createMockClientSocket("sock-dave-phone");
    const tabletSocket = createMockClientSocket("sock-dave-tablet");

    await manager.handleCustomerConnected(104, phoneSocket);
    assert.equal(manager.getOnlineCount(), 1, "Count should be 1 after phone connects");
    const countAfterFirst = emittedEvents.filter((e) => e.event === "customer:online").length;

    await manager.handleCustomerConnected(104, tabletSocket);
    assert.equal(manager.getOnlineCount(), 1, "Count must STILL be 1 after tablet connects (multi-device)");
    const countAfterSecond = emittedEvents.filter((e) => e.event === "customer:online").length;

    assert.equal(countAfterFirst, countAfterSecond, "customer:online must NOT be emitted again when 2nd device connects");
  });

  await t.test("5. Multi-device: First socket disconnects while second remains -> Customer stays ONLINE", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.store.customerAccounts.set(105, { id: 105, name: "Eve", isOnline: false, lastSeenAt: null });
    const { mockIo, mockStaff } = createMockSockets();

    const manager = new CustomerPresenceManager({
      prisma: mockPrisma,
      io: mockIo,
      staffNamespace: mockStaff,
      graceMs: 50,
    });

    const phoneSocket = createMockClientSocket("sock-eve-phone");
    const laptopSocket = createMockClientSocket("sock-eve-laptop");

    await manager.handleCustomerConnected(105, phoneSocket);
    await manager.handleCustomerConnected(105, laptopSocket);

    // Disconnect phone
    await manager.handleCustomerDisconnected("sock-eve-phone");
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Eve should remain ONLINE because laptop is still active
    assert.equal(manager.isCustomerOnline(105), true, "Eve should remain online via laptop");
    assert.equal(manager.getOnlineCount(), 1, "Online count should remain 1");
    const dbAcc = mockPrisma.store.customerAccounts.get(105);
    assert.equal(dbAcc.isOnline, true, "DB isOnline must remain true");
  });

  await t.test("6. Multi-device: Last socket disconnects -> Transitions OFFLINE after grace period", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.store.customerAccounts.set(106, { id: 106, name: "Frank", isOnline: false, lastSeenAt: null });
    const { mockIo, mockStaff, emittedEvents } = createMockSockets();

    const manager = new CustomerPresenceManager({
      prisma: mockPrisma,
      io: mockIo,
      staffNamespace: mockStaff,
      graceMs: 50,
    });

    const phoneSocket = createMockClientSocket("sock-frank-phone");
    const tabletSocket = createMockClientSocket("sock-frank-tablet");

    await manager.handleCustomerConnected(106, phoneSocket);
    await manager.handleCustomerConnected(106, tabletSocket);

    // Disconnect first socket
    await manager.handleCustomerDisconnected("sock-frank-phone");
    assert.equal(manager.isCustomerOnline(106), true);

    // Disconnect last socket
    await manager.handleCustomerDisconnected("sock-frank-tablet");
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.equal(manager.isCustomerOnline(106), false, "Frank should now be offline");
    assert.equal(manager.getOnlineCount(), 0, "Online count should be 0");
    const dbAcc = mockPrisma.store.customerAccounts.get(106);
    assert.equal(dbAcc.isOnline, false, "DB isOnline must be false");
  });

  await t.test("7. Explicit customer logout -> Immediately OFFLINE and cancels grace timer", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.store.customerAccounts.set(107, { id: 107, name: "Grace", isOnline: false, lastSeenAt: null });
    const { mockIo, mockStaff, emittedEvents } = createMockSockets();

    const manager = new CustomerPresenceManager({
      prisma: mockPrisma,
      io: mockIo,
      staffNamespace: mockStaff,
      graceMs: 5000, // long grace period
    });

    const sock = createMockClientSocket("sock-grace-1");
    await manager.handleCustomerConnected(107, sock);
    assert.equal(manager.isCustomerOnline(107), true);

    // Explicit logout
    await manager.handleCustomerLogout(107);

    assert.equal(manager.isCustomerOnline(107), false, "Should be offline immediately on logout");
    const dbAcc = mockPrisma.store.customerAccounts.get(107);
    assert.equal(dbAcc.isOnline, false, "DB isOnline should immediately be false without waiting 5s");

    const offlineEvents = emittedEvents.filter((e) => e.event === "customer:offline");
    assert.ok(offlineEvents.length >= 1, "customer:offline should be emitted immediately");
  });

  await t.test("8. Startup Reset -> Resets any stale DB records left online from previous backend crash/restart", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.store.customerAccounts.set(201, { id: 201, name: "Stale1", isOnline: true });
    mockPrisma.store.customerAccounts.set(202, { id: 202, name: "Stale2", isOnline: true });
    mockPrisma.store.customerAccounts.set(203, { id: 203, name: "Clean", isOnline: false });

    const manager = new CustomerPresenceManager({ prisma: mockPrisma });
    await manager.startupReset();

    assert.equal(mockPrisma.store.customerAccounts.get(201).isOnline, false);
    assert.equal(mockPrisma.store.customerAccounts.get(202).isOnline, false);
    assert.equal(mockPrisma.store.customerAccounts.get(203).isOnline, false);
  });

  await t.test("9. Aggregate presence counts calculation", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.store.customerAccounts.set(301, { id: 301, name: "User1", isOnline: false });
    mockPrisma.store.customerAccounts.set(302, { id: 302, name: "User2", isOnline: false });
    mockPrisma.store.customerAccounts.set(303, { id: 303, name: "User3", isOnline: false });
    mockPrisma.store.customerAccounts.set(304, { id: 304, name: "User4", isOnline: false });

    const manager = new CustomerPresenceManager({ prisma: mockPrisma, graceMs: 50 });

    const sock1 = createMockClientSocket("sock-301");
    await manager.handleCustomerConnected(301, sock1);

    const counts = await manager.getPresenceCounts();
    assert.equal(counts.totalCustomers, 4);
    assert.equal(counts.onlineCustomers, 1);
    assert.equal(counts.offlineCustomers, 3);
  });
});
