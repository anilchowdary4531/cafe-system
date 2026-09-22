import {
    getReservationsController,
    checkAvailabilityController,
    createReservationController,
    getReservationByIdController,
    updateReservationController,
    checkInReservationController,
    seatReservationController,
    cancelReservationController,
    noShowReservationController,
} from "../controllers/reservationController.js";

export default async function reservationRoutes(fastify) {
    // List & Search
    fastify.get("/reservations", getReservationsController);
    fastify.get("/owner/:restaurantId/reservations", getReservationsController);

    // Availability Check
    fastify.get("/reservations/availability", checkAvailabilityController);
    fastify.get("/owner/:restaurantId/reservations/availability", checkAvailabilityController);

    // Create
    fastify.post("/reservations", createReservationController);
    fastify.post("/owner/:restaurantId/reservations", createReservationController);

    // Single Details & Edit
    fastify.get("/reservations/:id", getReservationByIdController);
    fastify.get("/owner/:restaurantId/reservations/:id", getReservationByIdController);

    fastify.put("/reservations/:id", updateReservationController);
    fastify.put("/owner/:restaurantId/reservations/:id", updateReservationController);

    // Lifecycle Actions
    fastify.post("/reservations/:id/check-in", checkInReservationController);
    fastify.post("/owner/:restaurantId/reservations/:id/check-in", checkInReservationController);

    fastify.post("/reservations/:id/seat", seatReservationController);
    fastify.post("/owner/:restaurantId/reservations/:id/seat", seatReservationController);

    fastify.post("/reservations/:id/cancel", cancelReservationController);
    fastify.post("/owner/:restaurantId/reservations/:id/cancel", cancelReservationController);

    fastify.post("/reservations/:id/no-show", noShowReservationController);
    fastify.post("/owner/:restaurantId/reservations/:id/no-show", noShowReservationController);
}
