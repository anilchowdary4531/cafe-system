import { getOrCreateActiveSession } from "./tableSessionService.js";

/**
 * Helper to convert "HH:MM" (e.g. "19:30") to total minutes from midnight
 */
function timeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return 0;
    const [h, m] = timeStr.split(":").map((n) => parseInt(n, 10) || 0);
    return h * 60 + m;
}

/**
 * 1. CHECK TABLE AVAILABILITY & CONFLICT PREVENTION
 * Checks if table is available for given date, start time, and end time.
 * Enforces turnover buffer minutes (default 15 mins).
 */
export const checkTableAvailability = async ({
    prisma,
    restaurantId,
    tableId = null,
    date,
    startTime,
    endTime,
    bufferMinutes = 15,
    excludeReservationId = null,
} = {}) => {
    const rid = Number(restaurantId);
    if (!rid || !date || !startTime || !endTime) {
        const err = new Error("restaurantId, date, startTime, and endTime are required");
        err.code = "invalid_input";
        throw err;
    }

    const reqDate = new Date(date);
    reqDate.setHours(0, 0, 0, 0);

    const reqStartMin = timeToMinutes(startTime);
    let reqEndMin = timeToMinutes(endTime);
    if (reqEndMin <= reqStartMin) {
        reqEndMin = reqStartMin + 90; // default 90 min duration if invalid
    }

    // Apply buffer
    const reqStartWithBuffer = Math.max(0, reqStartMin - bufferMinutes);
    const reqEndWithBuffer = reqEndMin + bufferMinutes;

    // Fetch Table info if tableId provided
    let table = null;
    if (tableId) {
        table = await prisma.diningTable.findFirst({
            where: { id: Number(tableId), restaurantId: rid, isActive: true },
        });
        if (!table) {
            const err = new Error("Specified table not found or inactive");
            err.code = "table_not_found";
            throw err;
        }
    }

    // Fetch existing active reservations for table on that date
    const whereClause = {
        restaurantId: rid,
        reservationDate: reqDate,
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "SEATED"] },
    };

    if (tableId) {
        whereClause.tableId = Number(tableId);
    }
    if (excludeReservationId) {
        whereClause.id = { not: Number(excludeReservationId) };
    }

    const existingReservations = await prisma.reservation.findMany({
        where: whereClause,
        include: { table: true },
    });

    const conflicting = [];
    for (const res of existingReservations) {
        const resStartMin = timeToMinutes(res.startTime);
        const resEndMin = timeToMinutes(res.endTime);

        // Interval overlap formula: existing.start < requested.end AND existing.end > requested.start
        if (resStartMin < reqEndWithBuffer && resEndMin > reqStartWithBuffer) {
            conflicting.push(res);
        }
    }

    if (tableId && conflicting.length > 0) {
        return {
            available: false,
            reason: "OVERLAP",
            conflictingReservations: conflicting,
            message: `Table ${table.tableNo} is already reserved between ${conflicting[0].startTime} and ${conflicting[0].endTime}.`,
            table,
        };
    }

    return {
        available: true,
        conflictingReservations: conflicting,
        table,
    };
};

/**
 * 2. CREATE RESERVATION
 * Validates availability, creates/links Customer record by phone, assigns RES-XXXXXX sequence.
 */
export const createReservation = async ({
    prisma,
    restaurantId,
    data = {},
    actor = null,
} = {}) => {
    const rid = Number(restaurantId);
    const {
        tableId,
        reservationDate,
        startTime,
        endTime,
        guestCount = 1,
        customerName,
        customerPhone,
        customerEmail = null,
        notes = null,
        source = "POS",
        status = "CONFIRMED",
        clientOperationId = null,
    } = data;

    if (!rid || !reservationDate || !startTime || !endTime || !customerName || !customerPhone) {
        const err = new Error("restaurantId, reservationDate, startTime, endTime, customerName, and customerPhone are required");
        err.code = "invalid_input";
        throw err;
    }

    // Check clientOperationId idempotency
    if (clientOperationId) {
        const existing = await prisma.reservation.findUnique({
            where: { clientOperationId: String(clientOperationId) },
            include: { table: true, customer: true, tableSession: true },
        });
        if (existing) {
            return { reservation: existing, idempotentRetried: true };
        }
    }

    const targetTableId = tableId ? Number(tableId) : null;
    const reqDate = new Date(reservationDate);
    reqDate.setHours(0, 0, 0, 0);

    // Verify availability if table assigned
    if (targetTableId) {
        const check = await checkTableAvailability({
            prisma,
            restaurantId: rid,
            tableId: targetTableId,
            date: reqDate,
            startTime,
            endTime,
        });

        if (!check.available) {
            const err = new Error(check.message || "Table is unavailable for requested time slot");
            err.code = "table_unavailable";
            err.conflictingReservations = check.conflictingReservations;
            throw err;
        }

        // Validate table capacity warning
        if (check.table && Number(guestCount) > check.table.seats) {
            console.warn(`[Reservation] Warning: guest count (${guestCount}) exceeds table ${check.table.tableNo} capacity (${check.table.seats}).`);
        }
    }

    return await prisma.$transaction(async (tx) => {
        // Auto-link or create Customer by phone
        const cleanPhone = String(customerPhone).trim();
        let customer = await tx.customer.findUnique({
            where: { restaurantId_phone: { restaurantId: rid, phone: cleanPhone } },
        });

        if (!customer) {
            customer = await tx.customer.create({
                data: {
                    restaurantId: rid,
                    name: String(customerName).trim(),
                    phone: cleanPhone,
                    email: customerEmail ? String(customerEmail).trim() : null,
                },
            });
        } else if (customerName && (!customer.name || customer.name !== String(customerName).trim())) {
            // Update customer name if provided
            customer = await tx.customer.update({
                where: { id: customer.id },
                data: { name: String(customerName).trim() },
            });
        }

        // Generate authoritative sequence
        const lastRes = await tx.reservation.findFirst({
            where: { restaurantId: rid },
            orderBy: { id: "desc" },
        });
        const seq = (lastRes?.id || 0) + 1001;
        const reservationNo = `RES-${String(seq).padStart(6, "0")}`;

        const newReservation = await tx.reservation.create({
            data: {
                restaurantId: rid,
                reservationNo,
                tableId: targetTableId,
                customerId: customer.id,
                reservationDate: reqDate,
                startTime,
                endTime,
                guestCount: Number(guestCount || 1),
                customerName: String(customerName).trim(),
                customerPhone: cleanPhone,
                customerEmail: customerEmail ? String(customerEmail).trim() : null,
                notes: notes ? String(notes).trim() : null,
                status,
                source,
                createdById: actor?.userId || null,
                createdByName: actor?.userName || null,
                clientOperationId: clientOperationId ? String(clientOperationId) : null,
            },
            include: {
                table: true,
                customer: true,
                tableSession: true,
            },
        });

        return { reservation: newReservation, customer };
    });
};

/**
 * 3. UPDATE RESERVATION
 */
export const updateReservation = async ({
    prisma,
    restaurantId,
    reservationId,
    data = {},
    actor = null,
} = {}) => {
    const rid = Number(restaurantId);
    const resid = Number(reservationId);

    const existing = await prisma.reservation.findFirst({
        where: { id: resid, restaurantId: rid },
    });
    if (!existing) {
        const err = new Error("Reservation not found");
        err.code = "reservation_not_found";
        throw err;
    }

    const nextTableId = data.tableId !== undefined ? (data.tableId ? Number(data.tableId) : null) : existing.tableId;
    const nextDate = data.reservationDate ? new Date(data.reservationDate) : existing.reservationDate;
    nextDate.setHours(0, 0, 0, 0);
    const nextStart = data.startTime || existing.startTime;
    const nextEnd = data.endTime || existing.endTime;

    // Check availability if table/date/time modified
    if (nextTableId && (nextTableId !== existing.tableId || nextDate.getTime() !== existing.reservationDate.getTime() || nextStart !== existing.startTime || nextEnd !== existing.endTime)) {
        const check = await checkTableAvailability({
            prisma,
            restaurantId: rid,
            tableId: nextTableId,
            date: nextDate,
            startTime: nextStart,
            endTime: nextEnd,
            excludeReservationId: resid,
        });

        if (!check.available) {
            const err = new Error(check.message || "Table is unavailable for requested time slot");
            err.code = "table_unavailable";
            throw err;
        }
    }

    const updated = await prisma.reservation.update({
        where: { id: resid },
        data: {
            tableId: nextTableId,
            reservationDate: nextDate,
            startTime: nextStart,
            endTime: nextEnd,
            guestCount: data.guestCount ? Number(data.guestCount) : existing.guestCount,
            customerName: data.customerName ? String(data.customerName).trim() : existing.customerName,
            customerPhone: data.customerPhone ? String(data.customerPhone).trim() : existing.customerPhone,
            customerEmail: data.customerEmail !== undefined ? data.customerEmail : existing.customerEmail,
            notes: data.notes !== undefined ? data.notes : existing.notes,
            status: data.status || existing.status,
        },
        include: { table: true, customer: true, tableSession: true },
    });

    return updated;
};

/**
 * 4. UPDATE RESERVATION STATUS (CHECKED_IN, CANCELLED, NO_SHOW, etc.)
 */
export const updateReservationStatus = async ({
    prisma,
    restaurantId,
    reservationId,
    status,
    cancelReason = null,
    actor = null,
} = {}) => {
    const rid = Number(restaurantId);
    const resid = Number(reservationId);

    const existing = await prisma.reservation.findFirst({
        where: { id: resid, restaurantId: rid },
    });
    if (!existing) {
        const err = new Error("Reservation not found");
        err.code = "reservation_not_found";
        throw err;
    }

    const updateData = { status };
    if (status === "CHECKED_IN") {
        updateData.checkedInAt = new Date();
    } else if (status === "CANCELLED") {
        updateData.cancelledAt = new Date();
        updateData.cancelledBy = actor?.userName || "Staff";
        updateData.cancelReason = cancelReason || null;
    } else if (status === "COMPLETED") {
        updateData.completedAt = new Date();
    }

    const updated = await prisma.reservation.update({
        where: { id: resid },
        data: updateData,
        include: { table: true, customer: true, tableSession: true },
    });

    return updated;
};

/**
 * 5. SEAT RESERVATION GUEST -> OPENS / LINKS TABLE SESSION
 * Atomically opens or links active TableSession for table, transfers guest/customer context.
 */
export const seatReservationGuest = async ({
    prisma,
    restaurantId,
    reservationId,
    actor = null,
} = {}) => {
    const rid = Number(restaurantId);
    const resid = Number(reservationId);

    const reservation = await prisma.reservation.findFirst({
        where: { id: resid, restaurantId: rid },
        include: { table: true, customer: true },
    });

    if (!reservation) {
        const err = new Error("Reservation not found");
        err.code = "reservation_not_found";
        throw err;
    }

    if (!reservation.tableId) {
        const err = new Error("Cannot seat a reservation without an assigned table. Please assign a table first.");
        err.code = "no_table_assigned";
        throw err;
    }

    if (reservation.status === "CANCELLED" || reservation.status === "NO_SHOW") {
        const err = new Error(`Cannot seat a ${reservation.status} reservation`);
        err.code = "invalid_reservation_status";
        throw err;
    }

    // Open or retrieve active session on the table
    const session = await getOrCreateActiveSession({
        prisma,
        restaurantId: rid,
        tableId: reservation.tableId,
        waiterId: actor?.userId || null,
        waiterName: actor?.userName || null,
        guestCount: reservation.guestCount,
    });

    // Update Reservation status to SEATED and link tableSessionId
    const updatedReservation = await prisma.reservation.update({
        where: { id: resid },
        data: {
            tableSessionId: session.id,
            status: "SEATED",
            seatedAt: new Date(),
        },
        include: { table: true, customer: true, tableSession: true },
    });

    return {
        reservation: updatedReservation,
        session,
    };
};
