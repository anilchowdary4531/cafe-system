/**
 * Staff Attendance Service
 * Handles GPS Geofenced Clock-In/Out, Attendance Logs, and Correction Workflows.
 */

/**
 * Calculate distance between two GPS coordinates using Haversine Formula (returns distance in meters)
 */
export const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;

    const R = 6371e3; // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

/**
 * Clock In Staff Member with GPS Verification
 */
export const clockInStaff = async ({ prisma, restaurantId, userId, lat, lng, allowedRadiusMeters = 200 } = {}) => {
    const rid = Number(restaurantId);
    const uid = Number(userId);
    if (!rid || !uid) throw new Error("Invalid parameters");

    // 1. Check active duty session
    const active = await prisma.staffAttendance.findFirst({
        where: { restaurantId: rid, userId: uid, status: "ON_DUTY" },
    });

    if (active) {
        const activeErr = new Error("ALREADY_ON_DUTY: You are already clocked in.");
        activeErr.statusCode = 400;
        throw activeErr;
    }

    // 2. Fetch Restaurant location coordinates for geofence check
    const restaurant = await prisma.restaurant.findUnique({
        where: { id: rid },
        select: { latitude: true, longitude: true },
    });

    let isGeofenced = true;
    if (restaurant?.latitude && restaurant?.longitude && lat && lng) {
        const dist = calculateDistanceMeters(lat, lng, restaurant.latitude, restaurant.longitude);
        if (dist > allowedRadiusMeters) {
            const geoErr = new Error(`GEOFENCE_FAILED: You are ${Math.round(dist)}m away from restaurant location (Max allowed: ${allowedRadiusMeters}m).`);
            geoErr.statusCode = 400;
            throw geoErr;
        }
    } else {
        isGeofenced = false;
    }

    const clockInTime = new Date();

    return await prisma.staffAttendance.create({
        data: {
            restaurantId: rid,
            userId: uid,
            clockInTime,
            clockInLat: lat ? Number(lat) : null,
            clockInLng: lng ? Number(lng) : null,
            isGeofenced,
            status: "ON_DUTY",
        },
        include: {
            user: { select: { id: true, name: true, role: true } },
        },
    });
};

/**
 * Clock Out Staff Member
 */
export const clockOutStaff = async ({ prisma, restaurantId, userId, lat, lng } = {}) => {
    const rid = Number(restaurantId);
    const uid = Number(userId);
    if (!rid || !uid) throw new Error("Invalid parameters");

    const active = await prisma.staffAttendance.findFirst({
        where: { restaurantId: rid, userId: uid, status: "ON_DUTY" },
    });

    if (!active) {
        const err = new Error("NOT_ON_DUTY: No active clock-in session found.");
        err.statusCode = 400;
        throw err;
    }

    const clockOutTime = new Date();
    const totalMinutes = Math.max(1, Math.round((clockOutTime.getTime() - new Date(active.clockInTime).getTime()) / (1000 * 60)));

    return await prisma.staffAttendance.update({
        where: { id: active.id },
        data: {
            clockOutTime,
            clockOutLat: lat ? Number(lat) : null,
            clockOutLng: lng ? Number(lng) : null,
            totalMinutes,
            status: "COMPLETED",
        },
        include: {
            user: { select: { id: true, name: true, role: true } },
        },
    });
};

/**
 * Fetch Attendance Logs for Owner/Manager
 */
export const getAttendanceLogs = async ({ prisma, restaurantId, startDate, endDate, userId, status } = {}) => {
    const rid = Number(restaurantId);
    if (!rid) throw new Error("restaurant_id_required");

    const where = {
        restaurantId: rid,
        ...(startDate && endDate ? {
            clockInTime: {
                gte: new Date(startDate),
                lte: new Date(endDate),
            },
        } : {}),
        ...(userId ? { userId: Number(userId) } : {}),
        ...(status ? { status: String(status).toUpperCase() } : {}),
    };

    return await prisma.staffAttendance.findMany({
        where,
        include: {
            user: { select: { id: true, name: true, role: true, designation: true } },
            corrections: {
                include: { user: { select: { id: true, name: true } } },
            },
        },
        orderBy: { clockInTime: "desc" },
    });
};

/**
 * Submit Attendance Correction Request
 */
export const requestAttendanceCorrection = async ({ prisma, attendanceId, userId, requestedIn, requestedOut, reason } = {}) => {
    const attId = Number(attendanceId);
    const uid = Number(userId);
    if (!attId || !uid || !requestedIn || !requestedOut || !reason) {
        throw new Error("Missing required parameters for attendance correction");
    }

    return await prisma.attendanceCorrection.create({
        data: {
            attendanceId: attId,
            userId: uid,
            requestedIn: new Date(requestedIn),
            requestedOut: new Date(requestedOut),
            reason: String(reason),
            status: "PENDING",
        },
    });
};

/**
 * Review Attendance Correction (Approve or Reject)
 */
export const reviewAttendanceCorrection = async ({ prisma, correctionId, reviewerId, approve, reviewNotes } = {}) => {
    const corId = Number(correctionId);
    if (!corId) throw new Error("correction_id_required");

    const correction = await prisma.attendanceCorrection.findUnique({
        where: { id: corId },
        include: { attendance: true },
    });

    if (!correction) throw new Error("correction_not_found");

    const status = approve ? "APPROVED" : "REJECTED";

    if (approve && correction.attendance) {
        const reqIn = new Date(correction.requestedIn);
        const reqOut = new Date(correction.requestedOut);
        const totalMinutes = Math.max(1, Math.round((reqOut.getTime() - reqIn.getTime()) / (1000 * 60)));

        await prisma.staffAttendance.update({
            where: { id: correction.attendanceId },
            data: {
                clockInTime: reqIn,
                clockOutTime: reqOut,
                totalMinutes,
                status: "COMPLETED",
            },
        });
    }

    return await prisma.attendanceCorrection.update({
        where: { id: corId },
        data: {
            status,
            reviewedBy: reviewerId ? Number(reviewerId) : null,
            reviewNotes: reviewNotes ? String(reviewNotes) : null,
        },
    });
};
