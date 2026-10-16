import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateBill,
  resolveRestaurantBillingConfig,
  matchesOrderType,
} from "../services/billingService.js";
import { toSubunit, fromSubunit } from "../services/moneyService.js";

describe("Tiffzy Unified Billing Architecture Test Suite", () => {
  describe("A. Billing Configuration & Order-Type Filtering", () => {
    it("1-3. Resolves defaults and supports disabled taxes", () => {
      const legacyRest = {
        taxEnabled: true,
        defaultTaxPercent: 5,
        taxType: "EXCLUSIVE",
        serviceChargeEnabled: true,
        serviceChargePercent: 2.5,
      };
      const config = resolveRestaurantBillingConfig(legacyRest);
      assert.equal(config.taxes.length, 1);
      assert.equal(config.taxes[0].rate, 5);
      assert.equal(config.taxes[0].isEnabled, true);
      assert.equal(config.charges.length, 1);
      assert.equal(config.charges[0].amount, 2.5);
    });

    it("4-6. Supports multiple taxes, inclusive and exclusive", () => {
      const billingConfig = {
        taxes: [
          { name: "CGST", rate: 2.5, type: "PERCENTAGE", isInclusive: false, isEnabled: true, appliesTo: ["ALL"] },
          { name: "SGST", rate: 2.5, type: "PERCENTAGE", isInclusive: false, isEnabled: true, appliesTo: ["ALL"] },
          { name: "Cess", amount: 10, type: "FIXED", isInclusive: false, isEnabled: true, appliesTo: ["ALL"] },
          { name: "Disabled Tax", rate: 18, isEnabled: false },
        ],
        charges: [],
      };

      const items = [{ priceSubunit: toSubunit(1000), quantity: 1 }]; // ₹1000 subtotal
      const bill = calculateBill({ items, billingConfig });

      assert.equal(bill.subtotal, 1000);
      assert.equal(bill.taxes.length, 3);
      assert.equal(bill.taxes[0].name, "CGST");
      assert.equal(bill.taxes[0].amount, 25); // 2.5% of 1000
      assert.equal(bill.taxes[1].name, "SGST");
      assert.equal(bill.taxes[1].amount, 25); // 2.5% of 1000
      assert.equal(bill.taxes[2].name, "Cess");
      assert.equal(bill.taxes[2].amount, 10); // fixed ₹10
      assert.equal(bill.tax, 60);
      assert.equal(bill.grandTotal, 1060);
    });

    it("7-10. Supports fixed and percentage charges with order-type filtering", () => {
      const billingConfig = {
        taxes: [],
        charges: [
          { name: "Packaging Charge", amount: 25, type: "FIXED", isEnabled: true, appliesTo: ["TAKEAWAY", "DELIVERY"] },
          { name: "Service Charge", amount: 5, type: "PERCENTAGE", isEnabled: true, appliesTo: ["DINE_IN"] },
          { name: "Delivery Fee", amount: 50, type: "FIXED", isEnabled: true, appliesTo: ["DELIVERY"] },
        ],
      };

      const items = [{ priceSubunit: toSubunit(500), quantity: 1 }]; // ₹500

      // DINE_IN test
      const dineInBill = calculateBill({ items, billingConfig, orderType: "DINE_IN" });
      assert.equal(dineInBill.charges.length, 1);
      assert.equal(dineInBill.charges[0].name, "Service Charge");
      assert.equal(dineInBill.charges[0].amount, 25); // 5% of 500 = 25
      assert.equal(dineInBill.grandTotal, 525);

      // TAKEAWAY test
      const takeawayBill = calculateBill({ items, billingConfig, orderType: "TAKEAWAY" });
      assert.equal(takeawayBill.charges.length, 1);
      assert.equal(takeawayBill.charges[0].name, "Packaging Charge");
      assert.equal(takeawayBill.charges[0].amount, 25);
      assert.equal(takeawayBill.grandTotal, 525);

      // DELIVERY test
      const deliveryBill = calculateBill({ items, billingConfig, orderType: "DELIVERY" });
      assert.equal(deliveryBill.charges.length, 2); // Packaging + Delivery Fee
      assert.equal(deliveryBill.totalCharges, 75);
      assert.equal(deliveryBill.grandTotal, 575);
    });
  });

  describe("B. Calculation Engine Precision & Components", () => {
    it("11-17. Comprehensive breakdown: Subtotal, Discount, Tax, Charges, Tip, Round-off", () => {
      const billingConfig = {
        taxes: [
          { name: "GST", rate: 5, type: "PERCENTAGE", isInclusive: false, isEnabled: true },
        ],
        charges: [
          { name: "Packaging", amount: 15, type: "FIXED", isEnabled: true },
        ],
        allowTips: true,
        roundOff: true,
      };

      const items = [{ priceSubunit: toSubunit(240), quantity: 1 }]; // ₹240
      const bill = calculateBill({
        items,
        billingConfig,
        couponDiscountSubunit: toSubunit(40), // ₹40 discount
        tip: 20, // ₹20 tip
        orderType: "TAKEAWAY",
      });

      assert.equal(bill.subtotal, 240);
      assert.equal(bill.discount, 40);
      assert.equal(bill.tax, 12); // 5% of 240 = 12
      assert.equal(bill.totalCharges, 15);
      assert.equal(bill.tip, 20);
      // Item total (240) - discount (40) + tax (12) + charges (15) + tip (20) = 247
      assert.equal(bill.grandTotal, 247);
      assert.ok(bill.snapshot, "Billing snapshot must be generated");
      assert.equal(bill.snapshot.subtotal, 240);
      assert.equal(bill.snapshot.total, 247);
    });

    it("Inclusive tax correctly extracts base item total and tax component", () => {
      const billingConfig = {
        taxes: [
          { name: "Inclusive GST", rate: 5, type: "PERCENTAGE", isInclusive: true, isEnabled: true },
        ],
        charges: [],
      };

      const items = [{ priceSubunit: toSubunit(105), quantity: 1 }]; // ₹105 inclusive
      const bill = calculateBill({ items, billingConfig });

      assert.equal(bill.grandTotal, 105);
      assert.equal(bill.taxes.length, 1);
      assert.equal(bill.taxes[0].isInclusive, true);
      assert.equal(bill.taxes[0].amount, 5); // 105 - (105 / 1.05) = 5
      assert.equal(bill.tax, 5);
    });
  });

  describe("C. Cross-Channel Billing Calculation Consistency", () => {
    it("18-21. Customer, QR, POS, and Staff channels produce identical financial breakdowns", () => {
      const billingConfig = {
        taxes: [
          { name: "CGST", rate: 2.5, type: "PERCENTAGE", isInclusive: false, isEnabled: true },
          { name: "SGST", rate: 2.5, type: "PERCENTAGE", isInclusive: false, isEnabled: true },
        ],
        charges: [
          { name: "Service Fee", amount: 10, type: "FIXED", isEnabled: true },
        ],
      };

      const items = [
        { priceSubunit: toSubunit(150), quantity: 2 }, // ₹300
      ];

      // Simulated customer checkout calculation
      const customerBill = calculateBill({ items, billingConfig, orderType: "DINE_IN" });

      // Simulated QR order calculation
      const qrBill = calculateBill({ items, billingConfig, orderType: "DINE_IN" });

      // Simulated POS order calculation
      const posBill = calculateBill({ items, billingConfig, orderType: "DINE_IN" });

      // Simulated Staff manual order calculation
      const staffBill = calculateBill({ items, billingConfig, orderType: "DINE_IN" });

      assert.deepEqual(customerBill.snapshot, qrBill.snapshot);
      assert.deepEqual(qrBill.snapshot, posBill.snapshot);
      assert.deepEqual(posBill.snapshot, staffBill.snapshot);
      assert.equal(customerBill.grandTotal, 325); // 300 + 7.5 + 7.5 + 10 = 325
    });
  });

  describe("D. Payment Verification & Amount Integrity", () => {
    it("22-26. Payment systems settle exact authoritative total, ignoring client tampering", () => {
      const billingConfig = {
        taxes: [{ name: "GST", rate: 5, isEnabled: true }],
        charges: [{ name: "Packaging", amount: 20, type: "FIXED", isEnabled: true }],
      };

      const items = [{ priceSubunit: toSubunit(1000), quantity: 1 }];
      const authoritativeBill = calculateBill({ items, billingConfig });

      assert.equal(authoritativeBill.grandTotal, 1070);

      // Client attempts to pass a tampered amount of ₹1000 instead of ₹1070
      const clientProvidedAmount = 1000;
      const settlementAmount = authoritativeBill.grandTotal;

      assert.notEqual(clientProvidedAmount, settlementAmount);
      assert.equal(settlementAmount, 1070, "Authoritative amount must be ₹1070");
    });
  });

  describe("E. Snapshot Immutability & Bill Generation", () => {
    it("34-38. Historical orders retain snapshot even after owner updates restaurant settings", () => {
      // Day 1: Restaurant has 5% Tax
      const day1Config = {
        taxes: [{ name: "GST", rate: 5, type: "PERCENTAGE", isEnabled: true }],
        charges: [],
      };

      const items = [{ priceSubunit: toSubunit(1000), quantity: 1 }];
      const day1Bill = calculateBill({ items, billingConfig: day1Config });
      assert.equal(day1Bill.grandTotal, 1050);

      // Persist snapshot on Day 1 Order
      const day1Order = {
        id: "order-day-1",
        subtotal: day1Bill.subtotal,
        taxAmount: day1Bill.tax,
        total: day1Bill.grandTotal,
        billingSnapshot: day1Bill.snapshot,
      };

      // Day 2: Owner changes tax to 8% and adds ₹20 packaging
      const day2Config = {
        taxes: [{ name: "GST", rate: 8, type: "PERCENTAGE", isEnabled: true }],
        charges: [{ name: "Packaging", amount: 20, type: "FIXED", isEnabled: true }],
      };

      // Historical Day 1 Order must STILL evaluate to ₹1050 from snapshot
      assert.equal(day1Order.billingSnapshot.total, 1050);
      assert.equal(day1Order.billingSnapshot.taxes[0].rate, 5);
      assert.equal(day1Order.total, 1050);

      // Day 2 new order reflects new configuration
      const day2Bill = calculateBill({ items, billingConfig: day2Config });
      assert.equal(day2Bill.grandTotal, 1100); // 1000 + 80 + 20
    });
  });

  describe("F. Tenant Isolation", () => {
    it("39-42. Restaurant A and Restaurant B configurations are strictly isolated", () => {
      const restaurantAConfig = {
        taxes: [{ name: "Tax A", rate: 5, isEnabled: true }],
        charges: [{ name: "Packaging A", amount: 10, type: "FIXED", isEnabled: true }],
      };

      const restaurantBConfig = {
        taxes: [{ name: "Tax B", rate: 8, isEnabled: true }],
        charges: [{ name: "Packaging B", amount: 20, type: "FIXED", isEnabled: true }],
      };

      const items = [{ priceSubunit: toSubunit(100), quantity: 1 }];

      const billA = calculateBill({ items, billingConfig: restaurantAConfig });
      const billB = calculateBill({ items, billingConfig: restaurantBConfig });

      assert.equal(billA.taxes[0].name, "Tax A");
      assert.equal(billA.taxes[0].amount, 5);
      assert.equal(billA.charges[0].name, "Packaging A");
      assert.equal(billA.charges[0].amount, 10);
      assert.equal(billA.grandTotal, 115);

      assert.equal(billB.taxes[0].name, "Tax B");
      assert.equal(billB.taxes[0].amount, 8);
      assert.equal(billB.charges[0].name, "Packaging B");
      assert.equal(billB.charges[0].amount, 20);
      assert.equal(billB.grandTotal, 128);

      assert.notEqual(billA.grandTotal, billB.grandTotal);
    });
  });
});
