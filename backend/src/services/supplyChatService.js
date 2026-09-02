import prisma from "../prisma.js";

// In-memory persistent fallback store for fast real-time B2B chat threads & bargain offers
const chatThreadsStore = new Map();
const chatMessagesStore = new Map();

// Helper to seed initial sample B2B bargain conversations for demo & testing
function seedInitialThreads(supplierId = 1) {
    const thread1Id = `thread_supp_${supplierId}_rest_1`;
    const thread2Id = `thread_supp_${supplierId}_rest_2`;

    if (!chatThreadsStore.has(thread1Id)) {
        chatThreadsStore.set(thread1Id, {
            id: thread1Id,
            supplierId: Number(supplierId),
            clientName: "Bean House Cafe (Restaurant #1)",
            clientType: "RESTAURANT",
            clientId: 1,
            lastMessage: "Hi, can we get 100 KG Fresh Chicken Breast at ₹220/KG for bulk weekly order?",
            lastUpdated: new Date().toISOString(),
            unreadCount: 1,
        });

        chatMessagesStore.set(thread1Id, [
            {
                id: "msg_101",
                threadId: thread1Id,
                sender: "CLIENT",
                senderName: "Bean House Cafe",
                text: "Hello! We are looking for bulk raw chicken breast for our 3 cafe outlets.",
                createdAt: new Date(Date.now() - 3600000).toISOString(),
            },
            {
                id: "msg_102",
                threadId: thread1Id,
                sender: "CLIENT",
                senderName: "Bean House Cafe",
                text: "Your catalog shows ₹250/KG. Can we negotiate a weekly bulk discount?",
                type: "BARGAIN_OFFER",
                offer: {
                    id: "offer_501",
                    productName: "Fresh Premium Chicken Breast",
                    quantity: 100,
                    unit: "KG",
                    originalPrice: 250,
                    offeredPrice: 220,
                    status: "PENDING", // PENDING | ACCEPTED | REJECTED | COUNTERED
                },
                createdAt: new Date(Date.now() - 1800000).toISOString(),
            },
        ]);
    }

    if (!chatThreadsStore.has(thread2Id)) {
        chatThreadsStore.set(thread2Id, {
            id: thread2Id,
            supplierId: Number(supplierId),
            clientName: "Swarga Foods (External Wholesale Buyer)",
            clientType: "EXTERNAL_BUYER",
            clientId: 2,
            lastMessage: "Thank you! Order placed for 50 KG Dairy Butter.",
            lastUpdated: new Date(Date.now() - 7200000).toISOString(),
            unreadCount: 0,
        });

        chatMessagesStore.set(thread2Id, [
            {
                id: "msg_201",
                threadId: thread2Id,
                sender: "CLIENT",
                senderName: "Swarga Foods",
                text: "Are you able to deliver 50 KG Dairy Butter by tomorrow morning?",
                createdAt: new Date(Date.now() - 7300000).toISOString(),
            },
            {
                id: "msg_202",
                threadId: thread2Id,
                sender: "SUPPLIER",
                senderName: "Supplier Account",
                text: "Yes! Dispatch is ready. Price accepted at ₹420/KG.",
                type: "BARGAIN_OFFER",
                offer: {
                    id: "offer_502",
                    productName: "Unsalted Dairy Butter",
                    quantity: 50,
                    unit: "KG",
                    originalPrice: 450,
                    offeredPrice: 420,
                    status: "ACCEPTED",
                },
                createdAt: new Date(Date.now() - 7200000).toISOString(),
            },
        ]);
    }
}

export async function getSupplierChatThreads(supplierId) {
    const sId = Number(supplierId) || 1;
    seedInitialThreads(sId);

    const threads = Array.from(chatThreadsStore.values()).filter(
        (t) => t.supplierId === sId || t.supplierId === 1
    );

    return threads.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
}

export async function getThreadMessages(threadId) {
    if (!chatMessagesStore.has(threadId)) {
        seedInitialThreads(1);
    }
    return chatMessagesStore.get(threadId) || [];
}

export async function sendMessageOrOffer({ threadId, supplierId, sender, senderName, text, type, offer }) {
    const tId = threadId || `thread_supp_${supplierId}_rest_1`;
    if (!chatMessagesStore.has(tId)) {
        chatMessagesStore.set(tId, []);
    }

    const messages = chatMessagesStore.get(tId);
    const newMsg = {
        id: `msg_${Date.now()}`,
        threadId: tId,
        sender: sender || "SUPPLIER",
        senderName: senderName || "Supplier Account",
        text: text || "",
        type: type || "TEXT", // 'TEXT' | 'BARGAIN_OFFER'
        offer: offer
            ? {
                  id: `offer_${Date.now()}`,
                  productName: offer.productName || "Raw Material Product",
                  quantity: Number(offer.quantity) || 1,
                  unit: offer.unit || "KG",
                  originalPrice: Number(offer.originalPrice) || 100,
                  offeredPrice: Number(offer.offeredPrice) || 90,
                  status: "PENDING",
              }
            : null,
        createdAt: new Date().toISOString(),
    };

    messages.push(newMsg);
    chatMessagesStore.set(tId, messages);

    // Update thread snippet
    if (chatThreadsStore.has(tId)) {
        const thread = chatThreadsStore.get(tId);
        thread.lastMessage = type === "BARGAIN_OFFER" ? `Bargain Offer: ₹${offer?.offeredPrice}/${offer?.unit}` : text;
        thread.lastUpdated = new Date().toISOString();
        chatThreadsStore.set(tId, thread);
    }

    return newMsg;
}

export async function respondToBargainOffer({ threadId, offerId, responseStatus, counterPrice }) {
    const messages = chatMessagesStore.get(threadId) || [];
    let updatedOffer = null;

    for (const msg of messages) {
        if (msg.offer && msg.offer.id === offerId) {
            msg.offer.status = responseStatus; // 'ACCEPTED' | 'REJECTED' | 'COUNTERED'
            if (counterPrice) {
                msg.offer.counterPrice = Number(counterPrice);
            }
            updatedOffer = msg.offer;
            break;
        }
    }

    chatMessagesStore.set(threadId, messages);
    return updatedOffer;
}
