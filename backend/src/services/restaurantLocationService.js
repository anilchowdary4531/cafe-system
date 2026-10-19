/**
 * Restaurant Location Service
 * Centralized service for location-based restaurant discovery, bounding-box candidate filtering,
 * Haversine distance calculation, delivery radius eligibility, shift-based open/closed calculation,
 * and delivery ETA estimation.
 */

const EARTH_RADIUS_KM = 6371;
const KM_PER_LAT_DEGREE = 111.045;
const DEFAULT_RADIUS_KM = 5.0;
const MAX_RADIUS_KM = 100.0;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const BASE_PREP_TIME_MINUTES = 20;

/**
 * Validates GPS coordinates.
 * -90 <= latitude <= 90
 * -180 <= longitude <= 180
 *
 * @param {number|string} latitude
 * @param {number|string} longitude
 * @returns {{ latitude: number, longitude: number }}
 * @throws {Error} if invalid
 */
export const validateCoordinates = (latitude, longitude) => {
  if (latitude === undefined || latitude === null || latitude === "") {
    const err = new Error("Latitude is required.");
    err.statusCode = 400;
    throw err;
  }
  if (longitude === undefined || longitude === null || longitude === "") {
    const err = new Error("Longitude is required.");
    err.statusCode = 400;
    throw err;
  }

  const latNum = Number(latitude);
  const lngNum = Number(longitude);

  if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
    const err = new Error("Invalid latitude. Must be a finite number between -90 and 90.");
    err.statusCode = 400;
    throw err;
  }

  if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
    const err = new Error("Invalid longitude. Must be a finite number between -180 and 180.");
    err.statusCode = 400;
    throw err;
  }

  return { latitude: latNum, longitude: lngNum };
};

/**
 * Validates discovery radius and pagination options.
 */
export const validateQueryOptions = ({ radius, limit, offset } = {}) => {
  let parsedRadius = DEFAULT_RADIUS_KM;
  if (radius !== undefined && radius !== null && radius !== "") {
    const rNum = Number(radius);
    if (!Number.isFinite(rNum) || rNum <= 0) {
      const err = new Error("Invalid radius. Must be a positive number.");
      err.statusCode = 400;
      throw err;
    }
    if (rNum > MAX_RADIUS_KM) {
      const err = new Error(`Radius exceeds maximum allowed limit (${MAX_RADIUS_KM} km).`);
      err.statusCode = 400;
      throw err;
    }
    parsedRadius = rNum;
  }

  let parsedLimit = DEFAULT_LIMIT;
  if (limit !== undefined && limit !== null && limit !== "") {
    const lNum = Number(limit);
    if (!Number.isInteger(lNum) || lNum <= 0) {
      const err = new Error("Invalid limit. Must be a positive integer.");
      err.statusCode = 400;
      throw err;
    }
    parsedLimit = Math.min(lNum, MAX_LIMIT);
  }

  let parsedOffset = 0;
  if (offset !== undefined && offset !== null && offset !== "") {
    const oNum = Number(offset);
    if (!Number.isInteger(oNum) || oNum < 0) {
      const err = new Error("Invalid offset. Must be a non-negative integer.");
      err.statusCode = 400;
      throw err;
    }
    parsedOffset = oNum;
  }

  return { radiusKm: parsedRadius, limit: parsedLimit, offset: parsedOffset };
};

/**
 * Calculates a bounding box around (lat, lng) for a given radius in km.
 * Used to reduce the candidate set at the database query level.
 */
export const calculateBoundingBox = (lat, lng, radiusKm) => {
  const latDelta = radiusKm / KM_PER_LAT_DEGREE;
  const minLat = Math.max(-90, lat - latDelta);
  const maxLat = Math.min(90, lat + latDelta);

  // Degrees of longitude per km varies with latitude
  const latRad = (lat * Math.PI) / 180;
  const cosLat = Math.cos(latRad);

  let lngDelta;
  if (Math.abs(cosLat) < 0.017) {
    // Near poles (|lat| > 89 deg), span the full longitude range
    lngDelta = 180;
  } else {
    lngDelta = radiusKm / (KM_PER_LAT_DEGREE * cosLat);
  }

  const minLng = Math.max(-180, lng - lngDelta);
  const maxLng = Math.min(180, lng + lngDelta);

  return { minLat, maxLat, minLng, maxLng };
};

/**
 * Calculates the exact great-circle distance between two GPS coordinates using the Haversine formula.
 *
 * R = 6371 km
 * a = sin²((lat2 - lat1)/2) + cos(lat1) * cos(lat2) * sin²((lng2 - lng1)/2)
 * c = 2 * atan2(√a, √(1-a))
 * distance = R * c
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distance in kilometers
 */
export const calculateHaversineDistanceKm = (lat1, lng1, lat2, lng2) => {
  if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
    return Infinity;
  }

  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const rLat1 = lat1 * toRad;
  const rLat2 = lat2 * toRad;

  const sinDLat2 = Math.sin(dLat / 2);
  const sinDLng2 = Math.sin(dLng / 2);

  const a =
    sinDLat2 * sinDLat2 +
    Math.cos(rLat1) * Math.cos(rLat2) * sinDLng2 * sinDLng2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_KM * c;
};

/**
 * Evaluates whether a restaurant is currently open based on its shift timings and timezone.
 * Supported shifts: breakfast, lunch, dinner.
 * Supports overnight shifts where start > end (e.g. 20:00 to 02:00).
 */
export const isRestaurantOpen = (restaurant, currentTime = new Date()) => {
  if (!restaurant || restaurant.isActive === false) return false;

  const timezone = restaurant.timezone || "Asia/Kolkata";

  let localTimeStr;
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    localTimeStr = formatter.format(currentTime);
  } catch {
    // Fallback if timezone string is invalid
    const hours = String(currentTime.getUTCHours()).padStart(2, "0");
    const mins = String(currentTime.getUTCMinutes()).padStart(2, "0");
    localTimeStr = `${hours}:${mins}`;
  }

  const shifts = [
    { start: restaurant.breakfastStart, end: restaurant.breakfastEnd },
    { start: restaurant.lunchStart, end: restaurant.lunchEnd },
    { start: restaurant.dinnerStart, end: restaurant.dinnerEnd },
  ].filter((s) => s.start && s.end);

  // If no shifts are configured, default to open if restaurant is active
  if (shifts.length === 0) {
    return true;
  }

  const isTimeInShift = (startStr, endStr, timeStr) => {
    if (!startStr || !endStr) return false;
    const s = String(startStr).trim();
    const e = String(endStr).trim();
    if (s <= e) {
      // Normal shift within same day (e.g. 07:00 - 11:30)
      return timeStr >= s && timeStr < e;
    }
    // Overnight shift crossing midnight (e.g. 20:00 - 02:00)
    return timeStr >= s || timeStr < e;
  };

  return shifts.some((shift) => isTimeInShift(shift.start, shift.end, localTimeStr));
};

/**
 * Calculates estimated delivery minutes.
 * Release 1 documented assumption:
 * - Base preparation time: 20 minutes (or restaurant custom prep if provided)
 * - Travel transit time: ~6 minutes per kilometer (average ~10-15 km/h urban transit with handoff)
 * - Formula: Math.max(prepTime, Math.round(prepTime + distanceKm * 6))
 */
export const calculateEstimatedDeliveryMinutes = (distanceKm, customPrepMinutes = BASE_PREP_TIME_MINUTES) => {
  const prep = Number.isFinite(customPrepMinutes) && customPrepMinutes > 0 ? customPrepMinutes : BASE_PREP_TIME_MINUTES;
  const travel = Math.round(distanceKm * 6);
  return Math.max(prep, prep + travel);
};

/**
 * Determines sorting priority rank:
 * Priority 1: Deliverable + Open
 * Priority 2: Deliverable + Closed
 * Priority 3: Nearby but not Deliverable
 */
export const getPriorityRank = (restaurant) => {
  if (restaurant.canDeliver && restaurant.isOpen) return 1;
  if (restaurant.canDeliver && !restaurant.isOpen) return 2;
  return 3;
};

/**
 * Finds and discovers nearby restaurants for a customer location.
 *
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {number|string} params.latitude
 * @param {number|string} params.longitude
 * @param {number|string} [params.radius=5]
 * @param {number|string} [params.limit=20]
 * @param {number|string} [params.offset=0]
 * @param {boolean|string} [params.openOnly=false]
 * @param {Date} [params.referenceTime=new Date()]
 * @returns {Promise<object>} Response according to Phase 5 contract
 */
export const findNearbyRestaurants = async ({
  prisma,
  latitude,
  longitude,
  radius,
  limit,
  offset,
  openOnly = false,
  referenceTime = new Date(),
} = {}) => {
  if (!prisma) {
    throw new Error("Prisma client instance is required.");
  }

  // 1. Validate coordinates
  const { latitude: lat, longitude: lng } = validateCoordinates(latitude, longitude);

  // 2. Validate options
  const { radiusKm, limit: parsedLimit, offset: parsedOffset } = validateQueryOptions({ radius, limit, offset });
  const isOpenOnly = openOnly === true || openOnly === "true" || openOnly === "1" || openOnly === 1;

  // 3. Calculate bounding box for database candidate filtering
  const { minLat, maxLat, minLng, maxLng } = calculateBoundingBox(lat, lng, radiusKm);

  // 4. Candidate filtering at database level
  const candidates = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      latitude: {
        gte: minLat,
        lte: maxLat,
      },
      longitude: {
        gte: minLng,
        lte: maxLng,
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      latitude: true,
      longitude: true,
      deliveryRadiusKm: true,
      logoUrl: true,
      bannerUrl: true,
      addressLine1: true,
      city: true,
      state: true,
      pincode: true,
      timezone: true,
      isActive: true,
      breakfastStart: true,
      breakfastEnd: true,
      lunchStart: true,
      lunchEnd: true,
      dinnerStart: true,
      dinnerEnd: true,
    },
  });

  // 5. Compute exact distance, nearby eligibility, deliverability, open status, and ETA
  const evaluated = [];

  for (const r of candidates) {
    if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) continue;

    const exactDistanceKm = calculateHaversineDistanceKm(lat, lng, r.latitude, r.longitude);

    // Phase 6 & Phase 2: isNearby = distanceKm <= requested radiusKm
    if (exactDistanceKm > radiusKm) {
      continue;
    }

    const restaurantDeliveryRadius = Number(r.deliveryRadiusKm !== undefined && r.deliveryRadiusKm !== null ? r.deliveryRadiusKm : 5.0);
    const canDeliver = exactDistanceKm <= restaurantDeliveryRadius;
    const isOpen = isRestaurantOpen(r, referenceTime);
    const eta = calculateEstimatedDeliveryMinutes(exactDistanceKm);

    if (isOpenOnly && !isOpen) {
      continue;
    }

    evaluated.push({
      id: r.id,
      name: r.name,
      slug: r.slug,
      latitude: r.latitude,
      longitude: r.longitude,
      _rawDistanceKm: exactDistanceKm,
      deliveryRadiusKm: restaurantDeliveryRadius,
      isNearby: true,
      canDeliver,
      isOpen,
      estimatedDeliveryMinutes: eta,
      logoUrl: r.logoUrl || null,
      bannerUrl: r.bannerUrl || null,
      city: r.city || null,
      state: r.state || null,
      addressLine1: r.addressLine1 || null,
      pincode: r.pincode || null,
    });
  }

  // 6. Sort deterministically
  // Priority:
  // 1. Deliverable + open
  // 2. Deliverable + closed
  // 3. Nearby but not deliverable
  // Within each priority group: sort strictly by distanceKm ascending
  evaluated.sort((a, b) => {
    const rankDiff = getPriorityRank(a) - getPriorityRank(b);
    if (rankDiff !== 0) return rankDiff;

    const distDiff = a._rawDistanceKm - b._rawDistanceKm;
    if (Math.abs(distDiff) > 1e-6) return distDiff;

    return a.id - b.id;
  });

  const total = evaluated.length;
  const paginated = evaluated.slice(parsedOffset, parsedOffset + parsedLimit);

  // 7. Format according to Phase 5 contract
  return {
    location: {
      latitude: lat,
      longitude: lng,
    },
    radiusKm,
    count: paginated.length,
    total,
    restaurants: paginated.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      latitude: r.latitude,
      longitude: r.longitude,
      distanceKm: Number(r._rawDistanceKm.toFixed(1)),
      deliveryRadiusKm: r.deliveryRadiusKm,
      isNearby: true,
      canDeliver: r.canDeliver,
      isOpen: r.isOpen,
      estimatedDeliveryMinutes: r.estimatedDeliveryMinutes,
      logoUrl: r.logoUrl,
      bannerUrl: r.bannerUrl,
      city: r.city,
      state: r.state,
      addressLine1: r.addressLine1,
      pincode: r.pincode,
    })),
  };
};
