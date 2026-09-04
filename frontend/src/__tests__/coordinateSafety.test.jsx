import { describe, it, expect, vi } from "vitest";
import { parseAndValidateCoords } from "../components/TiffzyMapModal";

describe("Coordinate Safety & Historical Swapped Values Audit", () => {
    it("MUST NOT silently swap historical Bean House values (lat = 78.4867, lng = 17.3850)", () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const rawLat = 78.4867;
        const rawLng = 17.3850;

        const result = parseAndValidateCoords(rawLat, rawLng);

        // 1. Must retain original latitude as latitude (78.4867)
        expect(result.lat).toBe(78.4867);

        // 2. Must retain original longitude as longitude (17.3850)
        expect(result.lng).toBe(17.3850);

        // 3. Must NOT auto-swap them to (17.3850, 78.4867)
        expect(result.lat).not.toBe(17.3850);
        expect(result.lng).not.toBe(78.4867);

        // 4. Should log a warning for geographically suspicious values
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("Geographically suspicious coordinate detected")
        );

        consoleSpy.mockRestore();
    });

    it("rejects out-of-bounds latitude (< -90 or > 90)", () => {
        expect(parseAndValidateCoords(95.0, 77.5946)).toBeNull();
        expect(parseAndValidateCoords(-91.2, 77.5946)).toBeNull();
    });

    it("rejects out-of-bounds longitude (< -180 or > 180)", () => {
        expect(parseAndValidateCoords(12.9716, 185.0)).toBeNull();
        expect(parseAndValidateCoords(12.9716, -181.0)).toBeNull();
    });

    it("returns null for NULL or undefined coordinates without crashing", () => {
        expect(parseAndValidateCoords(null, null)).toBeNull();
        expect(parseAndValidateCoords(undefined, undefined)).toBeNull();
        expect(parseAndValidateCoords(null, 77.5946)).toBeNull();
        expect(parseAndValidateCoords(12.9716, null)).toBeNull();
    });

    it("correctly validates normal valid coordinates (e.g. Bengaluru 12.9716, 77.5946)", () => {
        const result = parseAndValidateCoords(12.9716, 77.5946);
        expect(result).toEqual({ lat: 12.9716, lng: 77.5946 });
    });
});
