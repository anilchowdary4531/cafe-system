import {
    getWaitlistController,
    createWaitlistController,
    notifyWaitlistController,
    seatWaitlistController,
    cancelWaitlistController,
} from "../controllers/waitlistController.js";

export default async function waitlistRoutes(fastify) {
    fastify.get("/waitlist", getWaitlistController);
    fastify.get("/owner/:restaurantId/waitlist", getWaitlistController);

    fastify.post("/waitlist", createWaitlistController);
    fastify.post("/owner/:restaurantId/waitlist", createWaitlistController);

    fastify.post("/waitlist/:id/notify", notifyWaitlistController);
    fastify.post("/owner/:restaurantId/waitlist/:id/notify", notifyWaitlistController);

    fastify.post("/waitlist/:id/seat", seatWaitlistController);
    fastify.post("/owner/:restaurantId/waitlist/:id/seat", seatWaitlistController);

    fastify.post("/waitlist/:id/cancel", cancelWaitlistController);
    fastify.post("/owner/:restaurantId/waitlist/:id/cancel", cancelWaitlistController);
}
