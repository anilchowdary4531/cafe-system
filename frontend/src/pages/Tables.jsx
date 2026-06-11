import { useMemo } from "react";
import useCachedGet from "../hooks/useCachedGet";

export default function Tables() {
    const user = (() => {
        try {
            return JSON.parse(localStorage.getItem("user")) || {};
        } catch {
            return {};
        }
    })();

    const params = useMemo(() => (user?.restaurantId ? { restaurantId: user.restaurantId } : {}), [user?.restaurantId]);
    const { data } = useCachedGet("/tables", { params, ttlMs: 15_000, staleMs: 2 * 60_000 });
    const tables = Array.isArray(data) ? data : [];

    const qrImageUrl = (targetUrl) =>
        `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(targetUrl)}`;

    const buildMenuUrl = (slug, tableNo) => {
        const safeSlug = String(slug || "").trim() || "restaurant";
        const safeTable = String(tableNo || "").trim();
        const path = `/m/${encodeURIComponent(safeSlug)}/${encodeURIComponent(safeTable)}`;
        const base = typeof window !== "undefined" ? window.location.origin : "";
        return base ? `${base}${path}` : path;
    };

    const buildDebugMenuUrl = (slug, tableNo) => {
        const safeSlug = String(slug || "").trim() || "restaurant";
        const safeTable = String(tableNo || "").trim();
        const path = `/debug/menu/${encodeURIComponent(safeSlug)}/${encodeURIComponent(safeTable)}`;
        const base = typeof window !== "undefined" ? window.location.origin : "";
        return base ? `${base}${path}` : path;
    };

    return (
        <div className="ml-64 p-6">
            <h1 className="text-xl mb-4">Tables</h1>

            <div className="grid grid-cols-4 gap-4">
                {tables.map((table) => {
                    const target = table.qrCodeUrl || buildMenuUrl(table.restaurant?.slug, table.tableNo);
                    const debugTarget = buildDebugMenuUrl(table.restaurant?.slug, table.tableNo);
                    return (
                        <div key={table.id} className="bg-[#1a2333] p-4 rounded text-center">
                            <p>Table {table.tableNo}</p>
                            <p className="text-sm text-gray-400">{table.seats} seats</p>

                            <img
                                src={qrImageUrl(target)}
                                className="mt-2"
                                alt={`${table.tableNo} QR`}
                            />

                            <a
                                href={debugTarget}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
                            >
                                Open debug link
                            </a>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
