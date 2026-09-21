/**
 * IndexedDB Local Database Wrapper for Tiffzy POS Offline Storage
 * DB Name: TiffzyPOSOfflineDB
 * Version: 1
 * Stores:
 *  - offlineMenu: Cached menu items, categories, variants, modifiers, tax rates.
 *  - offlineTables: Cached dining tables & active session state.
 *  - offlineOrders: Locally created & pending offline orders.
 *  - offlineOperations: Queued offline mutations to synchronize when online.
 *  - offlineIdMap: Mappings from temporary client UUIDs to server IDs.
 */

const DB_NAME = "TiffzyPOSOfflineDB";
const DB_VERSION = 1;

let dbPromise = null;

function getDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            console.warn("IndexedDB not available in browser env. Falling back to in-memory.");
            resolve(null);
            return;
        }

        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (evt) => {
            const db = evt.target.result;

            if (!db.objectStoreNames.contains("offlineMenu")) {
                db.createObjectStore("offlineMenu", { keyPath: "key" });
            }
            if (!db.objectStoreNames.contains("offlineTables")) {
                db.createObjectStore("offlineTables", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("offlineOrders")) {
                db.createObjectStore("offlineOrders", { keyPath: "localOrderId" });
            }
            if (!db.objectStoreNames.contains("offlineOperations")) {
                const opStore = db.createObjectStore("offlineOperations", { keyPath: "operationId" });
                opStore.createIndex("status", "status", { unique: false });
                opStore.createIndex("createdAt", "createdAt", { unique: false });
            }
            if (!db.objectStoreNames.contains("offlineIdMap")) {
                db.createObjectStore("offlineIdMap", { keyPath: "clientTempId" });
            }
        };

        req.onsuccess = (evt) => resolve(evt.target.result);
        req.onerror = (evt) => {
            console.error("IndexedDB open error:", evt.target.error);
            reject(evt.target.error);
        };
    });

    return dbPromise;
}

// -------------------------------------------------------------------
// GENERIC INDEXEDDB HELPER UTILITIES
// -------------------------------------------------------------------

export async function dbPut(storeName, value) {
    const db = await getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function dbGet(storeName, key) {
    const db = await getDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

export async function dbGetAll(storeName) {
    const db = await getDb();
    if (!db) return [];
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

export async function dbDelete(storeName, key) {
    const db = await getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function dbClear(storeName) {
    const db = await getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// -------------------------------------------------------------------
// DOMAIN-SPECIFIC POS STORAGE HELPERS
// -------------------------------------------------------------------

// 1. MENU CACHE
export async function cacheMenuOffline(restaurantId, menuData) {
    await dbPut("offlineMenu", {
        key: `menu_${restaurantId}`,
        restaurantId,
        data: menuData,
        cachedAt: Date.now(),
    });
}

export async function getOfflineMenu(restaurantId) {
    const entry = await dbGet("offlineMenu", `menu_${restaurantId}`);
    return entry?.data || null;
}

// 2. TABLES & SESSIONS SNAPSHOT
export async function cacheTablesOffline(restaurantId, tablesList, activeSessionsMap = {}) {
    await dbPut("offlineMenu", {
        key: `tables_${restaurantId}`,
        restaurantId,
        tables: tablesList,
        activeSessions: activeSessionsMap,
        cachedAt: Date.now(),
    });
}

export async function getOfflineTables(restaurantId) {
    const entry = await dbGet("offlineMenu", `tables_${restaurantId}`);
    return entry || { tables: [], activeSessions: {} };
}

// 3. OFFLINE OPERATIONS QUEUE
export async function queueOfflineOperation({ type, restaurantId, payload }) {
    const operationId = `OP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const op = {
        operationId,
        clientOperationId: operationId,
        type,
        restaurantId: Number(restaurantId),
        payload,
        createdAt: Date.now(),
        status: "PENDING", // PENDING | SYNCING | SYNCED | FAILED | CONFLICT
        retryCount: 0,
        error: null,
    };
    await dbPut("offlineOperations", op);
    return op;
}

export async function getPendingOfflineOperations() {
    const ops = await dbGetAll("offlineOperations");
    return ops
        .filter((o) => o.status === "PENDING" || o.status === "FAILED")
        .sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateOfflineOperationStatus(operationId, updates) {
    const existing = await dbGet("offlineOperations", operationId);
    if (!existing) return;
    const next = { ...existing, ...updates };
    await dbPut("offlineOperations", next);
}

// 4. OFFLINE ORDERS
export async function saveOfflineOrder(order) {
    await dbPut("offlineOrders", order);
}

export async function getOfflineOrders() {
    return await dbGetAll("offlineOrders");
}

// 5. CLIENT-TO-SERVER ID MAPPING
export async function setServerIdMapping(clientTempId, serverId) {
    await dbPut("offlineIdMap", { clientTempId, serverId, mappedAt: Date.now() });
}

export async function getServerIdMapping(clientTempId) {
    const entry = await dbGet("offlineIdMap", clientTempId);
    return entry?.serverId || null;
}
