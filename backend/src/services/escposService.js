import net from "node:net";

// ESC/POS Commands Constants
const ESC = 0x1b;
const GS = 0x1d;

const CMD_INIT = Buffer.from([ESC, 0x40]);
const CMD_ALIGN_LEFT = Buffer.from([ESC, 0x61, 0x00]);
const CMD_ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);
const CMD_ALIGN_RIGHT = Buffer.from([ESC, 0x61, 0x02]);

const CMD_TEXT_NORMAL = Buffer.from([ESC, 0x21, 0x00]);
const CMD_TEXT_BOLD_ON = Buffer.from([ESC, 0x45, 0x01]);
const CMD_TEXT_BOLD_OFF = Buffer.from([ESC, 0x45, 0x00]);
const CMD_TEXT_DOUBLE_SIZE = Buffer.from([GS, 0x21, 0x11]); // Double height & width
const CMD_TEXT_DOUBLE_HEIGHT = Buffer.from([GS, 0x21, 0x01]);

const CMD_CUT_PAPER_FULL = Buffer.from([GS, 0x56, 0x41, 0x00]); // Full cut with feed
const CMD_LINE_FEED = Buffer.from([0x0a]);

/**
 * Format string with padding to match printer column width
 */
const formatRow = (leftText, rightText, width = 32) => {
    const left = String(leftText || "").slice(0, width - 6);
    const right = String(rightText || "");
    const spaces = Math.max(1, width - left.length - right.length);
    return `${left}${" ".repeat(spaces)}${right}\n`;
};

/**
 * Generate ESC/POS Binary Buffer for KOT Thermal Ticket
 */
export const generateKotEscposBuffer = ({ kot, paperWidth = "80mm" } = {}) => {
    const maxCols = paperWidth === "58mm" ? 32 : 48;
    const divider = "-".repeat(maxCols) + "\n";
    const buffers = [];

    // Initialize printer
    buffers.push(CMD_INIT);

    // Header: Restaurant / Station Title
    buffers.push(CMD_ALIGN_CENTER);
    buffers.push(CMD_TEXT_BOLD_ON);
    buffers.push(Buffer.from(`${String(kot.stationName || "KITCHEN ORDER TICKET").toUpperCase()}\n`));

    // KOT Number - Large & Bold
    buffers.push(CMD_TEXT_DOUBLE_SIZE);
    buffers.push(Buffer.from(`${kot.kotNo || "KOT"}\n`));
    buffers.push(CMD_TEXT_NORMAL);
    buffers.push(CMD_TEXT_BOLD_OFF);

    if (kot.priority && kot.priority !== "NORMAL") {
        buffers.push(CMD_TEXT_BOLD_ON);
        buffers.push(Buffer.from(`*** PRIORITY: ${String(kot.priority).toUpperCase()} ***\n`));
        buffers.push(CMD_TEXT_BOLD_OFF);
    }

    if (kot.type && kot.type !== "NEW") {
        buffers.push(CMD_TEXT_BOLD_ON);
        buffers.push(Buffer.from(`*** ${kot.type} ***\n`));
        buffers.push(CMD_TEXT_BOLD_OFF);
    }

    if (kot.reprintCount > 0) {
        buffers.push(Buffer.from(`*** REPRINT #${kot.reprintCount} ***\n`));
    }

    buffers.push(CMD_ALIGN_LEFT);
    buffers.push(Buffer.from(divider));

    // Metadata: Table, Waiter, Date/Time
    const tableText = kot.tableNo ? `TABLE: ${kot.tableNo}` : "TAKEAWAY / COUNTER";
    const waiterText = kot.waiterName ? `WAITER: ${kot.waiterName}` : "STAFF";
    const timeText = new Date(kot.createdAt || Date.now()).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
    });

    buffers.push(Buffer.from(formatRow(tableText, timeText, maxCols)));
    buffers.push(Buffer.from(`${waiterText}\n`));
    buffers.push(Buffer.from(divider));

    // Items Section
    buffers.push(CMD_TEXT_BOLD_ON);
    buffers.push(Buffer.from(formatRow("ITEM", "QTY", maxCols)));
    buffers.push(CMD_TEXT_BOLD_OFF);
    buffers.push(Buffer.from(divider));

    const items = Array.isArray(kot.items) ? kot.items : [];
    for (const item of items) {
        const qtyStr = `x${item.qty}`;
        buffers.push(CMD_TEXT_BOLD_ON);
        buffers.push(Buffer.from(formatRow(item.itemName, qtyStr, maxCols)));
        buffers.push(CMD_TEXT_BOLD_OFF);

        if (item.variantName) {
            buffers.push(Buffer.from(`   Size: [${item.variantName}]\n`));
        }

        const modifiers = Array.isArray(item.selectedModifiers) ? item.selectedModifiers : [];
        for (const mod of modifiers) {
            const modName = typeof mod === "string" ? mod : mod.name || mod.modifierName || "";
            if (modName) {
                buffers.push(Buffer.from(`   + ${modName}\n`));
            }
        }

        if (item.notes) {
            buffers.push(Buffer.from(`   Note: ${item.notes}\n`));
        }
    }

    buffers.push(Buffer.from(divider));

    if (kot.notes) {
        buffers.push(CMD_TEXT_BOLD_ON);
        buffers.push(Buffer.from(`NOTES: ${kot.notes}\n`));
        buffers.push(CMD_TEXT_BOLD_OFF);
        buffers.push(Buffer.from(divider));
    }

    // Footer & Paper Cut
    buffers.push(CMD_LINE_FEED);
    buffers.push(CMD_LINE_FEED);
    buffers.push(CMD_CUT_PAPER_FULL);

    return Buffer.concat(buffers);
};

/**
 * Send raw binary ESC/POS buffer over TCP socket to network printer port 9100
 */
export const printToNetworkPrinter = async ({ ipAddress, port = 9100, buffer, timeoutMs = 4000 } = {}) => {
    if (!ipAddress) {
        const err = new Error("printer_ip_missing");
        err.code = "printer_ip_missing";
        throw err;
    }

    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let errorOccurred = false;

        socket.setTimeout(timeoutMs);

        socket.connect(Number(port) || 9100, String(ipAddress).trim(), () => {
            socket.write(buffer, (err) => {
                if (err) {
                    errorOccurred = true;
                    socket.destroy();
                    return reject(err);
                }
                socket.end();
            });
        });

        socket.on("close", () => {
            if (!errorOccurred) {
                resolve({ ok: true, message: "Printed successfully" });
            }
        });

        socket.on("timeout", () => {
            errorOccurred = true;
            socket.destroy();
            const err = new Error(`Connection to printer ${ipAddress}:${port} timed out`);
            err.code = "PRINTER_TIMEOUT";
            reject(err);
        });

        socket.on("error", (err) => {
            errorOccurred = true;
            socket.destroy();
            reject(err);
        });
    });
};

/**
 * Test ESC/POS Printer TCP Connection Reachability
 */
export const testPrinterConnection = async ({ ipAddress, port = 9100, timeoutMs = 3000 } = {}) => {
    if (!ipAddress) {
        return { connected: false, message: "IP Address required" };
    }

    const startTime = Date.now();
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeoutMs);

        socket.connect(Number(port) || 9100, String(ipAddress).trim(), () => {
            const latencyMs = Date.now() - startTime;
            socket.destroy();
            resolve({ connected: true, latencyMs, message: `Connected in ${latencyMs}ms` });
        });

        socket.on("timeout", () => {
            socket.destroy();
            resolve({ connected: false, message: "Connection timed out" });
        });

        socket.on("error", (err) => {
            socket.destroy();
            resolve({ connected: false, message: err?.message || "Printer unreachable" });
        });
    });
};
