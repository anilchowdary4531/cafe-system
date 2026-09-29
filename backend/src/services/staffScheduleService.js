/**
 * Staff Schedule Service
 * Manages staff shift schedules, conflict checking, weekly templates, and shift swaps.
 */

/**
 * Helper to check if two time ranges (HH:mm) overlap on the same date
 */
export const checkTimeOverlap = (startA, endA, startB, endB) => {
    const toMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(":").map(Number);
        return h * 60 + m;
    };

    const sA = toMinutes(startA);
    const eA = toMinutes(endA);
    const sB = toMinutes(startB);
    const eB = toMinutes(endB);

    return Math.max(sA, sB) < Math.min(eA, eB);
};

/**
 * Fetch shifts for a date range (Weekly or Monthly)
 */
export const getStaffShifts = async ({ prisma, restaurantId, startDate, endDate, userId, role, status } = {}) => {
    const rid = Number(restaurantId);
    if (!rid) throw new Error("restaurant_id_required");

    const where = {
        restaurantId: rid,
        ...(startDate && endDate ? {
            shiftDate: {
                gte: new Date(startDate),
                lte: new Date(endDate),
            },
        } : {}),
        ...(userId ? { userId: Number(userId) } : {}),
        ...(role ? { role: String(role).toUpperCase() } : {}),
        ...(status ? { status: String(status).toUpperCase() } : {}),
    };

    const shifts = await prisma.staffShift.findMany({
        where,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    designation: true,
                },
            },
            swapRequests: {
                include: {
                    requester: { select: { id: true, name: true } },
                    targetUser: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: [{ shiftDate: "asc" }, { startTime: "asc" }],
    });

    return shifts;
};

/**
 * Create or update a shift with conflict checking
 */
export const saveStaffShift = async ({
    prisma,
    restaurantId,
    shiftId = null,
    userId,
    role,
    shiftDate,
    startTime,
    endTime,
    breakMins = 30,
    notes = "",
    branchId = null,
} = {}) => {
    const rid = Number(restaurantId);
    const uid = Number(userId);
    if (!rid || !uid || !shiftDate || !startTime || !endTime) {
        throw new Error("Missing required shift parameters");
    }

    const dateObj = new Date(shiftDate);

    // 1. Conflict Check: Look for existing shifts for this user on the same date
    const existingShifts = await prisma.staffShift.findMany({
        where: {
            restaurantId: rid,
            userId: uid,
            shiftDate: dateObj,
            ...(shiftId ? { id: { not: Number(shiftId) } } : {}),
            status: { not: "CANCELLED" },
        },
    });

    const hasConflict = existingShifts.some((existing) =>
        checkTimeOverlap(startTime, endTime, existing.startTime, existing.endTime)
    );

    if (hasConflict) {
        const conflictErr = new Error("CONFLICT_DETECTED: Employee already has an overlapping shift on this day.");
        conflictErr.statusCode = 400;
        throw conflictErr;
    }

    // 2. Save or Update Shift
    if (shiftId) {
        return await prisma.staffShift.update({
            where: { id: Number(shiftId) },
            data: {
                userId: uid,
                role: String(role || "STAFF").toUpperCase(),
                shiftDate: dateObj,
                startTime,
                endTime,
                breakMins: Number(breakMins || 30),
                notes: notes ? String(notes) : null,
                branchId: branchId ? Number(branchId) : null,
            },
            include: {
                user: { select: { id: true, name: true, role: true } },
            },
        });
    }

    return await prisma.staffShift.create({
        data: {
            restaurantId: rid,
            userId: uid,
            role: String(role || "STAFF").toUpperCase(),
            shiftDate: dateObj,
            startTime,
            endTime,
            breakMins: Number(breakMins || 30),
            notes: notes ? String(notes) : null,
            branchId: branchId ? Number(branchId) : null,
            status: "DRAFT",
        },
        include: {
            user: { select: { id: true, name: true, role: true } },
        },
    });
};

/**
 * Delete / Cancel a Shift
 */
export const deleteStaffShift = async ({ prisma, restaurantId, shiftId } = {}) => {
    const rid = Number(restaurantId);
    const sid = Number(shiftId);
    if (!rid || !sid) throw new Error("Invalid parameters");

    return await prisma.staffShift.delete({
        where: { id: sid, restaurantId: rid },
    });
};

/**
 * Bulk Publish Draft Shifts for a Date Range
 */
export const publishStaffShifts = async ({ prisma, realtime, restaurantId, startDate, endDate } = {}) => {
    const rid = Number(restaurantId);
    if (!rid) throw new Error("restaurant_id_required");

    const updated = await prisma.staffShift.updateMany({
        where: {
            restaurantId: rid,
            status: "DRAFT",
            ...(startDate && endDate ? {
                shiftDate: {
                    gte: new Date(startDate),
                    lte: new Date(endDate),
                },
            } : {}),
        },
        data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
        },
    });

    if (realtime) {
        realtime.emitToRestaurant(rid, "staff:schedule_published", {
            restaurantId: rid,
            count: updated.count,
            publishedAt: new Date(),
        });
    }

    return { count: updated.count };
};

/**
 * Copy Previous Week Shifts to Target Week
 */
export const copyPreviousWeekShifts = async ({ prisma, restaurantId, sourceStartDate, targetStartDate } = {}) => {
    const rid = Number(restaurantId);
    if (!rid || !sourceStartDate || !targetStartDate) {
        throw new Error("Missing dates for copying schedule");
    }

    const srcStart = new Date(sourceStartDate);
    const srcEnd = new Date(srcStart);
    srcEnd.setDate(srcEnd.getDate() + 6);

    const tgtStart = new Date(targetStartDate);

    const sourceShifts = await prisma.staffShift.findMany({
        where: {
            restaurantId: rid,
            shiftDate: { gte: srcStart, lte: srcEnd },
            status: { not: "CANCELLED" },
        },
    });

    const newShiftsData = sourceShifts.map((shift) => {
        const dayOffset = Math.floor((new Date(shift.shiftDate).getTime() - srcStart.getTime()) / (1000 * 60 * 60 * 24));
        const newDate = new Date(tgtStart);
        newDate.setDate(newDate.getDate() + dayOffset);

        return {
            restaurantId: rid,
            branchId: shift.branchId,
            userId: shift.userId,
            role: shift.role,
            shiftDate: newDate,
            startTime: shift.startTime,
            endTime: shift.endTime,
            breakMins: shift.breakMins,
            notes: shift.notes,
            status: "DRAFT",
        };
    });

    if (newShiftsData.length > 0) {
        await prisma.staffShift.createMany({ data: newShiftsData });
    }

    return { count: newShiftsData.length };
};

/**
 * Request Peer Shift Swap
 */
export const requestShiftSwap = async ({ prisma, realtime, restaurantId, shiftId, requesterId, targetUserId } = {}) => {
    const rid = Number(restaurantId);
    const sid = Number(shiftId);
    const reqId = Number(requesterId);
    const tgtId = Number(targetUserId);

    if (!rid || !sid || !reqId || !tgtId) {
        throw new Error("Missing parameters for shift swap request");
    }

    const swap = await prisma.shiftSwapRequest.create({
        data: {
            restaurantId: rid,
            shiftId: sid,
            requesterId: reqId,
            targetUserId: tgtId,
            status: "PENDING",
        },
        include: {
            shift: true,
            requester: { select: { id: true, name: true } },
            targetUser: { select: { id: true, name: true } },
        },
    });

    if (realtime) {
        realtime.emitToRestaurant(rid, "staff:shift_swap_requested", { swap });
    }

    return swap;
};

/**
 * Respond to Shift Swap (Peer Acceptance directly reassigns the shift)
 */
export const respondToShiftSwap = async ({ prisma, realtime, restaurantId, swapId, targetUserId, accept } = {}) => {
    const rid = Number(restaurantId);
    const swId = Number(swapId);
    const tgtId = Number(targetUserId);

    const swap = await prisma.shiftSwapRequest.findFirst({
        where: { id: swId, restaurantId: rid, targetUserId: tgtId, status: "PENDING" },
        include: { shift: true },
    });

    if (!swap) throw new Error("swap_request_not_found");

    if (!accept) {
        const rejected = await prisma.shiftSwapRequest.update({
            where: { id: swId },
            data: { status: "REJECTED" },
        });

        if (realtime) {
            realtime.emitToRestaurant(rid, "staff:shift_swap_responded", { swapId: swId, status: "REJECTED" });
        }
        return rejected;
    }

    // Direct shift swap acceptance: Update shift userId to targetUserId
    await prisma.$transaction([
        prisma.staffShift.update({
            where: { id: swap.shiftId },
            data: { userId: tgtId },
        }),
        prisma.shiftSwapRequest.update({
            where: { id: swId },
            data: { status: "ACCEPTED" },
        }),
    ]);

    if (realtime) {
        realtime.emitToRestaurant(rid, "staff:shift_swap_responded", {
            swapId: swId,
            status: "ACCEPTED",
            newUserId: tgtId,
        });
    }

    return { success: true, status: "ACCEPTED" };
};
