export type GeoCoords = { lat: number; lng: number; accuracy?: number };

export const DEFAULT_OFFICE_LAT = 12.91648;
export const DEFAULT_OFFICE_LNG = 77.618145;
export const DEFAULT_OFFICE_RADIUS = 100; // meters

// Maximum permissible GPS drift tolerance allowance in meters (capped tightly to prevent remote abuse)
export const MAX_GPS_DRIFT_TOLERANCE = 30; // meters
export const MAX_ACCEPTABLE_ACCURACY_RADIUS = 200; // meters

function parseFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function haversineMeters(from: GeoCoords, to: GeoCoords): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(from.lat - to.lat);
  const dLon = toRad(from.lng - to.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(to.lat)) * Math.cos(toRad(from.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isLocationCheckEnabled(settings: any): boolean {
  if (process.env.ENABLE_LOCATION_CHECK === 'false') return false;
  if (process.env.ENABLE_LOCATION_CHECK === 'true') return true;
  return Boolean(settings?.enableLocationCheck);
}

/**
 * Validates whether the user coordinates fall within the allowed physical office boundary.
 * 
 * Includes realistic GPS accuracy calibration:
 * - Checks true Haversine distance from office center.
 * - If inside the configured radius, accepts immediately.
 * - If slightly outside the radius, evaluates whether the excess distance falls within the
 *   legitimate indoor GPS confidence interval (capped up to 30m maximum drift allowance for accuracy <= 150m).
 * - Distinguishes between normal indoor building GPS drift and employees genuinely outside the office.
 */
export function assertWithinOfficeGeofence(
  settings: any,
  coords: GeoCoords | null | undefined
): { ok: true; distance?: number } | { ok: false; error: string; distance?: number } {
  if (!isLocationCheckEnabled(settings)) {
    return { ok: true };
  }

  const officeLat = parseFiniteNumber(settings?.officeLatitude) ?? parseFiniteNumber(process.env.OFFICE_LATITUDE) ?? DEFAULT_OFFICE_LAT;
  const officeLng = parseFiniteNumber(settings?.officeLongitude) ?? parseFiniteNumber(process.env.OFFICE_LONGITUDE) ?? DEFAULT_OFFICE_LNG;
  const radius = parseFiniteNumber(settings?.officeRadiusMeters) ?? parseFiniteNumber(process.env.OFFICE_RADIUS_METERS) ?? DEFAULT_OFFICE_RADIUS;

  if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number' || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return {
      ok: false,
      error: 'Location required: Please allow location access in your browser to check in.',
    };
  }

  const accuracy = typeof coords.accuracy === 'number' && Number.isFinite(coords.accuracy) ? coords.accuracy : 0;

  // Reject coarse IP-based geolocation with extreme uncertainty
  if (accuracy > MAX_ACCEPTABLE_ACCURACY_RADIUS) {
    return {
      ok: false,
      error: `Location accuracy is too low (±${Math.round(accuracy)}m). Please enable high-accuracy GPS on your device to check in.`,
    };
  }

  const rawDistance = haversineMeters(coords, { lat: officeLat, lng: officeLng });
  const distance = Math.round(rawDistance);

  // Directly inside the allowed office radius
  if (distance <= radius) {
    return { ok: true, distance };
  }

  // Account for realistic indoor building GPS drift if accuracy is within valid GPS/WiFi range (<= 150m)
  if (accuracy > 0 && accuracy <= 150) {
    const driftAllowance = Math.min(accuracy * 0.5, MAX_GPS_DRIFT_TOLERANCE);
    const effectiveDistance = Math.max(0, distance - driftAllowance);

    if (effectiveDistance <= radius) {
      return { ok: true, distance };
    }
  }

  return {
    ok: false,
    distance,
    error: `Access Denied: You are ${distance}m away from the office. You must be within the ${radius}m office radius to check in.`,
  };
}