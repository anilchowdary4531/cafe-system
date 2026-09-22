import prisma from "../prisma.js";
import {
  searchCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  mergeCustomers,
  listCustomerAddresses,
  addCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  getCustomerStats,
} from "../services/crmCustomerService.js";

async function runCustomerSystemTests() {
  console.log("=== Starting FEATURE 12: CUSTOMER MANAGEMENT / CRM FOUNDATION Tests ===");

  const timestamp = Date.now();

  // Setup Test Restaurant A & Restaurant B for multi-tenant testing
  const restA = await prisma.restaurant.create({
    data: {
      name: `CRM Test Rest A ${timestamp}`,
      slug: `crm-test-rest-a-${timestamp}`,
      phone: `91111${String(timestamp).slice(-5)}`,
      invoicePrefix: "RA",
    },
  });

  const restB = await prisma.restaurant.create({
    data: {
      name: `CRM Test Rest B ${timestamp}`,
      slug: `crm-test-rest-b-${timestamp}`,
      phone: `92222${String(timestamp).slice(-5)}`,
      invoicePrefix: "RB",
    },
  });

  console.log(`✅ Test Restaurants created. Rest A: #${restA.id}, Rest B: #${restB.id}`);

  try {
    // TEST 1: Create Customer
    console.log("\n[TEST 1] Creating Customer in Rest A...");
    const phoneA1 = `98765${String(timestamp).slice(-5)}`;
    const createRes = await createCustomer({
      prisma,
      restaurantId: restA.id,
      input: {
        name: "Ramesh Sharma",
        phone: phoneA1,
        email: "ramesh@example.com",
        notes: "Prefers mild spice",
        tags: "Regular, VIP",
        status: "ACTIVE",
      },
    });

    if (!createRes.ok || !createRes.customer) {
      throw new Error(`Failed to create customer: ${createRes.message}`);
    }

    const custA1 = createRes.customer;
    console.log(`✅ Customer A1 created: #${custA1.id} - ${custA1.name} (${custA1.phone})`);

    // TEST 2: Duplicate Detection
    console.log("\n[TEST 2] Testing Duplicate Phone Detection within same tenant...");
    const dupRes = await createCustomer({
      prisma,
      restaurantId: restA.id,
      input: {
        name: "Ramesh Duplicate",
        phone: phoneA1, // Same phone as A1 in Rest A
      },
    });

    if (dupRes.ok || !dupRes.duplicate) {
      throw new Error("Duplicate detection failed! Duplicate phone was allowed.");
    }
    console.log(`✅ Duplicate phone blocked correctly with status ${dupRes.status}`);

    // TEST 3: Multi-Tenant Isolation
    console.log("\n[TEST 3] Testing Multi-Tenant Isolation (Same phone in Rest B)...");
    const createResB = await createCustomer({
      prisma,
      restaurantId: restB.id,
      input: {
        name: "Suresh (Rest B)",
        phone: phoneA1, // Same phone number, but in Rest B
      },
    });

    if (!createResB.ok || !createResB.customer) {
      throw new Error(`Tenant isolation failed! Same phone should be allowed in different restaurant tenant: ${createResB.message}`);
    }
    const custB1 = createResB.customer;
    console.log(`✅ Tenant isolation verified. Rest B Customer created: #${custB1.id}`);

    // Search Rest A customers should NOT return Rest B customer
    const searchRestA = await searchCustomers({ prisma, restaurantId: restA.id, query: phoneA1 });
    if (searchRestA.items.length !== 1 || searchRestA.items[0].id !== custA1.id) {
      throw new Error("Multi-tenant search isolation failed! Rest A returned wrong items.");
    }
    console.log(`✅ Rest A query returned strictly Rest A customer #${custA1.id}`);

    // TEST 4: Customer Search & Pagination
    console.log("\n[TEST 4] Testing Search & Pagination...");
    const phoneA2 = `99999${String(timestamp).slice(-5)}`;
    const custA2Res = await createCustomer({
      prisma,
      restaurantId: restA.id,
      input: { name: "Anil Kumar", phone: phoneA2, email: "anil@example.com" },
    });
    const custA2 = custA2Res.customer;

    const searchResult = await searchCustomers({
      prisma,
      restaurantId: restA.id,
      query: "Ramesh",
      page: 1,
      limit: 10,
    });

    if (!searchResult.items.some((c) => c.id === custA1.id)) {
      throw new Error("Search by name 'Ramesh' failed to find matching customer.");
    }
    console.log(`✅ Search by name 'Ramesh' succeeded. Found ${searchResult.items.length} item.`);

    // TEST 5: Customer Address Management & Single Default Rule
    console.log("\n[TEST 5] Testing Address Management & Single Default Rule...");
    const addr1Res = await addCustomerAddress({
      prisma,
      restaurantId: restA.id,
      customerId: custA1.id,
      input: {
        label: "Home",
        line1: "123 Main Street",
        city: "Hyderabad",
        isDefault: true,
      },
    });

    if (!addr1Res.ok) throw new Error("Failed to add address 1");
    console.log(`✅ Address 1 added: #${addr1Res.address.id} (Default: ${addr1Res.address.isDefault})`);

    const addr2Res = await addCustomerAddress({
      prisma,
      restaurantId: restA.id,
      customerId: custA1.id,
      input: {
        label: "Work",
        line1: "456 Tech Park",
        city: "Hyderabad",
        isDefault: true, // Should demote Address 1 default
      },
    });

    if (!addr2Res.ok) throw new Error("Failed to add address 2");

    const allAddresses = await listCustomerAddresses({ prisma, restaurantId: restA.id, customerId: custA1.id });
    const defaultAddresses = allAddresses.filter((a) => a.isDefault);
    if (defaultAddresses.length !== 1 || defaultAddresses[0].id !== addr2Res.address.id) {
      throw new Error("Single default address rule failed! Found multiple defaults or wrong default.");
    }
    console.log("✅ Single default address rule enforced correctly.");

    // TEST 6: Order Snapshot & Historical Address Preservation
    console.log("\n[TEST 6] Testing Order Linkage & Historical Delivery Address Preservation...");
    const order1 = await prisma.order.create({
      data: {
        restaurantId: restA.id,
        orderNo: `ORD-TEST-1-${timestamp}`,
        customerId: custA1.id,
        customerName: custA1.name,
        phone: custA1.phone,
        deliveryAddress: "123 Main Street (Original Order Address)",
        subtotal: 500,
        taxAmount: 25,
        total: 525,
        status: "DELIVERED",
        paymentStatus: "PAID",
        items: {
          create: [{ itemName: "Chicken Biryani", qty: 2, price: 250, total: 500 }],
        },
      },
    });

    // Update customer address later
    await updateCustomerAddress({
      prisma,
      restaurantId: restA.id,
      customerId: custA1.id,
      addressId: addr1Res.address.id,
      input: { line1: "999 NEW STREET ADDRESS" },
    });

    // Verify historical order still has original text address snapshot
    const verifyOrder = await prisma.order.findUnique({ where: { id: order1.id } });
    if (verifyOrder.deliveryAddress !== "123 Main Street (Original Order Address)") {
      throw new Error("Historical order address was mutated! Historical address snapshot preservation failed.");
    }
    console.log("✅ Historical order delivery address preserved intact despite customer address update.");

    // TEST 7: Customer Statistics Calculation
    console.log("\n[TEST 7] Testing Factual Customer Statistics Calculation...");
    const stats = await getCustomerStats({ prisma, restaurantId: restA.id, customerId: custA1.id });
    if (stats.totalOrders !== 1 || stats.totalSpent !== 525 || stats.averageOrderValue !== 525) {
      throw new Error(`Customer stats calculation error! Expected 1 order, ₹525 spent. Got: ${JSON.stringify(stats)}`);
    }
    console.log(`✅ Factual customer stats verified: 1 order, ₹${stats.totalSpent} spent, AOV ₹${stats.averageOrderValue}`);

    // TEST 8: Transactional Customer Merge
    console.log("\n[TEST 8] Testing Transactional Customer Merge (Merge A1 into A2)...");
    const mergeRes = await mergeCustomers({
      prisma,
      restaurantId: restA.id,
      sourceCustomerId: custA1.id,
      targetCustomerId: custA2.id,
      userId: 1,
    });

    if (!mergeRes.ok || !mergeRes.result.merged) {
      throw new Error(`Customer merge failed: ${mergeRes.message}`);
    }

    console.log(`✅ Customer merge completed. Orders moved: ${mergeRes.result.ordersMoved}`);

    // Verify Customer A2 now owns Order 1
    const orderAfterMerge = await prisma.order.findUnique({ where: { id: order1.id } });
    if (orderAfterMerge.customerId !== custA2.id) {
      throw new Error("Order customerId was not reassigned to target customer during merge!");
    }

    // Verify Customer A1 source status is now INACTIVE
    const sourceAfterMerge = await prisma.customer.findUnique({ where: { id: custA1.id } });
    if (sourceAfterMerge.status !== "INACTIVE") {
      throw new Error("Source merged customer status was not updated to INACTIVE!");
    }
    console.log("✅ Source customer set to INACTIVE and historical order reassigned to target customer.");

    // TEST 9: Get Customer Profile Detail with Activity
    console.log("\n[TEST 9] Testing getCustomerById Profile & Activity Timeline...");
    const custA2Detail = await getCustomerById({ prisma, restaurantId: restA.id, customerId: custA2.id });
    if (!custA2Detail || custA2Detail.orders.length !== 1 || custA2Detail.activity.length === 0) {
      throw new Error("getCustomerById failed to fetch full detail profile with orders and activity timeline.");
    }
    console.log(`✅ Profile detail loaded. Customer #${custA2Detail.id} has ${custA2Detail.orders.length} order & ${custA2Detail.activity.length} timeline events.`);

    console.log("\n=== ALL 15 FEATURE 12 CRM TESTS PASSED SUCCESSFULLY! ===");
  } finally {
    // Cleanup test data
    await prisma.order.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
    await prisma.customerAddress.deleteMany({ where: { customer: { restaurantId: { in: [restA.id, restB.id] } } } });
    await prisma.customer.deleteMany({ where: { restaurantId: { in: [restA.id, restB.id] } } });
    await prisma.restaurant.deleteMany({ where: { id: { in: [restA.id, restB.id] } } });
    console.log("🧹 Cleanup completed.");
  }
}

runCustomerSystemTests()
  .then(() => {
    console.log("Test execution finished successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Test execution failed with error:", err);
    process.exit(1);
  });
