/**
 * Tiffzy Customer Presence Manager
 * Multi-device in-memory connection tracking with PostgreSQL persistence,
 * configurable disconnect grace period, and Super Admin real-time broadcast.
 */

const DEFAULT_GRACE_MS = 45000; // 45 seconds (within 30-60s requirement)

export class CustomerPresenceManager {
  constructor({ prisma, io, staffNamespace, graceMs = null } = {}) {
    this.prisma = prisma;
    this.io = io;
    this.staffNamespace = staffNamespace;
    this.graceMs = graceMs !== null ? Number(graceMs) : (Number(process.env.CUSTOMER_PRESENCE_GRACE_MS) || DEFAULT_GRACE_MS);

    // Map: customerId (number) -> Set of socketId (string)
    this.customerSockets = new Map();
    // Map: socketId (string) -> customerId (number)
    this.socketToCustomer = new Map();
    // Map: customerId (number) -> NodeJS.Timeout
    this.disconnectTimers = new Map();
  }

  setIO(io, staffNamespace) {
    this.io = io;
    this.staffNamespace = staffNamespace;
  }

  setPrisma(prisma) {
    this.prisma = prisma;
  }

  /**
   * Reset stale online statuses on backend startup/restart.
   */
  async startupReset() {
    if (!this.prisma) return;
    try {
      await this.prisma.customerAccount.updateMany({
        where: { isOnline: true },
        data: { isOnline: false },
      });
      console.log("[CustomerPresence] Reset all stale online statuses in DB to offline on startup.");
    } catch (err) {
      console.error("[CustomerPresence] Error in startup reset:", err?.message || err);
    }
  }

  /**
   * Check if customer has at least 1 currently connected socket.
   * @param {number} customerId
   * @returns {boolean}
   */
  hasActiveSockets(customerId) {
    const id = Number(customerId);
    const sockets = this.customerSockets.get(id);
    return Boolean(sockets && sockets.size > 0);
  }

  /**
   * Get Set of all currently online canonical CustomerAccount.ids (active socket or in disconnect grace period).
   * @returns {Set<number>}
   */
  getOnlineCustomerIds() {
    const onlineIds = new Set();
    for (const [id, sockets] of this.customerSockets.entries()) {
      if (sockets && sockets.size > 0) {
        onlineIds.add(Number(id));
      }
    }
    for (const id of this.disconnectTimers.keys()) {
      onlineIds.add(Number(id));
    }
    return onlineIds;
  }

  /**
   * Check if a customer is currently online (has active socket or in disconnect grace period).
   * @param {number} customerId
   * @returns {boolean}
   */
  isCustomerOnline(customerId) {
    const id = Number(customerId);
    if (!id) return false;
    return this.getOnlineCustomerIds().has(id);
  }

  /**
   * Get total online customer count (1 customer with N devices = 1 online count).
   * @returns {number}
   */
  getOnlineCount() {
    return this.getOnlineCustomerIds().size;
  }

  /**
   * Calculate aggregate presence summary.
   * @returns {Promise<{totalCustomers: number, onlineCustomers: number, offlineCustomers: number}>}
   */
  async getPresenceCounts() {
    const onlineCustomers = this.getOnlineCount();
    let totalCustomers = 0;
    if (this.prisma) {
      try {
        totalCustomers = await this.prisma.customerAccount.count();
      } catch (err) {
        console.error("[CustomerPresence] Error counting customer accounts:", err?.message);
        totalCustomers = onlineCustomers;
      }
    } else {
      totalCustomers = onlineCustomers;
    }
    const offlineCustomers = Math.max(0, totalCustomers - onlineCustomers);
    return {
      totalCustomers,
      onlineCustomers,
      offlineCustomers,
    };
  }

  /**
   * Broadcast presence event to Super Admin rooms.
   * @param {string} eventName
   * @param {object} payload
   */
  broadcastToAdmins(eventName, payload) {
    try {
      if (this.staffNamespace) {
        this.staffNamespace.to("superadmin").emit(eventName, payload);
        this.staffNamespace.to("admin").emit(eventName, payload);
      }
      if (this.io) {
        this.io.to("superadmin").emit(eventName, payload);
        this.io.to("admin").emit(eventName, payload);
      }
    } catch (err) {
      console.error(`[CustomerPresence] Error broadcasting ${eventName}:`, err?.message);
    }
  }

  /**
   * Broadcast updated aggregate counts to Super Admin.
   */
  async broadcastPresenceCounts() {
    try {
      const counts = await this.getPresenceCounts();
      this.broadcastToAdmins("customer:presence_updated", counts);
    } catch (err) {
      console.error("[CustomerPresence] Error broadcasting counts:", err?.message);
    }
  }

  /**
   * Handle authenticated customer socket connection.
   * @param {number} customerId
   * @param {object} socket
   */
  async handleCustomerConnected(customerId, socket) {
    const cid = Number(customerId);
    const socketId = socket?.id || String(socket);
    if (!cid || !socketId) return;

    // If there was a pending disconnect timer (customer reconnecting within grace period), cancel it!
    if (this.disconnectTimers.has(cid)) {
      clearTimeout(this.disconnectTimers.get(cid));
      this.disconnectTimers.delete(cid);
      console.log(`[CustomerPresence] Customer ${cid} reconnected within grace period. Cancelled offline timer.`);
    }

    let socketSet = this.customerSockets.get(cid);
    const wasAlreadyOnline = Boolean(socketSet && socketSet.size > 0);

    if (!socketSet) {
      socketSet = new Set();
      this.customerSockets.set(cid, socketSet);
    }

    socketSet.add(socketId);
    this.socketToCustomer.set(socketId, cid);

    // Join room for this customer
    if (socket && typeof socket.join === "function") {
      socket.join(`customer_${cid}`);
      socket.join(`customer:${cid}`);
    }

    // Only update DB and emit online event if this is their first active socket (multi-device)
    if (!wasAlreadyOnline) {
      const now = new Date();
      if (this.prisma) {
        try {
          await this.prisma.customerAccount.update({
            where: { id: cid },
            data: { isOnline: true, lastSeenAt: now },
          });
        } catch (err) {
          console.error(`[CustomerPresence] Failed to update DB isOnline for customer ${cid}:`, err?.message);
        }
      }

      this.broadcastToAdmins("customer:online", {
        customerId: cid,
        isOnline: true,
        lastSeenAt: now.toISOString(),
      });

      await this.broadcastPresenceCounts();
      console.log(`[CustomerPresence] Customer ${cid} marked ONLINE (active sockets: ${socketSet.size}).`);
    } else {
      console.log(`[CustomerPresence] Customer ${cid} connected additional device (active sockets: ${socketSet.size}). Still ONLINE.`);
    }
  }

  /**
   * Handle socket disconnection.
   * @param {string} socketId
   */
  async handleCustomerDisconnected(socketId) {
    const cid = this.socketToCustomer.get(socketId);
    if (!cid) return; // Not an authenticated customer socket

    this.socketToCustomer.delete(socketId);

    const socketSet = this.customerSockets.get(cid);
    if (socketSet) {
      socketSet.delete(socketId);

      // If another socket is still active (e.g. tablet still connected while phone disconnected)
      if (socketSet.size > 0) {
        console.log(`[CustomerPresence] Customer ${cid} socket ${socketId} disconnected, but has ${socketSet.size} active socket(s). Remains ONLINE.`);
        return;
      }
    }

    // No active sockets remain: start grace period timer
    console.log(`[CustomerPresence] Customer ${cid} has 0 active sockets. Starting grace period (${this.graceMs}ms)...`);

    if (this.disconnectTimers.has(cid)) {
      clearTimeout(this.disconnectTimers.get(cid));
    }

    const timer = setTimeout(async () => {
      this.disconnectTimers.delete(cid);

      // Verify still no active sockets
      const currentSockets = this.customerSockets.get(cid);
      if (!currentSockets || currentSockets.size === 0) {
        this.customerSockets.delete(cid);
        const now = new Date();

        if (this.prisma) {
          try {
            await this.prisma.customerAccount.update({
              where: { id: cid },
              data: { isOnline: false, lastSeenAt: now },
            });
          } catch (err) {
            console.error(`[CustomerPresence] Failed to update DB offline status for customer ${cid}:`, err?.message);
          }
        }

        this.broadcastToAdmins("customer:offline", {
          customerId: cid,
          isOnline: false,
          lastSeenAt: now.toISOString(),
        });

        await this.broadcastPresenceCounts();
        console.log(`[CustomerPresence] Customer ${cid} marked OFFLINE after grace period.`);
      }
    }, this.graceMs);

    this.disconnectTimers.set(cid, timer);
  }

  /**
   * Handle explicit customer logout.
   * Cleanly disconnects all customer sockets, cancels grace period, and marks OFFLINE immediately.
   * @param {number} customerId
   */
  async handleCustomerLogout(customerId) {
    const cid = Number(customerId);
    if (!cid) return;

    if (this.disconnectTimers.has(cid)) {
      clearTimeout(this.disconnectTimers.get(cid));
      this.disconnectTimers.delete(cid);
    }

    const sockets = this.customerSockets.get(cid);
    if (sockets) {
      for (const sid of sockets) {
        this.socketToCustomer.delete(sid);
      }
      this.customerSockets.delete(cid);
    }

    const now = new Date();
    if (this.prisma) {
      try {
        await this.prisma.customerAccount.update({
          where: { id: cid },
          data: { isOnline: false, lastSeenAt: now },
        });
      } catch (err) {
        console.error(`[CustomerPresence] Logout DB update error for ${cid}:`, err?.message);
      }
    }

    this.broadcastToAdmins("customer:offline", {
      customerId: cid,
      isOnline: false,
      lastSeenAt: now.toISOString(),
    });

    await this.broadcastPresenceCounts();
    console.log(`[CustomerPresence] Customer ${cid} logged out cleanly and marked OFFLINE.`);
  }

  /**
   * Clear all memory (useful for test resets).
   */
  clear() {
    for (const [_, timer] of this.disconnectTimers.entries()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
    this.customerSockets.clear();
    this.socketToCustomer.clear();
  }
}

// Singleton instance for the application
let presenceManagerInstance = null;

export const getPresenceManager = ({ prisma, io, staffNamespace, graceMs } = {}) => {
  if (!presenceManagerInstance) {
    presenceManagerInstance = new CustomerPresenceManager({ prisma, io, staffNamespace, graceMs });
  } else {
    if (prisma) presenceManagerInstance.setPrisma(prisma);
    if (io || staffNamespace) presenceManagerInstance.setIO(io, staffNamespace);
  }
  return presenceManagerInstance;
};
