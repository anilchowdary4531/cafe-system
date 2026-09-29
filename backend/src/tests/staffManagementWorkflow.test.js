import test from "node:test";
import assert from "node:assert/strict";
import { checkTimeOverlap } from "../services/staffScheduleService.js";
import { calculateDistanceMeters } from "../services/staffAttendanceService.js";

test("Staff Management Workflow — Shift Time Overlap Checker", async (t) => {
    await t.test("detects overlapping shift time ranges", () => {
        // 09:00-17:00 overlaps with 12:00-15:00
        assert.equal(checkTimeOverlap("09:00", "17:00", "12:00", "15:00"), true);
        // 09:00-17:00 overlaps with 08:00-10:00
        assert.equal(checkTimeOverlap("09:00", "17:00", "08:00", "10:00"), true);
        // 09:00-17:00 overlaps with 08:00-18:00
        assert.equal(checkTimeOverlap("09:00", "17:00", "08:00", "18:00"), true);
    });

    await t.test("allows non-overlapping sequential shifts", () => {
        // 09:00-13:00 does not overlap with 13:00-17:00
        assert.equal(checkTimeOverlap("09:00", "13:00", "13:00", "17:00"), false);
        // 09:00-12:00 does not overlap with 14:00-18:00
        assert.equal(checkTimeOverlap("09:00", "12:00", "14:00", "18:00"), false);
    });
});

test("Staff Management Workflow — GPS Geofence Distance Calculator", async (t) => {
    await t.test("calculates distance between close coordinates", () => {
        // Same point -> 0 meters
        const distSame = calculateDistanceMeters(17.385044, 78.486671, 17.385044, 78.486671);
        assert.equal(Math.round(distSame), 0);

        // Nearby point within ~50m
        const distNearby = calculateDistanceMeters(17.385044, 78.486671, 17.385400, 78.486800);
        assert.ok(distNearby < 100, `Expected distance < 100m, got ${distNearby}m`);
    });

    await t.test("detects out-of-geofence distance", () => {
        // Point ~5km away
        const distFar = calculateDistanceMeters(17.385044, 78.486671, 17.435044, 78.536671);
        assert.ok(distFar > 1000, `Expected distance > 1000m, got ${distFar}m`);
    });
});
