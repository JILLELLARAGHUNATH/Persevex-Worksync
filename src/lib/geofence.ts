import { prisma } from './prisma';

export type GeoCoords = { lat: number; lng: number; accuracy?: number };

export const DEFAULT_OFFICE_LAT = 12.91648;
export const DEFAULT_OFFICE_LNG = 77.618145;
export const DEFAULT_OFFICE_RADIUS = 100; // meters

let cachedSettings: any = null;
let lastSettingsFetchTime = 0;
const SETTINGS_CACHE_TTL_MS = 15000; // 15 seconds

export async function getCachedOfficeSettings(): Promise<any> {
  const now = Date.now();
  if (cachedSettings && now - lastSettingsFetchTime < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings;
  }
  try {
    const fresh = await prisma.systemSetting.findUnique({
      where: { id: 'global_config' },
    });
    cachedSettings = fresh;
    lastSettingsFetchTime = now;
    return fresh;
  } catch (err) {
    if (cachedSettings) return cachedSettings;
    throw err;
  }
}

export function invalidateOfficeSettingsCache(): void {
  cachedSettings = null;
  lastSettingsFetchTime = 0;
}

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
  return Boolean(settings?.enableLocationCheck);
}

/**
 * Validates whether the user coordinates fall within the allowed physical office boundary.
 * 
 * Rules:
 * - Reads live configured officeLatitude, officeLongitude, and officeRadiusMeters from DB settings.
 * - Calculates true Haversine distance in meters.
 * - Uses the saved Manager Settings record as the authoritative policy; it never
 *   silently falls back to environment or sample coordinates while enforcement is on.
 * - Strictly rejects any location whose actual Haversine distance exceeds the
 *   configured perimeter. GPS accuracy is diagnostic only and never expands
 *   the configured radius or independently rejects an in-radius fix.
 */
export function assertWithinOfficeGeofence(
  settings: any,
  coords: GeoCoords | null | undefined
): { ok: true; distance?: number } | { ok: false; error: string; distance?: number } {
  if (!isLocationCheckEnabled(settings)) {
    return { ok: true };
  }

  const officeLat = parseFiniteNumber(settings?.officeLatitude);
  const officeLng = parseFiniteNumber(settings?.officeLongitude);
  const radius = parseFiniteNumber(settings?.officeRadiusMeters);

  if (
    officeLat === null || officeLat < -90 || officeLat > 90 ||
    officeLng === null || officeLng < -180 || officeLng > 180 ||
    radius === null || radius <= 0
  ) {
    return {
      ok: false,
      error: 'Office geofence is not configured correctly. Please contact a manager.',
    };
  }

  if (
    !coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number' ||
    !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng) ||
    coords.lat < -90 || coords.lat > 90 || coords.lng < -180 || coords.lng > 180
  ) {
    return {
      ok: false,
      error: 'Location required: Please allow location access in your browser to check in.',
    };
  }

  const rawDistance = haversineMeters(coords, { lat: officeLat, lng: officeLng });
  const distance = Math.round(rawDistance);

  // Directly inside the allowed office radius
  if (rawDistance <= radius) {
    return { ok: true, distance };
  }

  return {
    ok: false,
    distance,
    error: `Access Denied: You are ${distance}m away from the office. You must be within the ${radius}m office radius to check in.`,
  };
}
