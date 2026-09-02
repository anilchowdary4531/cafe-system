import {
    getSupplierChatThreads,
    getThreadMessages,
    sendMessageOrOffer,
    respondToBargainOffer,
} from "../services/supplyChatService.js";
import authorizeRoles from "../middleware/rbacGuard.js";

export default async function supplyChatRoutes(app) {
    const authSupplierOrOwner = authorizeRoles("SUPPLIER", "SUPER_ADMIN", "OWNER", "MANAGER");

    const getThreadsHandler = async (req, reply) => {
        try {
            const supplierId = req.user?.supplierId || req.user?.id || 1;
            const threads = await getSupplierChatThreads(supplierId);
            return reply.code(200).send({ threads });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch chat threads" });
        }
    };

    const getMessagesHandler = async (req, reply) => {
        try {
            const { threadId } = req.params;
            const messages = await getThreadMessages(threadId);
            return reply.code(200).send({ messages });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to fetch chat messages" });
        }
    };

    const sendMessageHandler = async (req, reply) => {
        try {
            const supplierId = req.user?.supplierId || req.user?.id || 1;
            const msg = await sendMessageOrOffer({
                ...req.body,
                supplierId,
            });
            return reply.code(201).send({ message: "Message sent", data: msg });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to send message" });
        }
    };

    const respondOfferHandler = async (req, reply) => {
        try {
            const { offerId } = req.params;
            const { threadId, responseStatus, counterPrice } = req.body || {};
            const offer = await respondToBargainOffer({ threadId, offerId, responseStatus, counterPrice });
            return reply.code(200).send({ message: `Offer updated to ${responseStatus}`, offer });
        } catch (err) {
            return reply.code(500).send({ error: "Failed to respond to offer" });
        }
    };

    app.get("/supply-chat/threads", { preHandler: [authSupplierOrOwner] }, getThreadsHandler);
    app.get("/api/v1/supply-chat/threads", { preHandler: [authSupplierOrOwner] }, getThreadsHandler);

    app.get("/supply-chat/threads/:threadId/messages", { preHandler: [authSupplierOrOwner] }, getMessagesHandler);
    app.get("/api/v1/supply-chat/threads/:threadId/messages", { preHandler: [authSupplierOrOwner] }, getMessagesHandler);

    app.post("/supply-chat/messages", { preHandler: [authSupplierOrOwner] }, sendMessageHandler);
    app.post("/api/v1/supply-chat/messages", { preHandler: [authSupplierOrOwner] }, sendMessageHandler);

    app.post("/supply-chat/offers/:offerId/respond", { preHandler: [authSupplierOrOwner] }, respondOfferHandler);
    app.post("/api/v1/supply-chat/offers/:offerId/respond", { preHandler: [authSupplierOrOwner] }, respondOfferHandler);
}
