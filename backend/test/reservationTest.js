import { PrismaClient } from '@prisma/client';
import * as reservationService from '../src/services/reservationService.js';

const prisma = new PrismaClient();

async function testReservationSystem() {
    console.log("=== STARTING RESERVATION SYSTEM INTEGRATION TEST ===");
    let createdReservation = null;
    let seededTableId = null;
    let restaurantId = null;

    try {
        // 1. Get or create test restaurant and table
        const restaurant = await prisma.restaurant.findFirst();
        if (!restaurant) {
            throw new Error("No restaurant found in DB for test");
        }
        restaurantId = restaurant.id;
        console.log(`✓ Using Restaurant ID: ${restaurantId} (${restaurant.name})`);

        let table = await prisma.diningTable.findFirst({
            where: { restaurantId: restaurantId }
        });
        if (!table) {
            table = await prisma.diningTable.create({
                data: {
                    restaurantId: restaurantId,
                    tableNo: "R-TEST-1",
                    seats: 4,
                    isActive: true,
                }
            });
        }
        seededTableId = table.id;
        console.log(`✓ Using Table ID: ${table.id} (${table.tableNo})`);

        // Clean up previous test runs if any
        await prisma.reservation.deleteMany({
            where: { restaurantId, customerPhone: { in: ["+919998887776", "+919998887775"] } }
        });

        // 2. Test Availability Check
        const todayStr = new Date().toISOString().slice(0, 10);
        const startTimeStr = "19:30";
        const endTimeStr = "21:00";

        const check1 = await reservationService.checkTableAvailability({
            prisma,
            restaurantId,
            tableId: table.id,
            date: todayStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            guestCount: 2,
        });

        console.log(`✓ Availability check result: available=${check1.available}`);

        // 3. Create Reservation
        const resData = {
            tableId: table.id,
            reservationDate: todayStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            guestCount: 2,
            customerName: "Test Guest",
            customerPhone: "+919998887776",
            customerEmail: "testguest@example.com",
            notes: "Window seat preferred",
        };

        const result = await reservationService.createReservation({
            prisma,
            restaurantId,
            data: resData,
        });
        createdReservation = result.reservation;
        console.log(`✓ Reservation created: ${createdReservation.reservationNo} (Status: ${createdReservation.status})`);
        console.log(`  Linked Customer ID: ${createdReservation.customerId}`);

        // 4. Test Overlap / Double-Booking Prevention
        let overlapErrorThrown = false;
        try {
            await reservationService.createReservation({
                prisma,
                restaurantId,
                data: {
                    ...resData,
                    customerName: "Conflicting Guest",
                    customerPhone: "+919998887775",
                    startTime: "20:00", // 30 mins after 19:30, within slot
                    endTime: "21:30",
                }
            });
        } catch (err) {
            overlapErrorThrown = true;
            console.log(`✓ Overlap protection verified! Correctly blocked conflicting slot: "${err.message}"`);
        }

        if (!overlapErrorThrown) {
            throw new Error("FAILED: Overlapping reservation was NOT blocked by backend service!");
        }

        // 5. Test Check-In Status Update
        const checkedInRes = await reservationService.updateReservationStatus({
            prisma,
            restaurantId,
            reservationId: createdReservation.id,
            status: "CHECKED_IN",
        });
        console.log(`✓ Updated status to CHECKED_IN (Status: ${checkedInRes.status})`);

        // 6. Test Seating Guest (Link/Open TableSession)
        const seatResult = await reservationService.seatReservationGuest({
            prisma,
            restaurantId,
            reservationId: createdReservation.id,
            waiterName: "Test Waiter",
        });

        console.log(`✓ Seated Guest successfully! Session ID: ${seatResult.session.id}, Reservation Status: ${seatResult.reservation.status}`);

        // Clean up test data
        if (seatResult.session) {
            await prisma.tableSession.delete({ where: { id: seatResult.session.id } });
        }
        await prisma.reservation.delete({ where: { id: createdReservation.id } });
        console.log("✓ Cleaned up test reservation & session.");

        console.log("\n✅ ALL RESERVATION SYSTEM TESTS PASSED SUCCESSFULLY!");
    } catch (err) {
        console.error("❌ RESERVATION INTEGRATION TEST FAILED:", err);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

testReservationSystem();
