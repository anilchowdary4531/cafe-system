import {
    getSupplierChatThreads,
    getRestaurantChatThreads,
    canAccessChatThread,
    getThreadMessages,
    sendMessageOrOffer,
    respondToBargainOffer,
} from "../services/supplyChatService.js";
import { requireSupplyChatActor } from "../middleware/supplyAuth.js";

export default async function supplyChatRoutes(app) {
    const getThreadsHandler = async (req, reply) => {
        try {
            const actor = req.supplyChatActor;
            if (!actor) return reply.code(401).send({ error: "Unauthorized" });

            const threads = actor.type === "SUPPLIER"
                ? await getSupplierChatThreads(actor.supplierId)
                : await getRestaurantChatThreads(actor.restaurantId);
            return reply.code(200).send({ threads });
        } catch {
            return reply.code(500).send({ error: "Failed to fetch chat threads" });
        }
    };

    const getMessagesHandler = async (req, reply) => {
        try {
            const actor = req.supplyChatActor;
            const { threadId } = req.params;
            if (!canAccessChatThread(threadId, actor)) {
                return reply.code(403).send({ error: "Forbidden", message: "Access denied for this chat thread" });
            }
            const messages = await getThreadMessages(threadId);
            return reply.code(200).send({ messages });
        } catch {
            return reply.code(500).send({ error: "Failed to fetch chat messages" });
        }
    };

    const sendMessageHandler = async (req, reply) => {
        try {
            const actor = req.supplyChatActor;
            const body = req.body || {};
            const supplierId = actor.type === "SUPPLIER" ? actor.supplierId : Number(body.supplierId || 0) || null;
            const restaurantId = actor.type === "RESTAURANT" ? actor.restaurantId : Number(body.restaurantId || 0) || null;
            const targetThreadId = body.threadId || (supplierId && restaurantId ? `thread_supp_${supplierId}_rest_${restaurantId}` : null);

            if (!targetThreadId || !canAccessChatThread(targetThreadId, actor)) {
                return reply.code(403).send({ error: "Forbidden", message: "Access denied for this chat thread" });
            }

            const msg = await sendMessageOrOffer({
                ...body,
                threadId: targetThreadId,
                supplierId,
                restaurantId,
                sender: actor.type === "SUPPLIER" ? "SUPPLIER" : "CLIENT",
            });
            return reply.code(201).send({ message: "Message sent", data: msg });
        } catch (err) {
            return reply.code(err.statusCode || 500).send({ error: err.message || "Failed to send message" });
        }
    };

    const respondOfferHandler = async (req, reply) => {
        try {
            const actor = req.supplyChatActor;
            const { offerId } = req.params;
            const { threadId, responseStatus, counterPrice } = req.body || {};
            if (!threadId || !canAccessChatThread(threadId, actor)) {
                return reply.code(403).send({ error: "Forbidden", message: "Access denied for this chat thread" });
            }
            const offer = await respondToBargainOffer({ threadId, offerId, responseStatus, counterPrice });
            return reply.code(200).send({ message: `Offer updated to ${responseStatus}`, offer });
        } catch {
            return reply.code(500).send({ error: "Failed to respond to offer" });
        }
    };

    app.get("/supply-chat/threads", { preHandler: [requireSupplyChatActor] }, getThreadsHandler);
    app.get("/api/supply-chat/threads", { preHandler: [requireSupplyChatActor] }, getThreadsHandler);
    app.get("/api/v1/supply-chat/threads", { preHandler: [requireSupplyChatActor] }, getThreadsHandler);

    app.get("/supply-chat/threads/:threadId/messages", { preHandler: [requireSupplyChatActor] }, getMessagesHandler);
    app.get("/api/supply-chat/threads/:threadId/messages", { preHandler: [requireSupplyChatActor] }, getMessagesHandler);
    app.get("/api/v1/supply-chat/threads/:threadId/messages", { preHandler: [requireSupplyChatActor] }, getMessagesHandler);

    app.post("/supply-chat/messages", { preHandler: [requireSupplyChatActor] }, sendMessageHandler);
    app.post("/api/supply-chat/messages", { preHandler: [requireSupplyChatActor] }, sendMessageHandler);
    app.post("/api/v1/supply-chat/messages", { preHandler: [requireSupplyChatActor] }, sendMessageHandler);

    app.post("/supply-chat/offers/:offerId/respond", { preHandler: [requireSupplyChatActor] }, respondOfferHandler);
    app.post("/api/supply-chat/offers/:offerId/respond", { preHandler: [requireSupplyChatActor] }, respondOfferHandler);
    app.post("/api/v1/supply-chat/offers/:offerId/respond", { preHandler: [requireSupplyChatActor] }, respondOfferHandler);
}
