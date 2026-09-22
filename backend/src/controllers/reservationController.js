import { prisma } from "../config/prisma.js";
import {
    checkTableAvailability,
    createReservation,
    seatReservationGuest,
    updateReservation,
    updateReservationStatus,
} from "../services/reservationService.js";

const getActor = (req) => ({
    userId: req.user?.id || req.user?.userId || null,
    userName: req.user?.name || req.user?.userName || "Staff",
    role: req.user?.role || "WAITER",
    restaurantId: req.user?.restaurantId || null,
});

const getSocketEmitter = (req) => {
    return (reservation) => {
        if (req.server?.realtime?.emitReservationUpdated) {
            req.server.realtime.emitReservationUpdated(reservation);
        } else if (req.realtime?.emitReservationUpdated) {
            req.realtime.emitReservationUpdated(reservation);
        }
    };
};

// 1. GET RESERVATIONS WITH FILTERS
export async function getReservationsController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
        const { date, status, tableId, search } = req.query || {};

        if (!restaurantId) {
            return reply.code(400).send({ success: false, message: "restaurantId is required" });
        }

        const where = { restaurantId };

        if (date) {
            const reqDate = new Date(date);
            reqDate.setHours(0, 0, 0, 0);
            const nextDate = new Date(reqDate);
            nextDate.setDate(nextDate.getDate() + 1);

            where.reservationDate = {
                gte: reqDate,
                lt: nextDate,
            };
        }

        if (status && status !== "ALL") {
            where.status = String(status).toUpperCase();
        }

        if (tableId) {
            where.tableId = Number(tableId);
        }

        if (search) {
            const q = String(search).trim();
            where.OR = [
                { customerName: { contains: q, mode: "insensitive" } },
                { customerPhone: { contains: q } },
                { reservationNo: { contains: q, mode: "insensitive" } },
            ];
        }

        const reservations = await prisma.reservation.findMany({
            where,
            include: { table: true, customer: true, tableSession: true },
            orderBy: [{ reservationDate: "asc" }, { startTime: "asc" }],
        });

        return reply.send({ success: true, count: reservations.length, reservations });
    } catch (err) {
        console.error("Error fetching reservations:", err);
        return reply.code(500).send({ success: false, message: err.message || "Failed to fetch reservations" });
    }
}

// 2. CHECK TABLE AVAILABILITY
export async function checkAvailabilityController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
        const { tableId, date, startTime, endTime, excludeReservationId } = req.query || {};

        if (!restaurantId || !date || !startTime || !endTime) {
            return reply.code(400).send({ success: false, message: "restaurantId, date, startTime, and endTime are required" });
        }

        const result = await checkTableAvailability({
            prisma,
            restaurantId,
            tableId: tableId ? Number(tableId) : null,
            date,
            startTime,
            endTime,
            excludeReservationId: excludeReservationId ? Number(excludeReservationId) : null,
        });

        return reply.send({ success: true, availability: result });
    } catch (err) {
        console.error("Error checking availability:", err);
        return reply.code(400).send({ success: false, message: err.message || "Availability check failed" });
    }
}

// 3. CREATE RESERVATION
export async function createReservationController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.body?.restaurantId || req.user?.restaurantId);
        if (!restaurantId) {
            return reply.code(400).send({ success: false, message: "restaurantId is required" });
        }

        const actor = getActor(req);
        const result = await createReservation({
            prisma,
            restaurantId,
            data: req.body || {},
            actor,
        });

        const emit = getSocketEmitter(req);
        emit(result.reservation);

        return reply.send({
            success: true,
            message: `Reservation ${result.reservation.reservationNo} created successfully`,
            reservation: result.reservation,
        });
    } catch (err) {
        console.error("Error creating reservation:", err);
        return reply.code(400).send({
            success: false,
            message: err.message || "Failed to create reservation",
            code: err.code || "reservation_failed",
            conflictingReservations: err.conflictingReservations || [],
        });
    }
}

// 4. GET SINGLE RESERVATION
export async function getReservationByIdController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
        const reservationId = Number(req.params.id);

        const reservation = await prisma.reservation.findFirst({
            where: { id: reservationId, restaurantId },
            include: { table: true, customer: true, tableSession: true },
        });

        if (!reservation) {
            return reply.code(404).send({ success: false, message: "Reservation not found" });
        }

        return reply.send({ success: true, reservation });
    } catch (err) {
        console.error("Error fetching reservation detail:", err);
        return reply.code(500).send({ success: false, message: err.message || "Failed to fetch reservation" });
    }
}

// 5. UPDATE RESERVATION
export async function updateReservationController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.body?.restaurantId || req.user?.restaurantId);
        const reservationId = Number(req.params.id);

        const actor = getActor(req);
        const updated = await updateReservation({
            prisma,
            restaurantId,
            reservationId,
            data: req.body || {},
            actor,
        });

        const emit = getSocketEmitter(req);
        emit(updated);

        return reply.send({ success: true, message: "Reservation updated successfully", reservation: updated });
    } catch (err) {
        console.error("Error updating reservation:", err);
        return reply.code(400).send({ success: false, message: err.message || "Failed to update reservation" });
    }
}

// 6. CHECK IN RESERVATION GUEST
export async function checkInReservationController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
        const reservationId = Number(req.params.id);

        const actor = getActor(req);
        const updated = await updateReservationStatus({
            prisma,
            restaurantId,
            reservationId,
            status: "CHECKED_IN",
            actor,
        });

        const emit = getSocketEmitter(req);
        emit(updated);

        return reply.send({ success: true, message: "Guest checked in successfully", reservation: updated });
    } catch (err) {
        console.error("Error checking in reservation:", err);
        return reply.code(400).send({ success: false, message: err.message || "Failed to check in guest" });
    }
}

// 7. SEAT RESERVATION GUEST -> OPENS / LINKS TABLE SESSION
export async function seatReservationController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
        const reservationId = Number(req.params.id);

        const actor = getActor(req);
        const result = await seatReservationGuest({
            prisma,
            restaurantId,
            reservationId,
            actor,
        });

        const emit = getSocketEmitter(req);
        emit(result.reservation);

        if (req.server?.realtime?.emitTableSessionUpdated) {
            req.server.realtime.emitTableSessionUpdated(result.session);
        }

        return reply.send({
            success: true,
            message: `Guest seated at Table ${result.session.tableNo}. Session #${result.session.id} active.`,
            result,
        });
    } catch (err) {
        console.error("Error seating reservation:", err);
        return reply.code(400).send({ success: false, message: err.message || "Failed to seat reservation" });
    }
}

// 8. CANCEL RESERVATION
export async function cancelReservationController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
        const reservationId = Number(req.params.id);
        const { cancelReason } = req.body || {};

        const actor = getActor(req);
        const updated = await updateReservationStatus({
            prisma,
            restaurantId,
            reservationId,
            status: "CANCELLED",
            cancelReason,
            actor,
        });

        const emit = getSocketEmitter(req);
        emit(updated);

        return reply.send({ success: true, message: "Reservation cancelled", reservation: updated });
    } catch (err) {
        console.error("Error cancelling reservation:", err);
        return reply.code(400).send({ success: false, message: err.message || "Failed to cancel reservation" });
    }
}

// 9. MARK NO-SHOW
export async function noShowReservationController(req, reply) {
    try {
        const restaurantId = Number(req.params.restaurantId || req.user?.restaurantId);
        const reservationId = Number(req.params.id);

        const actor = getActor(req);
        const updated = await updateReservationStatus({
            prisma,
            restaurantId,
            reservationId,
            status: "NO_SHOW",
            actor,
        });

        const emit = getSocketEmitter(req);
        emit(updated);

        return reply.send({ success: true, message: "Reservation marked as No-Show", reservation: updated });
    } catch (err) {
        console.error("Error marking no-show:", err);
        return reply.code(400).send({ success: false, message: err.message || "Failed to mark no-show" });
    }
}
